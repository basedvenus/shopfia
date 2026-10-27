import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-soft">
        <div className="bg-[linear-gradient(135deg,rgba(244,207,202,0.78),rgba(255,248,245,0.96),rgba(249,224,199,0.62))] p-6">
          <h1 className="text-3xl font-bold tracking-tight text-[#2f2626]">Forgot your password?</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the email you use for ShopFia. We’ll send you a link to create a new password.</p>
        </div>
        <div className="grid gap-5 p-5">
          <ForgotPasswordForm />
          <Link href="/account" className="text-center text-sm font-medium text-[#9b6b65] underline-offset-4 hover:underline">Back to sign in</Link>
        </div>
      </section>
    </div>
  );
}
