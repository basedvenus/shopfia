import { notFound } from "next/navigation";
import { PhoneVerificationForm } from "@/components/account/phone-verification-form";

export default function PhoneVerificationPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <section className="mx-auto max-w-md rounded-3xl border bg-white/90 p-6 shadow-soft">
    <h1 className="text-xl font-semibold">Verify your phone number</h1>
    <p className="mt-2 text-sm text-muted-foreground">We’ll text you a code to confirm your number.</p>
    <PhoneVerificationForm verifiedPhone={null} configured onboarding />
  </section>;
}
