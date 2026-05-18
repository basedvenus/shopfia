import { UserRole, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type MessageConversation = Prisma.ConversationGetPayload<{
  include: {
    buyer: { select: { email: true; id: true; image: true; name: true; username: true } };
    vendor: { select: { email: true; id: true; image: true; name: true; username: true } };
    vendorProfile: {
      select: {
        city: true;
        coverPhoto: true;
        id: true;
        logoUrl: true;
        name: true;
        slug: true;
        startingPriceCents: true;
        state: true;
      };
    };
    listing: {
      select: {
        city: true;
        description: true;
        id: true;
        priceFrom: true;
        state: true;
        title: true;
        offering: {
          select: {
            basePriceCents: true;
            messageForPricing: true;
            photos: true;
          };
        };
      };
    };
    offering: {
      select: {
        basePriceCents: true;
        description: true;
        id: true;
        messageForPricing: true;
        photos: true;
        title: true;
      };
    };
    messages: {
      orderBy: { createdAt: "asc" };
    };
    inquiries: {
      orderBy: { createdAt: "asc" };
      include: {
        listing: { select: { title: true } };
        offering: { select: { title: true } };
      };
    };
  };
}>;

export type SerializedMessageConversation = ReturnType<typeof serializeConversation>;
type MessageQuoteRequest = Prisma.QuoteRequestGetPayload<{
  include: {
    offering: { select: { photos: true; title: true } };
    quote: true;
  };
}>;

const conversationInclude = {
  buyer: {
    select: { email: true, id: true, image: true, name: true, username: true }
  },
  vendor: {
    select: { email: true, id: true, image: true, name: true, username: true }
  },
  vendorProfile: {
    select: {
      city: true,
      coverPhoto: true,
      id: true,
      logoUrl: true,
      name: true,
      slug: true,
      startingPriceCents: true,
      state: true
    }
  },
  listing: {
    select: {
      city: true,
      description: true,
      id: true,
      priceFrom: true,
      state: true,
      title: true,
      offering: {
        select: {
          basePriceCents: true,
          messageForPricing: true,
          photos: true
        }
      }
    }
  },
  offering: {
    select: {
      basePriceCents: true,
      description: true,
      id: true,
      messageForPricing: true,
      photos: true,
      title: true
    }
  },
  messages: {
    orderBy: { createdAt: "asc" as const }
  },
  inquiries: {
    orderBy: { createdAt: "asc" as const },
    include: {
      listing: { select: { title: true } },
      offering: { select: { title: true } }
    }
  }
} satisfies Prisma.ConversationInclude;

export async function getMessagesPayload({
  currentUserId,
  role,
  selectedConversationId,
  markSelectedRead = false
}: {
  currentUserId: string;
  markSelectedRead?: boolean;
  role?: UserRole | string | null;
  selectedConversationId?: string | null;
}) {
  const conversations = await db.conversation.findMany({
    where:
      role === UserRole.ADMIN
        ? undefined
        : {
            OR: [{ buyerId: currentUserId }, { vendorId: currentUserId }]
          },
    include: conversationInclude,
    orderBy: { lastMessageAt: "desc" },
    take: 30
  });

  const conversationIds = conversations.map((conversation) => conversation.id);
  const selectedExists = selectedConversationId
    ? conversationIds.includes(selectedConversationId)
    : false;

  const unreadMessages =
    conversationIds.length > 0
      ? await db.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: currentUserId },
            readAt: null
          },
          select: { conversationId: true }
        })
      : [];

  const unreadByConversation: Record<string, number> = {};
  unreadMessages.forEach((message) => {
    unreadByConversation[message.conversationId] =
      (unreadByConversation[message.conversationId] ?? 0) + 1;
  });

  if (markSelectedRead && selectedConversationId && selectedExists) {
    await db.message.updateMany({
      where: {
        conversationId: selectedConversationId,
        senderId: { not: currentUserId },
        readAt: null
      },
      data: { readAt: new Date() }
    });
    unreadByConversation[selectedConversationId] = 0;
  }

  const quoteRequests =
    conversations.length > 0
      ? await db.quoteRequest.findMany({
          where: {
            OR: conversations.map((conversation) => ({
              buyerId: conversation.buyerId,
              vendorId: conversation.vendorProfileId
            }))
          },
          include: {
            offering: { select: { photos: true, title: true } },
            quote: true
          },
          orderBy: { createdAt: "asc" }
        })
      : [];

  const serializedConversations = conversations.map((conversation) =>
    serializeConversation(
      conversation,
      quoteRequests.filter(
        (quoteRequest) =>
          quoteRequest.buyerId === conversation.buyerId &&
          quoteRequest.vendorId === conversation.vendorProfileId &&
          (!quoteRequest.offeringId || !conversation.offeringId || quoteRequest.offeringId === conversation.offeringId)
      )
    )
  );

  return {
    conversations: serializedConversations,
    selectedConversationId: selectedExists
      ? selectedConversationId ?? null
      : serializedConversations[0]?.id ?? null,
    supabase: {
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
    },
    unreadByConversation,
    unreadTotal: Object.values(unreadByConversation).reduce((sum, count) => sum + count, 0)
  };
}

export function serializeConversation(
  conversation: MessageConversation,
  quoteRequests: MessageQuoteRequest[] = []
) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    inquiries: conversation.inquiries.map((inquiry) => ({
      ...inquiry,
      createdAt: inquiry.createdAt.toISOString(),
      eventDate: inquiry.eventDate?.toISOString() ?? null,
      updatedAt: inquiry.updatedAt.toISOString()
    })),
    messages: conversation.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null
    })),
    quoteRequests: quoteRequests.map((quoteRequest) => ({
      ...quoteRequest,
      createdAt: quoteRequest.createdAt.toISOString(),
      eventDate: quoteRequest.eventDate?.toISOString() ?? null,
      quote: quoteRequest.quote
        ? {
            ...quoteRequest.quote,
            createdAt: quoteRequest.quote.createdAt.toISOString(),
            expiresAt: quoteRequest.quote.expiresAt.toISOString(),
            updatedAt: quoteRequest.quote.updatedAt.toISOString()
          }
        : null,
      updatedAt: quoteRequest.updatedAt.toISOString()
    }))
  };
}
