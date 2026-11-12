import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

const input = z.object({
  conversationId: z.string().cuid(),
  state: z.enum(["archived", "deleted", "inbox"])
});

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [{ key: "inbox-state:ip:{ip}", limit: 60, intervalMs: 60_000 }]);
  if (limited) return limited;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to manage messages." }, { status: 401 });

  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid conversation action." }, { status: 400 });
  const { conversationId, state } = parsed.data;
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, OR: [{ buyerId: userId }, { vendorId: userId }, { vendorProfile: { userId } }] },
    select: { id: true }
  });
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  if (state === "inbox") {
    await db.$executeRaw`DELETE FROM "ConversationInboxState"
      WHERE "userId" = ${userId} AND "conversationId" = ${conversationId} AND "state" = 'archived'`;
  } else {
    await db.$executeRaw`INSERT INTO "ConversationInboxState" ("userId", "conversationId", "state")
      VALUES (${userId}, ${conversationId}, ${state})
      ON CONFLICT ("userId", "conversationId") DO UPDATE SET "state" = EXCLUDED."state"
      WHERE "ConversationInboxState"."state" <> 'deleted'`;
  }
  return NextResponse.json({ ok: true });
}
