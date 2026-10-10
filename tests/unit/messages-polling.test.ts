import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagesClient } from "@/components/messages/messages-client";
import type { PagedMessagesPayload } from "@/lib/messages/paged-query";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), get: vi.fn((_key: string): string | null => null) }));
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

const payload: PagedMessagesPayload = {
  conversations: [], selectedConversationId: null, unreadByConversation: {}, unreadTotal: 0,
  pagination: { page: "refresh", nextConversationCursor: null, history: null }
};
const roots: ReactTestRenderer[] = [];
beforeEach(() => { vi.useFakeTimers(); navigation.get.mockReturnValue(null); });
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function setup(initialPayload: PagedMessagesPayload = payload) {
  const setInterval = vi.fn(globalThis.setInterval);
  const clearInterval = vi.fn(globalThis.clearInterval);
  const listeners = new Set<EventListener>();
  const documentMock = {
    visibilityState: "visible",
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "visibilitychange") listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "visibilitychange") listeners.delete(listener);
    })
  };
  const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({ ok: true, json: async () => payload }));
  vi.stubGlobal("window", { setInterval, clearInterval });
  vi.stubGlobal("document", documentMock);
  vi.stubGlobal("fetch", fetchMock);
  let root!: ReactTestRenderer;
  act(() => { root = create(createElement(MessagesClient, { currentUserId: "buyer-a", initialPayload })); });
  roots.push(root);
  return {
    root, setInterval, clearInterval, documentMock, fetchMock, listeners,
    async visibility(state: "hidden" | "visible") {
      documentMock.visibilityState = state;
      await act(async () => { listeners.forEach((listener) => listener(new Event("visibilitychange"))); });
    },
    unmount() { act(() => root.unmount()); roots.splice(roots.indexOf(root), 1); }
  };
}

describe("messages polling lifecycle", () => {
  it("refreshes through the paged scoped API every seven seconds and removes its timer and visibility listener", async () => {
    const view = setup();
    expect(view.setInterval).toHaveBeenCalledWith(expect.any(Function), 7000);
    expect(view.documentMock.addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    expect(view.fetchMock).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledWith("/api/messages?paged=1&page=refresh&markRead=1", {
      cache: "no-store", signal: expect.any(AbortSignal)
    });
    expect(view.setInterval).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    const interval = view.setInterval.mock.results[0].value;
    const visibilityListener = view.documentMock.addEventListener.mock.calls[0][1];
    view.unmount();
    expect(view.clearInterval).toHaveBeenCalledWith(interval);
    expect(view.documentMock.removeEventListener).toHaveBeenCalledWith("visibilitychange", visibilityListener);
    expect(view.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(21_000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
  });

  it("skips hidden-tab polling and refreshes immediately when visible without duplicating timers", async () => {
    const view = setup();
    await view.visibility("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(21_000); });
    expect(view.fetchMock).not.toHaveBeenCalled();
    await view.visibility("visible");
    expect(view.fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    await view.visibility("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    await view.visibility("visible");
    expect(view.fetchMock).toHaveBeenCalledTimes(3);
    expect(view.setInterval).toHaveBeenCalledTimes(1);
    expect(view.listeners.size).toBe(1);
  });

  it("lets mobile users open and close the inbox when the selected conversation is unavailable", async () => {
    const view = setup({ ...payload, selectedConversationId: "missing-conversation" });
    await act(async () => {});
    expect(JSON.stringify(view.root.toJSON())).toContain("This conversation is unavailable.");
    const openInbox = view.root.root.findAllByType("button").find((button) => button.children.includes("Open inbox"));
    expect(openInbox).toBeDefined();
    expect(openInbox!.props.className).toContain("md:hidden");
    act(() => openInbox!.props.onClick());
    const closeInbox = view.root.root.findByProps({ "aria-label": "Close inbox" });
    act(() => closeInbox.props.onClick());
    expect(view.root.root.findAllByProps({ "aria-label": "Close inbox" })).toHaveLength(0);
  });

  it.each(["return", "canceled"])("forwards the order target from a payment=%s URL to the queued refresh and later polling", async (payment) => {
    navigation.get.mockImplementation((key: string) => ({
      conversationId: "missing-conversation", payment, orderId: "returned-order"
    })[key] ?? null);
    const view = setup({ ...payload, selectedConversationId: "missing-conversation" });
    await act(async () => {});
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    const requestUrls = view.fetchMock.mock.calls.map((call) => new URL(call[0] as string, "https://example.invalid"));
    expect(requestUrls[0].searchParams.has("orderId")).toBe(false);
    expect(requestUrls[1].searchParams.get("orderId")).toBe("returned-order");
    expect(requestUrls[1].searchParams.get("conversationId")).toBe("missing-conversation");
    expect(navigation.replace).toHaveBeenCalledWith("/messages?conversationId=missing-conversation", { scroll: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(3);
    expect(new URL(view.fetchMock.mock.calls[2][0] as string, "https://example.invalid").searchParams.get("orderId")).toBe("returned-order");
  });

  it.each(["return", "canceled"])("ignores an oversized orderId in a payment=%s URL instead of poisoning later polling", async (payment) => {
    navigation.get.mockImplementation((key: string) => ({
      conversationId: "missing-conversation", payment, orderId: "x".repeat(257)
    })[key] ?? null);
    const view = setup({ ...payload, selectedConversationId: "missing-conversation" });
    await act(async () => {});
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(4);
    for (const [url] of view.fetchMock.mock.calls) {
      const params = new URL(url, "https://example.invalid").searchParams;
      expect(params.has("orderId")).toBe(false);
      expect(params.has("quoteRequestId")).toBe(false);
      expect(params.get("conversationId")).toBe("missing-conversation");
    }
    expect(navigation.replace).toHaveBeenCalledWith("/messages?conversationId=missing-conversation", { scroll: false });
  });

  it("recovers on the next visible poll after an HTTP failure without recreating the timer", async () => {
    const view = setup();
    view.fetchMock.mockResolvedValueOnce({ ok: false, json: async () => payload });
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
    expect(view.fetchMock).toHaveBeenCalledTimes(2);
    expect(view.setInterval).toHaveBeenCalledTimes(1);
    expect(view.listeners.size).toBe(1);
  });
});
