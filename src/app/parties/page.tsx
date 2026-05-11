import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Plus, Sparkles } from "lucide-react";
import { PartyEventForm, type EditablePartyEvent } from "@/components/parties/party-event-form";
import { Button } from "@/components/ui/button";

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

export default async function PartiesPage({
  searchParams
}: {
  searchParams?: { edit?: string };
}) {
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
      where: { verified: true },
      select: { id: true, name: true, city: true, state: true },
      orderBy: { name: "asc" }
    })
  ]);

  const editSlug = typeof searchParams?.edit === "string" ? searchParams.edit : null;
  const selectedEvent = editSlug ? events.find((event) => event.slug === editSlug) ?? null : null;
  const formParty = selectedEvent
    ? ({
        id: selectedEvent.id,
        slug: selectedEvent.slug,
        title: selectedEvent.title,
        theme: selectedEvent.theme,
        tags: selectedEvent.tags,
        description: selectedEvent.description,
        location: selectedEvent.location,
        photos: selectedEvent.photos.map((photo) => ({
          id: photo.id,
          url: `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`,
          vendorIds: photo.taggedVendors.map((vendor) => vendor.id)
        }))
      } satisfies EditablePartyEvent)
    : null;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(390px,0.85fr)]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Social party portfolio</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">My Parties</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Curate visual stories with real photos, searchable hashtags, and vendor credits tied to the images they helped create.
              </p>
            </div>
            {selectedEvent ? (
              <Link href="/parties">
                <Button variant="secondary">
                  <Plus className="h-4 w-4" />
                  New Party
                </Button>
              </Link>
            ) : null}
          </div>

          {events.length > 0 ? (
            <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {events.map((event, index) => {
                const image = getEventImage(event);
                const vendorCount = new Set(event.photos.flatMap((photo) => photo.taggedVendors.map((vendor) => vendor.id))).size;
                const isSelected = selectedEvent?.id === event.id;
                const featured = index === 0 || index % 7 === 0;
                return (
                  <Link
                    key={event.id}
                    href={`/parties?edit=${event.slug}`}
                    className={`group relative overflow-hidden rounded-[1.5rem] border bg-muted shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${
                      featured ? "col-span-2 row-span-2" : "col-span-2"
                    } ${isSelected ? "border-primary ring-2 ring-primary/30" : "border-white/80"}`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]"
                      style={{ backgroundImage: `url(${image})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
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
                  </Link>
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
              <h2 className="text-xl font-semibold tracking-tight">{selectedEvent ? "Edit Party" : "Add Party"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedEvent
                  ? "Revise the story, reorder the gallery, and adjust photo-level vendor credits."
                  : "Start with photos, then add tags and vendor credits."}
              </p>
            </div>
            {selectedEvent ? (
              <Link href={`/events/${selectedEvent.slug}`}>
                <Button size="sm" variant="secondary">View story</Button>
              </Link>
            ) : null}
          </div>
          <PartyEventForm key={selectedEvent?.id ?? "new-party"} initialParty={formParty} vendors={vendors} />
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
