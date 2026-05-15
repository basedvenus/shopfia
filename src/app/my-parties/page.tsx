import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Pencil, Sparkles } from "lucide-react";
import { PartyEventForm } from "@/components/parties/party-event-form";

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

export default async function MyPartiesPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (!session?.user?.id) redirect("/account");

  const [events, vendors] = await Promise.all([
    db.partyEvent.findMany({
      where: { userId: session.user.id },
      include: {
        photos: {
          orderBy: { sortOrder: "asc" },
          include: { taggedVendors: true }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    db.vendorProfile.findMany({
      select: { id: true, name: true, username: true, city: true, state: true, logoUrl: true },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)]">
        <div className="space-y-5">
          <div>
            <p className="text-sm text-muted-foreground">Social party portfolio</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Parties</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Curate visual stories with real photos, searchable hashtags, and vendor credits tied to the images they helped create.
            </p>
          </div>

          {events.length > 0 ? (
            <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {events.map((event, index) => {
                const image = getEventImage(event);
                const vendorCount = new Set(event.photos.flatMap((photo) => photo.taggedVendors.map((vendor) => vendor.id))).size;
                const featured = index === 0 || index % 7 === 0;
                return (
                  <article
                    key={event.id}
                    className={`group relative overflow-hidden rounded-[1.5rem] border border-white/80 bg-muted shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
                      featured ? "col-span-2 row-span-2" : "col-span-2"
                    }`}
                  >
                    <Link
                      href={`/events/${event.slug}`}
                      className="absolute inset-0 z-10"
                      aria-label={`Open ${event.title}`}
                    />
                    <Link
                      href={`/events/${event.slug}?edit=1`}
                      aria-label={`Edit ${event.title}`}
                      className="absolute right-3 top-3 z-30 grid h-9 w-9 place-items-center rounded-full border border-white/80 bg-white/90 text-foreground opacity-100 shadow-sm backdrop-blur transition hover:bg-white md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <div
                      className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]"
                      style={{ backgroundImage: `url(${image})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 text-white">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {event.tags.slice(0, featured ? 4 : 2).map((tag) => (
                          <span key={tag} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] backdrop-blur">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold">{event.title}</h3>
                      {event.location ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/80">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </p>
                      ) : event.theme ? (
                        <p className="mt-1 text-xs text-white/80">{event.theme}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-white/75">
                        {event.photos.length || event.imageUrls.length || 1} photo{(event.photos.length || event.imageUrls.length || 1) === 1 ? "" : "s"}
                        {vendorCount ? ` · ${vendorCount} vendor${vendorCount === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid auto-rows-[220px] grid-cols-2 gap-3 md:grid-cols-4">
              <div className="col-span-2 row-span-2 rounded-[1.7rem] border border-dashed border-primary/30 bg-white/80 p-5">
                <div className="flex h-full flex-col justify-between">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">Start your party portfolio</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Your created parties will fill this space as visual cards you can reopen and edit.
                    </p>
                  </div>
                </div>
              </div>
              {fallbackEvents.map((event) => (
                <Link
                  key={event.title}
                  href={`/events/${event.slug}`}
                  className="relative col-span-2 overflow-hidden rounded-[1.5rem] border border-white/80 bg-muted shadow-sm"
                >
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
        </div>

        <aside className="rounded-[1.8rem] border border-white/70 bg-white/90 p-4 shadow-soft lg:sticky lg:top-24 lg:self-start">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Add Party</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with photos, then add tags and vendor credits.
              </p>
            </div>
          </div>
          <PartyEventForm key="new-party" vendors={vendors} />
        </aside>
      </section>
    </div>
  );
}

function getEventImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos: Array<{ id: string; updatedAt: Date }>;
}) {
  return event.photos[0]
    ? `/api/party-photos/${event.photos[0].id}?v=${event.photos[0].updatedAt.getTime()}`
    : event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png";
}
