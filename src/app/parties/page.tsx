import Link from "next/link";
import { auth } from "@/auth";
import { Heart, MapPin, Search, Tags, UserPlus } from "lucide-react";
import { toggleFollowAction } from "@/app/actions/auth";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { db } from "@/lib/db";
import { normalizeImageCrop } from "@/lib/image-crop";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { getSafeProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

const demoParties = [
  {
    title: "Citrus Garden Brunch",
    theme: "Lemon tablescape inspiration",
    tags: ["lemons", "floral", "brunch"],
    location: "Fairfield, CA",
    coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
    slug: "citrus-garden-brunch",
    vendorCount: 1,
    host: "ShopFia"
  },
  {
    title: "Tulip Cookie Shower",
    theme: "Pastel cookie favors",
    tags: ["baby shower", "pastel", "cookies"],
    location: "Vacaville, CA",
    coverImageUrl: "/demo/vacaville-cookie-tulips.png",
    slug: "tulip-cookie-shower",
    vendorCount: 1,
    host: "ShopFia"
  }
];

const feedTabs = ["For You", "Following", "Nearby", "Trending"] as const;
type FeedTab = (typeof feedTabs)[number];

export default async function PartiesPage({
  searchParams
}: {
  searchParams?: Promise<{ feed?: string; friend?: string }> | { feed?: string; friend?: string };
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const [session, originalMemberCutoff] = await Promise.all([auth(), getOriginalMemberCutoffDate(db)]);
  const selectedFeed = getSelectedFeed(resolvedSearchParams.feed);
  const friendQuery = normalizeFriendQuery(resolvedSearchParams.friend);
  const parties = await db.partyEvent.findMany({
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
          userId: true,
          user: { select: { id: true, image: true, name: true, username: true } }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: 60
  });
  const followingIds = session?.user?.id
    ? new Set(
        (
          await db.follow.findMany({
            where: { followerId: session.user.id },
            select: { followingId: true }
          })
        ).map((follow) => follow.followingId)
      )
    : new Set<string>();
  const friendResults = friendQuery
    ? await db.user.findMany({
        where: {
          AND: [
            { id: { not: session?.user?.id ?? "" } },
            { username: { not: null } },
            {
              OR: [
                { username: { contains: friendQuery, mode: "insensitive" } },
                { name: { contains: friendQuery, mode: "insensitive" } }
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
      })
    : [];
  const savedPartyIds = session?.user?.id
    ? new Set(
        (
          await db.favorite.findMany({
            where: { buyerId: session.user.id, partyEventId: { not: null } },
            select: { partyEventId: true }
          })
        ).map((favorite) => favorite.partyEventId).filter(Boolean) as string[]
      )
    : new Set<string>();
  const visibleParties = getPartiesForFeed(parties, selectedFeed, followingIds);

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
          <Link href="/my-parties" className="hidden rounded-full border border-primary/20 bg-white/75 px-4 py-2 text-sm font-medium text-primary shadow-sm transition hover:bg-white md:inline-flex">
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
        <form action="/parties" className="mt-4 flex flex-col gap-2 sm:flex-row">
          {selectedFeed !== "For You" ? (
            <input type="hidden" name="feed" value={selectedFeed.toLowerCase()} />
          ) : null}
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="friend"
              defaultValue={friendQuery}
              placeholder="Search username or display name"
              className="h-12 w-full rounded-full border border-border bg-white px-11 text-sm outline-none transition focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <button className="h-12 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition hover:bg-foreground/90">
            Search
          </button>
        </form>
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
                        <img src={image} alt="" className="h-12 w-12 rounded-full object-cover" />
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

      <section className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        {visibleParties.length > 0
          ? visibleParties.map((party, index) => {
              const { crop, image } = getEventImage(party);
              const vendors = getUniqueVendors(party);
              const hostImage = getSafeProfileImage(party.user.image);
              const hostName = party.user.name ?? party.user.username ?? "ShopFia host";
              const hostBadge = getProfileBadge(party.user, originalMemberCutoff);
              const hostSummary = formatHostedBy(
                party.collaborators.length
                  ? party.collaborators.map((collaborator) => collaborator.user)
                  : [party.user]
              );
              const tall = index % 5 === 0 || index % 7 === 3;

              return (
                <article
                  key={party.id}
                  className="group relative mb-4 break-inside-avoid overflow-hidden rounded-[1.35rem] border border-white/75 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <Link href={`/events/${party.slug}`} className="absolute inset-0 z-10" aria-label={`Open ${party.title}`} />
                  <div className={`relative overflow-hidden bg-muted ${tall ? "aspect-[3/4]" : "aspect-[4/5]"}`}>
                    <CroppedImage src={image} alt="" crop={crop} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute right-4 top-4 z-20">
                      <FavoriteToggle targetType="party" targetId={party.id} isSaved={savedPartyIds.has(party.id)} />
                    </div>
                    <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                      {(party.tags.length ? party.tags : [party.theme].filter(Boolean))
                        .slice(0, 3)
                        .map((tag) => (
                          <span key={tag} className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white backdrop-blur">
                            #{tag}
                          </span>
                        ))}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <h2 className="text-2xl font-semibold tracking-tight">{party.title}</h2>
                      {party.location || party.city ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80">
                          <MapPin className="h-4 w-4" />
                          {party.location ?? [party.city, party.state].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {hostImage ? (
                          <img src={hostImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {hostName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate text-sm text-muted-foreground">{hostSummary}</span>
                        <ProfileBadge badge={hostBadge} />
                      </div>
                      <span className="shrink-0 rounded-full bg-[#fff7f4] px-3 py-1 text-xs text-muted-foreground">
                        {party.theme ?? "Party"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                        <Heart className={`h-3.5 w-3.5 ${savedPartyIds.has(party.id) ? "fill-current text-primary" : ""}`} />
                        {savedPartyIds.has(party.id) ? "Saved" : "Save"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                        <Tags className="h-3.5 w-3.5" />
                        {vendors.length} tagged vendor{vendors.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {vendors.length > 0 ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        Tagged: {vendors.slice(0, 3).map((vendor) => vendor.name).join(", ")}
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
          : demoParties.map((party) => (
              <Link
                key={party.title}
                href={`/events/${party.slug}`}
                className="group mb-4 block break-inside-avoid overflow-hidden rounded-[1.35rem] border border-white/75 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]"
                    style={{ backgroundImage: `url(${party.coverImageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                    {party.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white backdrop-blur">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <h2 className="text-2xl font-semibold tracking-tight">{party.title}</h2>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80">
                      <MapPin className="h-4 w-4" />
                      {party.location}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{party.host}</span>
                    <span className="rounded-full bg-[#fff7f4] px-3 py-1 text-xs text-muted-foreground">
                      {party.theme}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                      <Heart className="h-3.5 w-3.5" />
                      Save
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                      <Tags className="h-3.5 w-3.5" />
                      {party.vendorCount} tagged vendor
                    </span>
                  </div>
                </div>
              </Link>
            ))}
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
  createdAt: Date;
  user: { id: string };
  collaborators: Array<{ userId: string }>;
  taggedVendors: Array<{ id: string; userId: string }>;
  photos: Array<{ taggedVendors: Array<{ id: string; userId: string }> }>;
  tags: string[];
  imageUrls: string[];
}>(parties: T[], feed: FeedTab, followingIds: Set<string>) {
  if (feed === "Following") {
    const followed = parties.filter((party) => {
      if (followingIds.has(party.user.id)) return true;
      if (party.collaborators.some((collaborator) => followingIds.has(collaborator.userId))) return true;
      if (party.taggedVendors.some((vendor) => followingIds.has(vendor.userId))) return true;
      return party.photos.some((photo) =>
        photo.taggedVendors.some((vendor) => followingIds.has(vendor.userId))
      );
    });
    return followed.length ? followed : parties;
  }

  if (feed === "Nearby") {
    return [...parties].sort((left, right) => nearbyScore(left) - nearbyScore(right));
  }

  if (feed === "Trending") {
    return [...parties].sort((left, right) => trendingScore(right) - trendingScore(left));
  }

  return parties;
}

function nearbyScore(party: { city: string | null; state: string | null }) {
  const location = `${party.city ?? ""} ${party.state ?? ""}`.toLowerCase();
  if (location.includes("fairfield")) return 0;
  if (location.includes("vacaville")) return 1;
  if (location.includes("vallejo")) return 2;
  if (location.includes("benicia")) return 3;
  if (location.includes("ca") || location.includes("california")) return 10;
  return 20;
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

function getUniqueVendors(party: {
  taggedVendors: Array<{ id: string; name: string; slug: string }>;
  photos: Array<{ taggedVendors: Array<{ id: string; name: string; slug: string }> }>;
}) {
  const vendorMap = new Map<string, { id: string; name: string; slug: string }>();
  party.taggedVendors.forEach((vendor) => vendorMap.set(vendor.id, vendor));
  party.photos.forEach((photo) => {
    photo.taggedVendors.forEach((vendor) => vendorMap.set(vendor.id, vendor));
  });
  return Array.from(vendorMap.values());
}

function formatHostedBy(users: Array<{ name: string | null; username: string | null }>) {
  const names = users
    .map((user) => user.name ?? user.username)
    .filter(Boolean) as string[];

  if (names.length === 0) return "Hosted by ShopFia";
  if (names.length === 1) return `Hosted by ${names[0]}`;
  if (names.length === 2) return `Hosted by ${names[0]} and ${names[1]}`;
  return `Hosted by ${names[0]}, ${names[1]} + ${names.length - 2} others`;
}

function getEventImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos: Array<{ crop: unknown; id: string; updatedAt: Date }>;
}) {
  return event.photos[0]
    ? {
        crop: normalizeImageCrop(event.photos[0].crop),
        image: `/api/party-photos/${event.photos[0].id}?v=${event.photos[0].updatedAt.getTime()}`
      }
    : {
        crop: normalizeImageCrop(null),
        image: event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png"
      };
}
