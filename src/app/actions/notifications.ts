"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkServerActionRateLimit } from "@/lib/security/request";
import { deliverPartyNotificationEmails } from "@/lib/services/party-notifications";

export async function markNotificationsReadAction() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function deleteNotificationAction(form: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  const id = form.get("notificationId");
  if (!userId || typeof id !== "string" || !id || id.length > 128) return;

  await db.notification.deleteMany({ where: { id, userId } });
  revalidatePath("/notifications");
}

export async function updatePartyNotificationPreferenceAction(form: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sign in to update preferences.");
  const limited = await checkServerActionRateLimit([{ key: `notification-preference:${session.user.id}`, limit: 12, intervalMs: 60_000 }]);
  if (!limited.ok) throw new Error("Please wait before updating preferences again.");
  const email = form.get("email") === "on";
  await db.user.update({ where: { id: session.user.id }, data: { partyEmailNotifications: email } });
  if (email) await deliverPartyNotificationEmails(undefined, session.user.id).catch(() => undefined);
  revalidatePath("/notifications");
}
