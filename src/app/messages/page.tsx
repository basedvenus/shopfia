import { MessagesClient } from "@/components/messages/messages-client";
import { getPagedMessagesPayload } from "@/lib/messages/paged-query";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams
}: {
  searchParams?: Promise<{ conversationId?: string | string[]; payment?: string | string[]; orderId?: string | string[] }>;
}) {
  const [{ auth }] = await Promise.all([import("@/auth")]);
  const session = await auth();

  if (!session?.user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to access messages.</p>;
  }

  const params = await searchParams;
  const paymentOrderId = typeof params?.orderId === "string" && params.orderId.length > 0 && params.orderId.length <= 256
    ? params.orderId : undefined;
  const payload = await getPagedMessagesPayload({
    currentUserId: session.user.id,
    markSelectedRead: false,
    role: session.user.role,
    selectedConversationId: typeof params?.conversationId === "string" ? params.conversationId : undefined,
    orderId: params?.payment === "return" || params?.payment === "canceled" ? paymentOrderId : undefined
  });

  return (
    <MessagesClient
      currentUserId={session.user.id}
      initialPayload={payload}
    />
  );
}
