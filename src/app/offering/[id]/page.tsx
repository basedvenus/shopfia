import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Sparkles, Star } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ListingInquiryForm } from "@/components/inquiries/listing-inquiry-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";

export default async function OfferingPage({ params }: { params: { id: string } }) {
  const [{ db }, session] = await Promise.all([import("@/lib/db"), auth()]);
  const offering = await db.offering.findUnique({
    where: { id: params.id },
    include: {
      vendor: {
        include: {
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
  });

  if (!offering || !offering.active) return notFound();
  const photos = offering.photos.length > 0 ? offering.photos : [fallbackImage];
  const priceLabel = formatOfferingPrice(offering);
  const packages = getPricedOptions(offering.variantsJson);
  const addons = getPricedOptions(offering.addonsJson);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_0.95fr]">
      <section className="space-y-5">
        <Link
          href={`/vendor/profile/${offering.vendor.slug}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {offering.vendor.name}
        </Link>

        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/95 shadow-soft">
          <div className="grid gap-3 p-3 md:grid-cols-[1.45fr_0.75fr]">
            <div className="relative min-h-[380px] overflow-hidden rounded-[1.6rem] bg-muted">
              <Image src={photos[0]} alt={offering.title} fill className="object-cover" />
            </div>
            <div className="grid gap-3 md:grid-rows-2">
              {photos.slice(1, 3).map((photo, index) => (
                <div key={`${photo}-${index}`} className="relative min-h-[185px] overflow-hidden rounded-[1.35rem] bg-muted">
                  <Image
                    src={photo}
                    alt={`${offering.title} detail ${index + 2}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{offering.category.name}</Badge>
              {offering.eventCategories.map((eventCategory) => (
                <Badge key={eventCategory.id} variant="outline">
                  {eventCategory.category.name}
                </Badge>
              ))}
              <Badge variant="accent">{offering.type.toLowerCase()}</Badge>
              <Badge variant="outline">Verified reviews only</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight [font-family:'PP_Neue_Montreal','Satoshi','Instrument_Sans',Inter,ui-sans-serif,system-ui,sans-serif] md:text-4xl">
                {offering.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-current text-amber-500" />
                  {(offering.vendor.sellerRatingAggregate?.weightedAverageRating ?? offering.vendor.averageRating).toFixed(1)}
                </span>
                <span>
                  {offering.vendor.sellerRatingAggregate?.totalReviews ?? offering.vendor.reviewCount} reviews
                </span>
                {offering.vendor.rankingScore ? <span>{offering.vendor.rankingScore.tierLabel}</span> : null}
              </div>
              <p className="max-w-3xl leading-7 text-muted-foreground">{offering.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.3rem] bg-muted/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Pricing
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {priceLabel}
                </div>
                {offering.messageForPricing ? (
                  <Button asChild size="sm" className="mt-3">
                    <a href="#inquiry">Check Availability</a>
                  </Button>
                ) : null}
              </div>
              <div className="rounded-[1.3rem] bg-muted/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Turnaround
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {offering.turnaroundDays ? `${offering.turnaroundDays} days` : "Custom"}
                </div>
              </div>
              <div className="rounded-[1.3rem] bg-muted/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Timing
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {offering.durationMinutes ? `${offering.durationMinutes} mins` : "Varies"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <Card className="border-white/70 bg-white/95">
            <CardHeader>
              <CardTitle>What Clients Usually Book</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {buildHighlights(offering).map((item) => (
                <div key={item} className="rounded-[1.2rem] bg-muted/70 p-4">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/95">
            <CardHeader>
              <CardTitle>Quick Facts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  Sold by <span className="font-medium text-foreground">{offering.vendor.name}</span> in{" "}
                  {offering.vendor.city}
                  {offering.vendor.state ? `, ${offering.vendor.state}` : ""}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {offering.turnaroundDays
                    ? `Best booked at least ${offering.turnaroundDays} days ahead.`
                    : "Lead time is confirmed during quoting."}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Tags: {offering.tags.join(", ") || "Customizable per inquiry"}</span>
              </div>
              <div className="flex items-start gap-2">
                <Star className="mt-0.5 h-4 w-4 shrink-0 fill-current text-amber-500" />
                <span>
                  Share a few details and the vendor can reply inside ShopFia messages.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {packages.length > 0 || addons.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {packages.length > 0 ? (
              <Card className="border-white/70 bg-white/95">
                <CardHeader>
                  <CardTitle>Packages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {packages.map((item) => (
                    <PricedOptionCard key={item.name} option={item} />
                  ))}
                </CardContent>
              </Card>
            ) : null}
            {addons.length > 0 ? (
              <Card className="border-white/70 bg-white/95">
                <CardHeader>
                  <CardTitle>Add-ons</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {addons.map((item) => (
                    <PricedOptionCard key={item.name} option={item} />
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="space-y-4">
        <Card id="inquiry" className="border-white/70 bg-white/95">
          <CardHeader>
            <CardTitle className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-2xl font-normal italic">
              Ask About This Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Share a few details and the vendor can confirm availability, fit, and next steps.
            </p>
            <ListingInquiryForm
              defaultName={session?.user?.name}
              listingId={offering.listing?.id}
              offeringId={offering.id}
              vendorProfileId={offering.vendorId}
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

type PricedOption = {
  name: string;
  description?: string;
  priceCents?: number;
};

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
    <div className="rounded-[1.2rem] bg-muted/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{option.name}</div>
          {option.description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
          ) : null}
        </div>
        <div className="whitespace-nowrap text-sm font-semibold">
          {option.priceCents != null ? formatCurrency(option.priceCents) : "Custom proposal"}
        </div>
      </div>
    </div>
  );
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Custom proposal";
  return offering.basePriceCents ? formatCurrency(offering.basePriceCents) : "Custom proposal";
}

function buildHighlights(offering: {
  title: string;
  description: string;
  tags: string[];
  durationMinutes: number | null;
  turnaroundDays: number | null;
}) {
  const highlights = [
    `Starting point: ${offering.description}`,
    offering.turnaroundDays
      ? `Lead time: approximately ${offering.turnaroundDays} days before the event date.`
      : "Lead time is customized based on the scope.",
    offering.durationMinutes
      ? `Planning window: about ${offering.durationMinutes} minutes of consult or setup time is built in.`
      : "Timing varies depending on the project details."
  ];

  if (offering.tags.length > 0) {
    highlights.push(`Popular details: ${offering.tags.join(", ")}.`);
  }

  return highlights;
}
