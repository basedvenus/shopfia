import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Heart, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { toggleFollowAction, updatePartyCollaborationAction } from "@/app/actions/auth";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getSafeProfileImage } from "@/lib/profile-image";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";

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
          include: { taggedVendors: true },
          orderBy: { createdAt: "desc" }
        },
        partyCollaborations: {
          where: { status: { in: ["ACCEPTED", "PENDING"] } },
          include: {
            event: {
              include: { taggedVendors: true }
            }
          },
          orderBy: { createdAt: "desc" }
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
  const profileBadge = getProfileBadge(profile, originalMemberCutoff);

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  async function updateCollaboration(formData: FormData) {
    "use server";

    await updatePartyCollaborationAction(formData);
  }

  const acceptedCollaborations = profile.partyCollaborations.filter(
    (collaboration) => collaboration.status === "ACCEPTED"
  );
  const pendingCollaborations = currentUserId === profile.id
    ? profile.partyCollaborations.filter((collaboration) => collaboration.status === "PENDING")
    : [];
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
                  <Image src={profileImage} alt={profile.name ?? profile.username ?? "Profile"} fill className="object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Party host profile</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight">{profile.name ?? "ShopFia host"}</h1>
                  <ProfileBadge badge={profileBadge} />
                </div>
                <p className="text-sm font-medium text-muted-foreground">@{profile.username}</p>
                {profile.bio ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{profile.bio}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>{profile._count.followers} followers</span>
                  <span>{profile._count.following} following</span>
                  <span>{profilePartyEvents.length} party stories</span>
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

      {pendingCollaborations.length > 0 ? (
        <section className="rounded-[1.75rem] border border-primary/15 bg-white/90 p-4 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Collaboration Invites</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accept to let these party stories appear on your profile.
          </p>
          <div className="mt-4 grid gap-3">
            {pendingCollaborations.map((collaboration) => (
              <div key={collaboration.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border bg-white p-3">
                <div>
                  <p className="text-sm font-semibold">{collaboration.event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {collaboration.role === "MAIN_HOST" ? "Main host invite" : "Co-host invite"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={updateCollaboration}>
                    <input type="hidden" name="collaborationId" value={collaboration.id} />
                    <input type="hidden" name="action" value="accept" />
                    <Button type="submit" size="sm">Accept</Button>
                  </form>
                  <form action={updateCollaboration}>
                    <input type="hidden" name="collaborationId" value={collaboration.id} />
                    <input type="hidden" name="action" value="decline" />
                    <Button type="submit" size="sm" variant="secondary">Decline</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Party Stories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Real celebrations, tags, and vendor credits from this host.
          </p>
        </div>

        {profilePartyEvents.length > 0 ? (
          <div className="grid auto-rows-[230px] gap-4 md:grid-cols-2 xl:grid-cols-3">
            {profilePartyEvents.map((event, index) => {
              const image = event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png";
              return (
                <Link key={event.id} href={`/events/${event.slug}`} className={index === 0 ? "md:row-span-2" : ""}>
                  <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/80 bg-muted shadow-sm">
                    <Image src={image} alt={event.title} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <h3 className="text-xl font-semibold">{event.title}</h3>
                      {event.theme ? <p className="mt-1 text-sm text-white/80">{event.theme}</p> : null}
                      <p className="mt-2 text-xs text-white/75">
                        {event.taggedVendors.length} tagged vendor{event.taggedVendors.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-white/70 bg-white/90">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Party stories will appear here when this host publishes events.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
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
