import Link from "next/link";
import { notFound } from "next/navigation";
import { Heart, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { toggleFollowAction } from "@/app/actions/auth";
import { ProfileBadges } from "@/components/badges/profile-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CroppedImage } from "@/components/ui/cropped-image";
import { db } from "@/lib/db";
import { storefrontPath } from "@/lib/businesses";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { getSafeProfileImage } from "@/lib/profile-image";
import { getOriginalMemberCutoffDate, getProfileBadges } from "@/lib/profile-badges";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: rawUsername } = await params;
  const username = rawUsername.replace(/^@/, "").toLowerCase();
  const [profile, session, originalMemberCutoff] = await Promise.all([
    db.user.findUnique({
      where: { username },
      select: {
        id: true,
        createdAt: true,
        email: true,
        name: true,
        username: true,
        bio: true,
        image: true,
        partyEvents: {
          include: {
            taggedVendors: true,
            collaborators: {
              where: { status: "ACCEPTED" },
              include: {
                user: { select: { id: true, image: true, name: true, username: true } }
              },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }]
            },
            photos: {
              orderBy: { sortOrder: "asc" },
              select: { crop: true, id: true, updatedAt: true }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        partyCollaborations: {
          where: { status: "ACCEPTED" },
          include: {
            event: {
              include: {
                taggedVendors: true,
                collaborators: {
                  where: { status: "ACCEPTED" },
                  include: {
                    user: { select: { id: true, image: true, name: true, username: true } }
                  },
                  orderBy: [{ role: "asc" }, { createdAt: "asc" }]
                },
                photos: {
                  orderBy: { sortOrder: "asc" },
                  select: { crop: true, id: true, updatedAt: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        vendorProfile: {
          select: {
            id: true,
            logoCrop: true,
            logoUrl: true,
            name: true,
            photos: true,
            slug: true
          }
        },
        managedBusinesses: {
          include: {
            vendorProfile: {
              select: {
                id: true,
                logoCrop: true,
                logoUrl: true,
                name: true,
                photos: true,
                slug: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        },
        _count: {
          select: { followers: true, following: true }
        }
      }
    }),
    auth(),
    getOriginalMemberCutoffDate(db)
  ]);

  if (!profile) return notFound();

  const currentUserId = session?.user?.id;
  const isFollowing =
    currentUserId && currentUserId !== profile.id
      ? Boolean(
          await db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUserId,
                followingId: profile.id
              }
            }
          })
        )
      : false;
  const initials = getInitials(profile.name ?? profile.username);
  const profileImage = getSafeProfileImage(profile.image);
  const profileBadges = getProfileBadges(profile, originalMemberCutoff);
  const profileStorefronts = dedupeStorefrontLinks([
    profile.vendorProfile,
    ...profile.managedBusinesses.map((manager) => manager.vendorProfile)
  ]);

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  const acceptedCollaborations = profile.partyCollaborations.filter(
    (collaboration) => collaboration.status === "ACCEPTED"
  );
  const profilePartyEvents = [
    ...profile.partyEvents,
    ...acceptedCollaborations
      .map((collaboration) => collaboration.event)
      .filter((event) => !profile.partyEvents.some((ownedEvent) => ownedEvent.id === event.id))
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <div className="bg-[linear-gradient(135deg,rgba(234,184,179,0.34),rgba(255,255,255,0.86),rgba(253,230,208,0.45))] p-5 md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-white bg-accent text-2xl font-semibold shadow-soft">
                {profileImage ? (
                  <CroppedImage
                    key={profileImage}
                    src={profileImage}
                    alt={profile.name ?? profile.username ?? "Profile"}
                    crop={null}
                    className="block h-full w-full object-cover object-center"
                  />
                ) : (
                  initials
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Party host profile</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">{profile.name ?? "ShopFia host"}</h1>
                  <ProfileBadges badges={profileBadges} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">@{profile.username}</p>
                {profile.bio ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>
                ) : null}
                {profileStorefronts.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profileStorefronts.map((storefront) => (
                      <Link
                        key={storefront.id}
                        href={storefrontPath(storefront.slug)}
                        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-primary/20 bg-white/85 px-2.5 py-2 pr-4 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:bg-white"
                      >
                        <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-[11px] font-semibold text-primary">
                          {storefront.logoUrl ? (
                            <CroppedImage
                              src={storefront.logoUrl}
                              alt={`${storefront.name} logo`}
                              crop={normalizeImageCrop(storefront.logoCrop)}
                              className="block h-full w-full object-cover object-center"
                            />
                          ) : storefront.photos[0] ? (
                            <CroppedImage
                              src={storefront.photos[0]}
                              alt={`${storefront.name} storefront`}
                              crop={null}
                              className="block h-full w-full object-cover object-center"
                            />
                          ) : (
                            storefront.name.slice(0, 1)
                          )}
                        </span>
                        <span className="truncate">{storefront.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>{profile._count.followers} followers</span>
                  <span>{profile._count.following} following</span>
                  <span>{profilePartyEvents.length} parties</span>
                </div>
              </div>
            </div>
            {currentUserId && currentUserId !== profile.id ? (
              <form action={toggleFollow}>
                <input type="hidden" name="followingId" value={profile.id} />
                <Button type="submit" variant="secondary">
                  {isFollowing ? <Heart className="h-4 w-4 fill-current" /> : <UserPlus className="h-4 w-4" />}
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Parties</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real celebrations, tags, and vendor credits from this host.
          </p>
        </div>

        {profilePartyEvents.length > 0 ? (
          <div className="grid auto-rows-[230px] gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profilePartyEvents.map((event, index) => {
              const { crop, image } = getPartyCardImage(event);
              return (
                <Link key={event.id} href={`/events/${event.slug}`} className={index === 0 ? "md:row-span-2" : ""}>
                  <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-muted shadow-sm">
                    <CroppedImage src={image} alt={event.title} crop={crop} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <h3 className="text-xl font-semibold">{event.title}</h3>
                      <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
                        {event.theme ? (
                          <span className="inline-flex h-7 max-w-full items-center rounded-full bg-white/15 px-2.5 text-[13px] text-white/85 backdrop-blur">
                            <span className="truncate">{event.theme}</span>
                          </span>
                        ) : null}
                        <span className="inline-flex h-7 max-w-full items-center rounded-full bg-white/15 px-2.5 text-[13px] text-white/75 backdrop-blur">
                          <span className="truncate">
                            {event.taggedVendors.length} tagged vendor{event.taggedVendors.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                      {"collaborators" in event && event.collaborators?.length ? (
                        <p className="mt-1 text-xs text-white/75">
                          Hosted by {getPrimaryHostName(event)}
                        </p>
                      ) : null}
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-white/70 bg-white/90">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Parties will appear here when this host publishes celebrations.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function dedupeStorefrontLinks(
  storefronts: Array<{
    id: string;
    logoCrop: unknown;
    logoUrl: string | null;
    name: string;
    photos: string[];
    slug: string;
  } | null>
) {
  const seen = new Set<string>();
  return storefronts.filter((storefront): storefront is NonNullable<(typeof storefronts)[number]> => {
    if (!storefront || seen.has(storefront.id)) return false;
    seen.add(storefront.id);
    return true;
  });
}

function getPrimaryHostName(event: {
  user?: { name: string | null; username: string | null } | null;
  collaborators?: Array<{
    role?: string;
    user: { name: string | null; username: string | null };
  }>;
}) {
  const primaryHost = event.collaborators?.find((collaborator) => collaborator.role === "MAIN_HOST")?.user ?? event.user;
  return primaryHost?.name ?? primaryHost?.username ?? "ShopFia";
}

function getPartyCardImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos?: Array<{ crop: unknown; id: string; updatedAt: Date }>;
}) {
  const photo = event.photos?.[0];

  if (photo) {
    return {
      crop: normalizeImageCrop(photo.crop),
      image: partyPhotoUrl(photo.id, photo.updatedAt, { width: 1000 })
    };
  }

  return {
    crop: normalizeImageCrop(null),
    image: event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png"
  };
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
