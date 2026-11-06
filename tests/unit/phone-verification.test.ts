import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizePhoneNumber } from "@/lib/phone-verification";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({revalidatePath: vi.fn()}));
const mocks = vi.hoisted(() => ({auth: vi.fn(), query: vi.fn(), execute: vi.fn(), limit: vi.fn()}));
vi.mock("@/auth", () => ({auth: mocks.auth}));
vi.mock("@/lib/db", () => ({db: {$queryRaw: mocks.query, $executeRaw: mocks.execute}}));
vi.mock("@/lib/security/request", () => ({checkServerActionRateLimit: mocks.limit}));
import { sendPhoneVerification, checkPhoneVerification } from "@/lib/services/twilio-verify";
import { confirmPhoneCodeAction, sendPhoneCodeAction } from "@/app/actions/phone-verification";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("TWILIO_API_KEY_SID", "SKtest");
  vi.stubEnv("TWILIO_API_KEY_SECRET", "test-secret");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", `VA${"a".repeat(32)}`);
  mocks.auth.mockResolvedValue({user: {id: "user-1"}});
  mocks.limit.mockResolvedValue({ok: true});
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});

describe("phone verification", () => {
  it("normalizes US and international numbers and rejects malformed values", () => {
    expect(normalizePhoneNumber("(415) 555-0123")).toBe("+14155550123");
    expect(normalizePhoneNumber("+44 20 7946 0123")).toBe("+442079460123");
    expect(normalizePhoneNumber("4155550123extra")).toBeNull();
  });
  it("sends to the configured Verify service with server-only authorization", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok: true, json: async () => ({sid: "VEtest", status: "pending"})});
    vi.stubGlobal("fetch", fetcher);
    await sendPhoneVerification("+14155550123");
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toContain("/Verifications");
    expect(request.body.get("To")).toBe("+14155550123");
    expect(request.body.get("Channel")).toBe("sms");
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("SKtest:test-secret").toString("base64")}`);
  });
  it("checks the server-stored verification SID rather than a submitted phone", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok: true, json: async () => ({sid: "VEtest", status: "approved"})});
    vi.stubGlobal("fetch", fetcher);
    await checkPhoneVerification("VEtest", "123456");
    expect(fetcher.mock.calls[0][1].body.get("VerificationSid")).toBe("VEtest");
    expect(fetcher.mock.calls[0][1].body.has("To")).toBe(false);
  });
  it("does not send without an authenticated account", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await sendPhoneCodeAction(new FormData())).ok).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("requires explicit consent before reserving a text", async () => {
    const form = new FormData(); form.set("phone", "4155550123");
    expect((await sendPhoneCodeAction(form)).ok).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it("never calls Twilio when the durable send limit rejects a request", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    mocks.query.mockResolvedValue([]);
    const form = new FormData(); form.set("phone", "4155550123"); form.set("consent", "on");
    expect((await sendPhoneCodeAction(form)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("explains Twilio recipient restrictions without exposing provider details", async () => {
    mocks.query.mockResolvedValue([{userId: "user-1"}]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: false, status: 403, json: async () => ({code: 21608, message: "private provider details"})}));
    const form = new FormData(); form.set("phone", "4155550123"); form.set("consent", "on");
    const result = await sendPhoneCodeAction(form);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not approved for testing");
    expect(result.error).not.toContain("private provider details");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects expired challenges without calling the provider", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    mocks.query.mockResolvedValue([]);
    const form = new FormData(); form.set("code", "123456");
    expect((await confirmPhoneCodeAction(form)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not mark a number verified when the provider rejects the code", async () => {
    mocks.query.mockResolvedValue([{pendingPhone: "+14155550123", pendingSid: "VEtest", requestId: "r1"}]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true, json: async () => ({sid: "VEtest", status: "pending"})}));
    const form = new FormData(); form.set("code", "000000");
    expect((await confirmPhoneCodeAction(form)).ok).toBe(false);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("saves provider-approved numbers and rejects a superseded request", async () => {
    mocks.query.mockResolvedValue([{pendingPhone: "+14155550123", pendingSid: "VEtest", requestId: "r1"}]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok: true, json: async () => ({sid: "VEtest", status: "approved"})}));
    const form = new FormData(); form.set("code", "123456");
    mocks.execute.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    expect((await confirmPhoneCodeAction(form)).ok).toBe(true);
    expect((await confirmPhoneCodeAction(form)).ok).toBe(false);
  });
});
