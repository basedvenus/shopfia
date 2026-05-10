import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyEventForm } from "@/components/parties/party-event-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const fallbackEvents = [
  {
    title: "Citrus Garden Brunch",
    theme: "Lemon tablescape inspiration",
    coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
    slug: "citrus-garden-brunch"
  },
  {
    title: "Tulip Cookie Shower",
    theme: "Soft floral favors",
    coverImageUrl: "/demo/vacaville-cookie-tulips.png",
    slug: "tulip-cookie-shower"
  }
];

export default async function PartiesPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (!session?.user?.id) redirect("/account");

  const [events, vendors] = await Promise.all([
    db.partyEvent.findMany({
      where: { userId: session.user.id },
      include: { taggedVendors: true },
      orderBy: { createdAt: "desc" }
    }),
    db.vendorProfile.findMany({
      where: { verified: true },
      select: { id: true, name: true, city: true, state: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft md:p-7">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
          <div>
            <p className="text-sm text-muted-foreground">Social party portfolio</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Parties</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Build visual party stories with themes, searchable tags, photos, and vendor credits
              that make each celebration feel discoverable.
            </p>
          </div>
          <Card className="border-white/70 bg-white/80">
            <CardHeader><CardTitle>Add Party</CardTitle></CardHeader>
            <CardContent>
              <PartyEventForm vendors={vendors} />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Party Stories</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a gallery to open its dedicated event page.
            </p>
          </div>
          <Link href="/account"><Button variant="secondary">Back to profile</Button></Link>
        </div>

        {events.length > 0 ? (
          <div className="grid auto-rows-[220px] grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {events.map((event, index) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className={`group relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-muted shadow-sm ${
                  index === 0 ? "col-span-2 row-span-2" : "col-span-2"
                }`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
                  style={{ backgroundImage: `url(${event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png"})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-semibold">{event.title}</h3>
                  {event.theme ? <p className="text-xs text-white/80">{event.theme}</p> : null}
                  {event.tags.length > 0 ? (
                    <p className="mt-1 text-xs text-white/75">{event.tags.slice(0, 3).join(" · ")}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid auto-rows-[220px] grid-cols-2 gap-3 md:grid-cols-4">
            {fallbackEvents.map((event) => (
              <Link key={event.title} href={`/events/${event.slug}`} className="relative col-span-2 overflow-hidden rounded-[1.5rem] border border-white/80 bg-muted shadow-sm">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.coverImageUrl})` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-xs text-white/80">{event.theme}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
