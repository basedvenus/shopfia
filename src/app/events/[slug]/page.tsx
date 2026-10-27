import { PartyMedia } from "@/components/parties/party-media";
import { partyCategoryLabel, inferPartyOccasion, occasionTag } from "@/lib/party-occasions";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, MapPin, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { toggleFollowAction } from "@/app/actions/auth";
import { PartyEventForm, type EditablePartyEvent } from "@/components/parties/party-event-form";
import { PartyCoverEditor } from "@/components/parties/party-cover-editor";
import { PartyComments } from "@/components/parties/party-comments";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { storefrontPath } from "@/lib/businesses";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { getPartyInspirationExample, getUniquePartyVendors } from "@/lib/party-inspiration";
import { isQuarantinedVendorId, publicVendorWhere } from "@/lib/public-marketplace";
import {
  canShowPartyManagementLinks,
  getVisiblePartyCollaborators
} from "@/lib/party-public-view";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { getSafeProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

export default async function EventPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ edit?: string }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { edit?: string })
  ]);
  const [{ db }, session] = await Promise.all([import("@/lib/db"), auth()]);
  const originalMemberCutoff = await getOriginalMemberCutoffDate(db);
  const requestedSlug = decodeURIComponent(slug).trim();
  const event = await db.partyEvent
    .findFirst({
      where: {
        OR: [
          { slug: requestedSlug },
          { id: requestedSlug }
        ]
      },
      include: {
        user: { select: { id: true, createdAt: true, email: true, name: true, username: true, image: true } },
        taggedVendors: {
          include: {
            categories: { include: { category: true } },
            user: { select: { createdAt: true, email: true, username: true } }
          }
        },
        photos: {
          orderBy: { sortOrder: "asc" },
          include: {
            taggedVendors: {
              include: {
                categories: { include: { category: true } },
                user: { select: { createdAt: true, email: true, username: true } }
              }
            },
            vendorRatings: true
          }
        },
        collaborators: {
          where: { status: "ACCEPTED" },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: {
            user: { select: { id: true, image: true, name: true, username: true } }
          }
        }
      }
    });

  const fallback = getPartyInspirationExample(requestedSlug, Boolean(event));

  if (!event && !fallback) return notFound();

  const title = event?.title ?? fallback?.title ?? "Party";
  const theme = event?.theme ?? fallback?.theme ?? null;
  const inferredOccasion = event ? inferPartyOccasion(event.tags, event.title) : "";
  const tags = inferredOccasion ? [occasionTag(inferredOccasion)] : event?.tags?.length ? event.tags : fallback?.tags ?? [];
  const legacyImages = event?.imageUrls?.length ? event.imageUrls : event?.coverImageUrl ? [event.coverImageUrl] : fallback?.imageUrls ?? [];
  const photos = event?.photos?.length
    ? event.photos.map((photo) => ({
      id: photo.id,
      url: partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 }),
      crop: normalizeImageCrop(photo.crop),
      taggedVendors: photo.taggedVendors.filter((vendor) => !isQuarantinedVendorId(vendor.id)),
      vendorContributions: Object.fromEntries(
        photo.vendorRatings
          .filter((credit) => credit.contributionNote && !isQuarantinedVendorId(credit.vendorId))
          .map((credit) => [credit.vendorId, credit.contributionNote ?? ""])
      )
      }))
    : legacyImages.map((image, index) => ({
      id: `${image}-${index}`,
      url: image,
      crop: normalizeImageCrop(null),
      taggedVendors: event?.taggedVendors.filter((vendor) => !isQuarantinedVendorId(vendor.id)) ?? [],
      vendorContributions: {}
      }));
  const safePhotos = photos;
  const hero = safePhotos[0]?.url ?? event?.coverImageUrl ?? fallback?.coverImageUrl ?? null;
  const vendors = getUniquePartyVendors({
    taggedVendors: event?.taggedVendors ?? [],
    photos: safePhotos
  });
  const firstPhotoIdByVendor = new Map<string, string>();
  for (const photo of safePhotos) {
    for (const vendor of photo.taggedVendors) {
      if (!firstPhotoIdByVendor.has(vendor.id)) {
        firstPhotoIdByVendor.set(vendor.id, photo.id);
      }
    }
  }
  const host = event?.user ?? null;
  const hostBadge = getProfileBadge(host, originalMemberCutoff);
  const hostHandle = host?.username ? `@${host.username}` : host?.name ?? "ShopFia host";
  const currentUserId = session?.user?.id ?? null;
  const isOwner = Boolean(currentUserId && host?.id && currentUserId === host.id);
  const showManagementLinks = canShowPartyManagementLinks(isOwner, Boolean(event));
  const visibleCollaborators = getVisiblePartyCollaborators((event?.collaborators ?? []).filter((person) => person.role !== "GUEST"), host);
  const guests = (event?.collaborators ?? []).filter((person) => person.role === "GUEST" && person.status === "ACCEPTED");
  const editRequested = resolvedSearchParams.edit === "1" || resolvedSearchParams.edit === "true";
  const isEditing = Boolean(editRequested && isOwner && event);
  // Keep pending invitations selected during owner edits without adding them to
  // the public collaborator projection above.
  const editableCollaborators = isEditing && event
    ? await db.partyCollaborator.findMany({
        where: {
          eventId: event.id,
          event: { userId: currentUserId! },
          status: { in: ["PENDING", "ACCEPTED"] }
        },
        select: { userId: true, role: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }]
      })
    : [];
  const formParty = isEditing && event
    ? ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        theme: event.theme,
        tags: event.tags,
        description: event.description,
        eventDate: event.eventDate,
        partyfulUrl: event.partyfulUrl,
        tiktokUrl: event.tiktokUrl,
        appleMusicUrl: event.appleMusicUrl,
        location: event.location,
        formattedAddress: event.formattedAddress,
        city: event.city,
        state: event.state,
        zipCode: event.zipCode,
        locationLat: event.locationLat,
        locationLng: event.locationLng,
        googlePlaceId: event.googlePlaceId,
        photos: event.photos.map((photo) => ({
          id: photo.id,
          url: partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 }),
          crop: normalizeImageCrop(photo.crop),
          vendorIds: photo.taggedVendors.map((vendor) => vendor.id),
          vendorRatings: Object.fromEntries(photo.vendorRatings.filter((credit) => credit.rating !== null).map((credit) => [credit.vendorId, credit.rating!])),
          vendorContributions: Object.fromEntries(
            photo.vendorRatings
              .filter((credit) => credit.contributionNote)
              .map((credit) => [credit.vendorId, credit.contributionNote ?? ""])
          )
        })),
        mainHostId:
          editableCollaborators.find((collaborator) => collaborator.role === "MAIN_HOST")?.userId ??
          event.userId,
        guestIds: editableCollaborators.filter((collaborator) => collaborator.role === "GUEST").map((collaborator) => collaborator.userId),
        coHostIds: editableCollaborators
          .filter((collaborator) => collaborator.role === "CO_HOST")
          .map((collaborator) => collaborator.userId)
      } satisfies EditablePartyEvent)
    : null;
  const isFollowingHost =
    session?.user?.id && host?.id
      ? Boolean(
          await db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: session.user.id,
                followingId: host.id
              }
            }
          })
        )
      : false;
  const [editVendors, editUsers] = isEditing
    ? await Promise.all([
        db.vendorProfile.findMany({
          where: publicVendorWhere(),
          select: { id: true, name: true, username: true, city: true, state: true, logoUrl: true, status: true },
          orderBy: { name: "asc" }
        }),
        db.user.findMany({
          where: { OR: [{ username: { not: null } }, { id: currentUserId ?? "" }] },
          select: { id: true, image: true, name: true, username: true },
          orderBy: [{ name: "asc" }, { username: "asc" }],
          take: 100
        })
      ])
    : [[], []];

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  if (isEditing && formParty) {
    return <section className="space-y-7 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div><p className="text-sm text-muted-foreground">Editing party</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Edit {formParty.title}</h1><p className="mt-2 text-sm text-muted-foreground">Update your story, select photos, and credit your vendors.</p></div>
        <Link href={`/events/${formParty.slug}`} className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium">View public party</Link>
      </header>
      <PartyEventForm composer currentUserId={currentUserId ?? ""} initialParty={formParty} users={editUsers} vendors={editVendors} />
    </section>;
  }
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <div className="relative min-h-[480px]">
          {hero ? <PartyCoverEditor eventId={event?.id} slug={event?.slug} imageUrl={hero} crop={normalizeImageCrop(event?.coverImageCrop ?? safePhotos[0]?.crop)} editable={isOwner} /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative flex min-h-[480px] flex-col justify-end p-6 text-white md:p-8">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white backdrop-blur" variant="default">{event ? "Party" : "Inspiration example"}</Badge>
              {theme && !event ? <Badge className="bg-white/15 text-white backdrop-blur" variant="default">{theme}</Badge> : null}
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>

            {event?.location ? (
              <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {event?.eventDate ? (
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                  {formatPartyDate(event.eventDate)}
                </span>
              ) : null}

            </div>
            {host ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="text-sm text-white/85">
                  Posted by{" "}
                  {host.username ? (
                    <Link href={`/profiles/${host.username}`} className="font-semibold text-white underline-offset-4 hover:underline">
                      {host.name ?? "ShopFia host"}
                    </Link>
                  ) : (
                    <span className="font-semibold text-white">{host.name ?? "ShopFia host"}</span>
                  )}{" "}
                  <span className="text-white/70">{hostHandle}</span>
                  <ProfileBadge badge={hostBadge} light className="ml-2 align-middle" />
                </div>
                {showManagementLinks && event ? (
                  <Link href={`/events/${event.slug}?edit=1`}>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="border-white/80 bg-white text-foreground shadow-soft hover:bg-white/90"
                    >
                      Edit party
                    </Button>
                  </Link>
                ) : null}
                {session?.user?.id && session.user.id !== host.id ? (
                  <form action={toggleFollow}>
                    <input type="hidden" name="followingId" value={host.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      {isFollowingHost ? <Heart className="h-4 w-4 fill-current" /> : <UserPlus className="h-4 w-4" />}
                      {isFollowingHost ? "Following" : "Follow"}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {guests.length > 0 ? <div className="mb-4 text-white"><p className="text-sm font-semibold">Guests</p><div className="flex flex-wrap gap-2">{guests.map((guest) => <Link key={guest.id} href={guest.user.username ? `/profiles/${guest.user.username}` : "#"} className="rounded-full bg-white/20 px-3 py-1 text-sm">{guest.user.name ?? guest.user.username ?? "Guest"}</Link>)}</div></div> : null}
            {visibleCollaborators.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex -space-x-2">
                  {visibleCollaborators.slice(0, 5).map((collaborator) => (
                    <Link
                      key={collaborator.id}
                      href={collaborator.user.username ? `/profiles/${collaborator.user.username}` : "#"}
                      className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-white bg-primary/20 text-xs font-semibold text-white shadow-sm"
                      title={collaborator.user.name ?? collaborator.user.username ?? "ShopFia host"}
                    >
                      {getSafeProfileImage(collaborator.user.image) ? (
                        <img
                          key={collaborator.user.image}
                          src={getSafeProfileImage(collaborator.user.image) ?? ""}
                          alt={collaborator.user.name ?? collaborator.user.username ?? "ShopFia host"}
                          className="block h-full w-full object-cover object-center"
                        />
                      ) : (
                        (collaborator.user.name ?? collaborator.user.username ?? "SF").slice(0, 2).toUpperCase()
                      )}
                    </Link>
                  ))}
                </div>
                <p className="text-sm text-white/85">
                  Hosted by {renderHostedBy(visibleCollaborators)}
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                  {partyCategoryLabel(tag)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid min-w-0 gap-5">
        <div id="party-gallery" className="grid scroll-mt-24 auto-rows-[190px] grid-cols-2 gap-3 md:grid-cols-4">
          {safePhotos.length === 0 ? <p className="col-span-full rounded-2xl bg-muted/60 p-5 text-sm text-muted-foreground">No party photos have been added yet.</p> : null}
          {safePhotos.map((photo, index) => (
            <div
              key={photo.id}
              className={`relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm ${
                index === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <CroppedImage
                src={photo.url}
                alt={`${title} party photo ${index + 1}`}
                crop={photo.crop}
                className="absolute inset-0 h-full w-full object-cover"
                loading={index === 0 ? "eager" : "lazy"}
              />
              {photo.taggedVendors.map((vendor) =>
                firstPhotoIdByVendor.get(vendor.id) === photo.id ? (
                  <span
                    key={vendor.id}
                    id={`vendor-${vendor.id}-photos`}
                    className="pointer-events-none absolute inset-1 rounded-[1.2rem] transition target:ring-4 target:ring-primary/45 target:ring-offset-2 target:ring-offset-background"
                    aria-hidden="true"
                  />
                ) : null
              )}
            </div>
          ))}
        </div>
          <PartyMedia tiktokUrl={event?.tiktokUrl} appleMusicUrl={event?.appleMusicUrl} />
        </div>

        <div className="min-w-0 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft">
          <h2 className="text-2xl font-semibold tracking-tight">Featured Vendors</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {event ? "The creative team credited by this party’s host." : "This is a decorative inspiration example. No vendor participation is implied."}
          </p>
          <div className="mt-5 grid gap-2">
            {vendors.length > 0 ? (
              vendors.map((vendor) => {
                const taggedPhotoCount = safePhotos.filter((photo) =>
                  photo.taggedVendors.some((taggedVendor) => taggedVendor.id === vendor.id)
                ).length;
                const categoryLabel = getVendorCategoryLabel(vendor);
                const taggedPhotoAnchor = firstPhotoIdByVendor.has(vendor.id)
                  ? `#vendor-${vendor.id}-photos`
                  : "#party-gallery";
                return (
                  <article
                    key={vendor.id}
                    className="rounded-[1.25rem] border border-[#eadbd7] bg-white/85 p-3 transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <a href={taggedPhotoAnchor} className="flex items-center gap-3">
                      {vendor.status !== "UNCLAIMED" && vendor.logoUrl ? (
                        <img src={vendor.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{vendor.name}</span>
                        <span className="mt-0.5 block truncate text-xs font-medium text-primary/75">{categoryLabel}</span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {taggedPhotoCount > 0
                            ? `${taggedPhotoCount} tagged photo${taggedPhotoCount === 1 ? "" : "s"}`
                            : "Tagged on this party"}
                        </span>
                      </span>
                    </a>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f1e2dd] pt-3">
                      <a href={taggedPhotoAnchor} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
                        Show tagged photos
                      </a>
                      <Link href={storefrontPath(vendor.slug)} className="text-xs font-semibold text-foreground underline-offset-4 hover:underline">
                        View storefront
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] bg-muted/60 p-4 text-sm text-muted-foreground">
                {event ? "No vendors have been credited on this party yet." : "No verified vendor credits are available for this example."}
              </div>
            )}
          </div>
        </div>
      </section>

      {event ? <PartyComments eventId={event.id} hostId={event.userId} signedIn={Boolean(currentUserId)} slug={event.slug} /> : null}
      {showManagementLinks ? (
        <Link href="/my-parties" className="inline-flex">
          <Button variant="secondary">Back to My Parties</Button>
        </Link>
      ) : null}
    </div>
  );
}

function renderHostedBy(
  collaborators: Array<{ user: { name: string | null; username: string | null } }>
) {
  const visible = collaborators.slice(0, 2);

  if (visible.length === 0) return "ShopFia";

  return (
    <>
      {visible.map((collaborator, index) => {
        const name = collaborator.user.name ?? collaborator.user.username ?? "ShopFia host";
        return (
          <span key={collaborator.user.username ?? `${name}-${index}`}>
            {index === 1 ? (collaborators.length === 2 ? " and " : ", ") : ""}
            {collaborator.user.username ? (
              <Link href={`/profiles/${collaborator.user.username}`} className="font-semibold text-white underline-offset-4 hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-white">{name}</span>
            )}
          </span>
        );
      })}
      {collaborators.length > 2 ? ` + ${collaborators.length - 2} others` : ""}
    </>
  );
}

function getVendorCategoryLabel(vendor: { categories?: Array<{ category: { name: string } }> }) {
  return vendor.categories?.[0]?.category.name ?? "Event Vendor";
}

function formatPartyDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}
