import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { markNotificationsReadAction, updatePartyNotificationPreferenceAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return <div className="rounded-3xl border bg-white p-6"><h1 className="text-2xl font-semibold">Notifications</h1><Link href="/account?callbackUrl=%2Fnotifications" className="mt-4 inline-block text-primary underline">Sign in to view your notifications</Link></div>;
  const [notifications, user] = await Promise.all([
    db.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.user.findUnique({ where: { id: session.user.id }, select: { partyEmailNotifications: true } })
  ]);
  return <div className="mx-auto grid max-w-3xl gap-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-semibold">Notifications</h1><form action={markNotificationsReadAction}><Button type="submit" variant="secondary">Mark all as read</Button></form></div>
    <section aria-label="Notification preferences" className="rounded-3xl border bg-white p-5">
      <h2 className="font-semibold">Party notification preferences</h2><p className="mt-2 text-sm text-muted-foreground">Invitations, guest submissions, and approval updates always appear here.</p>
      <form action={updatePartyNotificationPreferenceAction} className="mt-4 grid gap-3">
        <label className="flex items-center gap-2 text-sm"><input name="email" type="checkbox" defaultChecked={user?.partyEmailNotifications ?? false} disabled={!authProviderConfig.emailEnabled} />Email me party updates</label>
        {!authProviderConfig.emailEnabled ? <p className="text-xs text-muted-foreground">Email delivery is not connected yet. Website notifications are active.</p> : null}
        <p className="text-xs text-muted-foreground">SMS notifications are not connected yet.</p>
        <Button type="submit" className="w-fit" disabled={!authProviderConfig.emailEnabled}>Save preferences</Button>
      </form>
    </section>
    <section aria-label="Your notifications" className="grid gap-3">
      {notifications.length ? notifications.map((notification) => <article key={notification.id} className={`rounded-2xl border p-4 ${notification.readAt ? "bg-white" : "border-primary/25 bg-primary/5"}`}>
        <Link href={notification.href} className="font-medium underline-offset-4 hover:underline">{notification.title}</Link>
        <p className="mt-2 text-xs text-muted-foreground">{notification.createdAt.toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" })}{!notification.readAt ? " · Unread" : ""}</p>
      </article>) : <p className="rounded-3xl border bg-white p-6 text-sm text-muted-foreground">You’re all caught up. Party invitations and updates will appear here.</p>}
    </section>
  </div>;
}
