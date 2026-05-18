import { MessagesClient } from "@/components/messages/messages-client";
import { getMessagesPayload } from "@/lib/messages/query";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams
}: {
  searchParams?: Promise<{ conversationId?: string }>;
}) {
  const [{ auth }] = await Promise.all([import("@/auth")]);
  const session = await auth();

  if (!session?.user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to access messages.</p>;
  }

  const params = await searchParams;
  const payload = await getMessagesPayload({
    currentUserId: session.user.id,
    markSelectedRead: Boolean(params?.conversationId),
    role: session.user.role,
    selectedConversationId: params?.conversationId
  });

  return (
    <MessagesClient
      currentUserId={session.user.id}
      initialPayload={payload}
    />
  );
}
