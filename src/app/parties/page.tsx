import { CountySelector } from "@/components/parties/county-selector";
import { getCounty, countyDistance } from "@/lib/party-location";
import { FriendSearchForm } from "@/components/parties/friend-search-form";
import Link from "next/link";
import { auth } from "@/auth";
import { Heart, MapPin, Plus, Search, Tags, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/app/actions/auth";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { db } from "@/lib/db";
import { normalizePartyPhotoCrop, normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { getUniquePartyVendors } from "@/lib/party-inspiration";
import { storefrontPath } from "@/lib/businesses";
import { publicVendorWhere } from "@/lib/public-marketplace";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { getSafeProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

const feedTabs = ["For You", "Following", "Nearby", "Trending"] as const;
type FeedTab = (typeof feedTabs)[number];

export default async function PartiesPage({
  searchParams
}: {
  searchParams?: Promise<{ feed?: string; friend?: string; q?: string; county?: string }> | { feed?: string; friend?: string; q?: string; county?: string };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const [session, originalMemberCutoff] = await Promise.all([
    auth().catch((error) => {
      console.error("ShopFia parties auth failed", error);
      return null;
    }),
    getOriginalMemberCutoffDate(db).catch((error) => {
      console.error("ShopFia parties badge cutoff failed", error);
      return null;
    })
  ]);
  const selectedFeed = getSelectedFeed(resolvedSearchParams.feed);
  const nearbyCounty = getCounty(resolvedSearchParams.county);
  const friendQuery = normalizeFriendQuery(resolvedSearchParams.friend);
  const partyQuery = normalizeFriendQuery(resolvedSearchParams.q);
  const followingIds = session?.user?.id
    ? new Set(
        (
          await db.follow.findMany({
            where: { followerId: session.user.id },
            select: { followingId: true }
          }).catch((error) => {
            console.error("ShopFia following lookup failed", error);
            return [];
          })
        ).map((follow) => follow.followingId)
      )
    : new Set<string>();
  const partiesResult = await db.partyEvent.findMany({
    where: {
      AND: [
        ...(partyQuery ? [{
          OR: [
            { title: { contains: partyQuery, mode: "insensitive" as const } },
            { theme: { contains: partyQuery, mode: "insensitive" as const } },
            { description: { contains: partyQuery, mode: "insensitive" as const } },
            { location: { contains: partyQuery, mode: "insensitive" as const } },
            { formattedAddress: { contains: partyQuery, mode: "insensitive" as const } },
            { city: { contains: partyQuery, mode: "insensitive" as const } },
            { county: { contains: partyQuery, mode: "insensitive" as const } },
            { state: { contains: partyQuery, mode: "insensitive" as const } },
            { tags: { has: partyQuery.toLowerCase() } },
            {
              taggedVendors: {
                some: publicVendorWhere({ name: { contains: partyQuery, mode: "insensitive" as const } })
              }
            }
          ]
        }] : []),
        ...(selectedFeed === "Following" ? [{
          OR: [
            { userId: { in: [...followingIds] } },
            { collaborators: { some: { status: "ACCEPTED" as const, userId: { in: [...followingIds] } } } },
            { taggedVendors: { some: publicVendorWhere({ userId: { in: [...followingIds] } }) } },
            { photos: { some: { taggedVendors: { some: publicVendorWhere({ userId: { in: [...followingIds] } }) } } } }
          ]
        }] : [])
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
          email: true,
          image: true,
          name: true,
          username: true
        }
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        include: {
          taggedVendors: {
            where: publicVendorWhere(),
            select: {
              id: true,
              name: true,
              slug: true,
              userId: true
            }
          }
        }
      },
      taggedVendors: {
        where: publicVendorWhere(),
        select: {
          id: true,
          name: true,
          slug: true,
          userId: true
        }
      },
      collaborators: {
        where: { status: "ACCEPTED" },
        select: {
          role: true,
          userId: true,
          user: { select: { id: true, createdAt: true, email: true, image: true, name: true, username: true } }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: 60
  }).catch((error) => {
    console.error("ShopFia parties feed failed", error);
    return null;
  });
  const partiesUnavailable = partiesResult === null;
  const parties = partiesResult ?? [];
  const friendResults = friendQuery
    ? await db.user.findMany({
        where: {
          AND: [
            { id: { not: session?.user?.id ?? "" } },
            { username: { not: null } },
            {
              OR: [
                { username: { contains: friendQuery, mode: "insensitive" as const } },
                { name: { contains: friendQuery, mode: "insensitive" as const } }
              ]
            }
          ]
        },
        select: {
          id: true,
          image: true,
          name: true,
          username: true,
          partyEvents: { select: { id: true } },
          partyCollaborations: {
            where: { status: "ACCEPTED" },
            select: { eventId: true }
          }
        },
        orderBy: [{ name: "asc" }, { username: "asc" }],
        take: 8
      }).catch((error) => {
        console.error("ShopFia friend search failed", error);
        return [];
      })
    : [];
  const savedPartyIds = session?.user?.id
    ? new Set(
        (
          await db.favorite.findMany({
            where: { buyerId: session.user.id, partyEventId: { not: null } },
            select: { partyEventId: true }
          }).catch((error) => {
            console.error("ShopFia saved parties failed", error);
            return [];
          })
        ).map((favorite) => favorite.partyEventId).filter(Boolean) as string[]
      )
    : new Set<string>();
  const visibleParties = getPartiesForFeed(parties, selectedFeed, followingIds, nearbyCounty);

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  return (
    <div className="space-y-5">
      <section className="border-b border-primary/10 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
              <span className="h-px w-10 bg-primary/60" />
              <span>Party feed</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Discover real party inspiration near you.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Scroll real celebrations, see the vendors tagged in the moment, and save the details that feel like your next gathering.
            </p>
          </div>
          <Link href="/my-parties" className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full party-brand-button px-7 py-3 text-base font-semibold text-white shadow-md transition  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d88f9d] focus-visible:ring-offset-4">
            <Plus className="h-5 w-5" aria-hidden="true" />
            Share your party
          </Link>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/75 bg-white/80 p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Find friends</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Follow hosts whose style you love.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search people by name or username, then browse the parties and vendors they share.
            </p>
          </div>
        </div>
        <FriendSearchForm>
          {partyQuery ? <input type="hidden" name="q" value={partyQuery} /> : null}
          {selectedFeed !== "For You" ? (
            <input type="hidden" name="feed" value={selectedFeed.toLowerCase()} />
          ) : null}
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="friend"
              defaultValue={friendQuery}
              aria-label="Search people by username or display name"
              placeholder="Search username or display name"
              className="h-12 w-full rounded-full border border-border bg-white px-11 text-sm outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </label>
        </FriendSearchForm>
        {friendQuery ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {friendResults.length ? (
              friendResults.map((friend) => {
                const image = getSafeProfileImage(friend.image);
                const name = friend.name ?? friend.username ?? "ShopFia host";
                const username = friend.username ?? "";
                const partyCount = getSharedPartyCount(friend);
                const isFollowing = followingIds.has(friend.id);

                return (
                  <article key={friend.id} className="rounded-2xl border border-border/70 bg-white p-3 shadow-sm">
                    <Link href={`/profiles/${username}`} className="flex items-center gap-3">
                      {image ? (
                        <img src={image} alt={name} className="h-12 w-12 rounded-full object-cover" loading="lazy" decoding="async" />
                      ) : (
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(name)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{name}</h3>
                        <p className="truncate text-xs text-muted-foreground">@{username}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {partyCount} part{partyCount === 1 ? "y" : "ies"}
                        </p>
                      </div>
                    </Link>
                    {session?.user?.id ? (
                      <form action={toggleFollow} className="mt-3">
                        <input type="hidden" name="followingId" value={friend.id} />
                        <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/15">
                          {isFollowing ? <Heart className="h-3.5 w-3.5 fill-current" /> : <UserPlus className="h-3.5 w-3.5" />}
                          {isFollowing ? "Following" : "Follow"}
                        </button>
                      </form>
                    ) : (
                      <Link href="/account" className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary">
                        Sign in to follow
                      </Link>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-primary/20 bg-white/70 p-5 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
                No hosts matched that search yet. Try a display name or handle.
              </div>
            )}
          </div>
        ) : null}
      </section>

      <nav className="sticky top-20 z-20 -mx-4 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur md:top-20">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {feedTabs.map((tab) => {
            const active = selectedFeed === tab;
            return (
              <Link
                key={tab}
                href={tab === "For You" ? "/parties" : `/parties?feed=${encodeURIComponent(tab.toLowerCase())}`}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "border border-border/70 bg-white/75 text-muted-foreground hover:bg-white hover:text-foreground"
                }`}
              >
                {tab}
              </Link>
            );
          })}
        </div>
      </nav>

      {selectedFeed === "Nearby" ? <form action="/parties" className="grid gap-3 rounded-3xl border bg-white p-5">
        <input type="hidden" name="feed" value="nearby" />
        <h2 className="font-semibold">Find parties near your county</h2>
        <CountySelector key={nearbyCounty?.fips ?? "none"} initialFips={nearbyCounty?.fips} countyName="county" required />
        <button type="submit" className="w-fit rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">Find nearby parties</button>
        <p className="text-xs text-muted-foreground">{nearbyCounty ? `Sorted by approximate distance from ${nearbyCounty.name}, ${nearbyCounty.state}. Private residences use county-level locations.` : "Choose your county to sort parties by approximate distance."}</p>
      </form> : null}
      <p className="text-sm text-muted-foreground">
        {partiesUnavailable ? "Party feed unavailable" : `${visibleParties.length} published ${visibleParties.length === 1 ? "party" : "parties"}`}
      </p>
      {visibleParties.length === 0 ? (
        <p className="rounded-2xl border bg-white/80 p-5 text-sm text-muted-foreground">
          {partiesUnavailable ? "We couldn’t load published parties. Please try again shortly." : selectedFeed === "Following"
            ? "No parties from the people you follow yet."
            : partyQuery ? "No published parties match your search." : "No parties have been published yet. Share your celebration to start the gallery."}
        </p>
      ) : null}
      <section className="columns-2 gap-2 sm:gap-4 md:columns-3 xl:columns-4">
        {visibleParties.length > 0
          ? visibleParties.map((party, index) => {
              const { crop, image } = getEventImage(party);
              const vendors = getUniquePartyVendors(party);
              const primaryHost = getPrimaryHost(party);
              const hostImage = getSafeProfileImage(primaryHost.image);
              const hostName = primaryHost.name ?? primaryHost.username ?? "ShopFia host";
              const hostBadge = getProfileBadge(primaryHost, originalMemberCutoff);
              const hostSummary = `Hosted by ${hostName}`;
              const tall = index % 5 === 0 || index % 7 === 3;

              return (
                <article
                  key={party.id}
                  className="group relative mb-2 break-inside-avoid overflow-hidden rounded-[1.05rem] border border-white/75 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:mb-4 sm:rounded-[1.35rem]"
                >
                  <Link href={`/events/${party.slug}`} className="absolute inset-0 z-10" aria-label={`Open ${party.title}`} />
                  <div className={`relative overflow-hidden bg-muted ${tall ? "aspect-[3/4]" : "aspect-[4/5]"}`}>
                    <CroppedImage src={image} alt={party.title} crop={crop} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute right-3 top-3 z-20">
                      <FavoriteToggle targetType="party" targetId={party.id} isSaved={savedPartyIds.has(party.id)} variant="floating" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-2.5 text-white sm:p-5">
                      <h2 className="line-clamp-2 text-sm font-semibold tracking-tight sm:text-2xl">{party.title}</h2>
                      {party.location !== "Private residence" && (party.location || party.city) ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/80 sm:mt-2 sm:gap-1.5 sm:text-sm">
                          <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                          <span className="line-clamp-1">{party.city ?? party.location ?? [party.city, party.state].filter(Boolean).join(", ")}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden space-y-2.5 p-3.5 sm:block">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {hostImage ? (
                          <img src={hostImage} alt={hostName} className="h-7 w-7 shrink-0 rounded-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {hostName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 truncate text-[13px] text-muted-foreground">{hostSummary}</span>
                        <ProfileBadge badge={hostBadge} className="shrink-0" />
                      </div>
                      <span className="inline-flex h-7 max-w-[42%] shrink-0 items-center rounded-full bg-[#fff7f4] px-2.5 text-[13px] text-muted-foreground">
                        <span className="truncate">
                        {party.theme ?? "Party"}
                        </span>
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-1.5 text-[13px] text-muted-foreground">
                      <span className="inline-flex h-8 items-center gap-1 rounded-full border border-border/80 bg-white px-2.5">
                        <Heart className={`h-4 w-4 ${savedPartyIds.has(party.id) ? "fill-current text-primary" : ""}`} />
                        {savedPartyIds.has(party.id) ? "Saved" : "Save"}
                      </span>
                      <span className="inline-flex h-8 min-w-0 max-w-full items-center gap-1 rounded-full border border-border/80 bg-white px-2.5">
                        <Tags className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {vendors.length} tagged vendor{vendors.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </div>
                    {vendors.length > 0 ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        Tagged: {vendors.slice(0, 3).map((vendor, vendorIndex) => (
                          <span key={vendor.id}>
                            {vendorIndex > 0 ? ", " : ""}
                            <Link href={storefrontPath(vendor.slug)} className="relative z-20 underline-offset-4 hover:underline">{vendor.name}</Link>
                          </span>
                        ))}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Vendor tags will appear as hosts add them to party photos.
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          : null}
      </section>

    </div>
  );
}

function normalizeFriendQuery(value?: string) {
  return (value ?? "").trim().replace(/^@/, "").slice(0, 60);
}

function getSharedPartyCount(user: {
  partyEvents: Array<{ id: string }>;
  partyCollaborations: Array<{ eventId: string }>;
}) {
  return new Set([
    ...user.partyEvents.map((event) => event.id),
    ...user.partyCollaborations.map((collaboration) => collaboration.eventId)
  ]).size;
}

function getInitials(value?: string | null) {
  if (!value) return "SF";
  return value
    .split(/[ @._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getSelectedFeed(value?: string): FeedTab {
  const normalized = value?.toLowerCase();
  if (normalized === "following") return "Following";
  if (normalized === "nearby") return "Nearby";
  if (normalized === "trending") return "Trending";
  return "For You";
}

function getPartiesForFeed<T extends {
  city: string | null;
  state: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  createdAt: Date;
  user: { id: string };
  collaborators: Array<{ userId: string }>;
  taggedVendors: Array<{ id: string; userId: string | null }>;
  photos: Array<{ taggedVendors: Array<{ id: string; userId: string | null }> }>;
  tags: string[];
  imageUrls: string[];
}>(parties: T[], feed: FeedTab, followingIds: Set<string>, nearbyCounty: ReturnType<typeof getCounty>) {
  if (feed === "Following") {
    const followed = parties.filter((party) => {
      if (followingIds.has(party.user.id)) return true;
      if (party.collaborators.some((collaborator) => followingIds.has(collaborator.userId))) return true;
      if (party.taggedVendors.some((vendor) => vendor.userId && followingIds.has(vendor.userId))) return true;
      return party.photos.some((photo) =>
        photo.taggedVendors.some((vendor) => vendor.userId && followingIds.has(vendor.userId))
      );
    });
    return followed;
  }

  if (feed === "Nearby") {
    return nearbyCounty ? [...parties].sort((left, right) => countyDistance(left, nearbyCounty) - countyDistance(right, nearbyCounty)) : parties;
  }

  if (feed === "Trending") {
    return [...parties].sort((left, right) => trendingScore(right) - trendingScore(left));
  }

  return parties;
}

function trendingScore(party: {
  tags: string[];
  imageUrls: string[];
  photos: Array<{ taggedVendors: Array<{ id: string }> }>;
  taggedVendors: Array<{ id: string }>;
  createdAt: Date;
}) {
  const vendorCount = new Set([
    ...party.taggedVendors.map((vendor) => vendor.id),
    ...party.photos.flatMap((photo) => photo.taggedVendors.map((vendor) => vendor.id))
  ]).size;
  const photoCount = party.photos.length || party.imageUrls.length || 1;
  const freshness = Math.max(0, 30 - Math.floor((Date.now() - party.createdAt.getTime()) / 86400000));
  return vendorCount * 8 + photoCount * 3 + party.tags.length * 2 + freshness;
}

function getPrimaryHost(party: {
  user: {
    createdAt?: Date | string | null;
    email?: string | null;
    id: string;
    image: string | null;
    name: string | null;
    username: string | null;
  };
  collaborators: Array<{
    role?: string;
    user: {
      createdAt?: Date | string | null;
      email?: string | null;
      id: string;
      image: string | null;
      name: string | null;
      username: string | null;
    };
  }>;
}) {
  return party.collaborators.find((collaborator) => collaborator.role === "MAIN_HOST")?.user ?? party.user;
}

function getEventImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos: Array<{ crop: unknown; id: string; updatedAt: Date }>;
}) {
  return event.photos[0]
    ? {
        crop: normalizePartyPhotoCrop(event.photos[0].crop),
        image: partyPhotoUrl(event.photos[0].id, event.photos[0].updatedAt, { width: 900 })
      }
    : {
        crop: normalizeImageCrop(null),
        image: event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png"
      };
}
