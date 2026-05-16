import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, MapPin, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { toggleFollowAction } from "@/app/actions/auth";
import { PartyEventForm, type EditablePartyEvent } from "@/components/parties/party-event-form";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CroppedImage } from "@/components/ui/cropped-image";
import { normalizeImageCrop } from "@/lib/image-crop";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";

export const dynamic = "force-dynamic";

const fallbackEvents = {
  "citrus-garden-brunch": {
    title: "Citrus Garden Brunch",
    theme: "Lemon garden party",
    tags: ["brunch", "lemons", "floral", "garden party"],
    description:
      "A soft citrus tablescape with blush linens, lemon accents, candlelight, and modern florals.",
    coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
    imageUrls: ["/demo/fairfield-lemon-tablescape.png"],
    vendorSlugs: ["solano-flora-and-table"]
  },
  "tulip-cookie-shower": {
    title: "Tulip Cookie Shower",
    theme: "Pastel floral baby shower",
    tags: ["baby shower", "pastel", "cookies", "floral"],
    description:
      "A sweet pastel favor moment built around hand-piped tulip and floral cookies.",
    coverImageUrl: "/demo/vacaville-cookie-tulips.png",
    imageUrls: ["/demo/vacaville-cookie-tulips.png"],
    vendorSlugs: ["blush-batch-cookie-atelier"]
  }
};

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
  const fallback = fallbackEvents[requestedSlug as keyof typeof fallbackEvents];
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
            user: { select: { createdAt: true, email: true, username: true } }
          }
        },
        photos: {
          orderBy: { sortOrder: "asc" },
          include: {
            taggedVendors: {
              include: {
                user: { select: { createdAt: true, email: true, username: true } }
              }
            },
            vendorRatings: true
          }
        },
        collaborators: {
          where: { status: { in: ["ACCEPTED", "PENDING"] } },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          include: {
            user: { select: { id: true, image: true, name: true, username: true } }
          }
        }
      }
    })
    .catch(() => null);

  const fallbackVendors = fallback
    ? await db.vendorProfile.findMany({
        where: { slug: { in: fallback.vendorSlugs } },
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
          coverPhoto: true,
          logoUrl: true,
          user: { select: { createdAt: true, email: true, username: true } }
        }
      })
    : [];

  if (!event && !fallback) return notFound();

  const title = event?.title ?? fallback?.title ?? "Party Story";
  const theme = event?.theme ?? fallback?.theme ?? null;
  const tags = event?.tags?.length ? event.tags : fallback?.tags ?? [];
  const description = event?.description ?? fallback?.description ?? "This party story is still being filled in.";
  const legacyImages = event?.imageUrls?.length ? event.imageUrls : fallback?.imageUrls ?? [];
  const photos = event?.photos?.length
    ? event.photos.map((photo) => ({
      id: photo.id,
      url: `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`,
      crop: normalizeImageCrop(photo.crop),
      taggedVendors: photo.taggedVendors
      }))
    : legacyImages.map((image, index) => ({
      id: `${image}-${index}`,
      url: image,
      crop: normalizeImageCrop(null),
      taggedVendors: event?.taggedVendors ?? fallbackVendors
      }));
  const safePhotos = photos.length
    ? photos
    : [
        {
          id: "placeholder",
          url: fallback?.coverImageUrl ?? "/demo/fairfield-lemon-tablescape.png",
          crop: normalizeImageCrop(null),
          taggedVendors: []
        }
      ];
  const hero = event?.coverImageUrl ?? safePhotos[0]?.url ?? fallback?.coverImageUrl ?? "/demo/fairfield-lemon-tablescape.png";
  const vendors = Array.from(
    new Map(
      [
        ...(event?.taggedVendors ?? []),
        ...safePhotos.flatMap((photo) => photo.taggedVendors),
        ...fallbackVendors
      ].map((vendor) => [vendor.id, vendor])
    ).values()
  );
  const host = event?.user ?? null;
  const acceptedCollaborators =
    event?.collaborators.filter((collaborator) => collaborator.status === "ACCEPTED") ?? [];
  const visibleCollaborators = acceptedCollaborators.length
    ? acceptedCollaborators
    : host
    ? [
        {
          id: "host",
          role: "MAIN_HOST" as const,
          status: "ACCEPTED" as const,
          user: {
            id: host.id,
            image: host.image,
            name: host.name,
            username: host.username
          }
        }
      ]
    : [];
  const hostBadge = getProfileBadge(host, originalMemberCutoff);
  const hostHandle = host?.username ? `@${host.username}` : host?.name ?? "ShopFia host";
  const currentUserId = session?.user?.id ?? null;
  const isOwner = Boolean(currentUserId && host?.id && currentUserId === host.id);
  const editRequested = resolvedSearchParams.edit === "1" || resolvedSearchParams.edit === "true";
  const isEditing = Boolean(editRequested && isOwner && event);
  const formParty = event
    ? ({
        id: event.id,
        slug: event.slug,
        title: event.title,
        theme: event.theme,
        tags: event.tags,
        description: event.description,
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
          url: `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`,
          crop: normalizeImageCrop(photo.crop),
          vendorIds: photo.taggedVendors.map((vendor) => vendor.id),
          vendorRatings: Object.fromEntries(
            photo.vendorRatings.map((rating) => [rating.vendorId, rating.rating])
          )
        })),
        mainHostId:
          event.collaborators.find((collaborator) => collaborator.role === "MAIN_HOST")?.userId ??
          event.userId,
        coHostIds: event.collaborators
          .filter((collaborator) => collaborator.role === "CO_HOST" && collaborator.status !== "REMOVED")
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
          select: { id: true, name: true, username: true, city: true, state: true, logoUrl: true },
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

  return (
    <div className="space-y-8">
      {isEditing && formParty ? (
        <section className="grid gap-5 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft lg:grid-cols-[0.72fr_1.28fr]">
          <div className="flex flex-col justify-between gap-6 rounded-[1.6rem] bg-muted/60 p-5">
            <div>
              <p className="text-sm text-muted-foreground">Editing party story</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit {formParty.title}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Update the story, location, hashtag bubbles, gallery order, cover photo, and vendor tags attached to each image.
              </p>
            </div>
            <div className="relative min-h-[260px] overflow-hidden rounded-[1.4rem] bg-muted shadow-sm">
              <CroppedImage src={hero} alt="" crop={safePhotos[0]?.crop} className="absolute inset-0 h-full w-full object-cover" />
            </div>
            <Link href={`/events/${formParty.slug}`} className="inline-flex">
              <Button type="button" variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                View public story
              </Button>
            </Link>
          </div>
          <div className="rounded-[1.6rem] border bg-white p-4">
            <PartyEventForm
              currentUserId={currentUserId ?? ""}
              initialParty={formParty}
              users={editUsers}
              vendors={editVendors}
            />
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <div className="relative min-h-[480px]">
          <CroppedImage src={hero} alt="" crop={safePhotos[0]?.crop} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="relative flex min-h-[480px] flex-col justify-end p-6 text-white md:p-8">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="bg-white/15 text-white backdrop-blur" variant="default">Party Story</Badge>
              {theme ? <Badge className="bg-white/15 text-white backdrop-blur" variant="default">{theme}</Badge> : null}
            </div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{description}</p>
            {event?.location ? (
              <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                <MapPin className="h-3.5 w-3.5" />
                {event.location}
              </div>
            ) : null}
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
                {isOwner && event ? (
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
                      {collaborator.user.image ? (
                        <img src={collaborator.user.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (collaborator.user.name ?? collaborator.user.username ?? "SF").slice(0, 2).toUpperCase()
                      )}
                    </Link>
                  ))}
                </div>
                <p className="text-sm text-white/85">
                  Hosted by{" "}
                  {visibleCollaborators.slice(0, 2).map((collaborator, index) => (
                    <span key={collaborator.id}>
                      {index ? " + " : ""}
                      {collaborator.user.username ? (
                        <Link href={`/profiles/${collaborator.user.username}`} className="font-semibold text-white underline-offset-4 hover:underline">
                          {collaborator.user.name ?? collaborator.user.username}
                        </Link>
                      ) : (
                        <span className="font-semibold text-white">{collaborator.user.name ?? "ShopFia host"}</span>
                      )}
                    </span>
                  ))}
                  {visibleCollaborators.length > 2 ? ` + ${visibleCollaborators.length - 2} others` : ""}
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid auto-rows-[190px] grid-cols-2 gap-3 md:grid-cols-4">
          {safePhotos.map((photo, index) => (
            <div
              key={photo.id}
              className={`relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm ${
                index === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <CroppedImage src={photo.url} alt="" crop={photo.crop} className="absolute inset-0 h-full w-full object-cover" />
              {photo.taggedVendors.length > 0 ? (
                <div className="absolute inset-x-2 bottom-2 flex flex-wrap gap-1.5">
                  {photo.taggedVendors.slice(0, 3).map((vendor) => (
                    <Link
                      key={vendor.id}
                      href={`/vendor/profile/${vendor.slug}`}
                      className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm"
                    >
                      {vendor.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft">
          <h2 className="text-2xl font-semibold tracking-tight">Vendor Contributions</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            ShopFia event pages connect beautiful celebrations back to the vendors who helped make them happen.
          </p>
          <div className="mt-5 grid gap-3">
            {vendors.length > 0 ? (
              vendors.map((vendor) => {
                const taggedPhotoCount = safePhotos.filter((photo) =>
                  photo.taggedVendors.some((taggedVendor) => taggedVendor.id === vendor.id)
                ).length;
                return (
                  <Link
                    key={vendor.id}
                    href={`/vendor/profile/${vendor.slug}`}
                    className="grid gap-3 rounded-[1.4rem] border bg-white p-3 transition hover:shadow-soft sm:grid-cols-[88px_1fr]"
                  >
                    <div
                      className="min-h-[88px] rounded-[1rem] bg-muted bg-cover bg-center"
                      style={{ backgroundImage: `url(${vendor.logoUrl ?? vendor.coverPhoto ?? "/demo/fairfield-lemon-tablescape.png"})` }}
                    />
                    <div>
                      <p className="text-sm font-semibold">Vendor contribution by {vendor.name}</p>
                      <ProfileBadge badge={getProfileBadge(vendor.user, originalMemberCutoff, { vendorContext: true })} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {taggedPhotoCount > 0
                          ? `Tagged in ${taggedPhotoCount} photo${taggedPhotoCount === 1 ? "" : "s"} from this party story.`
                          : "Tagged on this party story."}
                      </p>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-[1.4rem] bg-muted/60 p-4 text-sm text-muted-foreground">
                Vendor tags will appear here as this party story grows.
              </div>
            )}
          </div>
          <div className="mt-5 rounded-[1.4rem] bg-muted/60 p-4 text-sm text-muted-foreground">
            Next layer: customer-tagged party photos can feed back into vendor profiles as authentic event proof.
          </div>
        </div>
      </section>

      {vendors.length > 0 ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Tagged Vendor Moments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each vendor tag can become a mini portfolio section with photos, context, and a direct profile link.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {vendors.map((vendor, vendorIndex) => {
              const vendorPhotos = safePhotos.filter((photo) =>
                photo.taggedVendors.some((taggedVendor) => taggedVendor.id === vendor.id)
              );
              const displayPhotos = vendorPhotos.length ? vendorPhotos : safePhotos;
              return (
                <article key={vendor.id} className="overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/90 shadow-sm">
                  <div className="grid grid-cols-3 gap-1 p-2">
                    {displayPhotos.slice(0, 3).map((photo) => (
                      <div key={`${vendor.id}-${photo.id}`} className="relative aspect-square overflow-hidden rounded-[1rem] bg-muted">
                        <CroppedImage src={photo.url} alt="" crop={photo.crop} className="absolute inset-0 h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold">
                      {vendorIndex === 0 ? "Featured styling" : "Event detail"} by {vendor.name}
                    </h3>
                    <ProfileBadge badge={getProfileBadge(vendor.user, originalMemberCutoff, { vendorContext: true })} className="mt-2" />
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Tagged photos give this vendor real context from a celebration, not just a static portfolio upload.
                    </p>
                    <Link href={`/vendor/profile/${vendor.slug}`} className="mt-3 inline-flex">
                      <Button size="sm" variant="secondary">View vendor profile</Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <Link href="/my-parties" className="inline-flex">
        <Button variant="secondary">Back to My Parties</Button>
      </Link>
    </div>
  );
}
