"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { requireSession } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendMessageSchema } from "@/lib/validators/message";

export async function sendMessageAction(formData: FormData) {
  const { db } = await import("@/lib/db");
  const session = await requireSession();
  const parsed = sendMessageSchema.parse({
    conversationId: formData.get("conversationId") || undefined,
    vendorProfileId: formData.get("vendorProfileId") || undefined,
    body: formData.get("body"),
    attachments: formData
      .getAll("attachments")
      .map((v) => String(v))
      .filter(Boolean)
  });

  const rate = checkRateLimit(`message:${session.user.id}`, 12, 60_000);
  if (!rate.ok) throw new Error("Rate limit exceeded");

  let conversationId = parsed.conversationId;

  if (!conversationId) {
    if (!parsed.vendorProfileId) throw new Error("Missing vendor profile");
    if (session.user.role !== UserRole.BUYER && session.user.role !== UserRole.ADMIN) {
      throw new Error("Only buyers can initiate new conversations");
    }
    const vendorProfile = await db.vendorProfile.findUnique({
      where: { id: parsed.vendorProfileId },
      include: { user: true }
    });
    if (!vendorProfile) throw new Error("Vendor not found");
    if (!vendorProfile.verified && session.user.role !== UserRole.ADMIN) {
      throw new Error("Vendor is not accepting platform messages");
    }
    const convo = await db.conversation.upsert({
      where: {
        buyerId_vendorId: {
          buyerId: session.user.id,
          vendorId: vendorProfile.userId
        }
      },
      update: {
        lastMessageAt: new Date()
      },
      create: {
        buyerId: session.user.id,
        vendorId: vendorProfile.userId,
        vendorProfileId: vendorProfile.id
      }
    });
    conversationId = convo.id;
  }

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("Conversation not found");

  const canAccess =
    session.user.role === UserRole.ADMIN ||
    conversation.buyerId === session.user.id ||
    conversation.vendorId === session.user.id;
  if (!canAccess) throw new Error("Forbidden");

  await db.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      body: parsed.body,
      attachments: parsed.attachments
    }
  });

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() }
  });

  revalidatePath("/messages");
  if (conversation.vendorProfileId) {
    const vendorProfile = await db.vendorProfile.findUnique({
      where: { id: conversation.vendorProfileId },
      select: { slug: true }
    });
    if (vendorProfile?.slug) {
      revalidatePath(`/vendor/profile/${vendorProfile.slug}`);
    }
  }
}
