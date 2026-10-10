import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), legacy: vi.fn(), paged: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/messages/query", () => ({ getMessagesPayload: mocks.legacy }));
vi.mock("@/lib/messages/paged-query", () => ({
  getPagedMessagesPayload: mocks.paged,
  InvalidMessageCursorError: class InvalidMessageCursorError extends Error {}
}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/email", () => ({ sendNewMessageEmail: vi.fn() }));
import { GET } from "@/app/api/messages/route";
import { InvalidMessageCursorError } from "@/lib/messages/paged-query";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "buyer-a", role: "BUYER" } });
  mocks.legacy.mockResolvedValue({ conversations: [], legacy: true });
  mocks.paged.mockResolvedValue({ conversations: [], pagination: { page: "refresh" } });
});

describe("opt-in paged messages API", () => {
  it("requires authentication before either compatibility or paged reads", async () => {
    mocks.auth.mockResolvedValue(null);
    for (const query of ["", "?paged=1"]) {
      expect((await GET(new Request(`https://example.invalid/api/messages${query}`))).status).toBe(401);
    }
    expect(mocks.legacy).not.toHaveBeenCalled();
    expect(mocks.paged).not.toHaveBeenCalled();
  });
  it("retains the existing default mobile response and forwards the authenticated identity", async () => {
    const response = await GET(new Request("https://example.invalid/api/messages?conversationId=c1&markRead=1"));
    expect(await response.json()).toEqual({ conversations: [], legacy: true });
    expect(mocks.legacy).toHaveBeenCalledWith({ currentUserId: "buyer-a", role: "BUYER", selectedConversationId: "c1", markSelectedRead: true });
    expect(mocks.paged).not.toHaveBeenCalled();
  });
  it("forwards paged parameters without trusting a user-supplied account ID", async () => {
    const response = await GET(new Request("https://example.invalid/api/messages?paged=1&page=messages&cursor=opaque&conversationId=c1&markRead=1&currentUserId=other"));
    expect(response.status).toBe(200);
    expect(mocks.paged).toHaveBeenCalledWith({ currentUserId: "buyer-a", role: "BUYER", selectedConversationId: "c1", markSelectedRead: true, page: "messages", cursor: "opaque", quoteRequestId: null, orderId: null });
    expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it("uses a generic cursor error with no ownership or existence detail", async () => {
    const error = new InvalidMessageCursorError();
    error.message = "private account details";
    mocks.paged.mockRejectedValue(error);
    const response = await GET(new Request("https://example.invalid/api/messages?paged=1&page=messages&cursor=bad"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid pagination cursor" });
  });
  it("rejects unknown collections before querying", async () => {
    const response = await GET(new Request("https://example.invalid/api/messages?paged=1&page=privateTable"));
    expect(response.status).toBe(400);
    expect(mocks.paged).not.toHaveBeenCalled();
  });
  it("does not turn failed read marking into a successful zero-unread response", async () => {
    mocks.paged.mockRejectedValue(new Error("mock read write failed"));
    await expect(GET(new Request("https://example.invalid/api/messages?paged=1&markRead=1"))).rejects.toThrow("mock read write failed");
  });
});
