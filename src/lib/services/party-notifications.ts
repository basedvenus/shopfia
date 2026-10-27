import { db } from "@/lib/db";
import { sendPartyNotificationEmail } from "@/lib/email";
import { authProviderConfig } from "@/lib/auth/provider-config";

/** Email is opt-in; the durable in-app notification is always kept. */
export async function deliverPartyNotificationEmails(eventId?: string, userId?: string) {
  if (!authProviderConfig.emailEnabled) return;
  const pending = await db.notification.findMany({
    where: { ...(eventId ? { eventId } : {}), ...(userId ? { userId } : {}), emailSentAt: null, user: { partyEmailNotifications: true, email: { not: null } } },
    select: { id: true, title: true, href: true, user: { select: { email: true } } },
    orderBy: { createdAt: "asc" }, take: 30
  });
  for (const notification of pending) {
    if (!notification.user.email) continue;
    const result = await sendPartyNotificationEmail({ to: notification.user.email, title: notification.title, path: notification.href });
    if (result.ok) await db.notification.updateMany({ where: { id: notification.id, emailSentAt: null }, data: { emailSentAt: new Date() } });
  }
}
