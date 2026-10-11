import Link from "next/link";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { RequiredProfileForm } from "@/components/account/required-profile-form";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { AccountRecovery } from "@/components/account/account-recovery";
import { getUserProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

export default async function RequiredProfileSetupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      avatar: { select: { updatedAt: true } },
      email: true,
      image: true,
      imageCrop: true,
      name: true,
      username: true
    }
  }).catch((error) => {
    console.error("ShopFia setup profile lookup failed", error);
    return null;
  });

  if (!user) {
    return (
      <section className="mx-auto grid max-w-xl gap-4 rounded-3xl border bg-white p-6">
        <h1 className="text-2xl font-semibold">Your profile could not be loaded.</h1>
        <p className="text-muted-foreground">
          Try reloading this page. If you still cannot see your profile, sign out and
          sign back in with your existing login.
        </p>
        <AccountRecovery email={session.user.email} />
        <Link href="/explore" className="font-semibold underline">Continue browsing</Link>
      </section>
    );
  }

  if (user?.username && user.name) {
    redirect("/account");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(244,207,202,0.75),transparent_38%),linear-gradient(135deg,rgba(255,248,245,0.96),rgba(255,255,255,0.86),rgba(249,224,199,0.62))] p-6 md:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
            Set up your profile
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#2f2626] md:text-5xl">
            Let&apos;s get started
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Create your personal profile first. If you are a vendor, your storefront
            will have its own name and web address.
          </p>
        </div>
        <div className="grid gap-5 p-5 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary"><Link href="/explore">Set up later and browse</Link></Button>
            <Link href="/account" className="text-sm font-semibold underline">Go to Account</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Setup is optional for browsing. Skipping it does not change your saved
            profile, photo, or storefront access.
          </p>
          <AccountRecovery email={user.email} />
          <RequiredProfileForm
            profileId={user.id}
            defaultDisplayName={user?.name}
            defaultImage={getUserProfileImage(user)}
            defaultImageCrop={user?.imageCrop}
            defaultUsername={user?.username}
          />
        </div>
      </section>
    </div>
  );
}
