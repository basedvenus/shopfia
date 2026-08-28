import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExploreSearch } from "@/components/explore/explore-search";
import { VendorCard } from "@/components/explore/vendor-card";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ProfileBadges } from "@/components/badges/profile-badge";
import { getExploreData } from "@/lib/data/explore";
import { auth } from "@/auth";
import { getOriginalMemberCutoffDate, getProfileBadges } from "@/lib/profile-badges";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { formatCurrency } from "@/lib/utils";
import { getVendorTrustStatus } from "@/lib/vendor-status";

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
        offerings: [],
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
  const savedFavorites = session?.user?.id
    ? await db.favorite.findMany({
        where: { buyerId: session.user.id },
        select: { offeringId: true, partyEventId: true, vendorId: true }
      }).catch((error) => {
        console.error("ShopFia saved favorites failed", error);
        return [];
      })
    : [];
  const savedPartyIds = new Set(savedFavorites.map((favorite) => favorite.partyEventId).filter(Boolean) as string[]);
  const savedVendorIds = new Set(savedFavorites.map((favorite) => favorite.vendorId).filter(Boolean) as string[]);
  const savedOfferingIds = new Set(savedFavorites.map((favorite) => favorite.offeringId).filter(Boolean) as string[]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/60 bg-white/55 p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-primary/20 bg-white/70 uppercase tracking-[0.18em] text-primary">
            Discover Local Celebrations
          </Badge>
        </div>
        <div className="max-w-3xl">
          <h1 className="shopfia-editorial-heading text-4xl leading-tight md:text-5xl">
            Discover local vendors, offerings, and real party inspiration.
          </h1>
          <p className="mt-2 text-muted-foreground">
            Search by business, service, category, location, or style, then browse party posts for extra inspiration.
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

      <section className="space-y-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Vendors</h2>
          <p className="text-sm text-muted-foreground">{data.vendors.length} vendors</p>
        </div>
        {data.vendors.length === 0 ? (
          <div className="rounded-3xl border bg-white/80 p-8 text-center text-muted-foreground">
            No vendors match those filters yet. Try a business name, username, category, or nearby city.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                isSaved={savedVendorIds.has(vendor.id)}
                originalMemberCutoff={originalMemberCutoff}
                vendor={vendor}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Offerings</h2>
          <p className="text-sm text-muted-foreground">{data.offerings.length} offerings</p>
        </div>
        {data.offerings.length === 0 ? (
          <div className="rounded-3xl border bg-white/80 p-8 text-center text-muted-foreground">
            No offerings match those filters yet. Search a service title, category, vendor, or city.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.offerings.map((offering) => (
              <OfferingExploreCard
                key={offering.id}
                isSaved={savedOfferingIds.has(offering.id)}
                offering={offering}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Party Inspiration</h2>
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
type ExploreOffering = Awaited<ReturnType<typeof getExploreData>>["offerings"][number];

function OfferingExploreCard({
  isSaved,
  offering
}: {
  isSaved: boolean;
  offering: ExploreOffering;
}) {
  const image = offering.photos[0] ?? offering.vendor.coverPhoto ?? offering.vendor.photos[0] ?? null;
  const trustStatus = getVendorTrustStatus(offering.vendor);
  const categoryNames = unique([
    offering.category.name,
    ...offering.categories.map((category) => category.category.name)
  ]);

  return (
    <article className="group relative overflow-hidden rounded-[1.05rem] border border-white/60 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-3xl">
      <Link href={`/offering/${offering.id}`} className="absolute inset-0 z-10" aria-label={`View ${offering.title}`} />
      <div className="relative aspect-[4/3] bg-[#f8ece9]">
        {image ? (
          <Image src={image} alt={offering.title} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <NeutralImagePlaceholder label={offering.category.name} />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          <Badge variant={trustStatus.tone === "verified" ? "accent" : "outline"}>{trustStatus.label}</Badge>
        </div>
        <div className="absolute right-3 top-3 z-20">
          <FavoriteToggle targetType="offering" targetId={offering.id} isSaved={isSaved} variant="floating" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-1 font-semibold">{offering.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {offering.vendor.name} · {offering.vendor.city}
              {offering.vendor.state ? `, ${offering.vendor.state}` : ""}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryNames.slice(0, 3).map((category) => (
            <Badge key={category} variant="outline">{category}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {offering.messageForPricing || !offering.basePriceCents
              ? "Custom pricing"
              : `From ${formatCurrency(offering.basePriceCents)}`}
          </p>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            {offering.type.replace("_", " ").toLowerCase()}
          </span>
        </div>
      </div>
    </article>
  );
}

function NeutralImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#f8ece9] px-5 text-center text-sm font-medium text-muted-foreground">
      {label}
    </div>
  );
}

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
        <div className="absolute right-3 top-3 z-20">
          <FavoriteToggle targetType="party" targetId={party.id} isSaved={isSaved} variant="floating" />
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
        <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
          <HostAvatar image={party.user.image} name={party.user.name ?? party.user.username} />
          <span className="min-w-0 truncate text-xs font-medium text-[#5f534e]">{hostName}</span>
          <ProfileBadges badges={badges} className="ml-auto shrink-0" />
        </div>
        {party.theme ? (
          <span className="inline-flex h-7 max-w-full items-center rounded-full bg-[#fff7f4] px-2.5 text-[13px] font-medium text-primary/80">
            <span className="truncate">{party.theme}</span>
          </span>
        ) : null}
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
