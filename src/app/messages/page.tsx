import Link from "next/link";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarHeart,
  ChevronRight,
  ExternalLink,
  Heart,
  Mail,
  MapPin,
  Package,
  Paperclip,
  Send,
  Sparkles,
  UsersRound
} from "lucide-react";
import { sendMessageAction } from "@/app/actions/messaging";
import { NotificationPreferences } from "@/components/messages/notification-preferences";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type ConversationForInbox = Prisma.ConversationGetPayload<{
  include: {
    buyer: { select: { id: true; image: true; name: true; username: true } };
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

type InquiryBrief = Prisma.InquiryGetPayload<{
  include: {
    listing: { select: { title: true } };
    offering: { select: { title: true } };
  };
}>;

export default async function MessagesPage({
  searchParams
}: {
  searchParams?: Promise<{ conversationId?: string }>;
}) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();

  if (!session?.user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to access messages.</p>;
  }

  const params = await searchParams;
  const selectedConversationId = params?.conversationId;
  const conversations = await db.conversation.findMany({
    where:
      session.user.role === "ADMIN"
        ? undefined
        : {
            OR: [{ buyerId: session.user.id }, { vendorId: session.user.id }]
          },
    include: {
      buyer: {
        select: { id: true, image: true, name: true, username: true }
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
        orderBy: { createdAt: "asc" },
        take: 20
      },
      inquiries: {
        orderBy: { createdAt: "asc" },
        include: {
          listing: { select: { title: true } },
          offering: { select: { title: true } }
        },
        take: 10
      }
    },
    orderBy: { lastMessageAt: "desc" },
    take: 30
  });

  const conversationIds = conversations.map((conversation) => conversation.id);
  const unreadMessages =
    conversationIds.length > 0
      ? await db.message.findMany({
          where: {
            conversationId: { in: conversationIds },
            senderId: { not: session.user.id },
            readAt: null
          },
          select: { conversationId: true }
        })
      : [];
  const unreadByConversation = new Map<string, number>();
  unreadMessages.forEach((message) => {
    unreadByConversation.set(
      message.conversationId,
      (unreadByConversation.get(message.conversationId) ?? 0) + 1
    );
  });

  if (selectedConversationId && conversationIds.includes(selectedConversationId)) {
    await db.message.updateMany({
      where: {
        conversationId: selectedConversationId,
        senderId: { not: session.user.id },
        readAt: null
      },
      data: { readAt: new Date() }
    });
    unreadByConversation.set(selectedConversationId, 0);
  }

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;
  const unreadTotal = Array.from(unreadByConversation.values()).reduce((sum, count) => sum + count, 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/88 shadow-soft">
        <div className="bg-[radial-gradient(circle_at_12%_8%,rgba(244,207,202,0.38),transparent_24%),linear-gradient(135deg,#fffaf6,#ffffff_58%,#f6efe7)] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/76 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
                <Sparkles className="h-3.5 w-3.5" />
                ShopFia Inbox
              </div>
              <h1 className="mt-4 font-serif text-5xl leading-tight tracking-tight text-[#2f2626]">
                Messages
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Event inquiries, vendor replies, and marketplace context in one warm thread.
              </p>
            </div>
            <div className="rounded-[1.25rem] border border-white/80 bg-white/82 px-4 py-3 text-sm shadow-sm">
              <div className="flex items-center gap-2 font-semibold text-[#2f2626]">
                <Bell className="h-4 w-4 text-[#c5837f]" />
                {unreadTotal > 0 ? `${unreadTotal} unread` : "All caught up"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                New inquiries appear with a soft pink glow.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className={selectedConversation ? "grid gap-5 xl:grid-cols-[0.8fr_1.2fr]" : "grid gap-5 xl:grid-cols-[1fr_0.42fr]"}>
        <section className="space-y-3">
          <InboxHeader
            count={conversations.length}
            selectedConversation={Boolean(selectedConversation)}
          />
          {conversations.length === 0 ? (
            <EmptyInbox />
          ) : (
            <div className="grid gap-3">
              {conversations.map((conversation) => (
                <InboxCard
                  key={conversation.id}
                  conversation={conversation}
                  currentUserId={session.user.id}
                  isSelected={conversation.id === selectedConversation?.id}
                  unreadCount={unreadByConversation.get(conversation.id) ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        {selectedConversation ? (
          <ConversationThread
            conversation={selectedConversation}
            currentUserId={session.user.id}
          />
        ) : (
          <aside className="space-y-4">
            <NotificationPreferences />
            <MarketplaceTrustPanel />
          </aside>
        )}
      </div>
    </div>
  );
}

function InboxHeader({
  count,
  selectedConversation
}: {
  count: number;
  selectedConversation: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[#2f2626]">Inbox</h2>
        <p className="text-sm text-muted-foreground">
          {count === 1 ? "1 conversation" : `${count} conversations`}
        </p>
      </div>
      {selectedConversation ? (
        <Link href="/messages" className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium hover:bg-[#fffaf6]">
          <ArrowLeft className="h-4 w-4" />
          Inbox
        </Link>
      ) : null}
    </div>
  );
}

function InboxCard({
  conversation,
  currentUserId,
  isSelected,
  unreadCount
}: {
  conversation: ConversationForInbox;
  currentUserId: string;
  isSelected: boolean;
  unreadCount: number;
}) {
  const viewerIsVendor = conversation.vendorId === currentUserId;
  const identity = getConversationIdentity(conversation, viewerIsVendor);
  const latestInquiry = conversation.inquiries.at(-1) ?? null;
  const latestMessage = [...conversation.messages]
    .reverse()
    .find((message) => !getInquiryMarkerId(message.body) && !isLegacyInquiryMessage(message.body));
  const contextTitle = getContextTitle(conversation, latestInquiry);
  const preview = latestInquiry?.message ?? latestMessage?.body ?? "A new ShopFia conversation is ready.";
  const dateLabel = latestInquiry?.eventDate ? shortEventDate(latestInquiry.eventDate) : null;
  const location = latestInquiry ? formatInquiryLocation(latestInquiry) : formatConversationLocation(conversation);
  const budget = latestInquiry?.budgetCents != null ? formatBudget(latestInquiry.budgetCents) : null;

  return (
    <Link
      href={`/messages?conversationId=${conversation.id}`}
      className={`group relative block overflow-hidden rounded-[1.75rem] border p-4 transition duration-200 before:absolute before:inset-x-6 before:bottom-0 before:h-6 before:rounded-full before:bg-[#8a5c58]/10 before:blur-2xl before:content-[''] hover:-translate-y-1 hover:shadow-[0_24px_58px_rgba(82,55,55,0.13)] ${
        isSelected
          ? "border-[#cfaa9e] bg-[linear-gradient(135deg,#ffffff_0%,#fffdf9_52%,#f8eee8_100%)] shadow-[0_22px_54px_rgba(82,55,55,0.15),inset_5px_0_0_#d8a39c]"
          : unreadCount > 0
            ? "border-[#e3beb5] bg-[linear-gradient(135deg,#ffffff_0%,#fffaf6_100%)] shadow-[0_18px_44px_rgba(82,55,55,0.12)]"
            : "border-[#eadfd8] bg-[linear-gradient(135deg,#ffffff_0%,#fffdf9_100%)] shadow-[0_16px_38px_rgba(82,55,55,0.09)]"
      }`}
    >
      {unreadCount > 0 ? (
        <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-[#e3a7a7] px-2.5 py-1 text-xs font-bold text-white shadow-sm">
          <Heart className="h-3 w-3 fill-current" />
          NEW
        </span>
      ) : null}
      <div className="relative flex gap-4 pr-14">
        <IdentityAvatar image={identity.image} label={identity.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-[#2f2626]">{identity.name}</h3>
            <span className="rounded-full bg-[#fbf1ed] px-2.5 py-1 text-xs font-medium text-[#9b6b65]">
              {identity.kind}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-[#5f514e]">
            {contextTitle}
            {dateLabel ? ` • ${dateLabel}` : ""}
          </p>
          {location ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          ) : null}
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
            &ldquo;{preview}&rdquo;
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatMessageDate(conversation.lastMessageAt)}</span>
            {budget ? <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#9b6b65]">{budget}</span> : null}
          </div>
        </div>
        <span className="mt-7 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fffaf6] text-[#9b6b65] shadow-sm transition group-hover:translate-x-0.5 group-hover:bg-white">
          <ChevronRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}

function ConversationThread({
  conversation,
  currentUserId
}: {
  conversation: ConversationForInbox;
  currentUserId: string;
}) {
  const viewerIsVendor = conversation.vendorId === currentUserId;
  const identity = getConversationIdentity(conversation, viewerIsVendor);
  const inquiriesById = new Map(conversation.inquiries.map((inquiry) => [inquiry.id, inquiry]));
  const renderedInquiryIds = new Set<string>();
  const nextUnrenderedInquiry = () =>
    conversation.inquiries.find((inquiry) => !renderedInquiryIds.has(inquiry.id));

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/75 bg-white/92 shadow-soft">
      <div className="border-b border-[#eadbd3] bg-[linear-gradient(135deg,#fffaf6,#ffffff_62%,#f6efe7)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={viewerIsVendor ? `/profiles/${conversation.buyer.username ?? ""}` : `/vendor/profile/${conversation.vendorProfile.slug}`}
            className={`flex min-w-0 items-center gap-3 rounded-[1.5rem] pr-3 transition hover:bg-white/68 ${viewerIsVendor && !conversation.buyer.username ? "pointer-events-none" : ""}`}
          >
            <IdentityAvatar image={identity.image} label={identity.name} size="xl" />
            <div className="min-w-0 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-semibold text-[#2f2626]">{identity.name}</h2>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#9b6b65]">
                  {identity.kind}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {viewerIsVendor
                  ? "Responding as your vendor shop through ShopFia"
                  : "Marketplace conversation with a verified storefront"}
              </p>
            </div>
          </Link>
        </div>
        <ContextCard conversation={conversation} />
      </div>

      <div className="max-h-[36rem] space-y-4 overflow-auto bg-[linear-gradient(180deg,#fffdfa,#fff)] p-4 md:p-5">
        {conversation.messages.map((message) => {
          const markerInquiryId = getInquiryMarkerId(message.body);
          const inquiry =
            (markerInquiryId ? inquiriesById.get(markerInquiryId) : null) ??
            (isLegacyInquiryMessage(message.body) ? nextUnrenderedInquiry() : null);

          if (inquiry) {
            renderedInquiryIds.add(inquiry.id);
            return <InquiryBriefCard key={message.id} inquiry={inquiry} createdAt={message.createdAt} />;
          }

          if (markerInquiryId || isLegacyInquiryMessage(message.body)) return null;

          return (
            <ChatBubble
              key={message.id}
              body={message.body}
              createdAt={message.createdAt}
              isMine={message.senderId === currentUserId}
              label={message.senderId === conversation.buyerId ? conversation.buyer.name ?? "Buyer" : conversation.vendorProfile.name}
            />
          );
        })}
        {conversation.inquiries
          .filter((inquiry) => !renderedInquiryIds.has(inquiry.id))
          .map((inquiry) => (
            <InquiryBriefCard key={inquiry.id} inquiry={inquiry} createdAt={inquiry.createdAt} />
          ))}
      </div>

      <form action={sendMessageAction} className="border-t border-[#f0dfda] bg-white p-4">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <div className="rounded-[1.5rem] border border-[#eadbd7] bg-[#fffdfa] p-3">
          <Textarea
            name="body"
            placeholder={viewerIsVendor ? "Reply with availability, pricing, or next steps..." : "Reply to the vendor..."}
            className="min-h-[92px] border-0 bg-transparent shadow-none focus-visible:ring-0"
            required
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Replies stay connected to this ShopFia inquiry.
            </p>
            <Button type="submit" size="sm">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ContextCard({ conversation }: { conversation: ConversationForInbox }) {
  const title = conversation.listing?.title ?? conversation.offering?.title ?? conversation.vendorProfile.name;
  const description =
    conversation.listing?.description ??
    conversation.offering?.description ??
    "Browse the storefront, reviews, galleries, and offerings connected to this conversation.";
  const image =
    conversation.offering?.photos[0] ??
    conversation.listing?.offering?.photos[0] ??
    conversation.vendorProfile.coverPhoto ??
    conversation.vendorProfile.logoUrl;
  const price =
    conversation.listing?.priceFrom ??
    conversation.offering?.basePriceCents ??
    conversation.listing?.offering?.basePriceCents ??
    conversation.vendorProfile.startingPriceCents;
  const href = conversation.offeringId ? `/offering/${conversation.offeringId}` : `/vendor/profile/${conversation.vendorProfile.slug}`;

  return (
    <Link
      href={href}
      className="mt-5 grid gap-3 rounded-[1.5rem] border border-white/80 bg-white/82 p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:grid-cols-[86px_1fr_auto]"
    >
      <div className="relative h-24 overflow-hidden rounded-[1.15rem] bg-[#f7e6dc] sm:h-full">
        {image ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
        ) : (
          <div className="grid h-full place-items-center text-[#c5837f]">
            <Package className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">Regarding</p>
        <h3 className="mt-1 truncate text-lg font-semibold text-[#2f2626]">{title}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {price ? <p className="mt-2 text-sm font-semibold text-[#9b6b65]">From {formatBudget(price)}</p> : null}
      </div>
      <div className="hidden items-center text-muted-foreground sm:flex">
        <ChevronRight className="h-5 w-5" />
      </div>
    </Link>
  );
}

function InquiryBriefCard({
  createdAt,
  inquiry
}: {
  createdAt: Date;
  inquiry: InquiryBrief;
}) {
  const title = inquiry.listing?.title ?? inquiry.offering?.title ?? "Event Brief";
  const date = inquiry.eventDate ? formatEventDate(inquiry.eventDate) : "Date to be decided";
  const location = formatInquiryLocation(inquiry);
  const inspirationLinks = inquiry.inspirationUrls.filter(isHttpUrl);
  const inspirationImages = inquiry.inspirationUrls.filter(isVisualAttachment);

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[#eed7d1] bg-white shadow-[0_18px_45px_rgba(82,55,55,0.09)]">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(244,207,202,0.36),transparent_32%),linear-gradient(135deg,#fffaf6,#ffffff_60%,#f6efe7)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#9b6b65]">{inquiry.name} sent an inquiry</p>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            {formatMessageDate(createdAt)}
          </span>
        </div>
        <h3 className="mt-3 font-serif text-3xl leading-tight tracking-tight text-[#2f2626]">
          {title}
        </h3>
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <BriefDetail icon={<CalendarHeart className="h-4 w-4" />} label="Date" value={date} />
          <BriefDetail icon={<MapPin className="h-4 w-4" />} label="Location" value={location} />
          <BriefDetail
            icon={<UsersRound className="h-4 w-4" />}
            label="Guests"
            value={inquiry.guestCount ? `${inquiry.guestCount.toLocaleString()} Guests` : "Guest count TBD"}
          />
          <BriefDetail
            icon={<Banknote className="h-4 w-4" />}
            label="Budget"
            value={inquiry.budgetCents != null ? formatBudget(inquiry.budgetCents) : "Budget TBD"}
          />
        </div>

        {inquiry.message ? (
          <blockquote className="rounded-[1.35rem] border border-[#f0ded9] bg-[#fffdfa] px-4 py-3 font-serif text-lg leading-8 text-[#4b403c]">
            &ldquo;{inquiry.message}&rdquo;
          </blockquote>
        ) : null}

        {inspirationImages.length > 0 || inspirationLinks.length > 0 ? (
          <div className="grid gap-3 rounded-[1.35rem] border border-[#eadbd3] bg-[#fffdfa] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
              <Paperclip className="h-3.5 w-3.5" />
              Inspiration
            </div>
            {inspirationImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {inspirationImages.slice(0, 4).map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-[4/3] overflow-hidden rounded-[1.15rem] bg-[#f6efe7]"
                  >
                    <div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]" style={{ backgroundImage: `url(${url})` }} />
                  </a>
                ))}
              </div>
            ) : null}
            {inspirationLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {inspirationLinks.map((url) => {
                  const isPinterest = /pinterest\./i.test(url) || /pin\.it/i.test(url);
                  return (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e8c8c2] bg-white px-4 py-2 text-sm font-semibold text-[#9b6b65] transition hover:bg-[#fffaf6]"
                    >
                      {isPinterest ? "View Inspiration Board" : "View Inspiration"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BriefDetail({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/80 bg-[#fbf6f2] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#c5837f] shadow-sm">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-2 text-base font-semibold text-[#2f2626]">{value}</p>
    </div>
  );
}

function ChatBubble({
  body,
  createdAt,
  isMine,
  label
}: {
  body: string;
  createdAt: Date;
  isMine: boolean;
  label: string;
}) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-[1.35rem] border p-3 text-sm shadow-sm ${
          isMine ? "border-[#e7cfc8] bg-[#fffdfa]" : "border-white/80 bg-white"
        }`}
      >
        <div className="mb-1 text-xs text-muted-foreground">
          {label} · {formatMessageDate(createdAt)}
        </div>
        <div className="whitespace-pre-wrap leading-6 text-[#3d3331]">{body}</div>
      </div>
    </div>
  );
}

function IdentityAvatar({
  image,
  label,
  size
}: {
  image?: string | null;
  label: string;
  size: "lg" | "xl";
}) {
  const initials = getInitials(label);
  const dimensions = size === "xl" ? "h-16 w-16 text-lg" : "h-14 w-14 text-base";

  return (
    <div className={`${dimensions} relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,#f4cfca,#f9e8dd,#e4efe8)] font-serif font-semibold text-[#8a5c58] shadow-sm ring-2 ring-white`}>
      {image ? (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
      ) : (
        initials
      )}
    </div>
  );
}

function EmptyInbox() {
  return (
    <div className="rounded-[1.75rem] border border-white/80 bg-white/86 p-8 text-center shadow-sm">
      <Mail className="mx-auto h-8 w-8 text-[#c5837f]" />
      <h2 className="mt-4 text-xl font-semibold text-[#2f2626]">No conversations yet.</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Inquiries and vendor replies will appear here as polished conversation cards.
      </p>
    </div>
  );
}

function MarketplaceTrustPanel() {
  return (
    <div className="rounded-[1.75rem] border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-[#2f2626]">
        <Sparkles className="h-4 w-4 text-[#c5837f]" />
        Marketplace connected
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Vendor conversations stay tied to storefronts, offerings, galleries, and reviews so
        every reply feels trusted and easy to act on.
      </p>
    </div>
  );
}

function getConversationIdentity(conversation: ConversationForInbox, viewerIsVendor: boolean) {
  if (viewerIsVendor) {
    return {
      image: conversation.buyer.image,
      kind: conversation.buyer.username ? `@${conversation.buyer.username}` : "Personal Profile",
      name: conversation.buyer.name ?? conversation.buyer.username ?? "ShopFia Buyer"
    };
  }

  return {
    image: conversation.vendorProfile.logoUrl ?? conversation.vendorProfile.coverPhoto,
    kind: "Vendor Shop",
    name: conversation.vendorProfile.name
  };
}

function getContextTitle(conversation: ConversationForInbox, inquiry: InquiryBrief | null) {
  return (
    inquiry?.listing?.title ??
    inquiry?.offering?.title ??
    conversation.listing?.title ??
    conversation.offering?.title ??
    "Event Inquiry"
  );
}

function getInquiryMarkerId(body: string) {
  const match = body.match(/^INQUIRY_CARD:([a-z0-9]+)$/i);
  return match?.[1] ?? null;
}

function isLegacyInquiryMessage(body: string) {
  return /^New inquiry\b/i.test(body) || /^Inquiry for\b/i.test(body);
}

function formatEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function shortEventDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatMessageDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatBudget(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatInquiryLocation(inquiry: InquiryBrief) {
  if (inquiry.locationCity && inquiry.locationState) {
    return `${inquiry.locationCity}, ${inquiry.locationState}`;
  }

  const location = inquiry.formattedAddress ?? inquiry.eventLocation;
  if (!location) return "Location TBD";

  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const city = parts[parts.length - 3];
    const state = parts[parts.length - 2].match(/[A-Z]{2}/)?.[0];
    if (city && state) return `${city}, ${state}`;
  }

  if (parts.length >= 2) {
    const city = parts[0];
    const state = parts[1].match(/[A-Z]{2}/)?.[0] ?? parts[1];
    return `${city}, ${state}`;
  }

  return location;
}

function formatConversationLocation(conversation: ConversationForInbox) {
  const city = conversation.listing?.city ?? conversation.vendorProfile.city;
  const state = conversation.listing?.state ?? conversation.vendorProfile.state;
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? null;
}

function getInitials(label: string) {
  return label
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isVisualAttachment(value: string) {
  return value.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(value);
}
