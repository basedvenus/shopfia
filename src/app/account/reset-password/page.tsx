import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/reset-password-form";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const params = await searchParams;
  const email = params.email ?? "";
  const token = params.token ?? "";
  const hasLink = Boolean(email && token);

  return (
    <div className="mx-auto max-w-md">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-soft">
        <div className="bg-[linear-gradient(135deg,rgba(244,207,202,0.78),rgba(255,248,245,0.96),rgba(249,224,199,0.62))] p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
            Password reset
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#2f2626]">
            Create a new password.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Keep your ShopFia account secure with a fresh password.
          </p>
        </div>
        <div className="p-5">
          {hasLink ? (
            <ResetPasswordForm email={email} token={token} />
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                This reset link is missing details. Request a new link from the sign-in screen.
              </p>
              <Button asChild>
                <Link href="/account">Return to Sign In</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
