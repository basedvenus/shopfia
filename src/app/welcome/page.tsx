import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Heart, Images, MapPin, PartyPopper, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, username: true }
  });

  if (!user?.username || !user.name) {
    redirect("/account/setup");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(244,207,202,0.9),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(249,224,199,0.85),transparent_26%),linear-gradient(135deg,#fff8f5_0%,#ffffff_48%,#f9eee8_100%)]" />
        <div className="relative grid gap-8 p-7 md:grid-cols-[1fr_1fr] md:p-12">
          <div className="flex min-h-[520px] flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
              Step 3 of 3
            </p>
            <h1 className="font-serif text-5xl leading-[0.98] tracking-tight text-[#2f2626] md:text-7xl">
              Welcome to ShopFia.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d4c4b]">
              @{user.username}, how would you like to use ShopFia?
            </p>
          </div>

          <div className="grid content-center gap-3">
            <WelcomeChoice
              href="/explore"
              icon={<MapPin className="h-5 w-5" />}
              title="Find vendors and inspiration"
            />
            <WelcomeChoice
              href="/onboarding"
              icon={<Store className="h-5 w-5" />}
              title="Create a vendor storefront"
            />
            <WelcomeChoice
              href="/my-parties"
              icon={<PartyPopper className="h-5 w-5" />}
              title="Share my parties"
            />
            <div className="mt-3 rounded-[1.35rem] bg-white/80 p-4 text-sm leading-6 text-muted-foreground shadow-sm">
              <div className="mb-2 flex gap-2 text-[#c5837f]">
                <Images className="h-5 w-5" />
                <Heart className="h-5 w-5" />
              </div>
              One flexible account can browse, host, and sell whenever you are ready.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function WelcomeChoice({
  href,
  icon,
  title
}: {
  href: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <Button asChild size="lg" variant="secondary" className="h-auto justify-start rounded-[1.2rem] bg-white/88 p-5 text-left shadow-sm">
      <Link href={href} className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f8deda] text-primary">{icon}</span>
        <span className="text-base font-semibold">{title}</span>
      </Link>
    </Button>
  );
}
