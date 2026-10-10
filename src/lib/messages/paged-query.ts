import "server-only";

import { UserRole, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  conversationInclude,
  serializeConversation,
  type MessageConversation,
  type SerializedMessageConversation
} from "@/lib/messages/query";
import {
  decodeMessageCursor,
  encodeMessageCursor,
  InvalidMessageCursorError,
  type MessageCollection,
  type MessageCursor,
  type MessagePage
} from "@/lib/messages/pagination";

export { InvalidMessageCursorError } from "@/lib/messages/pagination";
export type { MessagePage } from "@/lib/messages/pagination";

export type PagedMessagesPayload = {
  conversations: SerializedMessageConversation[];
  selectedConversationId: string | null;
  unreadByConversation: Record<string, number>;
  unreadTotal: number;
  pagination: {
    page: MessagePage;
    nextConversationCursor: string | null;
    history: {
      conversationId: string;
      messages: string | null;
      inquiries: string | null;
      quoteRequests: string | null;
    } | null;
  };
};

const INBOX_LIMIT = 30;
const MESSAGE_LIMIT = 50;
const ACTIVITY_LIMIT = 20;
const descendingCreatedAt = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.MessageOrderByWithRelationInput[];

const quoteRequestInclude = {
  offering: { select: { photos: true, title: true } },
  quote: {
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          amountCents: true,
          buyerTotalCents: true,
          createdAt: true,
          id: true,
          paymentSucceededAt: true,
          review: { select: { id: true } },
          status: true,
          updatedAt: true
        }
      }
    }
  }
} satisfies Prisma.QuoteRequestInclude;

function participantScope(currentUserId: string, role?: UserRole | string | null): Prisma.ConversationWhereInput {
  return role === UserRole.ADMIN ? {} : {
    OR: [
      { buyerId: currentUserId },
      { vendorId: currentUserId },
      { vendorProfile: { userId: currentUserId } }
    ]
  };
}

function beforeCursor(cursor: MessageCursor | null, field: "createdAt" | "lastMessageAt") {
  return cursor ? {
    OR: [
      { [field]: { lt: new Date(cursor.timestamp) } },
      { [field]: new Date(cursor.timestamp), id: { lt: cursor.id } }
    ]
  } : {};
}

function historyPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
  scope: { userId: string; collection: MessageCollection; conversationId: string }
) {
  const fetched = rows.slice(0, limit);
  const oldest = fetched[fetched.length - 1];
  return {
    // SQL retrieves newest first; the UI and the legacy serializer are chronological.
    rows: fetched.reverse(),
    cursor: rows.length > limit && oldest ? encodeMessageCursor({
      ...scope,
      timestamp: oldest.createdAt.toISOString(),
      id: oldest.id
    }) : null
  };
}

export async function getPagedMessagesPayload({
  currentUserId,
  role,
  selectedConversationId,
  markSelectedRead = false,
  page = "refresh",
  cursor = null,
  quoteRequestId = null,
  orderId = null
}: {
  currentUserId: string;
  role?: UserRole | string | null;
  selectedConversationId?: string | null;
  markSelectedRead?: boolean;
  page?: MessagePage;
  cursor?: string | null;
  quoteRequestId?: string | null;
  orderId?: string | null;
}): Promise<PagedMessagesPayload> {
  const pages: readonly string[] = ["refresh", "conversations", "messages", "inquiries", "quoteRequests"];
  if (!pages.includes(page) || (page === "refresh" && cursor !== null)) {
    throw new InvalidMessageCursorError();
  }
  if ([quoteRequestId, orderId].some((target) => target !== null && (!target || target.length > 256 || page !== "refresh"))) {
    throw new InvalidMessageCursorError();
  }
  const isHistory = page !== "refresh" && page !== "conversations";
  if (isHistory && !selectedConversationId) throw new InvalidMessageCursorError();
  const decodedCursor = cursor === null ? null : decodeMessageCursor(cursor, {
    userId: currentUserId,
    collection: page as MessageCollection,
    conversationId: page === "conversations" ? null : selectedConversationId ?? null
  });
  const scope = participantScope(currentUserId, role);
  let nextConversationCursor: string | null = null;
  let inbox: MessageConversation[] = [];

  if (!isHistory) {
    const rows = await db.conversation.findMany({
      where: { AND: [scope, beforeCursor(decodedCursor, "lastMessageAt")] },
      include: {
        ...conversationInclude,
        messages: {
          where: { conversation: { is: scope } },
          orderBy: descendingCreatedAt,
          take: 1
        },
        inquiries: {
          ...conversationInclude.inquiries,
          where: { conversation: { is: scope } },
          orderBy: descendingCreatedAt,
          take: 1
        }
      },
      orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
      take: INBOX_LIMIT + 1
    });
    inbox = rows.slice(0, INBOX_LIMIT);
    const oldest = inbox[inbox.length - 1];
    if (rows.length > INBOX_LIMIT && oldest) {
      nextConversationCursor = encodeMessageCursor({
        userId: currentUserId,
        collection: "conversations",
        conversationId: null,
        timestamp: oldest.lastMessageAt.toISOString(),
        id: oldest.id
      });
    }
  }

  const conversations = inbox.map((conversation) => serializeConversation(conversation));
  let selectedId: string | null = null;
  let history: PagedMessagesPayload["pagination"]["history"] = null;
  const requestedId = selectedConversationId || (page === "refresh" ? inbox[0]?.id : null);

  // A separately authorized lookup allows opening an older thread even when it
  // does not appear in the first inbox page. History never loads the inbox.
  if (page !== "conversations" && requestedId) {
    const selectedScope = { AND: [scope, { id: requestedId }] } satisfies Prisma.ConversationWhereInput;
    const loadMessages = page === "refresh" || page === "messages";
    const loadInquiries = page === "refresh" || page === "inquiries";
    const historyWhere = { AND: [
      { conversation: { is: selectedScope } },
      beforeCursor(decodedCursor, "createdAt")
    ] };
    const selectedInclude = {
      ...conversationInclude,
      messages: loadMessages ? {
        where: historyWhere,
        orderBy: descendingCreatedAt,
        take: MESSAGE_LIMIT + 1
      } : false
    };
    // Keep the inquiry include static in each branch so Prisma retains the
    // listing/offering result types without asserting a broader payload type.
    const selected = loadInquiries
      ? await db.conversation.findFirst({
          where: selectedScope,
          include: {
            ...selectedInclude,
            inquiries: {
              ...conversationInclude.inquiries,
              where: historyWhere,
              orderBy: descendingCreatedAt,
              take: ACTIVITY_LIMIT + 1
            }
          }
        })
      : await db.conversation.findFirst({
          where: selectedScope,
          include: { ...selectedInclude, inquiries: false }
        }).then((conversation) => conversation && ({ ...conversation, inquiries: [] }));

    // Never disclose whether an inaccessible cursor target exists.
    if (!selected && decodedCursor) throw new InvalidMessageCursorError();

    if (selected) {
      selectedId = selected.id;
      const cursorScope = { userId: currentUserId, conversationId: selected.id };
      const messages = historyPage(loadMessages ? selected.messages : [], MESSAGE_LIMIT, {
        ...cursorScope, collection: "messages"
      });
      const inquiries = historyPage(loadInquiries ? selected.inquiries : [], ACTIVITY_LIMIT, {
        ...cursorScope, collection: "inquiries"
      });
      const quoteWhere = {
        buyerId: selected.buyerId,
        vendorId: selected.vendorProfileId,
        // Recheck this exact conversation's participant scope for both linked
        // and legacy unlinked quotes; the cursor never grants access.
        vendor: { conversations: { some: selectedScope } },
        AND: [
          { OR: [{ conversationId: selected.id }, { conversationId: null }] },
          ...(selected.offeringId ? [{ OR: [{ offeringId: selected.offeringId }, { offeringId: null }] }] : [])
        ]
      } satisfies Prisma.QuoteRequestWhereInput;
      const quoteRows = page === "refresh" || page === "quoteRequests" ? await db.quoteRequest.findMany({
        where: { ...quoteWhere, AND: [...quoteWhere.AND, beforeCursor(decodedCursor, "createdAt")] },
        include: quoteRequestInclude,
        orderBy: descendingCreatedAt,
        take: ACTIVITY_LIMIT + 1
      }) : [];
      const quoteRequests = historyPage(quoteRows, ACTIVITY_LIMIT, { ...cursorScope, collection: "quoteRequests" });
      // An explicit quote takes priority over an order carried by a payment
      // return URL, keeping both paths bounded to one extra record in total.
      const targetWhere: Prisma.QuoteRequestWhereInput | null = quoteRequestId
        ? { id: quoteRequestId }
        : orderId ? { quote: { is: { orders: { some: { id: orderId, buyerId: currentUserId } } } } } : null;
      if (targetWhere && (!quoteRequestId || !quoteRequests.rows.some((quote) => quote.id === quoteRequestId))) {
        // Refresh an older open/edited/paid quote without reloading its history.
        // Compute the normal cursor first so this extra row cannot move it.
        const targeted = await db.quoteRequest.findMany({
          where: { ...quoteWhere, ...targetWhere },
          include: quoteRequestInclude,
          take: 1
        });
        targeted.forEach((quote) => {
          const index = quoteRequests.rows.findIndex((existing) => existing.id === quote.id);
          if (index < 0) quoteRequests.rows.push(quote);
          else quoteRequests.rows[index] = quote;
        });
        quoteRequests.rows.sort((left, right) => (
          left.createdAt.getTime() - right.createdAt.getTime() ||
          (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
        ));
      }
      history = {
        conversationId: selected.id,
        messages: messages.cursor,
        inquiries: inquiries.cursor,
        quoteRequests: quoteRequests.cursor
      };

      if (markSelectedRead && loadMessages) {
        const incomingIds = messages.rows
          .filter((message) => message.senderId !== currentUserId && message.readAt === null)
          .map((message) => message.id);
        if (incomingIds.length > 0) {
          // Only the displayed slice was seen. Older rows and messages arriving
          // after this fetch stay unread; failed writes propagate to the caller.
          await db.message.updateMany({
            where: {
              id: { in: incomingIds },
              conversationId: selected.id,
              conversation: { is: selectedScope },
              senderId: { not: currentUserId },
              readAt: null
            },
            data: { readAt: new Date() }
          });
        }
      }

      const serialized = serializeConversation({ ...selected, messages: messages.rows, inquiries: inquiries.rows }, quoteRequests.rows);
      const index = conversations.findIndex((conversation) => conversation.id === selected.id);
      if (index < 0) conversations.push(serialized);
      else conversations[index] = serialized;
    }
  }

  const unreadWhere = {
    conversation: { is: scope },
    senderId: { not: currentUserId },
    readAt: null
  } satisfies Prisma.MessageWhereInput;
  // Aggregate after a successful mark-read write. The total covers the whole
  // authorized inbox, including conversations not loaded on this page.
  const [unreadGroups, unreadTotal] = await Promise.all([
    conversations.length > 0 ? db.message.groupBy({
      by: ["conversationId"],
      where: { ...unreadWhere, conversationId: { in: conversations.map((conversation) => conversation.id) } },
      _count: { _all: true }
    }) : Promise.resolve([]),
    db.message.count({ where: unreadWhere })
  ]);
  const unreadByConversation: Record<string, number> = Object.fromEntries(conversations.map((conversation) => [conversation.id, 0]));
  unreadGroups.forEach((group) => { unreadByConversation[group.conversationId] = group._count._all; });

  return {
    conversations,
    selectedConversationId: selectedId,
    unreadByConversation,
    unreadTotal,
    pagination: { page, nextConversationCursor, history }
  };
}
