"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Banknote,
  CalendarHeart,
  ChevronRight,
  ExternalLink,
  FileText,
  Inbox,
  Mail,
  MapPin,
  Package,
  Paperclip,
  ReceiptText,
  Send,
  Sparkles,
  UsersRound,
  X
} from "lucide-react";
import { NotificationPreferences } from "@/components/messages/notification-preferences";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedMessageConversation } from "@/lib/messages/query";

type MessagesPayload = {
  conversations: SerializedMessageConversation[];
  selectedConversationId: string | null;
  supabase: {
    anonKey: string | null;
    url: string | null;
  };
  unreadByConversation: Record<string, number>;
  unreadTotal: number;
};

type InquiryItem = SerializedMessageConversation["inquiries"][number];
type QuoteRequestItem = SerializedMessageConversation["quoteRequests"][number];
type QuoteLineForm = { description: string; quantity: number | string; unitAmount: string };
type QuoteLineItem = { description: string; quantity: number; unitAmountCents: number };

export function MessagesClient({
  currentUserId,
  initialPayload
}: {
  currentUserId: string;
  initialPayload: MessagesPayload;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState(initialPayload);
  const [selectedConversationId, setSelectedConversationId] = useState(
    initialPayload.selectedConversationId
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const previousUnreadTotal = useRef(initialPayload.unreadTotal);

  const selectedConversation = useMemo(
    () =>
      payload.conversations.find((conversation) => conversation.id === selectedConversationId) ??
      null,
    [payload.conversations, selectedConversationId]
  );

  const refreshMessages = useCallback(
    async ({ markRead = false }: { markRead?: boolean } = {}) => {
      const params = new URLSearchParams();
      if (selectedConversationId) params.set("conversationId", selectedConversationId);
      if (markRead) params.set("markRead", "1");
      const response = await fetch(`/api/messages?${params.toString()}`, {
        cache: "no-store"
      });
      if (!response.ok) return;
      const nextPayload = (await response.json()) as MessagesPayload;
      setPayload(nextPayload);
      setSelectedConversationId((current) => {
        if (current && nextPayload.conversations.some((conversation) => conversation.id === current)) {
          return current;
        }
        return nextPayload.selectedConversationId;
      });
    },
    [selectedConversationId]
  );

  const selectConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setDrawerOpen(false);
      startTransition(() => {
        router.replace(`/messages?conversationId=${conversationId}`, { scroll: false });
      });
    },
    [router, startTransition]
  );

  useEffect(() => {
    const urlConversationId = searchParams.get("conversationId");
    if (urlConversationId && urlConversationId !== selectedConversationId) {
      setSelectedConversationId(urlConversationId);
    }
  }, [searchParams, selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;
    void refreshMessages({ markRead: true });
  }, [refreshMessages, selectedConversationId]);

  useEffect(() => {
    if (!payload.supabase.url || !payload.supabase.anonKey) {
      const interval = window.setInterval(() => {
        void refreshMessages();
      }, 7000);
      return () => window.clearInterval(interval);
    }

    const supabase = createClient(payload.supabase.url, payload.supabase.anonKey);
    const channel = supabase
      .channel("shopfia-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Message" },
        () => void refreshMessages({ markRead: true })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Conversation" },
        () => void refreshMessages()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [payload.supabase.anonKey, payload.supabase.url, refreshMessages]);

  useEffect(() => {
    if (payload.unreadTotal <= previousUnreadTotal.current) {
      previousUnreadTotal.current = payload.unreadTotal;
      return;
    }

    previousUnreadTotal.current = payload.unreadTotal;
    const preferences = getNotificationPreferences();
    if (preferences.sound) playSoftPop();
    if (preferences.browser && "Notification" in window && Notification.permission === "granted") {
      const latestUnread = payload.conversations.find(
        (conversation) => (payload.unreadByConversation[conversation.id] ?? 0) > 0
      );
      const title = latestUnread
        ? `${getConversationIdentity(latestUnread, latestUnread.vendorId === currentUserId).name} on ShopFia`
        : "New ShopFia message";
      const notification = new Notification(title, {
        body: "A new message is waiting in your ShopFia inbox.",
        icon: "/logo.png"
      });
      notification.onclick = () => {
        window.focus();
        if (latestUnread) selectConversation(latestUnread.id);
      };
    }
  }, [currentUserId, payload, selectConversation]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.25rem)] max-w-[1500px] flex-col overflow-hidden rounded-[1.25rem] border border-white/75 bg-[#fffaf6] shadow-[0_24px_72px_rgba(82,55,55,0.10)] md:h-[calc(100vh-7.25rem)] md:min-h-[620px] md:rounded-[1.5rem]">
      <div className="relative grid min-h-0 flex-1 md:grid-cols-[minmax(270px,23%)_1fr]">
        <InboxPanel
          conversations={payload.conversations}
          currentUserId={currentUserId}
          isOverlay={false}
          onSelect={selectConversation}
          selectedConversationId={selectedConversationId}
          unreadByConversation={payload.unreadByConversation}
        />

        {drawerOpen ? (
          <div className="absolute inset-0 z-30 bg-[#2f2626]/20 backdrop-blur-sm md:hidden">
            <div className="h-full w-[88%] max-w-[360px] bg-[#fffaf6] shadow-[22px_0_54px_rgba(82,55,55,0.16)]">
              <div className="flex items-center justify-between border-b border-[#eadbd3] px-4 py-3">
                <div className="flex items-center gap-2 font-semibold text-[#2f2626]">
                  <Inbox className="h-4 w-4 text-[#c5837f]" />
                  Inbox
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm"
                  aria-label="Close inbox"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <InboxPanel
                conversations={payload.conversations}
                currentUserId={currentUserId}
                isOverlay
                onSelect={selectConversation}
                selectedConversationId={selectedConversationId}
                unreadByConversation={payload.unreadByConversation}
              />
            </div>
          </div>
        ) : null}

        {selectedConversation ? (
          <ConversationThread
            conversation={selectedConversation}
            currentUserId={currentUserId}
            isPending={isPending}
            onAfterSend={() => void refreshMessages({ markRead: true })}
            onOpenInbox={() => setDrawerOpen(true)}
          />
        ) : (
          <NoConversation />
        )}
      </div>
    </div>
  );
}

function InboxPanel({
  conversations,
  currentUserId,
  isOverlay,
  onSelect,
  selectedConversationId,
  unreadByConversation
}: {
  conversations: SerializedMessageConversation[];
  currentUserId: string;
  isOverlay: boolean;
  onSelect: (conversationId: string) => void;
  selectedConversationId: string | null;
  unreadByConversation: Record<string, number>;
}) {
  return (
    <aside
      className={`min-h-0 border-r border-[#eadbd3] bg-[#fff8f2] ${
        isOverlay ? "block h-[calc(100%-57px)]" : "hidden md:block"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-4 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
            Inbox
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {conversations.length === 1 ? "1 conversation" : `${conversations.length} conversations`}
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {conversations.length === 0 ? (
            <EmptyInbox />
          ) : (
            conversations.map((conversation) => (
              <InboxRow
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUserId}
                isSelected={conversation.id === selectedConversationId}
                onSelect={onSelect}
                unreadCount={unreadByConversation[conversation.id] ?? 0}
              />
            ))
          )}
        </div>
        {!isOverlay ? (
          <div className="shrink-0 border-t border-[#eadbd3] p-3">
            <NotificationPreferences compact />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function InboxRow({
  conversation,
  currentUserId,
  isSelected,
  onSelect,
  unreadCount
}: {
  conversation: SerializedMessageConversation;
  currentUserId: string;
  isSelected: boolean;
  onSelect: (conversationId: string) => void;
  unreadCount: number;
}) {
  const viewerIsVendor = conversation.vendorId === currentUserId;
  const identity = getConversationIdentity(conversation, viewerIsVendor);
  const latestInquiry = conversation.inquiries.at(-1) ?? null;
  const location = formatInboxLocation(
    latestInquiry ? formatInquiryLocation(latestInquiry) : formatConversationLocation(conversation)
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`group relative w-full rounded-[1rem] border px-2.5 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#dec4ba] hover:bg-white hover:shadow-[0_12px_26px_rgba(82,55,55,0.11)] ${
        isSelected
          ? "border-[#d8b3a9] bg-white shadow-[0_14px_30px_rgba(82,55,55,0.14),inset_3px_0_0_#d8a39c]"
          : unreadCount > 0
            ? "border-[#e1bbb2] bg-white shadow-[0_10px_24px_rgba(82,55,55,0.10)]"
            : "border-[#eadfd8] bg-[#fffdfa] shadow-[0_5px_14px_rgba(82,55,55,0.05)]"
      }`}
    >
      {unreadCount > 0 ? (
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#dd9c9b] shadow-[0_0_0_4px_rgba(221,156,155,0.14)]" />
      ) : null}
      <div className="flex items-center gap-2.5">
        <IdentityAvatar image={identity.image} label={identity.name} size="inbox" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate pr-4 text-sm font-bold leading-5 text-[#2f2626]">{identity.name}</h3>
          <p className="truncate text-xs font-semibold leading-5 text-[#5f514e]">
            Event Inquiry{location ? ` • ${location}` : ""}
          </p>
          <p className="truncate text-[11px] leading-4 text-muted-foreground">
            {formatMessageDate(conversation.lastMessageAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

function ConversationThread({
  conversation,
  currentUserId,
  isPending,
  onAfterSend,
  onOpenInbox
}: {
  conversation: SerializedMessageConversation;
  currentUserId: string;
  isPending: boolean;
  onAfterSend: () => void;
  onOpenInbox: () => void;
}) {
  const viewerIsVendor = conversation.vendorId === currentUserId;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [reviewQuoteRequest, setReviewQuoteRequest] = useState<QuoteRequestItem | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageCount = conversation.messages.length + conversation.inquiries.length;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversation.id, messageCount]);

  async function sendMessage() {
    const trimmed = body.trim();
    if (!trimmed || isSending) return;
    setError(null);
    setIsSending(true);
    setBody("");

    const response = await fetch("/api/messages", {
      body: JSON.stringify({ body: trimmed, conversationId: conversation.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });

    setIsSending(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(result?.error ?? "That message could not be sent.");
      setBody(trimmed);
      return;
    }

    onAfterSend();
  }

  return (
    <section className="flex min-h-0 flex-col bg-white">
      <div className="shrink-0 border-b border-[#eadbd3] bg-[linear-gradient(135deg,#fffdf9,#ffffff_62%,#f6efe7)] px-2.5 py-2 md:px-4">
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={onOpenInbox}
            className="grid w-9 shrink-0 place-items-center rounded-[1rem] bg-white text-[#8a5c58] shadow-sm md:hidden"
            aria-label="Open inbox"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <ContextCard conversation={conversation} />
          {viewerIsVendor ? (
            <button
              type="button"
              onClick={() => setQuoteBuilderOpen(true)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[1rem] bg-[#D7E5D0] px-3 text-xs font-bold text-[#fffaf6] shadow-[0_10px_22px_rgba(110,130,104,0.18)] transition hover:bg-[#C4D6BC]"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Build Quote</span>
              <span className="sm:hidden">Quote</span>
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[linear-gradient(180deg,#fffaf6,#ffffff_34%)] px-2.5 py-2.5 md:space-y-2.5 md:px-4 md:py-3"
      >
        <ConversationItems
          conversation={conversation}
          currentUserId={currentUserId}
          onBuildQuote={() => setQuoteBuilderOpen(true)}
          onReviewQuote={setReviewQuoteRequest}
          viewerIsVendor={viewerIsVendor}
        />
      </div>

      <div className="shrink-0 border-t border-[#f0dfda] bg-white px-2.5 py-2 md:px-4">
        <div className="rounded-[1.1rem] border border-[#eadbd7] bg-[#fffdfa] p-1.5 shadow-sm md:rounded-[1.35rem] md:p-2">
          <Textarea
            name="body"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={viewerIsVendor ? "Reply with availability, pricing, or next steps..." : "Reply to the vendor..."}
            value={body}
            className="min-h-[40px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 md:min-h-[54px] md:py-2"
            required
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {isPending || isSending ? "Sending through ShopFia..." : "Replies stay connected to this inquiry."}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void sendMessage()}
              disabled={!body.trim() || isSending}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
          {error ? <p className="px-2 pb-1 text-xs font-medium text-red-600">{error}</p> : null}
        </div>
      </div>
      {quoteBuilderOpen ? (
        <QuoteBuilderModal
          conversation={conversation}
          onClose={() => setQuoteBuilderOpen(false)}
          onSent={() => {
            setQuoteBuilderOpen(false);
            onAfterSend();
          }}
        />
      ) : null}
      {reviewQuoteRequest?.quote ? (
        <QuoteReviewModal
          conversation={conversation}
          onClose={() => setReviewQuoteRequest(null)}
          onRequestedChanges={() => {
            setReviewQuoteRequest(null);
            onAfterSend();
          }}
          quoteRequest={reviewQuoteRequest}
        />
      ) : null}
    </section>
  );
}

function ConversationItems({
  conversation,
  currentUserId,
  onBuildQuote,
  onReviewQuote,
  viewerIsVendor
}: {
  conversation: SerializedMessageConversation;
  currentUserId: string;
  onBuildQuote: () => void;
  onReviewQuote: (quoteRequest: QuoteRequestItem) => void;
  viewerIsVendor: boolean;
}) {
  const inquiriesById = new Map(conversation.inquiries.map((inquiry) => [inquiry.id, inquiry]));
  const renderedInquiryIds = new Set<string>();
  const nextUnrenderedInquiry = () =>
    conversation.inquiries.find((inquiry) => !renderedInquiryIds.has(inquiry.id));

  return (
    <>
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
            image={
              message.senderId === conversation.buyerId
                ? conversation.buyer.image
                : conversation.vendorProfile.logoUrl ?? conversation.vendorProfile.coverPhoto
            }
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
      {conversation.quoteRequests.map((quoteRequest) => (
        <QuoteWorkflowCard
          key={quoteRequest.id}
          quoteRequest={quoteRequest}
          onBuildQuote={onBuildQuote}
          onReviewQuote={onReviewQuote}
          viewerIsVendor={viewerIsVendor}
        />
      ))}
      {viewerIsVendor && conversation.inquiries.length > 0 && conversation.quoteRequests.length === 0 ? (
        <BuildQuotePromptCard onBuildQuote={onBuildQuote} />
      ) : null}
    </>
  );
}

function ContextCard({ conversation }: { conversation: SerializedMessageConversation }) {
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
      className="grid min-w-0 flex-1 gap-2 rounded-[1rem] border border-white/80 bg-white/85 p-2 shadow-sm transition hover:shadow-[0_12px_28px_rgba(82,55,55,0.10)] sm:grid-cols-[48px_1fr_auto]"
    >
      <div className="relative hidden h-12 overflow-hidden rounded-[0.8rem] bg-[#f7e6dc] sm:block">
        {image ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
        ) : (
          <div className="grid h-full place-items-center text-[#c5837f]">
            <Package className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">Regarding</p>
        <h3 className="truncate text-sm font-bold text-[#2f2626]">{title}</h3>
        <p className="hidden truncate text-[11px] text-muted-foreground sm:block">{description}</p>
        {price ? <p className="mt-0.5 text-xs font-semibold text-[#9b6b65]">From {formatBudget(price)}</p> : null}
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
  createdAt: string;
  inquiry: InquiryItem;
}) {
  const title = inquiry.listing?.title ?? inquiry.offering?.title ?? "Event Brief";
  const date = inquiry.eventDate ? formatEventDate(inquiry.eventDate) : "Date TBD";
  const location = formatInquiryLocation(inquiry);
  const inspirationLinks = inquiry.inspirationUrls.filter(isHttpUrl);
  const inspirationImages = inquiry.inspirationUrls.filter(isVisualAttachment);
  const compactMeta = [
    inquiry.eventDate ? shortEventDate(inquiry.eventDate) : "Date TBD",
    location,
    inquiry.budgetCents != null ? formatBudget(inquiry.budgetCents) : "Budget TBD"
  ];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mx-auto flex w-full max-w-[92%] items-center gap-3 rounded-[1.1rem] border border-[#eadbd3] bg-white px-3 py-2 text-left shadow-[0_10px_26px_rgba(82,55,55,0.08)] md:hidden"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[0.9rem] bg-[linear-gradient(135deg,#f4cfca,#f9e8dd,#e4efe8)] text-[#9b6b65]">
          {inspirationImages[0] ? (
            <span
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${inspirationImages[0]})` }}
            />
          ) : (
            <FileText className="h-5 w-5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9b6b65]">
            Event Brief Attached
          </span>
          <span className="mt-0.5 block truncate text-sm font-bold text-[#2f2626]">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {compactMeta.join(" • ")}
          </span>
          {inquiry.message ? (
            <span className="mt-1 block truncate text-xs text-[#6a5b56]">{inquiry.message}</span>
          ) : null}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#9b6b65]" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-[#2f2626]/30 p-3 backdrop-blur-sm md:hidden">
          <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_70px_rgba(47,38,38,0.22)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#eadbd3] bg-[#fffaf6] px-4 py-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9b6b65]">
                  Event Brief
                </p>
                <h3 className="truncate text-base font-bold text-[#2f2626]">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm"
                aria-label="Close event brief"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <FullInquiryBrief
                compact
                createdAt={createdAt}
                date={date}
                inquiry={inquiry}
                inspirationImages={inspirationImages}
                inspirationLinks={inspirationLinks}
                location={location}
                title={title}
              />
            </div>
          </div>
        </div>
      ) : null}

      <FullInquiryBrief
        createdAt={createdAt}
        date={date}
        inquiry={inquiry}
        inspirationImages={inspirationImages}
        inspirationLinks={inspirationLinks}
        location={location}
        title={title}
      />
    </>
  );
}

function FullInquiryBrief({
  compact = false,
  createdAt,
  date,
  inquiry,
  inspirationImages,
  inspirationLinks,
  location,
  title
}: {
  compact?: boolean;
  createdAt: string;
  date: string;
  inquiry: InquiryItem;
  inspirationImages: string[];
  inspirationLinks: string[];
  location: string;
  title: string;
}) {
  return (
    <article className={`${compact ? "block" : "mx-auto hidden md:block"} w-full max-w-3xl overflow-hidden rounded-[1.35rem] border border-[#eed7d1] bg-white shadow-[0_14px_34px_rgba(82,55,55,0.08)]`}>
      <div className="bg-[linear-gradient(135deg,#fffaf6,#ffffff_64%,#f6efe7)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-[#9b6b65]">{inquiry.name} sent an inquiry</p>
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {formatMessageDate(createdAt)}
          </span>
        </div>
        <h3 className="mt-2 font-serif text-2xl leading-tight tracking-tight text-[#2f2626] md:text-3xl">
          {title}
        </h3>
      </div>

      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <BriefDetail icon={<CalendarHeart className="h-4 w-4" />} label="Date" value={date} />
          <BriefDetail icon={<MapPin className="h-4 w-4" />} label="Location" value={location} />
          <BriefDetail
            icon={<UsersRound className="h-4 w-4" />}
            label="Guests"
            value={inquiry.guestCount ? `${inquiry.guestCount.toLocaleString()}` : "TBD"}
          />
          <BriefDetail
            icon={<Banknote className="h-4 w-4" />}
            label="Budget"
            value={inquiry.budgetCents != null ? formatBudget(inquiry.budgetCents) : "TBD"}
          />
        </div>

        {inquiry.message ? (
          <blockquote className="rounded-[1.1rem] border border-[#f0ded9] bg-[#fffdfa] px-4 py-3 font-serif text-base leading-7 text-[#4b403c] md:text-lg">
            &ldquo;{inquiry.message}&rdquo;
          </blockquote>
        ) : null}

        {inspirationImages.length > 0 || inspirationLinks.length > 0 ? (
          <div className="grid gap-2 rounded-[1.1rem] border border-[#eadbd3] bg-[#fffdfa] p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
              <Paperclip className="h-3.5 w-3.5" />
              Inspiration
            </div>
            {inspirationImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {inspirationImages.slice(0, 4).map((url, index) => (
                  <a
                    key={`${url}-${index}`}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-square overflow-hidden rounded-[0.95rem] bg-[#f6efe7]"
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
                      className="inline-flex w-fit items-center gap-2 rounded-full border border-[#e8c8c2] bg-white px-3 py-1.5 text-xs font-bold text-[#9b6b65] transition hover:bg-[#fffaf6]"
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

function QuoteWorkflowCard({
  onBuildQuote,
  onReviewQuote,
  quoteRequest,
  viewerIsVendor
}: {
  onBuildQuote: () => void;
  onReviewQuote: (quoteRequest: QuoteRequestItem) => void;
  quoteRequest: QuoteRequestItem;
  viewerIsVendor: boolean;
}) {
  const quote = quoteRequest.quote;
  const href = viewerIsVendor ? "/vendor/dashboard#requests" : "/account#quotes";
  const quoteDetails = parseQuoteDetails(quote?.lineItemsJson);
  const title = quoteDetails.title ?? quoteRequest.offering?.title ?? "Custom Event Quote";

  return (
    <article className="mx-auto w-full max-w-[92%] rounded-[1.1rem] border border-[#e7d3c9] bg-white px-3 py-2.5 shadow-[0_10px_26px_rgba(82,55,55,0.08)] md:max-w-2xl md:px-4 md:py-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] bg-[#fff4f0] text-[#9b6b65]">
          <ReceiptText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-[#9b6b65]">
              {quote ? "Quote Sent" : "Quote Request"}
            </p>
            <span className="rounded-full bg-[#fbf1ed] px-2 py-0.5 text-[11px] font-bold text-[#8f5f5b]">
              {quoteRequest.status.toLowerCase()}
            </span>
          </div>
          <h3 className="mt-0.5 truncate text-sm font-bold text-[#2f2626] md:text-base">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {quote
              ? `${formatBudget(quote.amountCents)}${quote.depositAmountCents ? ` • ${formatBudget(quote.depositAmountCents)} deposit` : ""}`
              : viewerIsVendor
                ? "Build a custom quote from this inquiry."
                : "The vendor can send pricing here once details are confirmed."}
          </p>
          {quote?.notes ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#6a5b56]">{quote.notes}</p>
          ) : null}
          {quoteDetails.lineItems.length > 0 ? (
            <div className="mt-2 grid gap-1 border-t border-[#f0dfda] pt-2">
              {quoteDetails.lineItems.slice(0, 3).map((item, index) => (
                <div key={`${item.description}-${index}`} className="flex items-center justify-between gap-3 text-xs text-[#5f514e]">
                  <span className="truncate">{item.description}</span>
                  <span className="shrink-0 font-bold text-[#2f2626]">
                    {formatBudget(Math.round(item.quantity * item.unitAmountCents))}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {quote && viewerIsVendor ? (
            <Link
              href={href}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#D7E5D0] px-3 py-1.5 text-xs font-bold text-[#fffaf6] shadow-[0_8px_18px_rgba(110,130,104,0.16)] transition hover:bg-[#C4D6BC]"
            >
              Manage Quote
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : quote ? (
            <button
              type="button"
              onClick={() => onReviewQuote(quoteRequest)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#D7E5D0] px-3 py-1.5 text-xs font-bold text-[#fffaf6] shadow-[0_8px_18px_rgba(110,130,104,0.16)] transition hover:bg-[#C4D6BC]"
            >
              Review Quote
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : viewerIsVendor ? (
            <button
              type="button"
              onClick={onBuildQuote}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#D7E5D0] px-3 py-1.5 text-xs font-bold text-[#fffaf6] shadow-[0_8px_18px_rgba(110,130,104,0.16)] transition hover:bg-[#C4D6BC]"
            >
              Build Quote
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <span className="mt-2 inline-flex rounded-full bg-[#fbf1ed] px-3 py-1.5 text-xs font-bold text-[#8f5f5b]">
              Waiting on Quote
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function QuoteReviewModal({
  conversation,
  onClose,
  onRequestedChanges,
  quoteRequest
}: {
  conversation: SerializedMessageConversation;
  onClose: () => void;
  onRequestedChanges: () => void;
  quoteRequest: QuoteRequestItem;
}) {
  const quote = quoteRequest.quote;
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentPrepared, setPaymentPrepared] = useState<{ orderId: string } | null>(null);

  if (!quote) return null;

  const reviewedQuote = quote;
  const quoteDetails = parseQuoteDetails(reviewedQuote.lineItemsJson);
  const title = quoteDetails.title ?? quoteRequest.offering?.title ?? "Custom Event Quote";
  const eventDate = quoteRequest.eventDate ? formatEventDate(quoteRequest.eventDate) : "Date TBD";
  const eventLocation = formatQuoteRequestLocation(quoteRequest.eventLocation);
  const subtotalCents = quoteDetails.lineItems.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitAmountCents),
    0
  );
  const requiredDepositCents = reviewedQuote.depositAmountCents ?? reviewedQuote.amountCents;
  const paymentTerms =
    reviewedQuote.depositAmountCents && reviewedQuote.depositAmountCents < reviewedQuote.amountCents
      ? `${formatDepositPercent(reviewedQuote.depositAmountCents, reviewedQuote.amountCents)} deposit required to secure booking`
      : "Full payment required to secure booking";
  const image =
    conversation.offering?.photos[0] ??
    conversation.listing?.offering?.photos[0] ??
    conversation.vendorProfile.coverPhoto ??
    conversation.vendorProfile.logoUrl;

  async function acceptQuote() {
    if (isAccepting) return;
    setError(null);
    setIsAccepting(true);
    const response = await fetch("/api/messages/quotes/accept", {
      body: JSON.stringify({ quoteId: reviewedQuote.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setIsAccepting(false);

    const result = (await response.json().catch(() => null)) as
      | { error?: string; orderId?: string }
      | null;
    if (!response.ok || !result?.orderId) {
      setError(result?.error ?? "Could not prepare payment yet.");
      return;
    }

    setPaymentPrepared({ orderId: result.orderId });
  }

  async function requestChanges() {
    if (isRequestingChanges) return;
    setError(null);
    setIsRequestingChanges(true);
    const response = await fetch("/api/messages/quotes/request-changes", {
      body: JSON.stringify({ conversationId: conversation.id, quoteId: reviewedQuote.id }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setIsRequestingChanges(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(result?.error ?? "Could not send the revision request.");
      return;
    }

    onRequestedChanges();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#2f2626]/25 p-3 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_70px_rgba(47,38,38,0.24)] md:h-auto md:max-h-[90vh]">
        <div className="relative shrink-0 overflow-hidden border-b border-[#eadbd3] bg-[#fffaf6]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#fffaf6,#ffffff_58%,#eef5eb)]" />
          <div className="relative flex items-start gap-3 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.1rem] bg-[#f7e6dc] shadow-sm">
              {image ? (
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
              ) : (
                <div className="grid h-full place-items-center text-[#9b6b65]">
                  <ReceiptText className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9b6b65]">
                Proposal from {conversation.vendorProfile.name}
              </p>
              <h2 className="mt-1 text-xl font-bold leading-tight text-[#2f2626]">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {eventDate} • {eventLocation}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm"
              aria-label="Close quote review"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <div className="rounded-[1.15rem] border border-[#eadbd3] bg-[#fffdfa] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9b6b65]">Payment terms</p>
                  <p className="mt-1 text-sm font-bold text-[#2f2626]">{paymentTerms}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-[#6f8469] shadow-sm">
                  {formatBudget(requiredDepositCents)}
                </span>
              </div>
            </div>

            {quoteDetails.lineItems.length > 0 ? (
              <div className="rounded-[1.15rem] border border-[#eadbd3] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9b6b65]">Included</p>
                <div className="mt-2 grid gap-2">
                  {quoteDetails.lineItems.map((item, index) => (
                    <div key={`${item.description}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#2f2626]">{item.description}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity}</p>
                      </div>
                      <span className="shrink-0 font-bold text-[#2f2626]">
                        {formatBudget(Math.round(item.quantity * item.unitAmountCents))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.15rem] border border-[#eadbd3] bg-white p-3">
              <div className="grid gap-2 text-sm">
                {subtotalCents > 0 ? (
                  <QuoteReviewTotalRow label="Subtotal" value={formatBudget(subtotalCents)} />
                ) : null}
                {quoteDetails.setupFeeCents > 0 ? (
                  <QuoteReviewTotalRow label="Setup fee" value={formatBudget(quoteDetails.setupFeeCents)} />
                ) : null}
                {quoteDetails.deliveryFeeCents > 0 ? (
                  <QuoteReviewTotalRow label="Delivery fee" value={formatBudget(quoteDetails.deliveryFeeCents)} />
                ) : null}
                {quoteDetails.taxCents > 0 ? (
                  <QuoteReviewTotalRow label="Taxes" value={formatBudget(quoteDetails.taxCents)} />
                ) : null}
                <div className="border-t border-[#f0dfda] pt-2">
                  <QuoteReviewTotalRow label="Proposal total" value={formatBudget(reviewedQuote.amountCents)} strong />
                </div>
              </div>
            </div>

            {reviewedQuote.notes ? (
              <div className="rounded-[1.15rem] border border-[#eadbd3] bg-[#fffdfa] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#9b6b65]">Note from vendor</p>
                <p className="mt-2 text-sm leading-6 text-[#4b403c]">{reviewedQuote.notes}</p>
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Expires {formatEventDate(reviewedQuote.expiresAt)}. Approval comes first; payment is the next secure step.
            </p>

            {paymentPrepared ? (
              <div className="rounded-[1.15rem] border border-[#d7e5d0] bg-[#f5faf2] p-3 text-sm text-[#4f6548]">
                Your proposal is approved and the secure payment step is ready. Order {paymentPrepared.orderId.slice(-6).toUpperCase()} has been created.
              </div>
            ) : null}
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="grid shrink-0 gap-2 border-t border-[#eadbd3] bg-white p-3 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={() => void requestChanges()}
            disabled={isRequestingChanges || isAccepting || Boolean(paymentPrepared)}
            className="rounded-full border border-[#eadbd3] bg-white px-4 py-2 text-sm font-bold text-[#8a5c58] transition hover:bg-[#fffaf6] disabled:opacity-50"
          >
            {isRequestingChanges ? "Sending..." : "Request Changes"}
          </button>
          <button
            type="button"
            onClick={() => void acceptQuote()}
            disabled={isAccepting || isRequestingChanges || Boolean(paymentPrepared)}
            className="rounded-full bg-[#D7E5D0] px-4 py-2 text-sm font-bold text-[#fffaf6] shadow-[0_10px_22px_rgba(110,130,104,0.18)] transition hover:bg-[#C4D6BC] disabled:opacity-50"
          >
            {isAccepting ? "Preparing Payment..." : "Accept & Continue to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuoteReviewTotalRow({
  label,
  strong = false,
  value
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "font-bold text-[#2f2626]" : "text-[#5f514e]"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function BuildQuotePromptCard({ onBuildQuote }: { onBuildQuote: () => void }) {
  return (
    <article className="mx-auto w-full max-w-[92%] rounded-[1.1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2.5 shadow-[0_10px_26px_rgba(82,55,55,0.07)] md:max-w-2xl md:px-4 md:py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.9rem] bg-white text-[#9b6b65] shadow-sm">
          <ReceiptText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#2f2626]">Ready to price this event?</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Send a custom quote once the details feel clear.
          </p>
        </div>
        <button
          type="button"
          onClick={onBuildQuote}
          className="shrink-0 rounded-full bg-[#D7E5D0] px-3 py-1.5 text-xs font-bold text-[#fffaf6] shadow-[0_8px_18px_rgba(110,130,104,0.16)] transition hover:bg-[#C4D6BC]"
        >
          Build Quote
        </button>
      </div>
    </article>
  );
}

function QuoteBuilderModal({
  conversation,
  onClose,
  onSent
}: {
  conversation: SerializedMessageConversation;
  onClose: () => void;
  onSent: () => void;
}) {
  const latestInquiry = conversation.inquiries.at(-1);
  const defaultTitle = conversation.offering?.title ?? latestInquiry?.offering?.title ?? latestInquiry?.listing?.title ?? "Custom Event Quote";
  const [title, setTitle] = useState(defaultTitle);
  const [lineItems, setLineItems] = useState<QuoteLineForm[]>([
    { description: defaultTitle, quantity: 1, unitAmount: "" }
  ]);
  const [setupFee, setSetupFee] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [tax, setTax] = useState("");
  const [depositPercent, setDepositPercent] = useState("50");
  const [paymentPreference, setPaymentPreference] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [expiresAt, setExpiresAt] = useState(() => getDefaultExpirationDate());
  const [notes, setNotes] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalCents = lineItems.reduce(
    (sum, item) => sum + dollarsToCents(item.unitAmount) * Math.max(1, Number(item.quantity) || 1),
    0
  );
  const totalCents =
    subtotalCents + dollarsToCents(setupFee) + dollarsToCents(deliveryFee) + dollarsToCents(tax);
  const depositCents =
    paymentPreference === "DEPOSIT"
      ? Math.round(totalCents * ((Number(depositPercent) || 0) / 100))
      : totalCents;

  function updateLineItem(index: number, field: "description" | "quantity" | "unitAmount", value: string | number) {
    setLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  async function sendQuote() {
    setError(null);
    setIsSending(true);
    const response = await fetch("/api/messages/quotes", {
      body: JSON.stringify({
        conversationId: conversation.id,
        deliveryFeeCents: dollarsToCents(deliveryFee),
        depositPercent: Number(depositPercent) || 0,
        expiresAt,
        lineItems: lineItems
          .filter((item) => item.description.trim())
          .map((item) => ({
            description: item.description.trim(),
            quantity: Math.max(1, Number(item.quantity) || 1),
            unitAmountCents: dollarsToCents(item.unitAmount)
          })),
        notes,
        paymentPreference,
        setupFeeCents: dollarsToCents(setupFee),
        taxCents: dollarsToCents(tax),
        title
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    setIsSending(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(result?.error ?? "Could not send quote.");
      return;
    }

    onSent();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#2f2626]/30 p-3 backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_24px_70px_rgba(47,38,38,0.24)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#eadbd3] bg-[#fffaf6] px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#9b6b65]">
              Build Quote
            </p>
            <h2 className="text-lg font-bold text-[#2f2626]">Custom proposal for this inquiry</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm"
            aria-label="Close quote builder"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
              Quote title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm font-medium outline-none focus:border-[#d8a39c]"
              />
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-[#2f2626]">Line items</p>
                <button
                  type="button"
                  onClick={() => setLineItems((current) => [...current, { description: "", quantity: 1, unitAmount: "" }])}
                  className="rounded-full border border-[#eadbd3] bg-white px-3 py-1.5 text-xs font-bold text-[#8f5f5b]"
                >
                  Add item
                </button>
              </div>
              {lineItems.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] p-2 sm:grid-cols-[1fr_80px_120px]">
                  <input
                    value={item.description}
                    onChange={(event) => updateLineItem(index, "description", event.target.value)}
                    placeholder="Package or service"
                    className="rounded-[0.8rem] border border-[#eadbd3] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    value={item.quantity}
                    onChange={(event) => updateLineItem(index, "quantity", event.target.value)}
                    placeholder="Qty"
                    type="number"
                    min="1"
                    className="rounded-[0.8rem] border border-[#eadbd3] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    value={item.unitAmount}
                    onChange={(event) => updateLineItem(index, "unitAmount", event.target.value)}
                    placeholder="$ Amount"
                    inputMode="decimal"
                    className="rounded-[0.8rem] border border-[#eadbd3] bg-white px-3 py-2 text-sm outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MoneyInput label="Setup fee" value={setupFee} onChange={setSetupFee} />
              <MoneyInput label="Delivery fee" value={deliveryFee} onChange={setDeliveryFee} />
              <MoneyInput label="Taxes" value={tax} onChange={setTax} />
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
                Payment
                <select
                  value={paymentPreference}
                  onChange={(event) => setPaymentPreference(event.target.value as "DEPOSIT" | "FULL")}
                  className="rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm outline-none"
                >
                  <option value="DEPOSIT">Deposit</option>
                  <option value="FULL">Full payment</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
                Deposit %
                <input
                  value={depositPercent}
                  onChange={(event) => setDepositPercent(event.target.value)}
                  type="number"
                  min="0"
                  max="100"
                  disabled={paymentPreference === "FULL"}
                  className="rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm outline-none disabled:opacity-50"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
                Expires
                <input
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  type="date"
                  className="rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
              Notes to buyer
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Share what is included, timeline, or next steps..."
                className="min-h-24 rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm outline-none"
              />
            </label>

            <div className="rounded-[1.1rem] border border-[#eadbd3] bg-[#fffaf6] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold text-[#2f2626]">Quote total</span>
                <span className="font-bold text-[#2f2626]">{formatBudget(totalCents)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{paymentPreference === "DEPOSIT" ? "Deposit due after approval" : "Full payment due after approval"}</span>
                <span>{formatBudget(depositCents)}</span>
              </div>
            </div>
            {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#eadbd3] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#eadbd3] bg-white px-4 py-2 text-sm font-bold text-[#6a5b56]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void sendQuote()}
            disabled={isSending || totalCents <= 0}
            className="rounded-full bg-[#D7E5D0] px-4 py-2 text-sm font-bold text-[#fffaf6] shadow-[0_10px_22px_rgba(110,130,104,0.18)] transition hover:bg-[#C4D6BC] disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send Quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoneyInput({
  label,
  onChange,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-bold text-[#2f2626]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        placeholder="$0"
        className="rounded-[1rem] border border-[#eadbd3] bg-[#fffdfa] px-3 py-2 text-sm outline-none"
      />
    </label>
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
    <div className="min-w-0 rounded-[1rem] border border-white/80 bg-[#fbf6f2] p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9b6b65]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[#c5837f] shadow-sm">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-sm font-bold text-[#2f2626]">{value}</p>
    </div>
  );
}

function ChatBubble({
  body,
  createdAt,
  image,
  isMine,
  label
}: {
  body: string;
  createdAt: string;
  image?: string | null;
  isMine: boolean;
  label: string;
}) {
  return (
    <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
      {!isMine ? <IdentityAvatar image={image} label={label} size="sm" /> : null}
      <div
        className={`max-w-[76%] rounded-[1.15rem] border px-3 py-2 text-sm shadow-sm md:max-w-[64%] ${
          isMine ? "border-[#e7cfc8] bg-[#fff5f2]" : "border-white/80 bg-white"
        }`}
      >
        <div className="mb-1 text-[11px] text-muted-foreground">
          {label} · {formatMessageDate(createdAt)}
        </div>
        <div className="whitespace-pre-wrap leading-6 text-[#3d3331]">{body}</div>
      </div>
      {isMine ? <IdentityAvatar image={image} label={label} size="sm" /> : null}
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
  size: "sm" | "inbox" | "md" | "lg";
}) {
  const initials = getInitials(label);
  const dimensions =
    size === "lg"
      ? "h-12 w-12 text-base"
      : size === "md"
        ? "h-11 w-11 text-sm"
        : size === "inbox"
          ? "h-9 w-9 text-xs"
          : "h-7 w-7 text-[10px]";

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
    <div className="rounded-[1.25rem] border border-white/80 bg-white/86 p-5 text-center shadow-sm">
      <Mail className="mx-auto h-7 w-7 text-[#c5837f]" />
      <h2 className="mt-3 text-base font-semibold text-[#2f2626]">No conversations yet.</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Inquiries and vendor replies will appear here.
      </p>
    </div>
  );
}

function NoConversation() {
  return (
    <main className="grid min-h-0 place-items-center bg-white p-6">
      <div className="max-w-md text-center">
        <Sparkles className="mx-auto h-8 w-8 text-[#c5837f]" />
        <h2 className="mt-3 text-xl font-semibold text-[#2f2626]">Choose a conversation</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Your inquiry details, inspiration, and replies will open here in one continuous thread.
        </p>
      </div>
    </main>
  );
}

function getConversationIdentity(
  conversation: SerializedMessageConversation,
  viewerIsVendor: boolean
) {
  if (viewerIsVendor) {
    return {
      image: conversation.buyer.image,
      kind: conversation.buyer.username ? `@${conversation.buyer.username}` : "Personal",
      name: conversation.buyer.name ?? conversation.buyer.username ?? "ShopFia Buyer"
    };
  }

  return {
    image: conversation.vendorProfile.logoUrl ?? conversation.vendorProfile.coverPhoto,
    kind: "Vendor Shop",
    name: conversation.vendorProfile.name
  };
}

function getInquiryMarkerId(body: string) {
  const match = body.match(/^INQUIRY_CARD:([a-z0-9]+)$/i);
  return match?.[1] ?? null;
}

function isLegacyInquiryMessage(body: string) {
  return /^New inquiry\b/i.test(body) || /^Inquiry for\b/i.test(body);
}

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(date));
}

function shortEventDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(date));
}

function formatMessageDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(date));
}

function formatBudget(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatInquiryLocation(inquiry: InquiryItem) {
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

function formatConversationLocation(conversation: SerializedMessageConversation) {
  const city = conversation.listing?.city ?? conversation.vendorProfile.city;
  const state = conversation.listing?.state ?? conversation.vendorProfile.state;
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? null;
}

function formatInboxLocation(location: string | null) {
  if (!location) return null;
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] ?? location;
  const state = parts[1]?.match(/[A-Z]{2}/)?.[0] ?? parts[1];
  if (/^san francisco$/i.test(city)) return "SF";
  return state ? `${city}, ${state}` : city;
}

function formatQuoteRequestLocation(location: string) {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const city = parts[parts.length - 3];
    const state = parts[parts.length - 2].match(/[A-Z]{2}/)?.[0];
    if (city && state) return `${city}, ${state}`;
  }
  return formatInboxLocation(location) ?? location;
}

function formatDepositPercent(depositCents: number, totalCents: number) {
  if (totalCents <= 0) return "Deposit";
  const percent = Math.round((depositCents / totalCents) * 100);
  return `${percent}%`;
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

function dollarsToCents(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function getDefaultExpirationDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

function parseQuoteDetails(value: unknown): {
  deliveryFeeCents: number;
  lineItems: QuoteLineItem[];
  setupFeeCents: number;
  taxCents: number;
  title: string | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { deliveryFeeCents: 0, lineItems: [], setupFeeCents: 0, taxCents: 0, title: null };
  }

  const details = value as {
    deliveryFeeCents?: unknown;
    lineItems?: unknown;
    setupFeeCents?: unknown;
    taxCents?: unknown;
    title?: unknown;
  };

  return {
    deliveryFeeCents: typeof details.deliveryFeeCents === "number" ? details.deliveryFeeCents : 0,
    lineItems: Array.isArray(details.lineItems)
      ? details.lineItems
          .map((item) => {
            if (!item || typeof item !== "object") return null;
            const line = item as { description?: unknown; quantity?: unknown; unitAmountCents?: unknown };
            if (typeof line.description !== "string" || typeof line.unitAmountCents !== "number") {
              return null;
            }
            return {
              description: line.description,
              quantity: typeof line.quantity === "number" ? line.quantity : 1,
              unitAmountCents: line.unitAmountCents
            };
          })
          .filter((item): item is QuoteLineItem => Boolean(item))
      : [],
    setupFeeCents: typeof details.setupFeeCents === "number" ? details.setupFeeCents : 0,
    taxCents: typeof details.taxCents === "number" ? details.taxCents : 0,
    title: typeof details.title === "string" ? details.title : null
  };
}

function playSoftPop() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const audioContext = new AudioContextCtor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(760, audioContext.currentTime + 0.055);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.13);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.14);
}

function getNotificationPreferences() {
  const fallback = { browser: false, email: true, sms: false, sound: false };
  try {
    const stored = window.localStorage.getItem("shopfia-message-notification-preferences");
    return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
  } catch {
    return fallback;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
