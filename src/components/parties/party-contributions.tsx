import { ProfileImage } from "@/components/account/profile-image";
import { normalizeImageCrop } from "@/lib/image-crop";
import { db } from "@/lib/db";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { CroppedImage } from "@/components/ui/cropped-image";
import { PartyMedia } from "@/components/parties/party-media";
import { PartyContributionForm, ContributionReviewControls } from "@/components/parties/party-contribution-form";
export async function PartyContributions({ eventId, userId, isOwner, canContribute }: { eventId: string; userId: string; isOwner: boolean; canContribute: boolean }) {
  if (!isOwner && !canContribute) return null;
  const items = await db.partyContribution.findMany({
    where: { eventId, ...(isOwner ? { status: "PENDING" as const } : { userId }) },
    select: { id: true, kind: true, status: true, tiktokUrl: true, appleMusicUrl: true, spotifyUrl: true, user: { select: { name: true, username: true, image: true } }, photo: { select: { id: true, crop: true, updatedAt: true } } },
    orderBy: { createdAt: "desc" }, take: 100
  });
  return <section id="party-contributions" className="scroll-mt-24 space-y-4 rounded-3xl border bg-white p-5">
    <h2 className="text-2xl font-semibold">{isOwner ? "Guest submissions" : "Add your party memories"}</h2>
    <p className="text-sm text-muted-foreground">{isOwner ? "Review guest photos, videos, and playlists before they appear publicly." : "Submit a photo, TikTok, or playlist. The host will review it before it appears on the party."}</p>
    {!isOwner && canContribute ? <PartyContributionForm eventId={eventId} /> : null}
    {items.map((item) => <article key={item.id} className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold"><ProfileImage image={item.user.image} initials={(item.user.name ?? item.user.username ?? "Guest").slice(0, 2).toUpperCase()} alt={`${item.user.name ?? item.user.username ?? "Guest"}'s profile photo`} /></span><p className="text-sm font-medium">{isOwner ? item.user.name ?? item.user.username ?? "Guest" : "Your submission"} · {item.status === "PENDING" ? "Awaiting approval" : item.status === "APPROVED" ? "Approved" : "Declined"}</p></div>
      {item.photo ? <div className="aspect-[4/3] max-w-lg overflow-hidden rounded-2xl"><CroppedImage src={partyPhotoUrl(item.photo.id, item.photo.updatedAt, { width: 800 })} crop={normalizeImageCrop(item.photo.crop)} alt="Submitted party photo" className="h-full w-full object-cover" /></div> : null}
      <PartyMedia tiktokUrl={item.tiktokUrl} appleMusicUrl={item.appleMusicUrl} spotifyUrl={item.spotifyUrl} />
      {isOwner ? <ContributionReviewControls contributionId={item.id} /> : null}
    </article>)}
    {isOwner && !items.length ? <p className="text-sm text-muted-foreground">No submissions are waiting for review.</p> : null}
  </section>;
}
