import { BusinessSmsToggle } from "@/components/account/business-sms-toggle";
import { isBusinessSmsConfigured } from "@/lib/services/business-sms";
import { PhoneVerificationForm } from "@/components/account/phone-verification-form";
import { isPhoneVerificationConfigured } from "@/lib/services/twilio-verify";
import { maskPhoneNumber } from "@/lib/phone-verification";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { updatePartyNotificationPreferenceAction } from "@/app/actions/notifications";
import { PartyNotificationSettings } from "@/components/messages/party-notification-settings";
import { NotificationPreferences } from "@/components/messages/notification-preferences";

export default async function AccountNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) return <Link href="/account?callbackUrl=%2Faccount%2Fnotifications">Sign in to manage notifications</Link>;
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { partyEmailNotifications: true, email: true, emailVerified: true } });
  const rows = await db.$queryRaw<Array<{phone: string | null; verifiedAt: Date | null; businessSmsEnabled: boolean}>>`SELECT "phone", "verifiedAt", "businessSmsEnabled" FROM "PhoneVerificationProfile" WHERE "userId" = ${session.user.id}`;
  const verifiedPhone = rows[0]?.verifiedAt && rows[0]?.phone ? maskPhoneNumber(rows[0].phone) : null;
  return <div className="mx-auto grid max-w-3xl gap-6">
    <Link href="/account" className="text-sm text-muted-foreground underline">← Profile settings</Link>
    <h1 className="text-3xl font-semibold">Notifications</h1>
    <PartyNotificationSettings email={user?.partyEmailNotifications ?? false} emailEnabled={authProviderConfig.emailEnabled} emailAddress={user?.email ?? null} emailVerified={Boolean(user?.emailVerified)} saveAction={updatePartyNotificationPreferenceAction}>
      <BusinessSmsToggle enabled={rows[0]?.businessSmsEnabled ?? false} verified={Boolean(verifiedPhone)} deliveryReady={isBusinessSmsConfigured()} />
      <PhoneVerificationForm configured={isPhoneVerificationConfigured()} verifiedPhone={verifiedPhone} />
    </PartyNotificationSettings>
    <NotificationPreferences />
  </div>;
}
