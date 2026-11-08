import { redirect } from "next/navigation";
import { RequiredProfileForm } from "@/components/account/required-profile-form";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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
        <p className="text-sm text-muted-foreground">Reload the page to try again.</p>

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
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#2f2626] md:text-4xl">
            Set up your profile
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Choose your username and display name.
          </p>
        </div>
        <div className="grid gap-5 p-5 md:p-8">
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
