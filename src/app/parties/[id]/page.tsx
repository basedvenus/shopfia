import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PartyEventPage({ params }: { params: { id: string } }) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (!session?.user?.id) redirect("/account");

  const event = await db.partyEvent.findFirst({
    where: { id: params.id, userId: session.user.id }
  });

  if (!event) return notFound();

  const images = event.imageUrls.length > 0 ? event.imageUrls : [event.coverImageUrl].filter(Boolean);
  const hero = event.coverImageUrl ?? images[0] ?? "/demo/fairfield-lemon-tablescape.png";

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <div className="relative min-h-[420px]">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${hero})` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
          <div className="relative flex min-h-[420px] flex-col justify-end p-6 text-white md:p-8">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white backdrop-blur" variant="default">Event gallery</Badge>
              {event.theme ? <Badge className="bg-white/15 text-white backdrop-blur" variant="default">{event.theme}</Badge> : null}
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">{event.title}</h1>
            {event.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{event.description}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className={`relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm ${
                index === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft">
          <h2 className="text-2xl font-semibold tracking-tight">Event Story</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page is the foundation for ShopFia’s visual event ecosystem: galleries,
            styling breakdowns, vendor attribution, and future Partyful import connections.
          </p>
          <div className="mt-5 grid gap-2 text-sm">
            <div className="rounded-2xl bg-muted/60 p-3">Tagged vendors: coming soon</div>
            <div className="rounded-2xl bg-muted/60 p-3">Styling breakdown: coming soon</div>
            <div className="rounded-2xl bg-muted/60 p-3">Partyful event connection: coming soon</div>
          </div>
          <Link href="/parties" className="mt-5 inline-flex">
            <Button variant="secondary">Back to My Parties</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
