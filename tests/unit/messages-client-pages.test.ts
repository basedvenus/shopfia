import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationItems } from "@/components/messages/messages-client";
import { useMessagePages } from "@/components/messages/use-message-pages";
import { historyCursor, mergeHistory, mergeMessagePages } from "@/lib/messages/client-state";
import type { PagedMessagesPayload } from "@/lib/messages/paged-query";
import type { SerializedMessageConversation } from "@/lib/messages/query";

// These imports are client-side functions and erased types only. No query module
// or database is needed to exercise actual request and merge behavior.
type Conversation = SerializedMessageConversation;
type Message = Conversation["messages"][number];
type QuoteRequest = Conversation["quoteRequests"][number];
type History = NonNullable<PagedMessagesPayload["pagination"]["history"]>;

function timestamp(n: number) {
  return new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString();
}

function message(n: number, conversationId = "conversation-a"): Message {
  return {
    id: `message-${String(n).padStart(3, "0")}`, conversationId, senderId: "vendor-a",
    body: `Message ${n}`, attachments: [], createdAt: timestamp(n), readAt: null
  };
}

function messageRange(first: number, last: number) {
  return Array.from({ length: last - first + 1 }, (_, index) => message(first + index));
}

function conversation(id = "conversation-a", overrides: Partial<Conversation> = {}): Conversation {
  return {
    id, buyerId: "buyer-a", vendorId: "vendor-a", vendorProfileId: "profile-a",
    listingId: null, offeringId: null, createdAt: timestamp(0), updatedAt: timestamp(50),
    lastMessageAt: timestamp(50),
    buyer: { id: "buyer-a", email: "buyer@example.invalid", name: "Buyer", image: null, username: null },
    vendor: { id: "vendor-a", email: "vendor@example.invalid", name: "Vendor", image: null, username: null },
    vendorProfile: { id: "profile-a", name: "Vendor", slug: "vendor", city: "Test City", state: null,
      coverPhoto: null, logoUrl: null, startingPriceCents: null },
    listing: null, offering: null, messages: [message(50, id)], inquiries: [], quoteRequests: [],
    ...overrides
  };
}

function quoteRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    id: "quote-request-a", buyerId: "buyer-a", vendorId: "profile-a", inquiryId: null,
    conversationId: "conversation-a", offeringId: null, eventDate: null, eventLocation: "Venue",
    pricingSnapshot: null, budgetCents: null, notes: null, attachments: [], status: "SUBMITTED",
    createdAt: timestamp(1), updatedAt: timestamp(1), offering: null, quote: null, ...overrides
  };
}

function inquiry(overrides: Partial<Conversation["inquiries"][number]> = {}): Conversation["inquiries"][number] {
  return {
    id: "inquiry2", buyerId: "buyer-a", vendorProfileId: "profile-a", listingId: null,
    offeringId: null, conversationId: "conversation-a", name: "Buyer", email: null, phone: null,
    eventDate: null, eventLocation: "Second event venue", formattedAddress: null, locationCity: null,
    locationState: null, locationZipCode: null, locationLat: null, locationLng: null,
    googlePlaceId: null, guestCount: null, inspirationUrls: [], budgetCents: null,
    message: "Independently loaded inquiry details", status: "NEW", createdAt: timestamp(100),
    updatedAt: timestamp(100), listing: null, offering: null, ...overrides
  };
}

function issuedQuote(quoteRequestId: string, overrides: Partial<NonNullable<QuoteRequest["quote"]>> = {}): NonNullable<QuoteRequest["quote"]> {
  return {
    id: `quote-${quoteRequestId}`, quoteRequestId, amountCents: 7500, depositAmountCents: null,
    expiresAt: timestamp(300), notes: `Quote details for ${quoteRequestId}`, lineItemsJson: null,
    paymentPreference: "FULL", status: "SENT", createdAt: timestamp(2), updatedAt: timestamp(2),
    orders: [], ...overrides
  };
}

function payload({
  conversations = [conversation()],
  selectedConversationId = "conversation-a",
  unreadByConversation = { "conversation-a": 7 },
  unreadTotal = 7,
  page = "refresh",
  nextConversationCursor = "inbox-next",
  history = { conversationId: selectedConversationId ?? "conversation-a", messages: "messages-next", inquiries: "inquiries-next", quoteRequests: "quotes-next" }
}: Partial<Omit<PagedMessagesPayload, "pagination">> & Partial<PagedMessagesPayload["pagination"]> = {}): PagedMessagesPayload {
  return { conversations, selectedConversationId, unreadByConversation, unreadTotal,
    pagination: { page, nextConversationCursor, history } };
}

function history(overrides: Partial<History> = {}): History {
  return { conversationId: "conversation-a", messages: "messages-next", inquiries: "inquiries-next", quoteRequests: "quotes-next", ...overrides };
}

const roots: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => roots.splice(0).forEach((root) => root.unmount()));
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("message page merging", () => {
  it("sorts by date and ID, deduplicates repeated pages, and replaces incoming rows by ID without mutation", () => {
    const first = { ...message(1), id: "a" };
    const tied = { ...message(1), id: "b" };
    const latest = message(2);
    const updated = { ...tied, body: "Updated", readAt: timestamp(3) };
    const previous = [latest, tied];
    const incoming = [updated, first, updated];
    const merged = mergeHistory(previous, incoming);
    expect(merged).toEqual([first, updated, latest]);
    expect(mergeHistory(merged, incoming)).toEqual(merged);
    expect(previous).toEqual([latest, tied]);
    expect(incoming).toEqual([updated, first, updated]);
  });

  it("keeps explicitly loaded older messages and inbox pages across refreshes", () => {
    const initial = payload({ conversations: [conversation("conversation-a", { messages: messageRange(51, 100) }),
      conversation("conversation-inbox", { lastMessageAt: timestamp(49) })] });
    const older = mergeMessagePages(initial, payload({ page: "messages",
      conversations: [conversation("conversation-a", { messages: messageRange(1, 50) })],
      history: history({ messages: null }) }), false);
    const extended = mergeMessagePages(older, payload({ page: "conversations", nextConversationCursor: "inbox-page-3",
      conversations: [conversation("conversation-b", { lastMessageAt: timestamp(0) })], history: null }), true);
    const refreshed = mergeMessagePages(extended, payload({
      conversations: [conversation("conversation-a", { messages: messageRange(52, 101), lastMessageAt: timestamp(101) }),
        conversation("conversation-inbox", { lastMessageAt: timestamp(49) })],
      history: history({ messages: "newest-window-cursor" }) }), true);
    expect(refreshed.conversations.map((item) => item.id)).toEqual(["conversation-a", "conversation-inbox", "conversation-b"]);
    expect(refreshed.conversations[0].messages).toEqual(messageRange(1, 101));
    expect(refreshed.pagination.nextConversationCursor).toBe("inbox-page-3");
    expect(historyCursor(refreshed, "conversation-a", "messages")).toBeNull();
    expect(historyCursor(refreshed, "conversation-b", "messages")).toBeNull();
  });

  it("keeps a gap of more than 50 new arrivals pageable after reaching the old history's end", () => {
    const fullyLoaded = payload({ conversations: [conversation("conversation-a", { messages: messageRange(1, 100) })],
      history: history({ messages: null }) });
    const refreshed = mergeMessagePages(fullyLoaded, payload({
      conversations: [conversation("conversation-a", { messages: messageRange(126, 175) })],
      history: history({ messages: "before-126" }) }), false);
    expect(refreshed.conversations[0].messages).toHaveLength(150);
    expect(historyCursor(refreshed, "conversation-a", "messages")).toBe("before-126");
    const filled = mergeMessagePages(refreshed, payload({ page: "messages",
      conversations: [conversation("conversation-a", { messages: messageRange(76, 125) })],
      history: history({ messages: "before-76" }) }), false);
    expect(filled.conversations[0].messages).toEqual(messageRange(1, 175));
    expect(historyCursor(filled, "conversation-a", "messages")).toBe("before-76");
  });

  it.each([null, "older-inbox-cursor"])("restores a pageable inbox gap after more than 30 new conversations when the old cursor was %s", (oldCursor) => {
    function inboxRange(first: number, last: number) {
      return Array.from({ length: last - first + 1 }, (_, offset) => {
        const index = first + offset;
        return conversation(`inbox-${String(index).padStart(3, "0")}`, { lastMessageAt: timestamp(index) });
      });
    }
    const previous = payload({ conversations: inboxRange(1, 30), nextConversationCursor: oldCursor });
    const refreshed = mergeMessagePages(previous, payload({
      // A separately selected old thread is the 31st row, outside the inbox window.
      conversations: [...inboxRange(46, 75).reverse(), inboxRange(5, 5)[0]],
      nextConversationCursor: "before-inbox-46"
    }), true);
    expect(refreshed.conversations).toHaveLength(60);
    expect(refreshed.pagination.nextConversationCursor).toBe("before-inbox-46");
    const filled = mergeMessagePages(refreshed, payload({ page: "conversations",
      conversations: inboxRange(16, 45).reverse(), nextConversationCursor: "before-inbox-16", history: null
    }), true);
    expect(filled.conversations.map((item) => item.id)).toEqual(inboxRange(1, 75).reverse().map((item) => item.id));
    expect(filled.pagination.nextConversationCursor).toBe("before-inbox-16");
  });

  it("replaces quote and payment updates by ID while retaining older quotes", () => {
    const original = quoteRequest();
    const older = quoteRequest({ id: "quote-request-older", createdAt: timestamp(0) });
    const accepted = quoteRequest({ status: "ACCEPTED", updatedAt: timestamp(100), quote: {
      id: "quote-a", quoteRequestId: original.id, amountCents: 5000, depositAmountCents: null,
      expiresAt: timestamp(200), notes: null, lineItemsJson: null, paymentPreference: "FULL",
      status: "ACCEPTED", createdAt: timestamp(2), updatedAt: timestamp(100), orders: [{
        id: "order-a", amountCents: 5000, buyerTotalCents: 5500, createdAt: timestamp(3),
        paymentSucceededAt: timestamp(100), updatedAt: timestamp(100), status: "paid", review: null
      }]
    } });
    const result = mergeMessagePages(payload({ conversations: [conversation("conversation-a", { quoteRequests: [older, original] })] }),
      payload({ conversations: [conversation("conversation-a", { quoteRequests: [accepted, accepted] })] }), false);
    expect(result.conversations[0].quoteRequests).toEqual([older, accepted]);
    expect(result.conversations[0].quoteRequests[1].quote?.orders[0].paymentSucceededAt).toBe(timestamp(100));
  });

  it.each(["messages", "inquiries", "quoteRequests"] as const)("ends an empty %s page without resetting sibling or inbox cursors", (kind) => {
    const previous = payload();
    const result = mergeMessagePages(previous, payload({ page: kind,
      conversations: [conversation("conversation-a", { messages: [], inquiries: [], quoteRequests: [] })],
      nextConversationCursor: null,
      history: history({ messages: null, inquiries: null, quoteRequests: null }) }), false);
    expect(result.conversations[0].messages).toEqual(previous.conversations[0].messages);
    expect(result.pagination.history).toEqual({ ...previous.pagination.history, [kind]: null });
    expect(result.pagination.nextConversationCursor).toBe("inbox-next");
  });

  it("ends an empty inbox page without deleting conversations or selected history", () => {
    const previous = payload();
    const result = mergeMessagePages(previous, payload({ page: "conversations", conversations: [], history: null,
      nextConversationCursor: null, unreadByConversation: {} }), true);
    expect(result.conversations).toEqual(previous.conversations);
    expect(result.pagination.history).toEqual(previous.pagination.history);
    expect(result.pagination.nextConversationCursor).toBeNull();
    expect(result.unreadByConversation).toEqual(previous.unreadByConversation);
  });

  it("reorders bumped conversations deterministically and keeps unread counts for extended inbox rows", () => {
    const previous = payload({ conversations: [conversation("a"), conversation("b")], unreadByConversation: { a: 3, b: 4 } });
    const result = mergeMessagePages(previous, payload({ conversations: [conversation("a", { lastMessageAt: timestamp(99) }),
      conversation("c", { lastMessageAt: timestamp(50) })], unreadByConversation: { a: 0, c: 2 }, unreadTotal: 6 }), false);
    expect(result.conversations.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(result.unreadByConversation).toEqual({ a: 0, b: 4, c: 2 });
    expect(result.unreadTotal).toBe(6);
  });
});

describe("independently paged conversation rendering", () => {
  function renderItems(value: Conversation, viewerIsVendor = false) {
    const onBuildQuote = vi.fn();
    const onReviewQuote = vi.fn();
    let root!: ReactTestRenderer;
    act(() => { root = create(createElement(ConversationItems, {
      conversation: value, currentUserId: viewerIsVendor ? "vendor-a" : "buyer-a", viewerIsVendor, onBuildQuote, onReviewQuote
    })); });
    roots.push(root);
    return { root, onBuildQuote, onReviewQuote };
  }

  it.each(["New inquiry for a different event", "Inquiry for an earlier event"])("keeps legacy text '%s' independent of differently paged inquiries", (body) => {
    const loadedInquiry = inquiry();
    const { root } = renderItems(conversation("conversation-a", {
      messages: [{ ...message(1), body }], inquiries: [loadedInquiry]
    }));
    const rendered = JSON.stringify(root.toJSON());
    expect(rendered).toContain(body);
    expect(rendered).toContain(loadedInquiry.message);
    const cards = root.root.findAll((node) => typeof node.type === "function" && node.type.name === "InquiryBriefCard");
    expect(cards).toHaveLength(1);
    expect(cards[0].props.inquiry.id).toBe(loadedInquiry.id);
    expect(cards[0].props.createdAt).toBe(loadedInquiry.createdAt);
  });

  it("renders a readable placeholder for a marker whose inquiry is outside the loaded page", () => {
    const loadedInquiry = inquiry();
    const { root } = renderItems(conversation("conversation-a", {
      messages: [{ ...message(1), body: "INQUIRY_CARD:inquiry1" }], inquiries: [loadedInquiry]
    }));
    const rendered = JSON.stringify(root.toJSON());
    expect(rendered).toContain("An event brief was shared. Load older inquiries to find its details.");
    expect(rendered).not.toContain("INQUIRY_CARD:");
    expect(rendered).toContain(loadedInquiry.message);
  });

  it("matches explicit inquiry IDs and renders an attached inquiry only once", () => {
    const loadedInquiry = inquiry();
    const { root } = renderItems(conversation("conversation-a", {
      messages: [{ ...message(1), body: `INQUIRY_CARD:${loadedInquiry.id}` }], inquiries: [loadedInquiry]
    }));
    const cards = root.root.findAll((node) => typeof node.type === "function" && node.type.name === "InquiryBriefCard");
    expect(cards).toHaveLength(1);
    expect(cards[0].props.inquiry).toBe(loadedInquiry);
    expect(cards[0].props.createdAt).toBe(timestamp(1));
    expect(JSON.stringify(root.toJSON())).not.toContain("Load older inquiries");
  });

  it("makes older vendor quote cards view-only while allowing the current quote to be managed", () => {
    const olderQuoted = quoteRequest({ id: "older-quoted", quote: issuedQuote("older-quoted"), createdAt: timestamp(1) });
    const olderUnquoted = quoteRequest({ id: "older-unquoted", createdAt: timestamp(2) });
    const current = quoteRequest({ id: "current-request", quote: issuedQuote("current-request"), createdAt: timestamp(100) });
    const { root, onBuildQuote, onReviewQuote } = renderItems(conversation("conversation-a", {
      messages: [], quoteRequests: [olderQuoted, olderUnquoted, current]
    }), true);
    const articles = root.root.findAllByType("article");
    expect(articles).toHaveLength(3);
    const historicalButtons = articles[0].findAllByType("button");
    expect(historicalButtons).toHaveLength(1);
    expect(historicalButtons[0].children).toContain("View historical quote");
    act(() => historicalButtons[0].props.onClick());
    expect(onReviewQuote).toHaveBeenCalledWith(olderQuoted);
    expect(onBuildQuote).not.toHaveBeenCalled();
    expect(articles[1].findAllByType("button")).toHaveLength(0);
    const currentButtons = articles[2].findAllByType("button");
    expect(currentButtons).toHaveLength(1);
    expect(currentButtons[0].children).toContain("Manage Quote");
    act(() => currentButtons[0].props.onClick());
    expect(onBuildQuote).toHaveBeenCalledOnce();
    expect(onBuildQuote).toHaveBeenCalledWith(current);
    expect(onReviewQuote).toHaveBeenCalledOnce();
  });

  it("keeps Build Quote available only for the latest unquoted vendor request", () => {
    const older = quoteRequest({ id: "older-unquoted", createdAt: timestamp(1) });
    const current = quoteRequest({ id: "current-unquoted", createdAt: timestamp(100) });
    const { root, onBuildQuote } = renderItems(conversation("conversation-a", {
      messages: [], quoteRequests: [older, current]
    }), true);
    const articles = root.root.findAllByType("article");
    expect(articles[0].findAllByType("button")).toHaveLength(0);
    const build = articles[1].findByType("button");
    expect(build.children).toContain("Build Quote");
    act(() => build.props.onClick());
    expect(onBuildQuote).toHaveBeenCalledOnce();
  });

  it("keeps older issued quotes visible and reviewable alongside newer quotes and unquoted requests", () => {
    const older = quoteRequest({ id: "old-request", quote: issuedQuote("old-request"), createdAt: timestamp(1) });
    const newer = quoteRequest({ id: "new-request", quote: issuedQuote("new-request"), createdAt: timestamp(100) });
    const unquoted = quoteRequest({ id: "unquoted-request", createdAt: timestamp(200) });
    const { root, onReviewQuote } = renderItems(conversation("conversation-a", {
      messages: [], quoteRequests: [older, newer, unquoted]
    }));
    expect(root.root.findAllByType("article")).toHaveLength(3);
    const rendered = JSON.stringify(root.toJSON());
    expect(rendered).toContain(older.quote!.notes);
    expect(rendered).toContain(newer.quote!.notes);
    expect(rendered).toContain("Waiting on Quote");
    const reviewButtons = root.root.findAllByType("button").filter((button) => button.children.includes("Review Quote"));
    expect(reviewButtons).toHaveLength(2);
    act(() => reviewButtons[0].props.onClick());
    expect(onReviewQuote).toHaveBeenCalledWith(older);
    act(() => reviewButtons[1].props.onClick());
    expect(onReviewQuote).toHaveBeenLastCalledWith(newer);
  });
});

type ResponseStub = { ok: boolean; json: () => Promise<PagedMessagesPayload> };
type PendingRequest = {
  url: string;
  signal: AbortSignal;
  resolve: (value: ResponseStub) => void;
  reject: (error: Error) => void;
};

function setupRequests() {
  const requests: PendingRequest[] = [];
  const fetchMock = vi.fn((url: string, options: { signal: AbortSignal }) => new Promise<ResponseStub>((resolve, reject) => {
    requests.push({ url, signal: options.signal, resolve, reject });
  }));
  vi.stubGlobal("fetch", fetchMock);
  return { requests, fetchMock };
}

function mountHook(initial: PagedMessagesPayload = payload(), selected = initial.selectedConversationId, threadVisible = true) {
  let latest!: ReturnType<typeof useMessagePages>;
  function Probe({ conversationId, visible }: { conversationId: string | null; visible: boolean }) {
    latest = useMessagePages(initial, conversationId, visible);
    return null;
  }
  let root!: ReactTestRenderer;
  act(() => { root = create(createElement(Probe, { conversationId: selected, visible: threadVisible })); });
  roots.push(root);
  return {
    get current() { return latest; },
    select(conversationId: string | null) {
      selected = conversationId;
      act(() => root.update(createElement(Probe, { conversationId, visible: threadVisible })));
    },
    setThreadVisible(visible: boolean) {
      threadVisible = visible;
      act(() => root.update(createElement(Probe, { conversationId: selected, visible })));
    },
    unmount() { act(() => root.unmount()); roots.splice(roots.indexOf(root), 1); }
  };
}

async function respond(request: PendingRequest, next: PagedMessagesPayload, ok = true) {
  await act(async () => { request.resolve({ ok, json: async () => next }); });
}

describe("message page request lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("document", { visibilityState: "visible" });
  });

  it("opts into scoped pagination, URL-encodes cursors, and does not request terminal pages", async () => {
    const { requests, fetchMock } = setupRequests();
    const hook = mountHook();
    await act(async () => { await hook.current.loadPage("messages", null); });
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => { void hook.current.loadPage("messages", "opaque+/cursor=?"); });
    expect(new URL(requests[0].url, "https://example.invalid").searchParams).toEqual(new URLSearchParams({
      paged: "1", page: "messages", conversationId: "conversation-a", cursor: "opaque+/cursor=?", markRead: "1"
    }));
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { cache: "no-store", signal: requests[0].signal });
    expect(hook.current.loading).toBe(true);
    await respond(requests[0], payload({ page: "messages", history: history({ messages: null }) }));
    expect(hook.current.loading).toBe(false);
    expect(historyCursor(hook.current.payload, "conversation-a", "messages")).toBeNull();
    await act(async () => { await hook.current.loadPage("messages", historyCursor(hook.current.payload, "conversation-a", "messages")); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated refreshes behind a history load and ignores repeated load clicks", async () => {
    const { requests, fetchMock } = setupRequests();
    const hook = mountHook();
    act(() => {
      void hook.current.loadPage("messages", "messages-next");
      void hook.current.loadPage("messages", "messages-next");
      void hook.current.refreshMessages();
      void hook.current.refreshMessages();
      void hook.current.refreshMessages();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await respond(requests[0], payload({ page: "messages",
      conversations: [conversation("conversation-a", { messages: [message(1)] })], history: history({ messages: null }) }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.get("page")).toBe("refresh");
    expect(hook.current.loading).toBe(true);
    await respond(requests[1], payload());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(hook.current.payload.conversations[0].messages.map((item) => item.id)).toEqual([message(1).id, message(50).id]);
    expect(hook.current.loading).toBe(false);
  });

  it("waits for the targeted queued refresh's exact result and retains its quote target for later polling", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    let initialRequest!: Promise<PagedMessagesPayload | undefined>;
    let targetedRequest!: Promise<PagedMessagesPayload | undefined>;
    let coalescedRequest!: Promise<PagedMessagesPayload | undefined>;
    let targetedSettled = false;
    act(() => {
      initialRequest = hook.current.refreshMessages();
      targetedRequest = hook.current.refreshMessages({ quoteRequestId: "old-quote-request" });
      coalescedRequest = hook.current.refreshMessages();
      void targetedRequest.then(() => { targetedSettled = true; });
    });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url, "https://example.invalid").searchParams.has("quoteRequestId")).toBe(false);
    const ordinaryResult = payload();
    await respond(requests[0], ordinaryResult);
    expect(await initialRequest).toBe(ordinaryResult);
    expect(targetedSettled).toBe(false);
    expect(requests).toHaveLength(2);
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.get("quoteRequestId")).toBe("old-quote-request");
    const targetedResult = payload({ conversations: [conversation("conversation-a", {
      quoteRequests: [quoteRequest({ id: "old-quote-request", quote: issuedQuote("old-quote-request") })]
    })] });
    await respond(requests[1], targetedResult);
    expect(await targetedRequest).toBe(targetedResult);
    expect(await coalescedRequest).toBe(targetedResult);
    expect(targetedSettled).toBe(true);
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[2].url, "https://example.invalid").searchParams.get("quoteRequestId")).toBe("old-quote-request");
    await respond(requests[2], targetedResult);
    hook.select("conversation-b");
    act(() => { void hook.current.refreshMessages(); });
    const switched = new URL(requests[3].url, "https://example.invalid").searchParams;
    expect(switched.get("conversationId")).toBe("conversation-b");
    expect(switched.has("quoteRequestId")).toBe(false);
    await respond(requests[3], payload({ selectedConversationId: "conversation-b" }));
    hook.select("conversation-a");
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[4].url, "https://example.invalid").searchParams.has("quoteRequestId")).toBe(false);
    await respond(requests[4], ordinaryResult);
  });

  it("queues a payment-return order target, keeps it on polling, and replaces it when a specific quote is opened", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    let returnedOrder!: Promise<PagedMessagesPayload | undefined>;
    act(() => {
      void hook.current.refreshMessages();
      returnedOrder = hook.current.refreshMessages({ orderId: "paid-order-a" });
    });
    await respond(requests[0], payload());
    const targeted = new URL(requests[1].url, "https://example.invalid").searchParams;
    expect(targeted.get("orderId")).toBe("paid-order-a");
    expect(targeted.has("quoteRequestId")).toBe(false);
    const orderResult = payload();
    await respond(requests[1], orderResult);
    expect(await returnedOrder).toBe(orderResult);
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[2].url, "https://example.invalid").searchParams.get("orderId")).toBe("paid-order-a");
    await respond(requests[2], payload());
    act(() => { void hook.current.refreshMessages({ quoteRequestId: "different-quote" }); });
    const quoteTarget = new URL(requests[3].url, "https://example.invalid").searchParams;
    expect(quoteTarget.get("quoteRequestId")).toBe("different-quote");
    expect(quoteTarget.has("orderId")).toBe(false);
    await respond(requests[3], payload());
    hook.select("conversation-b");
    act(() => { void hook.current.refreshMessages(); });
    const switched = new URL(requests[4].url, "https://example.invalid").searchParams;
    expect(switched.has("orderId")).toBe(false);
    expect(switched.has("quoteRequestId")).toBe(false);
    await respond(requests[4], payload({ selectedConversationId: "conversation-b" }));
  });

  it("resolves queued target callers on conversation switch without issuing an obsolete refresh", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    let queued!: Promise<PagedMessagesPayload | undefined>;
    act(() => {
      void hook.current.refreshMessages();
      queued = hook.current.refreshMessages({ quoteRequestId: "old-quote-request" });
    });
    hook.select("conversation-b");
    expect(await queued).toBeUndefined();
    expect(requests[0].signal.aborted).toBe(true);
    await respond(requests[0], payload());
    expect(requests).toHaveLength(1);
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.has("quoteRequestId")).toBe(false);
    await respond(requests[1], payload({ selectedConversationId: "conversation-b" }));
  });

  it("resolves every queued caller after an unsuccessful targeted refresh without losing cached quotes", async () => {
    const { requests } = setupRequests();
    const initial = payload({ conversations: [conversation("conversation-a", { quoteRequests: [quoteRequest()] })] });
    const hook = mountHook(initial);
    let queued!: Promise<PagedMessagesPayload | undefined>;
    act(() => {
      void hook.current.refreshMessages();
      queued = hook.current.refreshMessages({ quoteRequestId: "quote-request-a" });
    });
    await respond(requests[0], initial);
    await act(async () => { requests[1].reject(new Error("target refresh offline")); });
    expect(await queued).toBeUndefined();
    expect(hook.current.payload.conversations[0].quoteRequests).toEqual(initial.conversations[0].quoteRequests);
    expect(hook.current.error).toContain("Please try again");
    expect(hook.current.loading).toBe(false);
  });

  it("aborts a switched conversation and discards its late response even after switching back", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    act(() => { void hook.current.refreshMessages(); });
    const staleRefresh = hook.current.refreshMessages;
    hook.select("conversation-b");
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => { await staleRefresh(); });
    expect(requests).toHaveLength(1);
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.get("conversationId")).toBe("conversation-b");
    hook.select("conversation-a");
    expect(requests[1].signal.aborted).toBe(true);
    act(() => { void hook.current.refreshMessages(); });
    await respond(requests[2], payload({ unreadTotal: 2, unreadByConversation: { "conversation-a": 2 },
      conversations: [conversation("conversation-a", { messages: [{ ...message(50), body: "Newest response" }] })] }));
    await respond(requests[1], payload({ selectedConversationId: "conversation-b", unreadTotal: 99 }));
    await respond(requests[0], payload({ unreadTotal: 100 }));
    expect(hook.current.payload.unreadTotal).toBe(2);
    expect(hook.current.payload.selectedConversationId).toBe("conversation-a");
    expect(hook.current.payload.conversations[0].messages[0].body).toBe("Newest response");
    expect(hook.current.error).toBeNull();
  });

  it("does not let a stale failure clear a newer request's loading or unread state", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    act(() => { void hook.current.refreshMessages(); void hook.current.refreshMessages(); });
    hook.select("conversation-b");
    act(() => { void hook.current.refreshMessages(); });
    await act(async () => { requests[0].reject(new Error("Old request failed")); });
    expect(requests).toHaveLength(2);
    expect(hook.current.loading).toBe(true);
    expect(hook.current.error).toBeNull();
    expect(hook.current.payload.unreadTotal).toBe(7);
    await respond(requests[1], payload({ selectedConversationId: "conversation-b" }));
    expect(hook.current.loading).toBe(false);
  });

  it.each(["http", "network", "json"] as const)("retains unread state, loaded rows, and pagination cursor after a %s error and can retry", async (failure) => {
    const { requests } = setupRequests();
    const initial = payload();
    const hook = mountHook(initial);
    act(() => { void hook.current.loadPage("messages", "messages-next"); });
    await act(async () => {
      if (failure === "network") requests[0].reject(new Error("offline"));
      else requests[0].resolve({ ok: failure !== "http", json: async () => { throw new Error("invalid JSON"); } });
    });
    expect(hook.current.payload).toEqual(initial);
    expect(hook.current.payload.unreadByConversation).toEqual({ "conversation-a": 7 });
    expect(historyCursor(hook.current.payload, "conversation-a", "messages")).toBe("messages-next");
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toContain("Please try again");
    act(() => { void hook.current.loadPage("messages", historyCursor(hook.current.payload, "conversation-a", "messages")); });
    expect(hook.current.error).toBeNull();
    expect(requests[1].url).toBe(requests[0].url);
    await respond(requests[1], payload({ page: "messages", history: history({ messages: null }) }));
    expect(hook.current.loading).toBe(false);
    expect(historyCursor(hook.current.payload, "conversation-a", "messages")).toBeNull();
  });

  it("preserves the extended inbox cursor after subsequent refreshes", async () => {
    const { requests } = setupRequests();
    const hook = mountHook();
    act(() => { void hook.current.loadPage("conversations", "inbox-next"); });
    expect(new URL(requests[0].url, "https://example.invalid").searchParams.has("markRead")).toBe(false);
    await respond(requests[0], payload({ page: "conversations", nextConversationCursor: "inbox-page-3", history: null,
      conversations: [conversation("conversation-b")] }));
    act(() => { void hook.current.refreshMessages({ markRead: false }); });
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.has("markRead")).toBe(false);
    await respond(requests[1], payload({ nextConversationCursor: "inbox-new-first-page" }));
    expect(hook.current.payload.pagination.nextConversationCursor).toBe("inbox-page-3");
    expect(hook.current.payload.conversations.map((item) => item.id).sort()).toEqual(["conversation-a", "conversation-b"]);
  });

  it("refreshes an obscured thread without marking it read, then marks it read once visible", async () => {
    const { requests } = setupRequests();
    const initial = payload();
    const hook = mountHook(initial, "conversation-a", false);
    act(() => { void hook.current.refreshMessages({ markRead: true }); });
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url, "https://example.invalid").searchParams.has("markRead")).toBe(false);
    await respond(requests[0], initial);
    expect(hook.current.payload.unreadTotal).toBe(7);
    hook.setThreadVisible(true);
    act(() => { void hook.current.refreshMessages(); });
    expect(new URL(requests[1].url, "https://example.invalid").searchParams.get("markRead")).toBe("1");
    await respond(requests[1], payload({ unreadByConversation: { "conversation-a": 0 }, unreadTotal: 0 }));
    hook.setThreadVisible(false);
    act(() => { void hook.current.loadPage("messages", "messages-next"); });
    expect(new URL(requests[2].url, "https://example.invalid").searchParams.has("markRead")).toBe(false);
    await respond(requests[2], payload({ page: "messages" }));
  });

  it("releases a timed-out request for retry without clearing unread counts or its pagination cursor", async () => {
    const { requests } = setupRequests();
    const initial = payload();
    const hook = mountHook(initial);
    act(() => { void hook.current.loadPage("messages", "messages-next"); });
    requests[0].signal.addEventListener("abort", () => requests[0].reject(new Error("Aborted")), { once: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(requests[0].signal.aborted).toBe(true);
    expect(hook.current.loading).toBe(false);
    expect(hook.current.error).toContain("Please try again");
    expect(hook.current.payload).toEqual(initial);
    act(() => { void hook.current.loadPage("messages", historyCursor(hook.current.payload, "conversation-a", "messages")); });
    expect(requests[1].url).toBe(requests[0].url);
    await respond(requests[1], payload({ page: "messages", history: history({ messages: null }) }));
    expect(hook.current.error).toBeNull();
    expect(hook.current.loading).toBe(false);
  });

  it("does not fetch while hidden and aborts active work and queued refreshes on unmount", async () => {
    const { requests, fetchMock } = setupRequests();
    const hook = mountHook();
    vi.stubGlobal("document", { visibilityState: "hidden" });
    await act(async () => { await hook.current.refreshMessages(); await hook.current.loadPage("messages", "messages-next"); });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.stubGlobal("document", { visibilityState: "visible" });
    act(() => { void hook.current.refreshMessages(); void hook.current.refreshMessages(); });
    hook.unmount();
    expect(requests[0].signal.aborted).toBe(true);
    await respond(requests[0], payload());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
