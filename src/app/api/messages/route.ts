import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { db } from "@/lib/db";
import { sendNewMessageEmail } from "@/lib/email";
import { getMessagesPayload } from "@/lib/messages/query";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { sendMessageSchema } from "@/lib/validators/message";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");
  const payload = await getMessagesPayload({
    currentUserId: session.user.id,
    markSelectedRead: url.searchParams.get("markRead") === "1",
    role: session.user.role,
    selectedConversationId: conversationId
  });

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "message-api:ip:{ip}", limit: 30, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit(`message:${session.user.id}`, 12, 60_000);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many messages. Give it a moment and try again." },
      { status: 429 }
    );
  }

  const json = await request.json().catch(() => ({}));
  const parsed = sendMessageSchema.safeParse({
    attachments: Array.isArray(json.attachments) ? json.attachments : [],
    body: json.body,
    conversationId: json.conversationId,
    vendorProfileId: json.vendorProfileId
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  }

  let conversationId = parsed.data.conversationId;

  if (!conversationId) {
    if (!parsed.data.vendorProfileId) {
      return NextResponse.json({ error: "Missing vendor profile." }, { status: 400 });
    }

    if (session.user.role !== UserRole.BUYER && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Only buyers can start new conversations." }, { status: 403 });
    }

    const vendorProfile = await db.vendorProfile.findUnique({
      where: { id: parsed.data.vendorProfileId },
      include: { user: true }
    });
    if (!vendorProfile) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    if (!vendorProfile.verified && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Vendor is not accepting platform messages." }, { status: 403 });
    }

    const conversation = await db.conversation.upsert({
      where: {
        buyerId_vendorId: {
          buyerId: session.user.id,
          vendorId: vendorProfile.userId
        }
      },
      update: { lastMessageAt: new Date() },
      create: {
        buyerId: session.user.id,
        vendorId: vendorProfile.userId,
        vendorProfileId: vendorProfile.id
      }
    });
    conversationId = conversation.id;
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      buyer: { select: { email: true, id: true, name: true, username: true } },
      vendor: { select: { email: true, id: true, name: true, username: true } },
      vendorProfile: { select: { name: true, slug: true } },
      listing: { select: { title: true } },
      offering: { select: { title: true } }
    }
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const canAccess =
    session.user.role === UserRole.ADMIN ||
    conversation.buyerId === session.user.id ||
    conversation.vendorId === session.user.id;
  if (!canAccess) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const now = new Date();
  const message = await db.message.create({
    data: {
      attachments: parsed.data.attachments,
      body: parsed.data.body,
      conversationId,
      senderId: session.user.id
    }
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now }
  });

  const recipient =
    conversation.buyerId === session.user.id ? conversation.vendor : conversation.buyer;
  if (recipient.email) {
    const senderName =
      conversation.buyerId === session.user.id
        ? conversation.buyer.name ?? conversation.buyer.username ?? "A ShopFia buyer"
        : conversation.vendorProfile.name;
    const contextTitle =
      conversation.listing?.title ?? conversation.offering?.title ?? conversation.vendorProfile.name;

    await sendNewMessageEmail({
      conversationUrl: `${getBaseUrl()}/messages?conversationId=${conversationId}`,
      contextTitle,
      messagePreview: parsed.data.body,
      senderName,
      to: recipient.email
    });
  }

  return NextResponse.json({ message: { ...message, createdAt: message.createdAt.toISOString() } });
}

function getBaseUrl() {
  const configured =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return configured || "http://localhost:3000";
}
