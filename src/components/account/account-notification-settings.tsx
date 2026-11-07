import { DeliveryPreferences } from "./delivery-preferences";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { maskPhoneNumber } from "@/lib/phone-verification";
import { isPhoneVerificationConfigured } from "@/lib/services/twilio-verify";
import { PhoneVerificationForm } from "./phone-verification-form";
import { EmailConfirmation } from "./email-confirmation";
import { NotificationPreferences } from "@/components/messages/notification-preferences";

export async function AccountNotificationSettings() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user, phones] = await Promise.all([
    db.user.findUnique({where:{id:session.user.id}, select:{email:true,emailVerified:true,partyEmailNotifications:true}}),
    db.$queryRaw<Array<{phone:string|null;verifiedAt:Date|null;businessSmsEnabled:boolean}>>`SELECT "phone", "verifiedAt", "businessSmsEnabled" FROM "PhoneVerificationProfile" WHERE "userId" = ${session.user.id}`
  ]);
  const verifiedPhone = phones[0]?.verifiedAt && phones[0]?.phone ? maskPhoneNumber(phones[0].phone) : null;
  return <section className="rounded-3xl border bg-white p-5 md:p-7" aria-label="Notification preferences">
    <h2 className="text-xl font-semibold">Notification preferences</h2>
    <EmailConfirmation email={user?.email ?? null} verified={Boolean(user?.emailVerified)} configured={authProviderConfig.emailEnabled} />
    <PhoneVerificationForm configured={isPhoneVerificationConfigured()} verifiedPhone={verifiedPhone} />
    <DeliveryPreferences email={user?.partyEmailNotifications ?? false} text={phones[0]?.businessSmsEnabled ?? false} emailReady={authProviderConfig.emailEnabled} phoneVerified={Boolean(verifiedPhone)} />
    <div className="mt-5 border-t pt-5"><NotificationPreferences pushOnly /></div>
  </section>;
}
