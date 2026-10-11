import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), revalidate: vi.fn(), update: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { partyEvent: { updateMany: mocks.update } } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/security/request", () => ({ checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/email", () => ({ sendWelcomeEmail: vi.fn() }));
import { updatePartyCoverCropAction } from "@/app/actions/auth";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "owner" } }); mocks.rate.mockResolvedValue({ ok: true }); mocks.update.mockResolvedValue({ count: 1 }); });
describe("independent party cover crop", () => {
  it("only changes the signed-in owner's cover crop", async () => {
    expect((await updatePartyCoverCropAction("party", { x: 50, y: 20, zoom: 1 })).ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "party", userId: "owner" }, data: { coverImageCrop: { x: 50, y: 20, zoom: 1, brightness: 1, saturation: 1 } } });
  });
  it("rejects invalid crops without updating data", async () => {
    expect((await updatePartyCoverCropAction("party", { x: 500, y: 20, zoom: 1 })).ok).toBe(false); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects edits to another person's party", async () => {
    mocks.update.mockResolvedValue({ count: 0 }); expect((await updatePartyCoverCropAction("other-party", { x: 50, y: 20, zoom: 1 })).ok).toBe(false);
  });
});
