import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  conversations: vi.fn(), messages: vi.fn(), quotes: vi.fn(), updateMessages: vi.fn()
}));
vi.mock("@/lib/db", () => ({ db: {
  conversation: { findMany: mocks.conversations },
  message: { findMany: mocks.messages, updateMany: mocks.updateMessages },
  quoteRequest: { findMany: mocks.quotes }
} }));
import { getMessagesPayload } from "@/lib/messages/query";
beforeEach(() => { vi.clearAllMocks(); mocks.conversations.mockResolvedValue([]); });
afterEach(() => vi.unstubAllEnvs());
describe("authenticated messages transport boundary", () => {
  it("does not publish anonymous realtime configuration even if env names are configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "mock-public-key-not-a-credential");
    const result = await getMessagesPayload({ currentUserId: "buyer-a", role: "BUYER" });
    expect(result).not.toHaveProperty("supabase");
    expect(result).toMatchObject({ conversations: [], unreadTotal: 0 });
  });
  it("keeps non-admin polling scoped to the current buyer/vendor/profile owner", async () => {
    await getMessagesPayload({ currentUserId: "buyer-a", role: "BUYER", selectedConversationId: "other-account-thread", markSelectedRead: true });
    expect(mocks.conversations).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [
      { buyerId: "buyer-a" }, { vendorId: "buyer-a" }, { vendorProfile: { userId: "buyer-a" } }
    ] } }));
    expect(mocks.updateMessages).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
    expect(mocks.quotes).not.toHaveBeenCalled();
  });
  it("uses the existing polling timer without anonymous table subscriptions", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/components/messages/messages-client.tsx"), "utf8");
    expect(source).not.toContain("@supabase/supabase-js");
    expect(source).not.toContain("postgres_changes");
    expect(source).not.toContain("payload.supabase");
    expect(source).toContain("}, 7000)");
    expect(source).toContain("window.clearInterval(interval)");
  });
});
