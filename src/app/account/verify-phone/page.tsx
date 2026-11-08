import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PhoneVerificationForm } from "@/components/account/phone-verification-form";
import { isPhoneVerificationConfigured } from "@/lib/services/twilio-verify";

export const dynamic = "force-dynamic";

export default async function VerifyPhonePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/account");

  const phones = await db.$queryRaw<Array<{ phone: string | null; verifiedAt: Date | null }>>`
    SELECT "phone", "verifiedAt" FROM "PhoneVerificationProfile" WHERE "userId" = ${session.user.id}
  `;
  if (phones[0]?.phone && phones[0]?.verifiedAt) redirect("/account/setup");

  return (
    <section className="mx-auto max-w-md rounded-3xl border bg-white/90 p-5 shadow-soft md:p-6">
      <h1 className="text-xl font-semibold">Verify your phone number</h1>
      <p className="mt-2 text-sm text-muted-foreground">We’ll text you a code to confirm your number.</p>
      <PhoneVerificationForm verifiedPhone={null} configured={isPhoneVerificationConfigured()} onboarding />
    </section>
  );
}
