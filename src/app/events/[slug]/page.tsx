import { ProfileImage } from "@/components/account/profile-image";
import { DeletePartyButton } from "@/components/parties/delete-party-button";
import { PartyPhotoGallery } from "@/components/parties/party-photo-gallery";
import { PartyContributions } from "@/components/parties/party-contributions";
import { PartyInvitationResponse } from "@/components/parties/party-invitation-response";
import { PartifulArtwork } from "@/components/parties/partiful-artwork";
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
import { storefrontPath } from "@/lib/businesses";
import { normalizePartyPhotoCrop, normalizeImageCrop } from "@/lib/image-crop";
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
        vendorRatings: { where: { userId: session?.user?.id ?? "" }, select: { vendorId: true, rating: true } },
        contributions: { where: { status: "APPROVED" }, select: { tiktokUrl: true, appleMusicUrl: true, spotifyUrl: true }, orderBy: { createdAt: "asc" }, take: 100 },
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
      fullUrl: partyPhotoUrl(photo.id, photo.updatedAt, { original: true }),
      crop: normalizePartyPhotoCrop(photo.crop),
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
      fullUrl: image,
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
  const currentUserId = session?.user?.id ?? null;
  const isOwner = Boolean(currentUserId && host?.id && currentUserId === host.id);
  const pendingInvitation = currentUserId && event && !isOwner
    ? await db.partyCollaborator.findFirst({
        where: { eventId: event.id, userId: currentUserId, status: "PENDING", role: { in: ["GUEST", "CO_HOST"] } },
        select: { id: true, role: true }
      })
    : null;
  const showManagementLinks = canShowPartyManagementLinks(isOwner, Boolean(event));
  const visibleCollaborators = getVisiblePartyCollaborators((event?.collaborators ?? []).filter((person) => person.role !== "GUEST"), host);
  const pendingCoHosts = isOwner && event ? await db.partyCollaborator.findMany({
    where: { eventId: event.id, event: { userId: currentUserId! }, role: "CO_HOST", status: "PENDING" },
    select: { id: true, user: { select: { name: true, username: true } } },
    orderBy: { createdAt: "asc" }
  }) : [];
  const canContribute = Boolean(!isOwner && currentUserId && event?.collaborators.some((person) => person.userId === currentUserId && person.status === "ACCEPTED"));
  const showHeaderActions = Boolean(showManagementLinks && event || currentUserId && host && currentUserId !== host.id || canContribute);
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
        tiktokUrls: event.tiktokUrls,
        spotifyUrl: event.spotifyUrl,
        pinterestUrl: event.pinterestUrl,
        county: event.county,
        countyFips: event.countyFips,
        appleMusicUrl: event.appleMusicUrl,
        location: event.location,
        formattedAddress: event.formattedAddress,
        city: event.city,
        state: event.state,
        zipCode: event.zipCode,
        locationLat: event.locationLat,
        locationLng: event.locationLng,
        googlePlaceId: event.googlePlaceId,
        vendorRatings: Object.fromEntries(event.vendorRatings.map((rating) => [rating.vendorId, rating.rating])),
        photos: event.photos.map((photo) => ({
          id: photo.id,
          url: partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 }),
          crop: normalizePartyPhotoCrop(photo.crop),
          vendorIds: photo.taggedVendors.map((vendor) => vendor.id),
          vendorRatings: Object.fromEntries(event.vendorRatings.filter((rating) => photo.taggedVendors.some((vendor) => vendor.id === rating.vendorId)).map((rating) => [rating.vendorId, rating.rating])),
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
          select: { id: true, name: true, username: true, city: true, state: true, logoUrl: true, status: true, instagramUrl: true, tiktokUrl: true, website: true },
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
        <div className="flex flex-wrap items-center gap-3"><Link href={`/events/${formParty.slug}`} className="inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium">View public party</Link><DeletePartyButton eventId={formParty.id} title={formParty.title} /></div>
      </header>
      <PartyEventForm composer currentUserId={currentUserId ?? ""} initialParty={formParty} users={editUsers} vendors={editVendors} />
    </section>;
  }
  return (
    <div className="space-y-8">
      {pendingInvitation ? (
        <section aria-label="Your party invitation" className="space-y-4 rounded-3xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-semibold">You’re invited!</h2>
            <p className="mt-2 text-sm text-muted-foreground">You’ve been invited to {title} as {pendingInvitation.role === "GUEST" ? "a guest" : "a co-host"}. Would you like to accept or decline?</p>
          </div>
          <PartyInvitationResponse collaborationId={pendingInvitation.id} />
        </section>
      ) : null}
      <section aria-label="Party overview" className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-soft">
        <div className="relative md:min-h-[480px]">
          <div className="relative aspect-[4/3] overflow-hidden md:absolute md:inset-0 md:aspect-auto">
            {hero ? <PartyCoverEditor eventId={event?.id} slug={event?.slug} imageUrl={hero} crop={normalizeImageCrop(event?.coverImageCrop ?? safePhotos[0]?.crop)} editable={false} /> : null}
          </div>
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/85 via-black/35 to-transparent md:block" />
          <div className="relative flex min-w-0 flex-col gap-4 p-5 text-foreground md:min-h-[480px] md:justify-end md:p-8 md:text-white">
            {!event ? <div className="flex flex-wrap gap-2">
              <Badge variant="default">Inspiration example</Badge>
              {theme ? <Badge variant="default">{theme}</Badge> : null}
            </div> : null}
            <h1 className="max-w-3xl break-words text-3xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {event?.eventDate ? <span className="rounded-full bg-muted px-3 py-1.5 md:bg-white/15">{formatPartyDate(event.eventDate)}</span> : null}
              {tags.map((tag) => <span key={tag} className="rounded-full bg-primary/10 px-3 py-1.5 md:bg-white/15">{partyCategoryLabel(tag)}</span>)}
            </div>
            {event?.location && event.location !== "Private residence" ? (
              <p className="flex min-w-0 items-start gap-2 text-sm leading-6 text-muted-foreground md:text-white/85">
                <MapPin className="mt-1 h-4 w-4 shrink-0" />
                <span className="break-words">{event.location}</span>
              </p>
            ) : null}
            {visibleCollaborators.length > 0 ? (
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex shrink-0 -space-x-2">
                  {visibleCollaborators.slice(0, 5).map((collaborator) => (
                    <Link key={collaborator.id} href={collaborator.user.username ? `/profiles/${collaborator.user.username}` : "#"} className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 border-white bg-primary/20 text-xs font-semibold shadow-sm" title={collaborator.user.name ?? collaborator.user.username ?? "ShopFia host"}>
                      {getSafeProfileImage(collaborator.user.image) ? <img src={getSafeProfileImage(collaborator.user.image) ?? ""} alt={collaborator.user.name ?? collaborator.user.username ?? "ShopFia host"} className="block h-full w-full object-cover object-center" /> : (collaborator.user.name ?? collaborator.user.username ?? "SF").slice(0, 2).toUpperCase()}
                    </Link>
                  ))}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <p className="min-w-0 break-words">Hosted by {renderHostedBy(visibleCollaborators)}</p>
                  {host && visibleCollaborators.some((person) => person.user.id === host.id) ? <ProfileBadge badge={hostBadge} /> : null}
                </div>
              </div>
            ) : null}
            {host && !visibleCollaborators.some((person) => person.user.id === host.id) ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:text-white/85">
                <p>Posted by {host.username ? <Link href={`/profiles/${host.username}`} className="font-semibold underline-offset-4 hover:underline">{host.name ?? host.username}</Link> : host.name ?? "ShopFia host"}</p>
                <ProfileBadge badge={hostBadge} />
              </div>
            ) : null}

            {pendingCoHosts.length ? (
              <details className="rounded-2xl border border-border/60 p-3 text-sm md:border-white/20" aria-label="Pending co-host invitations">
                <summary className="cursor-pointer font-medium">Pending co-host invitations ({pendingCoHosts.length})</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground md:text-white/85">{pendingCoHosts.map((person) => <li key={person.id}>{person.user.name ?? person.user.username ?? "Invited co-host"} · invitation pending</li>)}</ul>
              </details>
            ) : null}
            {showHeaderActions ? (
              <div className="flex flex-wrap items-center gap-3">
                {showManagementLinks && event ? <Button asChild size="sm" variant="secondary" className="bg-white text-foreground shadow-sm"><Link href={`/events/${event.slug}?edit=1`}>Edit party</Link></Button> : null}
                {showManagementLinks && event ? <DeletePartyButton eventId={event.id} title={title} /> : null}
                {session?.user?.id && host && session.user.id !== host.id ? <form action={toggleFollow}><input type="hidden" name="followingId" value={host.id} /><Button type="submit" size="sm" variant="secondary">{isFollowingHost ? <Heart className="h-4 w-4 fill-current" /> : <UserPlus className="h-4 w-4" />}{isFollowingHost ? "Following" : "Follow"}</Button></form> : null}
                {canContribute ? <Button asChild size="sm" variant="secondary"><a href="#party-contributions">Add photos, videos or playlists</a></Button> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid min-w-0 gap-5">
          <PartyPhotoGallery title={title} photos={safePhotos.map((photo) => ({ id: photo.id, url: photo.url, fullUrl: photo.fullUrl, crop: photo.crop, vendorAnchors: photo.taggedVendors.filter((vendor) => firstPhotoIdByVendor.get(vendor.id) === photo.id).map((vendor) => `vendor-${vendor.id}-photos`) }))} />
          <PartifulArtwork url={event?.partyfulUrl} />
          <PartyMedia pinterestUrl={event?.pinterestUrl} tiktokUrl={event?.tiktokUrl} tiktokUrls={[...(event?.tiktokUrls ?? []), ...(event?.contributions ?? []).flatMap((item) => item.tiktokUrl ? [item.tiktokUrl] : [])]} appleMusicUrl={event?.appleMusicUrl} appleMusicUrls={(event?.contributions ?? []).flatMap((item) => item.appleMusicUrl ? [item.appleMusicUrl] : [])} spotifyUrl={event?.spotifyUrl} spotifyUrls={(event?.contributions ?? []).flatMap((item) => item.spotifyUrl ? [item.spotifyUrl] : [])} />
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
                    className="relative rounded-[1.25rem] border border-[#eadbd7] bg-white/85 p-3 transition hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <Link href={storefrontPath(vendor.slug)} aria-label={`View ${vendor.name} storefront`} className="flex items-center gap-3 after:absolute after:inset-0 after:rounded-[1.25rem] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-primary">
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
                    </Link>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f1e2dd] pt-3">
                      <a href={taggedPhotoAnchor} className="relative z-10 text-xs font-semibold text-primary underline-offset-4 hover:underline">
                        Show tagged photos
                      </a>
                      <Link href={storefrontPath(vendor.slug)} className="relative z-10 text-xs font-semibold text-foreground underline-offset-4 hover:underline">
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

      {guests.length > 0 ? <section aria-label="Party guests" className="space-y-4 rounded-3xl border bg-white p-5">
        <h2 className="text-2xl font-semibold">Guests</h2>
        <ul className="flex flex-wrap gap-3">
          {guests.map((guest) => {
            const name = guest.user.name ?? guest.user.username ?? "Guest";
            const identity = <><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold"><ProfileImage image={guest.user.image} initials={name.slice(0, 2).toUpperCase()} alt={`${name}'s profile photo`} /></span><span className="min-w-0 break-words text-sm font-medium">{name}</span></>;
            return <li key={guest.id}>{guest.user.username ? <Link href={`/profiles/${guest.user.username}`} className="inline-flex items-center gap-2 rounded-full border px-3 py-2">{identity}</Link> : <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2">{identity}</span>}</li>;
          })}
        </ul>
      </section> : null}

      {event && currentUserId ? <PartyContributions eventId={event.id} userId={currentUserId} isOwner={isOwner} canContribute={event.collaborators.some((person) => person.userId === currentUserId && person.status === "ACCEPTED")} /> : null}

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
              <Link href={`/profiles/${collaborator.user.username}`} className="font-semibold text-inherit underline-offset-4 hover:underline">
                {name}
              </Link>
            ) : (
              <span className="font-semibold text-inherit">{name}</span>
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
