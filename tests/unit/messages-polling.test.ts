import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessagesClient } from "@/components/messages/messages-client";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), get: vi.fn(() => null) }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation
}));
vi.mock("next/link", async () => {
  const { createElement, forwardRef } = await import("react");
  return { default: forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>((props, ref) => createElement("a", { ...props, ref })) };
});
vi.mock("@/components/messages/notification-preferences", () => ({
  NotificationPreferences: () => null
}));

const roots: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("messages polling lifecycle", () => {
  it("refreshes through the scoped API every seven seconds and removes its timer on unmount", async () => {
    let tick!: () => void;
    const setInterval = vi.fn((callback: () => void) => { tick = callback; return 42; });
    const clearInterval = vi.fn();
    const payload = { conversations: [], selectedConversationId: null, unreadByConversation: {}, unreadTotal: 0 };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => payload }));
    vi.stubGlobal("window", { setInterval, clearInterval });
    vi.stubGlobal("fetch", fetchMock);
    let root!: ReactTestRenderer;
    act(() => { root = create(createElement(MessagesClient, { currentUserId: "buyer-a", initialPayload: payload })); });
    roots.push(root);

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 7000);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { tick(); });
    expect(fetchMock).toHaveBeenCalledWith("/api/messages?", { cache: "no-store" });
    expect(setInterval).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    roots.pop();
    expect(clearInterval).toHaveBeenCalledWith(42);
  });
});
