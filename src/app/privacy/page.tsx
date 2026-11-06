import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy | Shopfia" };

export default function PrivacyPage() {
  return <article className="mx-auto max-w-3xl rounded-3xl border border-rose-100 bg-white p-6 sm:p-10">
    <p className="text-sm text-muted-foreground">Shopfia · Updated November 5, 2026</p>
    <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
    <div className="mt-6 space-y-6 text-sm leading-7">
      <section><h2 className="text-xl font-semibold">Information you provide</h2><p>Shopfia collects information you provide to create an account, maintain a profile or business listing, plan a party, send inquiries and messages, and manage notification preferences. This can include your name, email address, profile photos, business details, event details, messages, and an optional mobile number. If you use a connected sign-in provider, we receive the account information that provider shares with your permission.</p></section>
      <section><h2 className="text-xl font-semibold">How we use information</h2><p>We use this information to operate Shopfia, connect party planners with businesses, display the content you choose to publish, deliver inquiries and messages, authenticate accounts, prevent abuse, and send the notifications you request. Account cookies help keep you signed in and remember preferences.</p></section>
      <section><h2 className="text-xl font-semibold">Information shared to provide the service</h2><p>Your public profile, listings, and published party content can be seen by others. Information you send in an inquiry or conversation is shared with its recipients. Service providers help us host the platform, store data, authenticate accounts, and deliver email and text messages. For example, Twilio processes mobile numbers and message information to verify numbers and deliver requested texts. We may also disclose information when required by law or to protect users and the service.</p></section>
      <section><h2 className="text-xl font-semibold">SMS privacy</h2><p>We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes. Mobile numbers, SMS consent records, and related information are used to provide the messaging services you request, including processing by messaging service providers. We record your notification preference, consent time, verification status, and delivery information to manage the service.</p></section>
      <section><h2 className="text-xl font-semibold">Your choices</h2><p>You can edit profile information and notification preferences in your account. Business notification texts are optional. Reply STOP to unsubscribe, or disable text notifications in <Link href="/account/notifications" className="underline">notification preferences</Link>. Verifying a number does not by itself subscribe you to business alerts. See our <Link href="/terms" className="underline">SMS terms</Link> for details.</p></section>
      <section><h2 className="text-xl font-semibold">Retention and security</h2><p>We retain information as needed to provide the service, maintain consent and security records, resolve disputes, and meet legal obligations. We use safeguards to protect information, but no online service can guarantee complete security.</p></section>
      <section><h2 className="text-xl font-semibold">Contact and requests</h2><p>For privacy questions or requests to access, correct, or delete account information, contact <a href="mailto:venus@shopfia.app" className="underline">venus@shopfia.app</a>. We may need to verify your identity before acting on a request.</p></section>
    </div>
  </article>;
}
