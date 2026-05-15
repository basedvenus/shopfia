import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Heart,
  Images,
  MapPin,
  Star,
  Tag
} from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { ListingInquiryForm } from "@/components/inquiries/listing-inquiry-form";
import { Badge } from "@/components/ui/badge";
import { imageCropToCss, normalizeImageCrop } from "@/lib/image-crop";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";

export default async function OfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ db }, session] = await Promise.all([import("@/lib/db"), auth()]);
  const [offering, originalMemberCutoff] = await Promise.all([
    db.offering.findUnique({
      where: { id },
      include: {
        vendor: {
          include: {
            user: {
              select: {
                createdAt: true,
                email: true,
                username: true
              }
            },
            sellerRatingAggregate: true,
            rankingScore: true
          }
        },
        category: true,
        eventCategories: { include: { category: true } },
        listing: {
          select: {
            id: true
          }
        }
      }
    }),
    getOriginalMemberCutoffDate(db)
  ]);

  if (!offering || !offering.active) return notFound();

  const photos = offering.photos.length > 0 ? offering.photos : [fallbackImage];
  const photoCrops = getImageCrops(offering.photoCrops);
  const galleryPhotos = [photos[0], photos[1] ?? photos[0], photos[2] ?? photos[0]];
  const galleryCrops = [
    photoCrops[0] ?? normalizeImageCrop(null),
    photoCrops[1] ?? photoCrops[0] ?? normalizeImageCrop(null),
    photoCrops[2] ?? photoCrops[0] ?? normalizeImageCrop(null)
  ];
  const priceLabel = formatOfferingPrice(offering);
  const packages = getPricedOptions(offering.variantsJson);
  const addons = getPricedOptions(offering.addonsJson);
  const rating = (
    offering.vendor.sellerRatingAggregate?.weightedAverageRating ??
    offering.vendor.averageRating
  ).toFixed(1);
  const reviewCount =
    offering.vendor.sellerRatingAggregate?.totalReviews ?? offering.vendor.reviewCount;
  const vendorBadge = getProfileBadge(offering.vendor.user, originalMemberCutoff, { vendorContext: true });
  const eventTags = [
    offering.category.name,
    ...offering.eventCategories.map((eventCategory) => eventCategory.category.name),
    ...offering.tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
  ];

  return (
    <div className="space-y-7">
      <Link
        href={`/vendor/profile/${offering.vendor.slug}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {offering.vendor.name}
      </Link>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.38fr)_minmax(390px,0.62fr)]">
        <section className="space-y-7">
          <div className="grid gap-3 md:grid-cols-[1.45fr_0.68fr]">
            <div className="relative min-h-[430px] overflow-hidden rounded-[1.15rem] bg-[#f8ece9] shadow-soft md:min-h-[520px]">
              <Image
                src={galleryPhotos[0]}
                alt={offering.title}
                fill
                priority
                sizes="(min-width: 1280px) 58vw, 100vw"
                className="object-cover"
                style={imageCropToCss(galleryCrops[0])}
              />
              <button
                type="button"
                className="absolute right-5 top-5 grid h-12 w-12 place-items-center rounded-full bg-white/95 text-primary shadow-soft"
                aria-label="Save listing"
              >
                <Heart className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3">
              {galleryPhotos.slice(1).map((photo, index) => (
                <div
                  key={`${photo}-${index}`}
                  className="relative min-h-[205px] overflow-hidden rounded-[1.15rem] bg-[#f8ece9] shadow-soft md:min-h-0"
                >
                  <Image
                    src={photo}
                    alt={`${offering.title} detail ${index + 2}`}
                    fill
                    sizes="(min-width: 1280px) 26vw, 100vw"
                    className="object-cover"
                    style={imageCropToCss(galleryCrops[index + 1])}
                  />
                  {index === 1 ? (
                    <div className="absolute inset-x-0 bottom-5 flex justify-center">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-5 py-3 text-sm font-medium shadow-soft">
                        <Images className="h-4 w-4" />
                        View all photos ({photos.length})
                      </span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {eventTags.slice(0, 10).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="rounded-full border-[#eadbd7] bg-white/80 px-5 py-2 text-sm font-medium"
              >
                {tag}
              </Badge>
            ))}
            <Badge className="rounded-full px-5 py-2 text-sm font-medium" variant="accent">
              Verified Vendor
            </Badge>
            <ProfileBadge badge={vendorBadge} />
          </div>

          <div className="space-y-5">
            <h1 className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-5xl font-normal leading-[0.98] tracking-normal text-foreground md:text-6xl">
              {offering.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2 font-medium text-foreground">
                <Star className="h-4 w-4 fill-current text-primary" />
                {rating}
              </span>
              <span className="h-5 w-px bg-[#eadbd7]" />
              <span>{reviewCount} reviews</span>
              {offering.vendor.rankingScore ? (
                <span className="rounded-full bg-[#f8ece9] px-3 py-1 text-foreground">
                  {offering.vendor.rankingScore.tierLabel}
                </span>
              ) : null}
            </div>
            <p className="max-w-4xl text-lg leading-8 text-[#5f5550]">{offering.description}</p>
          </div>

          <div className="grid gap-4 rounded-[1.4rem] border border-[#eadbd7] bg-white/75 p-5 shadow-[0_18px_55px_rgba(80,55,45,0.06)] md:grid-cols-3">
            <InfoPanel
              icon={<Tag className="h-5 w-5" />}
              label="Pricing"
              value={priceLabel}
              detail={
                offering.messageForPricing
                  ? "Custom quotes based on your event details."
                  : "Final details are confirmed with the vendor."
              }
            />
            <InfoPanel
              icon={<CalendarDays className="h-5 w-5" />}
              label="Turnaround"
              value={offering.turnaroundDays ? `${offering.turnaroundDays} days` : "Custom"}
              detail="Timelines vary based on event size and scope."
            />
            <InfoPanel
              icon={<Clock3 className="h-5 w-5" />}
              label="Timing"
              value={offering.durationMinutes ? `${offering.durationMinutes} mins` : "Varies"}
              detail="Dependent on setup complexity and location."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.4rem] border border-[#eadbd7] bg-white/70 p-5">
              <h2 className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-3xl font-normal">
                Good to know
              </h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
                <p className="flex gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Sold by <span className="font-medium text-foreground">{offering.vendor.name}</span>{" "}
                    <ProfileBadge badge={vendorBadge} className="mx-1 align-middle" />
                    in{" "}
                    {offering.vendor.city}
                    {offering.vendor.state ? `, ${offering.vendor.state}` : ""}
                  </span>
                </p>
                <p>Share a few details and the vendor can reply inside ShopFia messages.</p>
              </div>
            </div>

            {packages.length > 0 || addons.length > 0 ? (
              <div className="rounded-[1.4rem] border border-[#eadbd7] bg-white/70 p-5">
                <h2 className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-3xl font-normal">
                  Options
                </h2>
                <div className="mt-4 space-y-3">
                  {[...packages, ...addons].slice(0, 4).map((item) => (
                    <PricedOptionCard key={item.name} option={item} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="xl:sticky xl:top-24">
          <div
            id="inquiry"
            className="rounded-[1.6rem] border border-white/80 bg-white/90 p-6 shadow-[0_22px_70px_rgba(80,55,45,0.11)] backdrop-blur"
          >
            <div className="space-y-3">
              <p className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-xl italic text-primary">
                Let&apos;s connect
              </p>
              <div className="flex items-center gap-3">
                <h2 className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-4xl font-normal tracking-normal">
                  Send Inquiry
                </h2>
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                Share a few details about your event and the vendor will personally get back to you.
              </p>
            </div>
            <div className="mt-6">
              <ListingInquiryForm
                defaultName={session?.user?.name}
                listingId={offering.listing?.id}
                offeringId={offering.id}
                vendorProfileId={offering.vendorId}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function getImageCrops(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeImageCrop(item));
}

type PricedOption = {
  name: string;
  description?: string;
  priceCents?: number;
};

function InfoPanel({
  detail,
  icon,
  label,
  value
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-3 border-[#eadbd7] md:border-r md:pr-5 md:last:border-r-0">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f8ece9] text-primary">
          {icon}
        </span>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-2xl font-normal">
        {value}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
    </div>
  );
}

function getPricedOptions(value: unknown): PricedOption[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<PricedOption[]>((options, item) => {
    if (!item || typeof item !== "object") return options;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) return options;
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const priceCents = typeof record.priceCents === "number" ? record.priceCents : undefined;
    options.push({ name, description, priceCents });
    return options;
  }, []);
}

function PricedOptionCard({ option }: { option: PricedOption }) {
  return (
    <div className="rounded-[1rem] bg-[#fffaf8] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{option.name}</div>
          {option.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
          ) : null}
        </div>
        <div className="whitespace-nowrap text-sm font-semibold">
          {option.priceCents != null ? formatCurrency(option.priceCents) : "Custom"}
        </div>
      </div>
    </div>
  );
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Custom proposal";
  return offering.basePriceCents ? `Starting at ${formatCurrency(offering.basePriceCents)}` : "Custom proposal";
}
