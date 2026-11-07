import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AccountNotificationSettings } from "@/components/account/account-notification-settings";
import Link from "next/link";
import { AccountRecovery } from "@/components/account/account-recovery";
import { AccountProfileEditor } from "@/components/account/account-profile-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInPanel } from "@/components/account/sign-in-panel";
import { authProviderConfig } from "@/lib/auth/provider-config";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const resolvedSearchParams: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const callbackUrl = getSafeCallbackUrl(resolvedSearchParams.redirectTo ?? resolvedSearchParams.callbackUrl);
  const session = await auth().catch((error) => {
    console.error("ShopFia auth session failed on account page", error);
    return null;
  });

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader><CardTitle>Sign in to ShopFia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sign in to favorite vendors, message, request quotes, and book.
            </p>
            <SignInPanel
              callbackUrl={callbackUrl}
              emailEnabled={authProviderConfig.emailEnabled}
              googleEnabled={authProviderConfig.googleEnabled}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const userId = session.user.id;
  let accountData: Awaited<ReturnType<typeof loadAccountData>>;

  async function loadAccountData() {
    return db.user.findUnique({ where: { id: userId }, select: { name: true, username: true, firstName: true, lastName: true } });
  }

  try {
    accountData = await loadAccountData();
  } catch (error) {
    console.error("ShopFia account dashboard failed", error);
    return (
      <div className="mx-auto max-w-xl">
        <Card className="border-[#ead6cf] bg-white/92 shadow-soft">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
              Temporary account issue
            </p>
            <CardTitle>Your account data cannot load right now.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              ShopFia is online, but we could not load your account data. Please try again in a
              few minutes while we check the database connection.
            </p>
            <div className="rounded-2xl border border-[#ead6cf] bg-[#fff8f5] p-4 text-sm leading-6 text-muted-foreground">
              Your businesses, listings, messages, and account data are preserved. The technical
              database error has been logged privately so we can diagnose it without exposing
              infrastructure details.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/">Return home</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/explore">Check Explore</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accountUser = accountData;
  if (!accountUser) {
    return (
      <section className="mx-auto grid max-w-xl gap-4 rounded-3xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Your profile could not be loaded.</h1>
        <p className="text-muted-foreground">Try reloading, or check your existing login before creating a new profile.</p>
        <AccountRecovery email={session.user.email} />
        <Link href="/explore" className="font-semibold underline">Continue browsing</Link>
      </section>
    );
  }
  const displayName = accountUser?.name || session.user.name || "ShopFia Member";
  const handle = accountUser?.username ? `@${accountUser.username}` : "Username not set";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <AccountProfileEditor
          firstName={accountUser.firstName}
          lastName={accountUser.lastName}
          displayName={displayName}
          handle={handle}
          initials={initials}
          signOutAction={async () => {
            "use server";
            const { signOut } = await import("@/auth");
            await signOut({ redirectTo: "/explore" });
          }}
        />
      </section>

      <AccountNotificationSettings />
      <ChangePasswordForm />

    </div>
  );
}

function getSafeCallbackUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return "/explore";

  try {
    const decoded = decodeURIComponent(rawValue);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/explore";
    if (decoded.startsWith("/api/")) return "/explore";
    return decoded;
  } catch {
    return "/explore";
  }
}
