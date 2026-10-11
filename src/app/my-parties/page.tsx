import Link from "next/link";
import { Camera, MapPin, Pencil, Sparkles } from "lucide-react";
import { PartyEventForm } from "@/components/parties/party-event-form";
import { PartyInvitationResponse } from "@/components/parties/party-invitation-response";
import { CroppedImage } from "@/components/ui/cropped-image";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { publicVendorWhere } from "@/lib/public-marketplace";

export const dynamic = "force-dynamic";

export default async function MyPartiesPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth().catch((error) => {
    console.error("ShopFia my parties auth failed", error);
    return null;
  });

  if (!session?.user?.id) {
    return <PublicMyPartiesPreview />;
  }

  const [events, vendors, users, invitations, hostedParties] = await Promise.all([
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
      where: publicVendorWhere(),
      select: { id: true, name: true, username: true, city: true, state: true, logoUrl: true, status: true },
      orderBy: { name: "asc" }
    }),
    db.user.findMany({
      where: {
        OR: [{ username: { not: null } }, { id: session.user.id }]
      },
      select: { id: true, image: true, name: true, username: true },
      orderBy: [{ name: "asc" }, { username: "asc" }],
      take: 100
    }),
    db.partyCollaborator.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      select: {
        id: true,
        role: true,
        event: { select: { title: true, slug: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    db.partyCollaborator.findMany({
      where: {
        userId: session.user.id,
        status: "ACCEPTED",
        // Owners retain their organizer attribution and use their own event controls.
        event: { userId: { not: session.user.id } }
      },
      select: {
        id: true,
        role: true,
        event: { select: { title: true, slug: true } }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <div className="space-y-10">
      <section className="min-w-0 rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-soft sm:p-8 lg:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Share your party</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your celebration, your story. Start with the photos that made it special.</p>
          </div>
          <Link href="/parties" className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium transition hover:bg-muted">Back to parties</Link>
        </header>
        <PartyEventForm key="new-party" composer currentUserId={session.user.id} users={users} vendors={vendors} />
      </section>
      {invitations.length > 0 ? (
        <section className="space-y-4 rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-soft">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Party invitations</h2>
            <p className="mt-1 text-sm text-muted-foreground">Accept to appear publicly as a host on a party.</p>
          </div>
          {invitations.map((invitation) => (
            <article key={invitation.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
              <div>
                <Link href={`/events/${invitation.event.slug}`} className="font-semibold underline-offset-4 hover:underline">
                  {invitation.event.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invited as {invitation.role === "MAIN_HOST" ? "main host" : "co-host"}
                </p>
              </div>
              <PartyInvitationResponse collaborationId={invitation.id} />
            </article>
          ))}
        </section>
      ) : null}
      {hostedParties.length > 0 ? (
        <section className="space-y-4 rounded-[1.8rem] border border-white/70 bg-white/90 p-5 shadow-soft">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Parties you host</h2>
            <p className="mt-1 text-sm text-muted-foreground">Leaving removes your public host attribution from a party.</p>
          </div>
          {hostedParties.map((collaboration) => (
            <article key={collaboration.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
              <div>
                <Link href={`/events/${collaboration.event.slug}`} className="font-semibold underline-offset-4 hover:underline">
                  {collaboration.event.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {collaboration.role === "MAIN_HOST" ? "Main host" : "Co-host"}
                </p>
              </div>
              <PartyInvitationResponse collaborationId={collaboration.id} mode="accepted" />
            </article>
          ))}
        </section>
      ) : null}
      {events.length > 0 ? (
        <section className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">Your published parties</h2>
            <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              {events.map((event, index) => {
                const { crop, image } = getEventImage(event);
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
                    <CroppedImage src={image} alt={event.title} crop={crop} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 text-white">
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

        </section>
      ) : null}
    </div>
  );
}

function PublicMyPartiesPreview() {
  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-soft lg:grid-cols-[1fr_0.76fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Party portfolio
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Create parties worth saving.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Browse the party gallery first, then sign in when you are ready to upload your own celebration,
            tag vendors, and turn inspiration into a planning board.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/parties"
              className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition hover:bg-foreground/90"
            >
              Browse parties
            </Link>
            <Link
              href="/account?redirectTo=%2Fmy-parties"
              className="inline-flex h-11 items-center justify-center rounded-full border border-primary/20 bg-white px-5 text-sm font-semibold text-primary shadow-sm transition hover:bg-white/90"
            >
              Sign in to create
            </Link>
          </div>
        </div>
        <div className="rounded-[1.7rem] border border-dashed border-primary/25 bg-[#fff8f5] p-5">
          <Camera className="h-6 w-6 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">What unlocks when you sign in</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
            <p>Upload event photos and crop them beautifully.</p>
            <p>Tag vendors directly on party moments.</p>
            <p>Save ideas, build galleries, and share your party style.</p>
          </div>
        </div>
      </section>


    </div>
  );
}

function getEventImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos: Array<{ crop: unknown; id: string; updatedAt: Date }>;
}) {
  return event.photos[0]
    ? {
        crop: normalizeImageCrop(event.photos[0].crop),
        image: partyPhotoUrl(event.photos[0].id, event.photos[0].updatedAt, { width: 900 })
      }
    : {
        crop: normalizeImageCrop(null),
        image: event.coverImageUrl ?? event.imageUrls[0] ?? ""
      };
}
