import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), count: vi.fn(), updateMany: vi.fn(), updateUser: vi.fn(), rate: vi.fn(), delivery: vi.fn(async () => undefined) }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { notification: { count: mocks.count, updateMany: mocks.updateMany }, user: { update: mocks.updateUser } } }));
vi.mock("@/lib/security/request", () => ({ enforceRequestRateLimit: () => null, checkServerActionRateLimit: mocks.rate }));
vi.mock("@/lib/services/party-notifications", () => ({ deliverPartyNotificationEmails: mocks.delivery }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { GET } from "@/app/api/notifications/route";
import { markNotificationsReadAction, updatePartyNotificationPreferenceAction } from "@/app/actions/notifications";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ user: { id: "recipient" } }); mocks.rate.mockResolvedValue({ ok: true }); mocks.count.mockResolvedValue(3); });
describe("notification account boundaries", () => {
  it("counts only the signed-in recipient's unread notifications without caching", async () => {
    const result = await GET(new Request("https://www.shopfia.app/api/notifications?userId=someone-else"));
    expect(await result.json()).toEqual({ unreadCount: 3 });
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.count).toHaveBeenCalledWith({ where: { userId: "recipient", readAt: null } });
  });
  it("rejects signed-out reads", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await GET(new Request("https://www.shopfia.app/api/notifications"))).status).toBe(401);
    expect(mocks.count).not.toHaveBeenCalled();
  });
  it("marks only the current recipient's inbox as read", async () => {
    await markNotificationsReadAction();
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { userId: "recipient", readAt: null }, data: { readAt: expect.any(Date) } });
  });
  it("stores email choices on the signed-in account and leaves opt-out mail unsent", async () => {
    const form = new FormData(); form.set("userId", "someone-else");
    await updatePartyNotificationPreferenceAction(form);
    expect(mocks.updateUser).toHaveBeenCalledWith({ where: { id: "recipient" }, data: { partyEmailNotifications: false } });
    expect(mocks.delivery).not.toHaveBeenCalled();
  });
});
