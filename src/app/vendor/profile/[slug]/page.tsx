import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Sparkles,
  Star,
  UserPlus
} from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { toggleFollowAction } from "@/app/actions/auth";
import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { getVendorProfileBySlug } from "@/lib/data/vendor";

export const dynamic = "force-dynamic";

const fallbackImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";
const demoTaggedEvents = {
  "solano-flora-and-table": [
    {
      title: "Citrus Garden Brunch",
      slug: "citrus-garden-brunch",
      theme: "Lemon garden party",
      tags: ["brunch", "lemons", "floral", "garden party"],
      coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
      credit: "@jordan.parties"
    }
  ],
  "blush-batch-cookie-atelier": [
    {
      title: "Tulip Cookie Shower",
      slug: "tulip-cookie-shower",
      theme: "Pastel floral baby shower",
      tags: ["baby shower", "pastel", "cookies", "floral"],
      coverImageUrl: "/demo/vacaville-cookie-tulips.png",
      credit: "@jordan.parties"
    }
  ]
} as const;

export default async function VendorProfilePage({ params }: { params: { slug: string } }) {
  const [vendor, session] = await Promise.all([getVendorProfileBySlug(params.slug), auth()]);
  if (!vendor) return notFound();

  const gallery = vendor.photos.length > 0 ? vendor.photos : [fallbackImage];
  const hero = vendor.coverPhoto ?? gallery[0] ?? fallbackImage;
  const portfolio = vendor.offerings.filter((offering) => offering.photos.length > 0);
  const photoTaggedEventMap = new Map<
    string,
    {
      title: string;
      slug: string;
      theme: string | null;
      tags: string[];
      coverImageUrl: string;
      credit: string;
      photoCount: number;
    }
  >();
  vendor.taggedPartyPhotos.forEach((photo) => {
    if (!photo.event) return;
    const existing = photoTaggedEventMap.get(photo.event.id);
    if (existing) {
      existing.photoCount += 1;
      return;
    }
    photoTaggedEventMap.set(photo.event.id, {
      title: photo.event.title,
      slug: photo.event.slug,
      theme: photo.event.theme,
      tags: photo.event.tags,
      coverImageUrl: `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`,
      credit: photo.event.user.username ? `@${photo.event.user.username}` : photo.event.user.name ?? "a ShopFia host",
      photoCount: 1
    });
  });
  const photoTaggedEvents = Array.from(photoTaggedEventMap.values());
  const taggedEvents =
    photoTaggedEvents.length > 0
      ? photoTaggedEvents
      : vendor.taggedPartyEvents.length > 0
      ? vendor.taggedPartyEvents.map((event) => ({
          title: event.title,
          slug: event.slug,
          theme: event.theme,
          tags: event.tags,
          coverImageUrl: event.coverImageUrl ?? event.imageUrls[0] ?? hero,
          credit: event.user.username ? `@${event.user.username}` : event.user.name ?? "a ShopFia host",
          photoCount: 0
        }))
      : [...(demoTaggedEvents[vendor.slug as keyof typeof demoTaggedEvents] ?? [])].map((event) => ({
          ...event,
          photoCount: 0
        }));
  const currentUserId = session?.user?.id;
  const isFollowingVendor =
    currentUserId && currentUserId !== vendor.user.id
      ? Boolean(
          await db.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUserId,
                followingId: vendor.user.id
              }
            }
          })
        )
      : false;

  async function submitInquiry(formData: FormData) {
    "use server";

    await createPublicInquiryAction(formData);
  }

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
          <div className="grid gap-3 p-3 md:grid-cols-[1.45fr_0.75fr]">
            <div className="relative min-h-[380px] overflow-hidden rounded-[1.6rem] bg-muted">
              <Image src={hero} alt={vendor.name} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <div className="mb-3 flex flex-wrap gap-2">
                  {vendor.verified && <Badge variant="accent">Verified vendor</Badge>}
                  {vendor.categories.slice(0, 3).map((c) => (
                    <Badge key={c.id} className="bg-white/20 text-white backdrop-blur" variant="default">
                      {c.category.name}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  {vendor.logoUrl ? (
                    <div
                      className="h-16 w-16 rounded-full border-2 border-white bg-white bg-cover bg-center shadow-soft"
                      style={{ backgroundImage: `url(${vendor.logoUrl})` }}
                    />
                  ) : null}
                  <div>
                    <h1 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                      {vendor.name}
                    </h1>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/80">
                      {vendor.username ? <span>@{vendor.username}</span> : null}
                      {vendor.website ? (
                        <Link href={vendor.website} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                          Website
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {vendor.instagramUrl ? (
                        <Link href={vendor.instagramUrl} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                          Instagram
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {vendor.tiktokUrl ? (
                        <Link href={vendor.tiktokUrl} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                          TikTok
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">{vendor.bio}</p>
                    {session?.user?.id && session.user.id !== vendor.user.id ? (
                      <form action={toggleFollow} className="mt-4">
                        <input type="hidden" name="followingId" value={vendor.user.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          {isFollowingVendor ? <Heart className="h-4 w-4 fill-current" /> : <UserPlus className="h-4 w-4" />}
                          {isFollowingVendor ? "Following" : "Follow vendor"}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>

            <div className="grid gap-3 md:grid-rows-3">
              {gallery.slice(1, 4).map((photo, index) => (
                <div key={`${photo}-${index}`} className="relative min-h-[116px] overflow-hidden rounded-[1.35rem] bg-muted">
                  <Image
                    src={photo}
                    alt={`${vendor.name} portfolio ${index + 2}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 border-t border-border/60 p-5 md:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] bg-accent/60 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Reviews
                </div>
                <div className="mt-2 flex items-center gap-2 text-2xl font-semibold">
                  <Star className="h-5 w-5 fill-current text-amber-500" />
                  {(vendor.sellerRatingAggregate?.weightedAverageRating ?? vendor.averageRating).toFixed(1)}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vendor.sellerRatingAggregate?.totalReviews ?? vendor.reviewCount} verified reviews
                </p>
              </div>
              <div className="rounded-[1.5rem] bg-muted/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Starting At
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {vendor.startingPriceCents ? formatCurrency(vendor.startingPriceCents) : "Message for pricing"}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Custom scope and delivery options</p>
              </div>
              <div className="rounded-[1.5rem] bg-muted/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Service Area
                </div>
                <div className="mt-2 text-2xl font-semibold">{vendor.serviceRadiusMiles} mi</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vendor.city}
                  {vendor.state ? `, ${vendor.state}` : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(253,236,230,0.92))] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                What this profile should feel like
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                A portfolio-first storefront where completed orders turn into verified reviews,
                and verified reviews turn into visibility.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-white px-3 py-1">Pinterest mood-board energy</span>
                <span className="rounded-full bg-white px-3 py-1">Instagram-style portfolio</span>
                <span className="rounded-full bg-white px-3 py-1">Etsy-style trust signals</span>
                {vendor.rankingScore ? <span className="rounded-full bg-white px-3 py-1">{vendor.rankingScore.tierLabel}</span> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-white/70 bg-white/95">
            <CardHeader>
              <CardTitle>Send an inquiry</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={submitInquiry} className="space-y-3">
                <input type="hidden" name="vendorProfileId" value={vendor.id} />
                <Input name="name" placeholder="Your name" required />
                <Input name="email" type="email" placeholder="Your email" required />
                <Input name="phone" placeholder="Phone (optional)" />
                <Input name="eventDate" type="date" />
                <Input name="eventLocation" placeholder="Event location" required />
                <Input
                  name="budgetDollars"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Budget in dollars (optional)"
                />
                <Textarea
                  name="message"
                  placeholder="Tell the vendor what you want made, booked, or styled..."
                />
                <Button type="submit" className="w-full">
                  Send inquiry
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/70 bg-white/90">
            <CardHeader>
              <CardTitle>Booking Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{vendor.serviceAreaNotes ?? "Service details are confirmed during quote review."}</span>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{vendor.availabilityNotes ?? "Availability is confirmed directly in chat."}</span>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>Perfect for clients who want examples first and logistics second.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Tagged In Real Events</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Customer-tagged party stories create authentic proof of how this vendor shows up in celebrations.
            </p>
          </div>
          <Badge variant="outline">{taggedEvents.length} party credits</Badge>
        </div>

        {taggedEvents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {taggedEvents.map((event) => {
              const photo = event.coverImageUrl;
              return (
                <Link key={event.slug} href={`/events/${event.slug}`}>
                  <article className="group overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="relative aspect-[4/3] bg-muted">
                      <Image src={photo} alt={event.title} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold">{event.title}</h3>
                      {event.theme ? <p className="mt-1 text-sm text-muted-foreground">{event.theme}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Credited by {event.credit}
                        {event.photoCount ? ` in ${event.photoCount} tagged photo${event.photoCount === 1 ? "" : "s"}` : ""}
                      </p>
                      {event.tags.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {event.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                              #{tag}
                            </span>
                          ))}
                        </div>
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
              Real event credits will appear here when hosts tag this vendor in party stories.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Portfolio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a tile to see the work, pricing anchor, and what the client booked.
            </p>
          </div>
          <Badge variant="outline">{vendor.offerings.length} featured examples</Badge>
        </div>

        <div className="grid auto-rows-[220px] gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vendor.offerings.map((offering, index) => {
            const photo = offering.photos[0] ?? hero;
            const featured = index === 0;

            return (
              <Link
                key={offering.id}
                href={`/offering/${offering.id}`}
                className={featured ? "md:row-span-2" : ""}
              >
                <article className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-soft">
                  <div className="absolute inset-0">
                    <Image
                      src={photo}
                      alt={offering.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  </div>
                  <div className="relative flex h-full flex-col justify-between p-4 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-white/15 text-white backdrop-blur" variant="default">
                          {offering.category.name}
                        </Badge>
                        {offering.eventCategories.slice(0, 2).map((eventCategory) => (
                          <Badge key={eventCategory.id} className="bg-white/15 text-white backdrop-blur" variant="default">
                            {eventCategory.category.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">
                        {formatOfferingPrice(offering)}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{offering.title}</h3>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/80">
                        {offering.description}
                      </p>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>

        {portfolio.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Portfolio examples will appear here once the vendor adds project photos.
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-white/70 bg-white/95">
          <CardHeader>
            <CardTitle>Why Buyers Trust This Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-[1.2rem] bg-muted/70 p-4">
              Pricing is visible early, so the profile feels more like shopping than cold outreach.
            </div>
            <div className="rounded-[1.2rem] bg-muted/70 p-4">
              Each project tile opens into a dedicated detail page, which is where “what it was” and
              “how much it was” becomes concrete.
            </div>
            <div className="rounded-[1.2rem] bg-muted/70 p-4">
              Review blocks stay warm and visual instead of looking like a dense marketplace ledger.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Reviews</h2>
            <div className="text-sm text-muted-foreground">
              {(vendor.sellerRatingAggregate?.weightedAverageRating ?? vendor.averageRating).toFixed(1)} average from {vendor.sellerRatingAggregate?.totalReviews ?? vendor.reviewCount} reviews
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">Verified reviews only</Badge>
            <Badge variant="outline">Reviews are only collected for bookings made through Fia</Badge>
          </div>

          {vendor.reviews.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">No reviews yet.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vendor.reviews.map((review) => (
                <Card key={review.id} className="border-white/70 bg-white/95">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold">
                          {getInitials(review.buyer.name)}
                        </div>
                        <div>
                          <div className="font-medium">{review.buyer.name ?? "Buyer"}</div>
                          <div className="text-xs text-muted-foreground">
                            {review.reviewerDisplayLabel} · {formatReviewDate(review.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                        <Star className="h-4 w-4 fill-current text-amber-500" />
                        {review.rating}
                      </div>
                    </div>
                    {review.body ? (
                      <p className="text-sm leading-6 text-muted-foreground">{review.body}</p>
                    ) : null}
                    {review.response ? (
                      <div className="rounded-2xl bg-muted/40 p-3 text-sm">
                        <div className="font-medium">Seller response</div>
                        <p className="mt-1 leading-6 text-muted-foreground">{review.response.body}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getInitials(name: string | null | undefined) {
  if (!name) return "B";

  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatReviewDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Message for pricing";
  return offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing";
}
