import { Suspense } from "react";
import Link from "next/link";
import { Crown, MapPin, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExploreSearch } from "@/components/explore/explore-search";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { CroppedImage } from "@/components/ui/cropped-image";
import { getExploreData } from "@/lib/data/explore";
import { auth } from "@/auth";
import { getOriginalMemberCutoffDate, getProfileBadges } from "@/lib/profile-badges";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { db } = await import("@/lib/db");
  const resolvedSearchParams = await searchParams;
  const session = await auth().catch((error) => {
    console.error("ShopFia explore auth failed", error);
    return null;
  });
  const [data, originalMemberCutoff] = await Promise.all([
    getExploreData(resolvedSearchParams).catch((error) => {
      console.error("ShopFia explore data failed", error);
      return {
        categories: [],
        eventCategories: [],
        parties: [],
        filters: {},
        vendors: []
      };
    }),
    getOriginalMemberCutoffDate(db).catch((error) => {
      console.error("ShopFia original member cutoff failed", error);
      return null;
    })
  ]);
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/20 bg-white/70 uppercase tracking-[0.18em] text-primary">
            Discover Local Celebrations
          </Badge>
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Explore real parties and local event inspiration.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse beautiful celebrations first, then refine by vendor category, location, availability, and style when you are ready.
          </p>
        </div>
        <div className="mt-5">
          <Suspense>
            <ExploreSearch
              categories={data.categories}
              eventCategories={data.eventCategories}
              filters={data.filters}
            />
          </Suspense>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Explore</h2>
          <p className="text-sm text-muted-foreground">{data.parties.length} parties</p>
        </div>
        {data.parties.length === 0 ? (
          <div className="rounded-3xl border bg-white/80 p-8 text-center text-muted-foreground">
            We are refreshing party inspiration right now. Try another theme or check back shortly.
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
            {data.parties.map((party, index) => (
              <PartyExploreCard
                key={party.id}
                index={index}
                isSaved={savedPartyIds.has(party.id)}
                originalMemberCutoff={originalMemberCutoff}
                party={party}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

type ExploreParty = Awaited<ReturnType<typeof getExploreData>>["parties"][number];

function PartyExploreCard({
  index,
  isSaved,
  originalMemberCutoff,
  party
}: {
  index: number;
  isSaved: boolean;
  originalMemberCutoff: Date | string | null;
  party: ExploreParty;
}) {
  const coverPhoto = party.photos[0];
  const image = coverPhoto
    ? partyPhotoUrl(coverPhoto.id, coverPhoto.updatedAt, { width: 760 })
    : party.coverImageUrl ?? party.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png";
  const crop = normalizeImageCrop(coverPhoto?.crop ?? party.coverImageCrop);
  const location = formatPartyLocation(party);
  const hostName = party.user.username ? `@${party.user.username}` : party.user.name ?? "ShopFia host";
  const badges = getProfileBadges(party.user, originalMemberCutoff, { includeFounder: true });
  const aspectRatio = getMasonryAspectRatio(index);

  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-[1.35rem] border border-white/75 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="relative overflow-hidden bg-muted" style={{ aspectRatio }}>
        <Link href={`/events/${party.slug}`} className="absolute inset-0 z-10" aria-label={`Open ${party.title}`} />
        <CroppedImage
          src={image}
          alt=""
          crop={crop}
          className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
        />
        <div className="absolute right-2 top-2 z-20">
          <FavoriteToggle targetType="party" targetId={party.id} isSaved={isSaved} />
        </div>
      </div>
      <div className="space-y-1.5 p-3">
        <Link href={`/events/${party.slug}`} className="block">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground sm:text-[0.95rem]">
            {party.title}
          </h3>
        </Link>
        {location ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </p>
        ) : null}
        {party.theme ? (
          <p className="line-clamp-1 text-xs font-semibold text-primary/80">
            {party.theme}
          </p>
        ) : null}
        <div className="flex items-center gap-2 pt-1">
          <HostAvatar image={party.user.image} name={party.user.name ?? party.user.username} />
          <span className="min-w-0 truncate text-xs font-medium text-[#5f534e]">{hostName}</span>
          <IconBadges badges={badges} />
        </div>
      </div>
    </article>
  );
}

function HostAvatar({ image, name }: { image: string | null; name: string | null | undefined }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- user avatars can be local uploads or auth-provider URLs.
    return <img src={image} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />;
  }

  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
      {(name ?? "S").slice(0, 2).toUpperCase()}
    </span>
  );
}

function IconBadges({ badges }: { badges: ReturnType<typeof getProfileBadges> }) {
  if (badges.length === 0) return null;

  return (
    <span className="ml-auto inline-flex shrink-0 items-center gap-1">
      {badges.map((badge) => {
        const Icon = badge.kind === "founder" ? Crown : Store;
        return (
          <span
            key={badge.kind}
            title={badge.title}
            className="grid h-5 w-5 place-items-center rounded-full border border-[#eadbd7] bg-[#fff7f4] text-primary/80"
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
          </span>
        );
      })}
    </span>
  );
}

function formatPartyLocation(party: ExploreParty) {
  if (party.city) {
    return [party.city, party.state].filter(Boolean).join(", ");
  }
  return party.location;
}

function getMasonryAspectRatio(index: number) {
  const ratios = ["4 / 5", "1 / 1", "3 / 4", "4 / 3", "5 / 7", "1 / 1"];
  return ratios[index % ratios.length];
}
