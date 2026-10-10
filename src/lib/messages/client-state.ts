import type { PagedMessagesPayload } from "@/lib/messages/paged-query";

const histories = ["messages", "inquiries", "quoteRequests"] as const;
type History = (typeof histories)[number];
type Dated = { id: string; createdAt: string };

function compare(a: Dated, b: Dated) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function mergeHistory<T extends Dated>(previous: T[], incoming: T[]): T[] {
  const byId = new Map(previous.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort(compare);
}

// Refresh only replaces fetched rows. Explicit older pages remain available even
// while a new message moves this conversation to the front of the inbox.
export function mergeMessagePages(
  previous: PagedMessagesPayload,
  incoming: PagedMessagesPayload,
  preserveConversationCursor: boolean
): PagedMessagesPayload {
  const byId = new Map(previous.conversations.map((item) => [item.id, item]));
  for (const item of incoming.conversations) {
    const old = byId.get(item.id);
    byId.set(item.id, old ? {
      ...item,
      messages: mergeHistory(old.messages, item.messages),
      inquiries: mergeHistory(old.inquiries, item.inquiries),
      quoteRequests: mergeHistory(old.quoteRequests, item.quoteRequests)
    } : item);
  }
  let history = incoming.pagination.history;
  if (!history) history = incoming.pagination.page === "refresh" ? null : previous.pagination.history;
  else if (history.conversationId === previous.pagination.history?.conversationId) {
    const oldHistory = previous.pagination.history;
    const old = previous.conversations.find((item) => item.id === history!.conversationId);
    const fresh = incoming.conversations.find((item) => item.id === history!.conversationId);
    history = { ...history };
    for (const kind of histories) {
      if (incoming.pagination.page !== "refresh" && incoming.pagination.page !== kind) {
        history[kind] = oldHistory[kind];
      } else if (incoming.pagination.page === "refresh" && old && fresh && history[kind]) {
        // If more than one page arrived between refreshes, start paging at the
        // fresh window, so the gap can be retrieved rather than silently lost.
        const newestKnown = old[kind].at(-1);
        // A targeted older quote can accompany the 20-row refresh window.
        // It must not conceal a gap in that regular window.
        const oldestFresh = kind === "quoteRequests" ? fresh[kind].slice(-20)[0] : fresh[kind][0];
        if (newestKnown && oldestFresh && compare(oldestFresh, newestKnown) <= 0) {
          history[kind] = oldHistory[kind];
        }
      }
    }
  }
  const newestKnownConversation = [...previous.conversations].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id)
  )[0];
  // The separately selected thread may be an extra (31st) result. Only the
  // first 30 inbox rows define the refreshed inbox window.
  const oldestFreshConversation = [...incoming.conversations].sort((a, b) =>
    b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id)
  ).slice(0, 30).at(-1);
  const inboxGap = Boolean(incoming.pagination.nextConversationCursor && newestKnownConversation && oldestFreshConversation &&
    (oldestFreshConversation.lastMessageAt > newestKnownConversation.lastMessageAt ||
      (oldestFreshConversation.lastMessageAt === newestKnownConversation.lastMessageAt && oldestFreshConversation.id > newestKnownConversation.id)));

  return {
    ...incoming,
    conversations: [...byId.values()].sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt) || b.id.localeCompare(a.id)
    ),
    unreadByConversation: { ...previous.unreadByConversation, ...incoming.unreadByConversation },
    pagination: {
      ...incoming.pagination,
      history,
      nextConversationCursor: incoming.pagination.page === "conversations" ||
        (incoming.pagination.page === "refresh" && (!preserveConversationCursor || inboxGap))
        ? incoming.pagination.nextConversationCursor
        : previous.pagination.nextConversationCursor
    }
  };
}

export function historyCursor(payload: PagedMessagesPayload, conversationId: string, kind: History) {
  return payload.pagination.history?.conversationId === conversationId
    ? payload.pagination.history[kind]
    : null;
}
