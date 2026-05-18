"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Banknote,
  Bell,
  CalendarHeart,
  ChevronRight,
  ExternalLink,
  FileText,
  Inbox,
  Mail,
  MapPin,
  Menu,
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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#eadbd3] bg-[linear-gradient(135deg,#fffdf9,#ffffff_54%,#f6efe7)] px-3 py-2.5 md:px-5 md:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm md:hidden"
            aria-label="Open inbox"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#9b6b65]">
              <Sparkles className="h-3.5 w-3.5" />
              ShopFia Inbox
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[#2f2626] md:text-3xl">
              Messages
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-white px-2.5 py-1.5 text-xs font-semibold text-[#2f2626] shadow-sm md:px-3 md:py-2 md:text-sm">
          <Bell className="h-4 w-4 text-[#c5837f]" />
          {payload.unreadTotal > 0 ? `${payload.unreadTotal} unread` : "Caught up"}
        </div>
      </header>

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
  const latestMessage = [...conversation.messages]
    .reverse()
    .find((message) => !getInquiryMarkerId(message.body) && !isLegacyInquiryMessage(message.body));
  const contextTitle = getContextTitle(conversation, latestInquiry);
  const preview = latestInquiry?.message ?? latestMessage?.body ?? "A new ShopFia conversation is ready.";
  const dateLabel = latestInquiry?.eventDate ? shortEventDate(latestInquiry.eventDate) : null;
  const location = latestInquiry ? formatInquiryLocation(latestInquiry) : formatConversationLocation(conversation);
  const budget = latestInquiry?.budgetCents != null ? formatBudget(latestInquiry.budgetCents) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`group relative w-full rounded-[1.25rem] border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(82,55,55,0.13)] ${
        isSelected
          ? "border-[#d8b3a9] bg-white shadow-[0_16px_38px_rgba(82,55,55,0.16),inset_4px_0_0_#d8a39c]"
          : unreadCount > 0
            ? "border-[#e1bbb2] bg-white shadow-[0_12px_28px_rgba(82,55,55,0.12)]"
            : "border-[#eadfd8] bg-[#fffdfa] shadow-[0_8px_18px_rgba(82,55,55,0.07)]"
      }`}
    >
      {unreadCount > 0 ? (
        <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#dd9c9b] shadow-[0_0_0_5px_rgba(221,156,155,0.16)]" />
      ) : null}
      <div className="flex gap-3">
        <IdentityAvatar image={identity.image} label={identity.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 pr-4">
            <h3 className="truncate text-sm font-bold text-[#2f2626]">{identity.name}</h3>
            <span className="shrink-0 rounded-full bg-[#fbf1ed] px-2 py-0.5 text-[11px] font-semibold text-[#9b6b65]">
              {identity.kind}
            </span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#5f514e]">
            {contextTitle}
            {dateLabel ? ` • ${dateLabel}` : ""}
          </p>
          {location ? (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {preview}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>{formatMessageDate(conversation.lastMessageAt)}</span>
            {budget ? (
              <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[#9b6b65]">
                {budget}
              </span>
            ) : null}
          </div>
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
  const identity = getConversationIdentity(conversation, viewerIsVendor);
  const latestInquiry = conversation.inquiries.at(-1) ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
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
      <div className="shrink-0 border-b border-[#eadbd3] bg-[linear-gradient(135deg,#fffdf9,#ffffff_62%,#f6efe7)] px-3 py-2 md:px-5 md:py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenInbox}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#8a5c58] shadow-sm md:hidden"
            aria-label="Open inbox"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Link
            href={viewerIsVendor ? `/profiles/${conversation.buyer.username ?? ""}` : `/vendor/profile/${conversation.vendorProfile.slug}`}
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-[1.25rem] transition hover:bg-white/70 ${viewerIsVendor && !conversation.buyer.username ? "pointer-events-none" : ""}`}
          >
            <IdentityAvatar image={identity.image} label={identity.name} size="lg" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="truncate text-base font-bold text-[#2f2626] md:text-xl">
                  {identity.name}
                </h2>
                <span className="hidden rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#9b6b65] sm:inline-flex">
                  {identity.kind}
                </span>
              </div>
              <p className="truncate text-[11px] text-muted-foreground md:text-sm">
                {viewerIsVendor
                  ? "Replying through your vendor shop"
                  : "Marketplace conversation with this storefront"}
              </p>
            </div>
          </Link>
          {viewerIsVendor ? (
            <Link
              href="/vendor/dashboard#requests"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2f2626] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#4b403c]"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Build Quote</span>
              <span className="sm:hidden">Quote</span>
            </Link>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-[#8f5f5b] md:text-xs">
          <span className="rounded-full bg-white/85 px-2.5 py-1 shadow-sm">
            {latestInquiry ? "Inquiry received" : "Conversation"}
          </span>
          <span className="rounded-full bg-white/85 px-2.5 py-1 shadow-sm">
            Quote {viewerIsVendor ? "ready to build" : "pending"}
          </span>
        </div>
        <ContextCard conversation={conversation} />
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-[linear-gradient(180deg,#fffaf6,#ffffff_34%)] px-2.5 py-3 md:space-y-3 md:px-5 md:py-4"
      >
        <ConversationItems conversation={conversation} currentUserId={currentUserId} />
      </div>

      <div className="shrink-0 border-t border-[#f0dfda] bg-white px-2.5 py-2 md:px-5 md:py-3">
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
            className="min-h-[42px] resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0 md:min-h-[70px] md:py-2"
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
    </section>
  );
}

function ConversationItems({
  conversation,
  currentUserId
}: {
  conversation: SerializedMessageConversation;
  currentUserId: string;
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
      className="mt-3 hidden gap-2 rounded-[1.1rem] border border-white/80 bg-white/85 p-2 shadow-sm transition hover:shadow-[0_12px_28px_rgba(82,55,55,0.10)] sm:grid sm:grid-cols-[58px_1fr_auto]"
    >
      <div className="relative hidden h-14 overflow-hidden rounded-[0.9rem] bg-[#f7e6dc] sm:block">
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
        <h3 className="truncate text-sm font-bold text-[#2f2626] md:text-base">{title}</h3>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
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
  isMine,
  label
}: {
  body: string;
  createdAt: string;
  isMine: boolean;
  label: string;
}) {
  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[76%] rounded-[1.25rem] border px-3 py-2 text-sm shadow-sm md:max-w-[64%] ${
          isMine ? "border-[#e7cfc8] bg-[#fff5f2]" : "border-white/80 bg-white"
        }`}
      >
        <div className="mb-1 text-[11px] text-muted-foreground">
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
  size: "md" | "lg";
}) {
  const initials = getInitials(label);
  const dimensions = size === "lg" ? "h-12 w-12 text-base" : "h-11 w-11 text-sm";

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

function getContextTitle(
  conversation: SerializedMessageConversation,
  inquiry: InquiryItem | null
) {
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
