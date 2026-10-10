import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inbox: vi.fn(), selected: vi.fn(), quotes: vi.fn(), markRead: vi.fn(), unread: vi.fn(), count: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {
  conversation: { findMany: mocks.inbox, findFirst: mocks.selected },
  message: { updateMany: mocks.markRead, groupBy: mocks.unread, count: mocks.count },
  quoteRequest: { findMany: mocks.quotes }
} }));

import { getPagedMessagesPayload, InvalidMessageCursorError, type MessagePage } from "@/lib/messages/paged-query";
import { decodeMessageCursor, encodeMessageCursor } from "@/lib/messages/pagination";

type Row = Record<string, unknown>;
type Query = { where?: Row; orderBy?: Row[]; take?: number; include?: Row };
const time = new Date("2026-10-10T00:00:00.000Z");
const at = (index: number) => new Date(time.getTime() + index * 1000);
const padded = (index: number) => String(index).padStart(3, "0");
let conversations: Row[];
let messages: Row[];
let inquiries: Row[];
let quotes: Row[];

function thread(id: string, overrides: Row = {}): Row {
  return {
    id, buyerId: "buyer", vendorId: "vendor", vendorProfileId: "profile", listingId: null, offeringId: "offering",
    lastMessageAt: time, createdAt: time, updatedAt: time,
    buyer: { id: "buyer", name: "Buyer", email: "buyer@example.test", username: null, image: null },
    vendor: { id: "vendor", name: "Vendor", email: "vendor@example.test", username: null, image: null },
    vendorProfile: { id: "profile", userId: "owner", name: "Business", city: "City", state: null, slug: "business", coverPhoto: null, logoUrl: null, startingPriceCents: null },
    listing: null, offering: null,
    ...overrides
  };
}
function message(index: number, conversationId = "thread", overrides: Row = {}): Row {
  return { id: `message-${padded(index)}`, conversationId, senderId: "vendor", body: "Hello", attachments: [], readAt: null, createdAt: at(index), ...overrides };
}
function inquiry(index: number, conversationId = "thread"): Row {
  return { id: `inquiry-${padded(index)}`, conversationId, createdAt: at(index), updatedAt: time, eventDate: null, listing: null, offering: null };
}
function quote(index: number, overrides: Row = {}): Row {
  return { id: `quote-${padded(index)}`, buyerId: "buyer", vendorId: "profile", conversationId: "thread", offeringId: "offering", createdAt: at(index), updatedAt: time, eventDate: null, offering: null, quote: null, ...overrides };
}
function paidQuote(index: number, orderId: string, buyerId = "buyer", overrides: Row = {}): Row {
  return quote(index, {
    quote: {
      id: `sent-quote-${index}`, createdAt: time, updatedAt: time, expiresAt: at(100),
      orders: [{ id: orderId, buyerId, createdAt: time, updatedAt: time, paymentSucceededAt: time }]
    },
    ...overrides
  });
}

// The in-memory DB applies the actual Prisma where/order/take arguments. This
// catches missing scope or keyset clauses rather than returning canned pages.
function field(row: Row, key: string): unknown {
  if (key === "conversation") return conversations.find((item) => item.id === row.conversationId) ?? null;
  if (key === "vendor" && "vendorId" in row && !row.vendor) {
    return { conversations: conversations.filter((item) => item.vendorProfileId === row.vendorId) };
  }
  return row[key];
}
function equal(left: unknown, right: unknown): boolean {
  return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : left === right;
}
function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return (Array.isArray(condition) ? condition : [condition]).every((item) => matches(row, item as Row));
    if (key === "OR") return (condition as Row[]).some((item) => matches(row, item));
    const actual = field(row, key);
    if (!condition || typeof condition !== "object" || condition instanceof Date) return equal(actual, condition);
    const filter = condition as Row;
    if ("in" in filter) return (filter.in as unknown[]).includes(actual);
    if ("not" in filter) return !equal(actual, filter.not);
    if ("lt" in filter) return (actual as string | Date) < (filter.lt as string | Date);
    if ("is" in filter) return !!actual && matches(actual as Row, filter.is as Row);
    if ("some" in filter) return (actual as Row[]).some((item) => matches(item, filter.some as Row));
    return !!actual && matches(actual as Row, filter);
  });
}
function query(rows: Row[], args: Query): Row[] {
  return rows.filter((row) => matches(row, args.where)).sort((left, right) => {
    for (const order of args.orderBy ?? []) {
      const [key, direction] = Object.entries(order)[0];
      const l = left[key] as string | Date;
      const r = right[key] as string | Date;
      if (!equal(l, r)) return (l < r ? -1 : 1) * (direction === "desc" ? -1 : 1);
    }
    return 0;
  }).slice(0, args.take);
}
function included(row: Row, include: Row = {}): Row {
  return {
    ...row,
    ...(include.messages ? { messages: query(messages.filter((item) => item.conversationId === row.id), include.messages as Query).map((item) => ({ ...item })) } : {}),
    ...(include.inquiries ? { inquiries: query(inquiries.filter((item) => item.conversationId === row.id), include.inquiries as Query).map((item) => ({ ...item })) } : {})
  };
}
function cursor(collection: Exclude<MessagePage, "refresh">, overrides: Partial<Parameters<typeof encodeMessageCursor>[0]> = {}) {
  return encodeMessageCursor({ userId: "buyer", collection, conversationId: collection === "conversations" ? null : "thread", timestamp: at(50).toISOString(), id: `${collection}-050`, ...overrides });
}

beforeEach(() => {
  vi.resetAllMocks();
  conversations = [thread("thread")];
  messages = [];
  inquiries = [];
  quotes = [];
  mocks.inbox.mockImplementation(async (args: Query) => query(conversations, args).map((row) => included(row, args.include)));
  mocks.selected.mockImplementation(async (args: Query) => {
    const found = conversations.find((row) => matches(row, args.where));
    return found ? included(found, args.include) : null;
  });
  mocks.quotes.mockImplementation(async (args: Query) => query(quotes, args));
  mocks.markRead.mockImplementation(async (args: Query & { data: Row }) => {
    const found = messages.filter((row) => matches(row, args.where));
    found.forEach((row) => Object.assign(row, args.data));
    return { count: found.length };
  });
  mocks.unread.mockImplementation(async (args: Query) => {
    const counts = new Map<string, number>();
    messages.filter((row) => matches(row, args.where)).forEach((row) => {
      const id = row.conversationId as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    });
    return [...counts].map(([conversationId, count]) => ({ conversationId, _count: { _all: count } }));
  });
  mocks.count.mockImplementation(async (args: Query) => messages.filter((row) => matches(row, args.where)).length);
});

describe("bounded messages query", () => {
  it("returns only previews in the inbox and bounded chronological selected history", async () => {
    conversations = Array.from({ length: 35 }, (_, index) => thread(`thread-${padded(index)}`, { lastMessageAt: at(index) }));
    messages = Array.from({ length: 90 }, (_, index) => message(index, "thread-034"));
    inquiries = Array.from({ length: 40 }, (_, index) => inquiry(index, "thread-034"));
    quotes = Array.from({ length: 40 }, (_, index) => quote(index, { conversationId: "thread-034" }));
    const payload = await getPagedMessagesPayload({ currentUserId: "buyer" });
    expect(payload.conversations).toHaveLength(30);
    expect(payload.selectedConversationId).toBe("thread-034");
    expect(payload.conversations[0].messages.map((row) => row.id)).toEqual(messages.slice(40).map((row) => row.id));
    expect(payload.conversations[0].inquiries).toHaveLength(20);
    expect(payload.conversations[0].quoteRequests).toHaveLength(20);
    expect(payload.pagination.history).toEqual({ conversationId: "thread-034", messages: expect.any(String), inquiries: expect.any(String), quoteRequests: expect.any(String) });
    expect(mocks.inbox).toHaveBeenCalledWith(expect.objectContaining({
      take: 31, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      include: expect.objectContaining({ messages: expect.objectContaining({ take: 1 }), inquiries: expect.objectContaining({ take: 1 }) })
    }));
    expect(mocks.selected).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ messages: expect.objectContaining({ take: 51 }), inquiries: expect.objectContaining({ take: 21 }) }) }));
    expect(mocks.quotes).toHaveBeenCalledWith(expect.objectContaining({ take: 21, include: expect.objectContaining({ quote: { include: { orders: expect.objectContaining({ take: 1 }) } } }) }));
    expect(payload.unreadTotal).toBe(90);
  });

  it("loads a selected conversation outside the newest 30 without losing the inbox cursor", async () => {
    conversations = Array.from({ length: 40 }, (_, index) => thread(`thread-${padded(index)}`, { lastMessageAt: at(index) }));
    messages = [message(1, "thread-000")];
    const payload = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread-000" });
    expect(payload.conversations).toHaveLength(31);
    expect(payload.selectedConversationId).toBe("thread-000");
    expect(payload.conversations.at(-1)?.messages).toHaveLength(1);
    expect(decodeMessageCursor(payload.pagination.nextConversationCursor!, { userId: "buyer", collection: "conversations", conversationId: null }).id).toBe("thread-010");
  });

  it("keeps other inbox rows to one preview and counts unread beyond the loaded inbox", async () => {
    conversations = Array.from({ length: 35 }, (_, index) => thread(`thread-${padded(index)}`, { lastMessageAt: at(index) }));
    messages = [message(1, "thread-000"), ...Array.from({ length: 100 }, (_, index) => message(index + 2, "thread-033"))];
    inquiries = Array.from({ length: 100 }, (_, index) => inquiry(index, "thread-033"));
    quotes = [quote(1, { conversationId: "thread-033" })];
    const payload = await getPagedMessagesPayload({ currentUserId: "buyer" });
    const preview = payload.conversations.find((row) => row.id === "thread-033")!;
    expect(preview.messages.map((row) => row.id)).toEqual(["message-101"]);
    expect(preview.inquiries.map((row) => row.id)).toEqual(["inquiry-099"]);
    expect(preview.quoteRequests).toEqual([]);
    expect(payload.unreadByConversation).not.toHaveProperty("thread-000");
    expect(payload.unreadByConversation["thread-033"]).toBe(100);
    expect(payload.unreadTotal).toBe(101);
  });

  it.each(["conversations", "messages", "inquiries", "quoteRequests"] as const)("has no continuation when %s contains exactly one full page", async (page) => {
    conversations = page === "conversations" ? Array.from({ length: 30 }, (_, index) => thread(`thread-${padded(index)}`)) : [thread("thread")];
    messages = Array.from({ length: 50 }, (_, index) => message(index));
    inquiries = Array.from({ length: 20 }, (_, index) => inquiry(index));
    quotes = Array.from({ length: 20 }, (_, index) => quote(index));
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", page, selectedConversationId: "thread" });
    expect(page === "conversations" ? result.pagination.nextConversationCursor : result.pagination.history![page]).toBeNull();
  });

  it("pages tied inbox timestamps without duplicate rows and ends with a null cursor", async () => {
    conversations = Array.from({ length: 61 }, (_, index) => thread(`thread-${padded(index)}`));
    const first = await getPagedMessagesPayload({ currentUserId: "buyer", page: "conversations" });
    const second = await getPagedMessagesPayload({ currentUserId: "buyer", page: "conversations", cursor: first.pagination.nextConversationCursor });
    const third = await getPagedMessagesPayload({ currentUserId: "buyer", page: "conversations", cursor: second.pagination.nextConversationCursor });
    const ids = [...first.conversations, ...second.conversations, ...third.conversations].map((row) => row.id);
    expect(ids).toHaveLength(61);
    expect(new Set(ids).size).toBe(61);
    expect(third.pagination.nextConversationCursor).toBeNull();
    expect(third.pagination.history).toBeNull();
    expect(mocks.selected).not.toHaveBeenCalled();
    expect(mocks.quotes).not.toHaveBeenCalled();
  });

  it.each(["messages", "inquiries", "quoteRequests"] as const)("pages only %s with tied timestamps, no duplicates and no unrelated histories", async (page) => {
    messages = Array.from({ length: 101 }, (_, index) => message(index, "thread", { createdAt: time }));
    inquiries = Array.from({ length: 41 }, (_, index) => ({ ...inquiry(index), createdAt: time }));
    quotes = Array.from({ length: 41 }, (_, index) => quote(index, { createdAt: time }));
    const ids: string[] = [];
    let next: string | null = null;
    for (let index = 0; index < 3; index++) {
      const result = await getPagedMessagesPayload({ currentUserId: "buyer", page, selectedConversationId: "thread", cursor: next });
      const selected = result.conversations[0];
      ids.push(...selected[page].map((item) => item.id));
      for (const other of ["messages", "inquiries", "quoteRequests"] as const) {
        if (other !== page) expect(selected[other]).toEqual([]);
      }
      const pageIds = selected[page].map((item) => item.id);
      expect(pageIds).toEqual([...pageIds].sort());
      next = result.pagination.history![page];
      expect(next === null).toBe(index === 2);
    }
    expect(ids).toHaveLength(page === "messages" ? 101 : 41);
    expect(new Set(ids).size).toBe(ids.length);
    expect(mocks.inbox).not.toHaveBeenCalled();
    if (page !== "quoteRequests") expect(mocks.quotes).not.toHaveBeenCalled();
  });

  it.each(["buyer", "vendor", "owner"])("permits the %s participant and excludes unrelated conversations from reads and counts", async (currentUserId) => {
    conversations.push(thread("private", { buyerId: "stranger", vendorId: "other-vendor", vendorProfileId: "private-profile", vendorProfile: { id: "private-profile", userId: "stranger" } }));
    messages = [message(1), message(2, "private")];
    const payload = await getPagedMessagesPayload({ currentUserId });
    expect(payload.conversations.map((item) => item.id)).toEqual(["thread"]);
    expect(payload.unreadTotal).toBe(currentUserId === "vendor" ? 0 : 1);
    expect(payload.unreadByConversation).not.toHaveProperty("private");
    expect(mocks.count.mock.calls[0][0].where.conversation.is.OR).toEqual([
      { buyerId: currentUserId }, { vendorId: currentUserId }, { vendorProfile: { userId: currentUserId } }
    ]);
  });

  it("retains admin access while keeping cursor scope bound to the admin identity", async () => {
    conversations.push(thread("private", { buyerId: "stranger" }));
    messages = [message(1), message(2, "private")];
    const payload = await getPagedMessagesPayload({ currentUserId: "admin", role: "ADMIN", selectedConversationId: "private" });
    expect(payload.conversations).toHaveLength(2);
    expect(payload.selectedConversationId).toBe("private");
    expect(payload.unreadTotal).toBe(2);
    await expect(getPagedMessagesPayload({ currentUserId: "admin", role: "ADMIN", page: "conversations", cursor: cursor("conversations") })).rejects.toThrow("Invalid pagination cursor");
  });

  it("does not read or mark history for an inaccessible selected ID", async () => {
    const result = await getPagedMessagesPayload({ currentUserId: "stranger", page: "messages", selectedConversationId: "thread", markSelectedRead: true });
    expect(result).toMatchObject({ conversations: [], selectedConversationId: null, unreadTotal: 0, pagination: { history: null } });
    expect(mocks.quotes).not.toHaveBeenCalled();
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(mocks.selected.mock.calls[0][0].where).toEqual({ AND: [expect.objectContaining({ OR: expect.any(Array) }), { id: "thread" }] });
  });

  it("does not trust a correctly formatted forged cursor for authorization", async () => {
    await expect(getPagedMessagesPayload({ currentUserId: "stranger", page: "messages", selectedConversationId: "thread", cursor: cursor("messages", { userId: "stranger" }) })).rejects.toThrow(InvalidMessageCursorError);
    expect(mocks.selected).toHaveBeenCalledOnce();
    expect(mocks.quotes).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "%not-json"],
    ["cross-user", cursor("messages", { userId: "someone-else" })],
    ["cross-conversation", cursor("messages", { conversationId: "someone-elses-thread" })],
    ["cross-collection", cursor("inquiries")],
    ["invalid-date", cursor("messages", { timestamp: "not-a-date" })],
    ["empty-id", cursor("messages", { id: "" })],
    ["oversized", "x".repeat(2049)],
    ["empty", ""]
  ])("rejects %s cursors identically before reading records", async (_label, value) => {
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", page: "messages", selectedConversationId: "thread", cursor: value })).rejects.toThrow("Invalid pagination cursor");
    expect(mocks.selected).not.toHaveBeenCalled();
    expect(mocks.inbox).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("rejects a refresh cursor or a history request without a conversation", async () => {
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", cursor: cursor("conversations") })).rejects.toThrow(InvalidMessageCursorError);
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", page: "messages" })).rejects.toThrow(InvalidMessageCursorError);
  });

  it("handles an empty inbox, an empty history and a deleted keyset anchor", async () => {
    conversations = [];
    expect(await getPagedMessagesPayload({ currentUserId: "buyer" })).toEqual({ conversations: [], selectedConversationId: null, unreadByConversation: {}, unreadTotal: 0, pagination: { page: "refresh", nextConversationCursor: null, history: null } });
    conversations = [thread("thread")];
    const empty = await getPagedMessagesPayload({ currentUserId: "buyer", page: "messages", selectedConversationId: "thread", cursor: cursor("messages") });
    expect(empty.conversations[0].messages).toEqual([]);
    expect(empty.pagination.history?.messages).toBeNull();
    messages = [message(1), message(60)];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", page: "messages", selectedConversationId: "thread", cursor: cursor("messages", { id: "deleted-anchor" }) });
    expect(result.conversations[0].messages.map((item) => item.id)).toEqual(["message-001"]);
  });

  it("retains legacy unlinked buyer/vendor/offering matches without linked cross-thread leakage", async () => {
    conversations.push(thread("other-thread"));
    quotes = [
      quote(1), quote(2, { conversationId: null }), quote(3, { conversationId: null, offeringId: null }),
      quote(4, { conversationId: "other-thread" }), quote(5, { conversationId: null, offeringId: "other-offering" }),
      quote(6, { conversationId: null, buyerId: "other-buyer" }), quote(7, { conversationId: null, vendorId: "other-profile" })
    ];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", page: "quoteRequests", selectedConversationId: "thread" });
    expect(result.conversations[0].quoteRequests.map((row) => row.id)).toEqual(["quote-001", "quote-002", "quote-003"]);
    expect(mocks.quotes.mock.calls[0][0].where.vendor.conversations.some).toEqual(mocks.selected.mock.calls[0][0].where);
    conversations[0].offeringId = null;
    const noOffering = await getPagedMessagesPayload({ currentUserId: "buyer", page: "quoteRequests", selectedConversationId: "thread" });
    expect(noOffering.conversations[0].quoteRequests.map((row) => row.id)).toEqual(["quote-001", "quote-002", "quote-003", "quote-005"]);
  });

  it("rechecks quote authorization if participation changes after the selected read", async () => {
    quotes = [quote(1, { conversationId: null })];
    mocks.selected.mockImplementationOnce(async (args: Query) => {
      const result = included(conversations[0], args.include);
      conversations[0] = thread("thread", { buyerId: "other-buyer", vendorId: "other-vendor", vendorProfile: { userId: "other-owner" } });
      return result;
    });
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", page: "quoteRequests", selectedConversationId: "thread" });
    expect(result.conversations[0].quoteRequests).toEqual([]);
  });

  it("refreshes one targeted older quote without changing the regular history cursor", async () => {
    quotes = Array.from({ length: 40 }, (_, index) => quote(index, { status: "SUBMITTED" }));
    const first = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread" });
    quotes[1].status = "QUOTED";
    const refreshed = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", quoteRequestId: "quote-001" });
    expect(refreshed.conversations[0].quoteRequests).toHaveLength(21);
    expect(refreshed.conversations[0].quoteRequests[0]).toMatchObject({ id: "quote-001", status: "QUOTED" });
    expect(refreshed.pagination.history?.quoteRequests).toBe(first.pagination.history?.quoteRequests);
    expect(mocks.quotes.mock.calls.at(-1)?.[0]).toMatchObject({
      take: 1,
      where: { id: "quote-001", buyerId: "buyer", vendorId: "profile", vendor: { conversations: { some: mocks.selected.mock.calls[0][0].where } } }
    });
  });

  it("does not duplicate a targeted quote already in the regular refresh page", async () => {
    quotes = [quote(1)];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", quoteRequestId: "quote-001" });
    expect(result.conversations[0].quoteRequests.map((row) => row.id)).toEqual(["quote-001"]);
    expect(mocks.quotes).toHaveBeenCalledOnce();
  });

  it.each([
    { buyerId: "other-buyer" },
    { vendorId: "other-profile" },
    { conversationId: "other-thread" },
    { offeringId: "other-offering", conversationId: null }
  ])("does not reveal an out-of-scope targeted quote: %j", async (override) => {
    quotes = [quote(1, override), quote(2)];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", quoteRequestId: "quote-001" });
    expect(result.conversations[0].quoteRequests.map((row) => row.id)).toEqual(["quote-002"]);
    expect(mocks.quotes).toHaveBeenCalledTimes(2);
  });

  it("validates targeted quote IDs and accepts them only during a refresh", async () => {
    for (const quoteRequestId of ["", "x".repeat(257)]) {
      await expect(getPagedMessagesPayload({ currentUserId: "buyer", quoteRequestId })).rejects.toThrow(InvalidMessageCursorError);
    }
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", page: "messages", selectedConversationId: "thread", quoteRequestId: "quote-001" })).rejects.toThrow(InvalidMessageCursorError);
    expect(mocks.inbox).not.toHaveBeenCalled();
    expect(mocks.selected).not.toHaveBeenCalled();
  });

  it("refreshes an older paid quote through the current buyer's payment-return order ID", async () => {
    quotes = [paidQuote(1, "paid-order"), ...Array.from({ length: 40 }, (_, index) => quote(index + 2))];
    const first = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread" });
    const refreshed = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", orderId: "paid-order" });
    expect(refreshed.conversations[0].quoteRequests).toHaveLength(21);
    expect(refreshed.conversations[0].quoteRequests[0]).toMatchObject({ id: "quote-001", quote: { orders: [{ id: "paid-order" }] } });
    expect(refreshed.pagination.history?.quoteRequests).toBe(first.pagination.history?.quoteRequests);
    expect(mocks.quotes.mock.calls.at(-1)?.[0]).toMatchObject({
      take: 1,
      where: { buyerId: "buyer", vendorId: "profile", quote: { is: { orders: { some: { id: "paid-order", buyerId: "buyer" } } } } }
    });
  });

  it.each([
    paidQuote(1, "foreign-order", "other-buyer"),
    paidQuote(1, "foreign-order", "buyer", { buyerId: "other-buyer" }),
    paidQuote(1, "foreign-order", "buyer", { conversationId: "other-thread" })
  ])("does not reveal a foreign payment-return order: %j", async (foreignQuote) => {
    quotes = [foreignQuote, ...Array.from({ length: 40 }, (_, index) => quote(index + 2))];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", orderId: "foreign-order" });
    expect(result.conversations[0].quoteRequests).toHaveLength(20);
    expect(result.conversations[0].quoteRequests.some((row) => row.id === "quote-001")).toBe(false);
  });

  it("deduplicates a payment-return quote already included in the regular page", async () => {
    quotes = [paidQuote(1, "paid-order")];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", orderId: "paid-order" });
    expect(result.conversations[0].quoteRequests.map((row) => row.id)).toEqual(["quote-001"]);
  });

  it("prefers an explicit quote ID when both refresh targets are supplied", async () => {
    quotes = [paidQuote(1, "paid-order"), ...Array.from({ length: 40 }, (_, index) => quote(index + 2))];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", quoteRequestId: "quote-002", orderId: "paid-order" });
    expect(result.conversations[0].quoteRequests).toHaveLength(21);
    expect(result.conversations[0].quoteRequests[0].id).toBe("quote-002");
    expect(mocks.quotes).toHaveBeenCalledTimes(2);
    expect(mocks.quotes.mock.calls[1][0].where.id).toBe("quote-002");
    expect(mocks.quotes.mock.calls[1][0].where).not.toHaveProperty("quote");
  });

  it("validates payment-return order IDs and accepts them only during a refresh", async () => {
    for (const orderId of ["", "x".repeat(257)]) {
      await expect(getPagedMessagesPayload({ currentUserId: "buyer", orderId })).rejects.toThrow(InvalidMessageCursorError);
    }
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", page: "quoteRequests", selectedConversationId: "thread", orderId: "paid-order" })).rejects.toThrow(InvalidMessageCursorError);
    expect(mocks.inbox).not.toHaveBeenCalled();
    expect(mocks.selected).not.toHaveBeenCalled();
  });

  it("marks only fetched incoming unread IDs and counts after writes, preserving old and newly arriving unread rows", async () => {
    conversations.push(thread("outside"));
    messages = Array.from({ length: 61 }, (_, index) => message(index));
    messages.push(message(62, "thread", { senderId: "buyer" }), message(63, "thread", { readAt: time }), message(64, "outside"));
    const update = mocks.markRead.getMockImplementation()!;
    mocks.markRead.mockImplementationOnce(async (...args) => {
      messages.push(message(100));
      return update(...args);
    });
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", page: "messages", selectedConversationId: "thread", markSelectedRead: true });
    const write = mocks.markRead.mock.calls[0][0];
    expect(write.where.conversationId).toBe("thread");
    expect(write.where.id.in).toHaveLength(48);
    expect(write.where.id.in).not.toContain("message-012");
    expect(write.where.id.in).not.toContain("message-062");
    expect(write.where.id.in).not.toContain("message-063");
    expect(write.where.id.in).not.toContain("message-100");
    expect(write.where.conversation.is).toEqual(mocks.selected.mock.calls[0][0].where);
    expect(result.unreadByConversation).toEqual({ thread: 14 });
    expect(result.unreadTotal).toBe(15);
    expect(mocks.unread.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.markRead.mock.invocationCallOrder[0]);
    expect(mocks.count.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.markRead.mock.invocationCallOrder[0]);
  });

  it("propagates failed read writes without reporting optimistic unread counts", async () => {
    messages = [message(1)];
    mocks.markRead.mockRejectedValueOnce(new Error("write unavailable"));
    await expect(getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", markSelectedRead: true })).rejects.toThrow("write unavailable");
    expect(mocks.unread).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
    expect(messages[0].readAt).toBeNull();
  });

  it("keeps unread counts when the read update affects zero rows", async () => {
    messages = [message(1)];
    mocks.markRead.mockResolvedValueOnce({ count: 0 });
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", markSelectedRead: true });
    expect(result.unreadByConversation).toEqual({ thread: 1 });
    expect(result.unreadTotal).toBe(1);
  });

  it("returns explicit verified zeroes after a successful read so merged badges clear", async () => {
    messages = [message(1)];
    const result = await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", markSelectedRead: true });
    expect(result.unreadByConversation).toEqual({ thread: 0 });
    expect(result.unreadTotal).toBe(0);
    expect(messages[0].readAt).toBeInstanceOf(Date);
  });

  it.each(["refresh", "messages", "conversations", "inquiries", "quoteRequests"] as const)("does not mark messages for a hidden %s request", async (page) => {
    messages = [message(1)];
    await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", page, markSelectedRead: false });
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it.each(["conversations", "inquiries", "quoteRequests"] as const)("never marks unfetched messages on a %s page", async (page) => {
    messages = [message(1)];
    await getPagedMessagesPayload({ currentUserId: "buyer", selectedConversationId: "thread", page, markSelectedRead: true });
    expect(mocks.markRead).not.toHaveBeenCalled();
  });
});
