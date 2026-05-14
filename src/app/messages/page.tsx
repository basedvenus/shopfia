import { sendMessageAction } from "@/app/actions/messaging";
import { sendQuoteResponseAction } from "@/app/actions/quotes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams
}: {
  searchParams?: { conversationId?: string };
}) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (!session?.user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to access messages.</p>;
  }
  const selectedConversationId = searchParams?.conversationId;

  const conversations = await db.conversation.findMany({
    where:
      session.user.role === "ADMIN"
        ? undefined
        : {
            OR: [{ buyerId: session.user.id }, { vendorId: session.user.id }]
          },
    include: {
      buyer: {
        select: { id: true, name: true }
      },
      vendor: {
        select: { id: true, name: true }
      },
      vendorProfile: {
        select: { id: true, name: true, slug: true }
      },
      listing: {
        select: { id: true, title: true }
      },
      offering: {
        select: { id: true, title: true }
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 8
      }
    },
    orderBy: { lastMessageAt: "desc" },
    take: 20
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

  const quoteRequests = await db.quoteRequest.findMany({
    where:
      session.user.role === "ADMIN"
        ? {}
        : session.user.role === "VENDOR"
          ? { vendor: { userId: session.user.id } }
          : { buyerId: session.user.id },
    include: {
      quote: true,
      vendor: { select: { id: true, name: true, slug: true } },
      buyer: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Messages</h1>
        {conversations.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">No conversations yet.</CardContent></Card>
        ) : (
          conversations.map((conversation) => {
            const unreadCount = unreadByConversation.get(conversation.id) ?? 0;
            const contextTitle = conversation.listing?.title ?? conversation.offering?.title;
            const isSelected = conversation.id === selectedConversationId;

            return (
              <Card
                key={conversation.id}
                className={isSelected ? "border-primary/40 bg-white/95 shadow-soft" : undefined}
              >
                <CardHeader className="pb-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <span>{conversation.vendorProfile.name}</span>
                    {unreadCount > 0 ? <Badge variant="accent">{unreadCount} unread</Badge> : null}
                    <span className="text-xs font-normal text-muted-foreground">
                      Buyer: {conversation.buyer.name ?? "Buyer"}
                    </span>
                  </CardTitle>
                  {contextTitle ? (
                    <p className="text-xs text-muted-foreground">Inquiry: {contextTitle}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-64 space-y-2 overflow-auto rounded-2xl bg-muted/30 p-3">
                    {conversation.messages.map((msg) => (
                      <div key={msg.id} className="rounded-xl border bg-white p-2 text-sm">
                        <div className="mb-1 text-xs text-muted-foreground">
                          {msg.senderId === conversation.buyerId ? "Buyer" : "Vendor"} ·{" "}
                          {new Date(msg.createdAt).toLocaleString()}
                        </div>
                        <div>{msg.body}</div>
                      </div>
                    ))}
                  </div>
                  <form action={sendMessageAction} className="space-y-2">
                    <input type="hidden" name="conversationId" value={conversation.id} />
                    <Textarea name="body" placeholder="Reply..." className="min-h-[80px]" required />
                    <Button type="submit" size="sm">Send</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <aside className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Quote Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {quoteRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quote activity yet.</p>
            ) : (
              quoteRequests.map((qr) => (
                <div key={qr.id} className="space-y-2 rounded-2xl border p-3 text-sm">
                  <div className="font-medium">{qr.vendor.name}</div>
                  <div className="text-muted-foreground">{qr.eventLocation}</div>
                  <div className="text-muted-foreground">Status: {qr.status}</div>
                  {session.user.role === "VENDOR" && (
                    <form action={sendQuoteResponseAction} className="grid gap-2 rounded-xl bg-muted/30 p-2">
                      <input type="hidden" name="quoteRequestId" value={qr.id} />
                      <Input name="amountCents" type="number" placeholder="Quote amount (cents)" required />
                      <Input name="depositAmountCents" type="number" placeholder="Deposit amount (cents)" />
                      <Input name="expiresAt" type="datetime-local" required />
                      <Textarea name="notes" placeholder="Quote notes" className="min-h-[70px]" />
                      <select name="paymentPreference" className="h-10 rounded-xl border bg-white px-3">
                        <option value="DEPOSIT">Deposit</option>
                        <option value="FULL">Full amount</option>
                      </select>
                      <Button type="submit" size="sm">Send quote</Button>
                    </form>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
