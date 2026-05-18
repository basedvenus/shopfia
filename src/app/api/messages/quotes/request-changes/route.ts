import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceRequestRateLimit } from "@/lib/security/request";

export const dynamic = "force-dynamic";

const requestChangesSchema = z.object({
  conversationId: z.string().cuid(),
  quoteId: z.string().cuid()
});

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "message-quote-revision:ip:{ip}", limit: 20, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestChangesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Could not request changes." }, { status: 400 });
  }

  const quote = await db.quote.findUnique({
    where: { id: parsed.data.quoteId },
    include: {
      quoteRequest: {
        select: {
          buyerId: true,
          vendorId: true
        }
      }
    }
  });
  const conversation = await db.conversation.findUnique({
    where: { id: parsed.data.conversationId },
    select: {
      buyerId: true,
      id: true,
      vendorProfileId: true
    }
  });

  if (
    !quote ||
    !conversation ||
    quote.quoteRequest.buyerId !== session.user.id ||
    conversation.buyerId !== session.user.id ||
    conversation.vendorProfileId !== quote.quoteRequest.vendorId
  ) {
    return NextResponse.json({ error: "Conversation quote not found." }, { status: 404 });
  }

  await db.$transaction([
    db.message.create({
      data: {
        attachments: [],
        body: "Buyer requested changes to the proposal.",
        conversationId: conversation.id,
        senderId: session.user.id
      }
    }),
    db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    })
  ]);

  return NextResponse.json({ ok: true });
}
