import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), paged: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/messages/paged-query", () => ({ getPagedMessagesPayload: mocks.paged }));
vi.mock("@/components/messages/messages-client", () => ({ MessagesClient: () => null }));
import MessagesPage from "@/app/messages/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "buyer-a", role: "BUYER" } });
  mocks.paged.mockResolvedValue({ conversations: [], selectedConversationId: null, unreadByConversation: {}, unreadTotal: 0,
    pagination: { page: "refresh", nextConversationCursor: null, history: null } });
});

describe("messages server page inputs", () => {
  it("does not read data before authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    await MessagesPage({});
    expect(mocks.paged).not.toHaveBeenCalled();
  });
  it("never marks a conversation read before the browser actually opens it", async () => {
    await MessagesPage({ searchParams: Promise.resolve({ conversationId: "conversation-a" }) });
    expect(mocks.paged).toHaveBeenCalledWith({ currentUserId: "buyer-a", role: "BUYER", selectedConversationId: "conversation-a", markSelectedRead: false, orderId: undefined });
  });
  it("normalizes repeated query keys instead of passing arrays into Prisma", async () => {
    await MessagesPage({ searchParams: Promise.resolve({ conversationId: ["a", "b"], payment: ["return", "canceled"], orderId: ["a", "b"] }) });
    expect(mocks.paged).toHaveBeenCalledWith(expect.objectContaining({ selectedConversationId: undefined, orderId: undefined }));
  });
  it.each(["", "x".repeat(257)])("ignores invalid payment return targets", async (orderId) => {
    await MessagesPage({ searchParams: Promise.resolve({ payment: "return", orderId }) });
    expect(mocks.paged).toHaveBeenCalledWith(expect.objectContaining({ orderId: undefined }));
  });
  it.each(["return", "canceled"])("loads the scoped historical quote for a %s checkout", async (payment) => {
    await MessagesPage({ searchParams: Promise.resolve({ conversationId: "conversation-a", payment, orderId: "order-a" }) });
    expect(mocks.paged).toHaveBeenCalledWith(expect.objectContaining({ selectedConversationId: "conversation-a", orderId: "order-a", markSelectedRead: false }));
  });
});
