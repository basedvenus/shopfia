import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn(), toBuffer: vi.fn(async () => Buffer.from("optimized-image")) }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { partyPhoto: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: () => null, assertSameOrigin: () => true }));
vi.mock("sharp", () => ({ default: () => ({ rotate: () => ({ resize: () => ({ webp: () => ({ toBuffer: mocks.toBuffer }) }) }) }) }));
vi.mock("@/lib/render-party-photo", () => ({ renderPartyPhoto: mocks.toBuffer }));
import { GET } from "@/app/api/party-photos/[photoId]/route";
const read = (width = "") => GET(new Request(`https://example.test/api/party-photos/photo${width}`), { params: Promise.resolve({ photoId: "photo" }) });
const photo = { contentType: "image/gif", data: Buffer.from("GIF89a-mock"), size: 11, updatedAt: new Date("2026-01-01"), eventId: null, userId: "owner" };
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(photo); mocks.auth.mockResolvedValue(null); });
describe("party photo read authorization", () => {
  it("denies anonymous access to unattached drafts", async () => {
    const result = await read(); expect(result.status).toBe(404); expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it.each(["another-buyer", "another-vendor", "admin-user"])("denies cross-account draft access for %s", async (id) => {
    mocks.auth.mockResolvedValue({ user: { id, role: id === "admin-user" ? "ADMIN" : "BUYER" } });
    expect((await read()).status).toBe(404);
  });
  it("allows the draft owner with no public caching", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "owner" } });
    const result = await read(); expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("also keeps the owner's optimized draft private", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "owner" } });
    mocks.findUnique.mockResolvedValue({ ...photo, contentType: "image/png" });
    const result = await read("?w=800"); expect(result.status).toBe(200); expect(result.headers.get("Content-Type")).toBe("image/webp"); expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("preserves anonymous access to a photo attached to a public party", async () => {
    mocks.findUnique.mockResolvedValue({ ...photo, eventId: "public-party" });
    const result = await read(); expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toContain("no-store"); expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("returns 404 for missing photos", async () => {
    mocks.findUnique.mockResolvedValue(null); expect((await read()).status).toBe(404);
  });
});


it("allows only the party host to review a pending guest photo privately", async () => {
  mocks.findUnique.mockResolvedValue({ ...photo, userId: "guest", contribution: { status: "PENDING", event: { userId: "host" } } });
  mocks.auth.mockResolvedValue({ user: { id: "host" } });
  const result = await read();
  expect(result.status).toBe(200); expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  mocks.auth.mockResolvedValue({ user: { id: "unrelated" } });
  expect((await read()).status).toBe(404);
});


it("serves rendered pixels even when a visitor requests original=1", async () => {
  mocks.findUnique.mockResolvedValue({ ...photo, contentType: "image/png", eventId: "published-party" });
  const result = await read("?original=1");
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Type")).toBe("image/webp");
  expect(mocks.toBuffer).toHaveBeenCalled();
});

it("denies original editing pixels to anonymous visitors and other accounts", async () => {
  mocks.findUnique.mockResolvedValue({ ...photo, eventId: "published-party" });
  expect((await read("?edit=1")).status).toBe(404);
  mocks.auth.mockResolvedValue({ user: { id: "someone-else" } });
  expect((await read("?edit=1")).status).toBe(404);
});

it("allows only the owner to load private original pixels for editing", async () => {
  mocks.findUnique.mockResolvedValue({ ...photo, eventId: "published-party" });
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  const result = await read("?edit=1");
  expect(result.status).toBe(200);
  expect(result.headers.get("Content-Type")).toBe("image/gif");
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.toBuffer).not.toHaveBeenCalled();
});
