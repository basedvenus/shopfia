import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service | Shopfia" };

export default function TermsPage() {
  return <article className="mx-auto max-w-3xl rounded-3xl border border-rose-100 bg-white p-6 sm:p-10">
    <p className="text-sm text-muted-foreground">Shopfia · Updated November 5, 2026</p>
    <h1 className="mt-2 text-3xl font-semibold">Terms of Service</h1>
    <div className="mt-6 space-y-6 text-sm leading-7">
      <section><h2 className="text-xl font-semibold">Using Shopfia</h2><p>Shopfia helps people discover event businesses, plan parties, and communicate about services. Keep your account information accurate and protect your sign-in credentials. Use the platform lawfully and respectfully. Do not send spam, impersonate others, post content you do not have permission to share, or interfere with the service.</p></section>
      <section><h2 className="text-xl font-semibold">Listings and inquiries</h2><p>Businesses are responsible for their listings, pricing, availability, and services. An inquiry or message does not by itself confirm a booking. Party planners and businesses should confirm the scope, price, cancellation terms, and other arrangements before committing to a service.</p></section>
      <section><h2 className="text-xl font-semibold">SMS Terms — Shopfia business alerts</h2><p>When you verify your mobile number and enable optional text alerts in your account notification preferences, you agree to receive automated Shopfia texts about new business inquiries and messages. Consent is not a condition of purchasing services or using Shopfia. Message frequency varies with account activity. Message and data rates may apply.</p><p className="mt-3">Reply STOP to unsubscribe from business notification texts. You may receive a confirmation of your opt-out. You can also turn off SMS alerts in <Link href="/account/notifications" className="underline">notification preferences</Link>. Reply HELP for help, or contact <a href="mailto:venus@shopfia.app" className="underline">venus@shopfia.app</a>. Messages are notifications; read and reply to customer conversations in your Shopfia inbox.</p><p className="mt-3">Verification texts are sent when you request a code and are separate from optional business alerts. Delivery depends on mobile networks and is not guaranteed; carriers are not liable for delayed or undelivered messages. Check your inbox directly for time-sensitive updates. Only provide a mobile number you control, and update your account if your number changes.</p></section>
      <section><h2 className="text-xl font-semibold">Privacy</h2><p>Our <Link href="/privacy" className="underline">Privacy Policy</Link> explains how Shopfia uses account and messaging information. We do not sell or share SMS opt-in data or personal information with third parties for marketing purposes.</p></section>
      <section><h2 className="text-xl font-semibold">Questions</h2><p>Contact <a href="mailto:venus@shopfia.app" className="underline">venus@shopfia.app</a> for help with Shopfia or these terms.</p></section>
    </div>
  </article>;
}
