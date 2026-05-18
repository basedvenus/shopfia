import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Heart, Images, MapPin, Sparkles } from "lucide-react";
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
        <div className="relative grid gap-8 p-7 md:grid-cols-[1.1fr_0.9fr] md:p-12">
          <div className="flex min-h-[520px] flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[#9b6b65] shadow-sm">
              <Sparkles className="h-4 w-4" />
              @{user.username}, you are in
            </div>
            <h1 className="font-serif text-5xl leading-[0.98] tracking-tight text-[#2f2626] md:text-7xl">
              Welcome to ShopFia.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5d4c4b]">
              Discover local artisans, browse real parties, and celebrate the
              people behind every event.
            </p>
            <p className="mt-3 max-w-2xl text-lg leading-8 text-[#5d4c4b]">
              We can&apos;t wait to see the celebrations you create.
            </p>
            <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
              Create parties, tag vendors, save inspiration, and connect with
              creatives in your area.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/explore">
                  Start Exploring
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid content-center gap-4">
            <div className="ml-auto w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-soft backdrop-blur">
              <div className="aspect-[4/5] overflow-hidden rounded-[1.35rem] bg-[linear-gradient(160deg,#f4cfca,#fff8f5_45%,#d9ede4)] p-5">
                <div className="grid h-full grid-rows-[1fr_auto]">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-3xl bg-white/78 p-4 shadow-sm">
                      <Images className="h-5 w-5 text-[#c5837f]" />
                      <p className="mt-12 font-serif text-2xl leading-7">real parties</p>
                    </div>
                    <div className="mt-10 rounded-3xl bg-white/78 p-4 shadow-sm">
                      <MapPin className="h-5 w-5 text-[#7f9f91]" />
                      <p className="mt-12 font-serif text-2xl leading-7">local finds</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-3xl bg-white/86 p-4 shadow-sm">
                    <Heart className="h-5 w-5 text-[#c5837f]" />
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      A softer way to plan, collect inspiration, and give credit
                      to the creatives who make gatherings feel unforgettable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
