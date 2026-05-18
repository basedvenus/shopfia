import { redirect } from "next/navigation";
import { RequiredProfileForm } from "@/components/account/required-profile-form";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RequiredProfileSetupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      image: true,
      imageCrop: true,
      name: true,
      username: true
    }
  });

  if (user?.username && user.name) {
    redirect("/welcome");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 shadow-soft">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(244,207,202,0.75),transparent_38%),linear-gradient(135deg,rgba(255,248,245,0.96),rgba(255,255,255,0.86),rgba(249,224,199,0.62))] p-6 md:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
            Step 2 of 3
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#2f2626] md:text-5xl">
            Choose your ShopFia identity.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Pick the public @username people will recognize across parties, comments,
            favorites, messages, and everything you create next.
          </p>
        </div>
        <div className="p-5 md:p-8">
          <RequiredProfileForm
            defaultDisplayName={user?.name}
            defaultImage={user?.image}
            defaultImageCrop={user?.imageCrop}
            defaultUsername={user?.username}
          />
        </div>
      </section>
    </div>
  );
}
