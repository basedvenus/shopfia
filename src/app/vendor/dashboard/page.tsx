import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Camera,
  Edit3,
  ExternalLink,
  Heart,
  ImagePlus,
  MapPin,
  MessageSquare,
  PackagePlus,
  Share2,
  ShoppingBag,
  Star,
  Store,
  Upload,
  Wand2
} from "lucide-react";
import { auth } from "@/auth";
import { updateOrderStatusAction } from "@/app/actions/orders";
import { respondToReviewAction } from "@/app/actions/reviews";
import { updateSellerMarketplaceSettingsAction } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConnectStripeButton } from "@/components/vendor/connect-stripe-button";
import { db } from "@/lib/db";
import { getMarketplaceFeeConfig } from "@/lib/services/marketplace-fees";
import { basisPointsToPercent, formatCurrency, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackHero = "/demo/fairfield-lemon-tablescape.png";
const fallbackService = "/demo/vacaville-cookie-tulips.png";
const fallbackPortfolio = "/demo/backyard-floral-dinner.png";

const paidOrderStatuses = new Set(["paid", "in_progress", "completed"]);
const activeOrderStatuses = new Set(["paid", "in_progress"]);
const requestStatuses = new Set(["SUBMITTED", "RESPONDED"]);

export default async function VendorDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const [vendor, feeConfig] = await Promise.all([
    db.vendorProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: {
          select: {
            id: true,
            image: true,
            name: true,
            username: true
          }
        },
        sellerRatingAggregate: true,
        rankingScore: true,
        favorites: {
          select: { id: true }
        },
        categories: {
          include: { category: true }
        },
        offerings: {
          include: {
            category: true,
            eventCategories: { include: { category: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        shop: {
          include: {
            seller: true,
            listings: {
              include: { feeEvents: { orderBy: { createdAt: "desc" }, take: 3 } },
              orderBy: { createdAt: "desc" }
            }
          }
        },
        quoteRequests: {
          include: {
            buyer: { select: { email: true, image: true, name: true, username: true } },
            offering: true,
            quote: true
          },
          orderBy: { createdAt: "desc" },
          take: 8
        },
        inquiries: {
          include: { offering: true },
          orderBy: { createdAt: "desc" },
          take: 8
        },
        orders: {
          include: {
            buyer: { select: { email: true, image: true, name: true, username: true } },
            feeBreakdown: true,
            offering: true,
            payout: true,
            review: {
              include: {
                buyer: { select: { email: true, image: true, name: true, username: true } },
                response: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 12
        },
        taggedPartyEvents: {
          include: {
            photos: { orderBy: { sortOrder: "asc" }, take: 1 },
            user: { select: { image: true, name: true, username: true } }
          },
          orderBy: { updatedAt: "desc" },
          take: 8
        },
        taggedPartyPhotos: {
          include: {
            event: {
              include: {
                user: { select: { image: true, name: true, username: true } }
              }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 12
        }
      }
    }),
    getMarketplaceFeeConfig()
  ]);

  if (!vendor) {
    return <VendorOnboardingGate />;
  }

  const categoryNames = vendor.categories.map((item) => item.category.name);
  const allOfferingPhotos = vendor.offerings.flatMap((offering) => offering.photos);
  const heroImage = vendor.coverPhoto ?? vendor.photos[0] ?? allOfferingPhotos[0] ?? fallbackHero;
  const seller = vendor.shop?.seller;
  const paidOrders = vendor.orders.filter((order) => paidOrderStatuses.has(order.status));
  const completedOrders = vendor.orders.filter((order) => order.status === "completed");
  const activeBookings = vendor.orders.filter((order) => activeOrderStatuses.has(order.status));
  const revenue = paidOrders.reduce(
    (sum, order) => sum + (order.feeBreakdown?.adjustedSellerNetPayoutCents ?? order.amountCents),
    0
  );
  const pendingRequests =
    vendor.quoteRequests.filter((quoteRequest) => requestStatuses.has(quoteRequest.status)).length +
    vendor.inquiries.filter((inquiry) => inquiry.status === "NEW").length;
  const reviewCount = vendor.sellerRatingAggregate?.totalReviews ?? vendor.reviewCount;
  const averageRating = vendor.sellerRatingAggregate?.weightedAverageRating ?? vendor.averageRating;
  const repeatClients = countRepeatClients(paidOrders.map((order) => order.buyerId));
  const saves = vendor.favorites.length;
  const partyPostCount = vendor.taggedPartyEvents.length + vendor.taggedPartyPhotos.length;
  const profileViews = vendor.rankingScore
    ? Math.round(vendor.rankingScore.score * 16 + saves * 10 + reviewCount * 12 + partyPostCount * 8)
    : saves * 10 + reviewCount * 12 + partyPostCount * 8;
  const specialties = unique([
    ...categoryNames,
    ...vendor.offerings.flatMap((offering) => offering.tags),
    ...(vendor.serviceAreaNotes ? [vendor.serviceAreaNotes] : [])
  ]).slice(0, 10);
  const portfolioImages = unique([
    heroImage,
    ...vendor.photos,
    ...allOfferingPhotos,
    ...vendor.taggedPartyPhotos.map((photo) => `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`),
    fallbackPortfolio
  ]).slice(0, 10);
  const partyPosts = buildPartyPosts(vendor, heroImage);
  const reviews = vendor.orders.flatMap((order) => (order.review ? [{ ...order.review, order }] : []));

  return (
    <div className="-mx-3 space-y-6 pb-10 sm:mx-0">
      <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_22px_70px_rgba(72,44,43,0.08)]">
        <div className="relative min-h-[270px] overflow-hidden bg-[#f8ece9]">
          <Image src={heroImage} alt={`${vendor.name} cover`} fill priority className="object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(25,22,22,0.72),rgba(25,22,22,0.22)_48%,rgba(25,22,22,0.08))]" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <VendorLogo
                  logoUrl={vendor.logoUrl}
                  name={vendor.name}
                  className="h-24 w-24 border-[5px] border-white shadow-[0_18px_42px_rgba(0,0,0,0.22)]"
                />
                <div className="max-w-3xl">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {vendor.verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/18 px-3 py-1 text-xs font-medium backdrop-blur">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified vendor
                      </span>
                    ) : null}
                    {categoryNames.slice(0, 4).map((category) => (
                      <span key={category} className="rounded-full bg-white/18 px-3 py-1 text-xs font-medium backdrop-blur">
                        {category}
                      </span>
                    ))}
                  </div>
                  <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                    {vendor.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/82">
                    {vendor.username ? <span>@{vendor.username}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {formatLocation(vendor.city, vendor.state)}
                    </span>
                    {vendor.website ? (
                      <Link href={vendor.website} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                        Website
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    {vendor.instagramUrl ? (
                      <Link href={vendor.instagramUrl} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                        Instagram
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                    {vendor.tiktokUrl ? (
                      <Link href={vendor.tiktokUrl} target="_blank" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                        TikTok
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-white/86">
                    {vendor.bio || "Add a business description so hosts can understand your style, service, and the kinds of celebrations you love creating."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" className="bg-white/92">
                  <Link href="/onboarding">
                    <Edit3 className="h-4 w-4" />
                    Edit Profile
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="bg-white/92">
                  <Link href={`/vendor/profile/${vendor.slug}`}>
                    <Share2 className="h-4 w-4" />
                    Share Profile
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="bg-white/92">
                  <Link href="/onboarding#services">
                    <PackagePlus className="h-4 w-4" />
                    Add Service
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/parties">
                    <Upload className="h-4 w-4" />
                    Upload Party
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-[#eadbd8] sm:grid-cols-2 xl:grid-cols-6">
          <StatTile label="Parties Served" value={String(Math.max(completedOrders.length, vendor.taggedPartyEvents.length))} />
          <StatTile label="Reviews" value={String(reviewCount)} />
          <StatTile label="Average Rating" value={averageRating ? `${averageRating.toFixed(1)} ★` : "New"} />
          <StatTile label="Repeat Clients" value={String(repeatClients)} />
          <StatTile label="Saves" value={String(saves)} />
          <StatTile label="Profile Views" value={profileViews ? String(profileViews) : "New"} />
        </div>
      </section>

      <nav className="sticky top-[88px] z-10 flex gap-2 overflow-x-auto rounded-full border border-border/70 bg-white/90 p-2 shadow-[0_14px_36px_rgba(72,44,43,0.08)] backdrop-blur">
        {["Overview", "Services", "Reviews", "Party Posts", "Portfolio", "Availability"].map((item) => (
          <a
            key={item}
            href={`#${slugify(item)}`}
            className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-[#f8ece9] hover:text-foreground"
          >
            {item}
          </a>
        ))}
      </nav>

      <section id="overview" className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<Store className="h-4 w-4" />} label="Overview" />
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.035em]">
                Your storefront, social proof, and portfolio in one place.
              </h2>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {vendor.bio || "Use this space to tell hosts what you make, how you work, and what makes your celebrations feel distinct."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {specialties.length ? (
                  specialties.map((specialty) => <SoftChip key={specialty}>{specialty}</SoftChip>)
                ) : (
                  <SoftChip>Add specialties in onboarding</SoftChip>
                )}
              </div>
            </div>
            <div className="rounded-[1.5rem] bg-[#f7f1ee] p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Service area</div>
              <div className="mt-3 text-2xl font-semibold tracking-tight">{formatLocation(vendor.city, vendor.state)}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {vendor.serviceAreaNotes ||
                  `Travels within ${vendor.serviceRadiusMiles} miles for parties, installations, and local celebrations.`}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MiniMetric label="Travel radius" value={`${vendor.serviceRadiusMiles} mi`} />
                <MiniMetric label="Weekends" value={vendor.weekendAvailable ? "Available" : "Limited"} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<Wand2 className="h-4 w-4" />} label="Profile readiness" />
          <div className="mt-5 space-y-4">
            <ReadinessRow complete={Boolean(vendor.logoUrl)} label="Business logo" />
            <ReadinessRow complete={Boolean(vendor.coverPhoto || vendor.photos.length)} label="Cover and portfolio imagery" />
            <ReadinessRow complete={Boolean(vendor.bio)} label="Business description" />
            <ReadinessRow complete={vendor.offerings.length > 0} label="At least one service" />
            <ReadinessRow complete={vendor.stripeOnboardingComplete} label="Stripe booking payout connected" />
          </div>
          <div className="mt-6 rounded-[1.4rem] border border-[#eadbd8] bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f8deda] text-primary">
                <Heart className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Trust grows through real parties.</div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Customer-tagged party photos become living proof of your work across ShopFia.
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section id="services" className="space-y-4">
        <SectionHeader
          eyebrow="Services"
          title="Your mini storefront"
          body="Services should feel browsable and visual, with enough detail for a host to know what to ask for next."
          action={
            <Button asChild variant="secondary">
              <Link href="/onboarding#services">
                <PackagePlus className="h-4 w-4" />
                Add / edit services
              </Link>
            </Button>
          }
        />
        {vendor.offerings.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vendor.offerings.map((offering) => (
              <article key={offering.id} className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
                <div className="relative aspect-[4/3] bg-[#f8ece9]">
                  <Image
                    src={offering.photos[0] ?? heroImage ?? fallbackService}
                    alt={offering.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute left-3 top-3 rounded-full bg-white/88 px-3 py-1 text-xs font-medium backdrop-blur">
                    {offering.category.name}
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-semibold tracking-[-0.025em]">{offering.title}</h3>
                      <Button asChild size="sm" variant={offering.messageForPricing ? "default" : "secondary"}>
                        <Link href={`/offering/${offering.id}#inquiry`}>
                          {offering.messageForPricing ? "Message for pricing" : formatOfferingPrice(offering)}
                        </Link>
                      </Button>
                    </div>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {offering.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {offering.eventCategories.slice(0, 3).map((eventCategory) => (
                      <SoftChip key={eventCategory.id}>{eventCategory.category.name}</SoftChip>
                    ))}
                    {offering.tags.slice(0, 4).map((tag) => (
                      <SoftChip key={tag}>#{tag}</SoftChip>
                    ))}
                  </div>
                  <Button asChild variant="secondary" className="w-full">
                    <Link href={`/offering/${offering.id}#inquiry`}>
                      Inquiry preview
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<PackagePlus className="h-5 w-5" />}
            title="Add your first service"
            body="Create a storefront card for balloon garlands, custom cookies, floral tablescapes, rentals, or any service hosts can book."
            href="/onboarding#services"
            action="Add service"
          />
        )}
      </section>

      <section id="reviews" className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<Star className="h-4 w-4" />} label="Reviews" />
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">Verified through completed bookings.</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Reviews should feel like trusted recommendations from real events, with photos and party context attached whenever possible.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniMetric label="Weighted rating" value={averageRating ? averageRating.toFixed(1) : "New"} />
            <MiniMetric label="Response rate" value={`${Math.round((vendor.sellerRatingAggregate?.responseRate ?? 0) * 100)}%`} />
          </div>
        </Panel>

        <Panel className="p-4 sm:p-5">
          {reviews.length ? (
            <div className="space-y-3">
              {reviews.slice(0, 4).map((review) => (
                <div key={review.id} className="rounded-[1.35rem] border border-[#eadbd8] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar image={review.buyer.image} name={review.buyer.name ?? review.buyer.email ?? "Host"} />
                      <div>
                        <div className="font-semibold">{review.buyer.name ?? review.buyer.username ?? "ShopFia host"}</div>
                        <div className="text-xs text-muted-foreground">
                          {review.order.offering?.title ?? "Completed booking"} · Verified through completed booking
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-[#f8ece9] px-2.5 py-1 text-sm font-semibold">
                      <Star className="h-3.5 w-3.5 fill-current text-primary" />
                      {review.rating}
                    </div>
                  </div>
                  {review.body ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{review.body}</p> : null}
                  {review.response ? (
                    <div className="mt-3 rounded-[1rem] bg-[#f7f1ee] p-3 text-sm">
                      <div className="font-semibold">Vendor response</div>
                      <p className="mt-1 text-muted-foreground">{review.response.body}</p>
                    </div>
                  ) : seller ? (
                    <form action={respondToReviewAction} className="mt-3 space-y-2">
                      <input type="hidden" name="reviewId" value={review.id} />
                      <Textarea name="body" placeholder="Reply with warmth and gratitude..." className="min-h-[74px] rounded-[1rem]" />
                      <Button type="submit" size="sm" variant="secondary">Respond</Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyInline
              icon={<Star className="h-5 w-5" />}
              title="No reviews yet"
              body="Reviews will appear after completed ShopFia bookings, keeping your reputation tied to real transactions."
            />
          )}
        </Panel>
      </section>

      <section id="party-posts" className="space-y-4">
        <SectionHeader
          eyebrow="Party Posts"
          title="A living portfolio of real events"
          body="Tagged customer parties, setup shots, behind-the-scenes moments, and vendor collaborations can all build social proof here."
          action={
            <Button asChild>
              <Link href="/parties">
                <ImagePlus className="h-4 w-4" />
                Upload party
              </Link>
            </Button>
          }
        />
        {partyPosts.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {partyPosts.map((post) => (
              <Link
                key={post.id}
                href={post.slug ? `/events/${post.slug}` : `/vendor/profile/${vendor.slug}`}
                className="group overflow-hidden rounded-[1.65rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(72,44,43,0.12)]"
              >
                <div className="relative aspect-[4/5] bg-[#f8ece9]">
                  <Image src={post.image} alt={post.title} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/8 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-white/22 px-2.5 py-1 text-xs font-medium backdrop-blur">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-lg font-semibold tracking-tight">{post.title}</div>
                    <div className="mt-1 text-xs text-white/78">{post.location || post.credit}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Camera className="h-5 w-5" />}
            title="No party posts yet"
            body="When hosts tag this vendor in party photos, those real celebrations can show up here as proof of your work."
            href="/parties"
            action="Upload party"
          />
        )}
      </section>

      <section id="portfolio" className="space-y-4">
        <SectionHeader
          eyebrow="Portfolio"
          title="Image-first proof of your style"
          body="Use this gallery as a social portfolio: finished details, installation shots, closeups, and customer-tagged moments."
        />
        <div className="grid auto-rows-[170px] grid-cols-2 gap-3 md:grid-cols-4 lg:auto-rows-[210px]">
          {portfolioImages.map((image, index) => (
            <div
              key={`${image}-${index}`}
              className={`relative overflow-hidden rounded-[1.5rem] bg-[#f8ece9] ${
                index === 0 || index === 5 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <Image src={image} alt={`${vendor.name} portfolio ${index + 1}`} fill className="object-cover" />
            </div>
          ))}
        </div>
      </section>

      <section id="availability" className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<CalendarDays className="h-4 w-4" />} label="Availability" />
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">Booking identity and service details</h2>
          <div className="mt-5 grid gap-3">
            <InfoRow label="Booking availability" value={vendor.availabilityNotes || (vendor.weekendAvailable ? "Weekend availability open" : "Limited weekend availability")} />
            <InfoRow label="Contact preference" value={vendor.website || vendor.instagramUrl || vendor.tiktokUrl ? "Website or social inquiry available" : "ShopFia inquiry preferred"} />
            <InfoRow label="Pricing range" value={vendor.startingPriceCents ? `Starts at ${formatCurrency(vendor.startingPriceCents)}` : "Message for pricing"} />
            <InfoRow label="Travel radius" value={`${vendor.serviceRadiusMiles} miles`} />
          </div>
          <div className="mt-6">
            <ConnectStripeButton connected={vendor.stripeOnboardingComplete} />
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<MessageSquare className="h-4 w-4" />} label="Business tools" />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <MiniMetric label="Open requests" value={String(pendingRequests)} />
            <MiniMetric label="Active bookings" value={String(activeBookings.length)} />
            <MiniMetric label="Net earnings" value={formatCurrency(revenue)} />
            <MiniMetric label="Visibility tier" value={vendor.rankingScore?.tierLabel ?? "Rising"} />
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-[#eadbd8] bg-[#fbf7f5] p-4">
            <div className="text-sm font-semibold">Marketplace fees</div>
            <div className="mt-3 space-y-2 text-sm">
              <FeeRow label="Listing fee" value={formatCurrency(feeConfig.listingFeeFlatCents)} />
              <FeeRow label="Transaction fee" value={`${formatPercent(basisPointsToPercent(feeConfig.transactionFeeBasisPoints))}%`} />
              <FeeRow
                label="Payment processing"
                value={`${formatPercent(basisPointsToPercent(feeConfig.paymentProcessingBasisPoints))}% + ${formatCurrency(feeConfig.paymentProcessingFlatCents)}`}
              />
            </div>
            {seller ? (
              <form action={updateSellerMarketplaceSettingsAction} className="mt-4 space-y-3 rounded-[1.1rem] bg-white p-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="offsiteAdsEnabled" defaultChecked={seller.offsiteAdsEnabled} />
                  Enable offsite ads fee when attributed
                </label>
                <select
                  name="offsiteAdsTier"
                  defaultValue={seller.offsiteAdsTier}
                  className="h-10 w-full rounded-full border border-border bg-white px-3 text-sm"
                >
                  <option value="STANDARD">Standard seller</option>
                  <option value="HIGH_VOLUME">High-volume seller</option>
                </select>
                <Button type="submit" size="sm" variant="secondary">Save fee settings</Button>
              </form>
            ) : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<MessageSquare className="h-4 w-4" />} label="Requests" />
          <div className="mt-5 space-y-3">
            {[...vendor.inquiries, ...vendor.quoteRequests].slice(0, 6).length ? (
              <>
                {vendor.inquiries.slice(0, 4).map((inquiry) => (
                  <div key={inquiry.id} className="rounded-[1.2rem] border border-[#eadbd8] bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{inquiry.name}</div>
                        <div className="text-muted-foreground">{inquiry.eventLocation}</div>
                        {inquiry.offering ? <div className="mt-1 text-xs text-muted-foreground">{inquiry.offering.title}</div> : null}
                      </div>
                      <span className="rounded-full bg-[#f8ece9] px-3 py-1 text-xs font-medium">{inquiry.status}</span>
                    </div>
                  </div>
                ))}
                {vendor.quoteRequests.slice(0, 4).map((quoteRequest) => (
                  <div key={quoteRequest.id} className="rounded-[1.2rem] border border-[#eadbd8] bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{quoteRequest.buyer.name ?? quoteRequest.buyer.email}</div>
                        <div className="text-muted-foreground">{quoteRequest.eventLocation}</div>
                        {quoteRequest.quote ? <div className="mt-1 text-xs">Quote: {formatCurrency(quoteRequest.quote.amountCents)}</div> : null}
                      </div>
                      <span className="rounded-full bg-[#f8ece9] px-3 py-1 text-xs font-medium">{quoteRequest.status}</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <EmptyInline
                icon={<MessageSquare className="h-5 w-5" />}
                title="No requests yet"
                body="New quote requests and public inquiries will appear here without taking over the main profile experience."
              />
            )}
          </div>
        </Panel>

        <Panel className="p-6 sm:p-7">
          <SectionKicker icon={<ShoppingBag className="h-4 w-4" />} label="Orders" />
          <div className="mt-5 space-y-3">
            {vendor.orders.length ? (
              vendor.orders.slice(0, 6).map((order) => (
                <div key={order.id} className="rounded-[1.2rem] border border-[#eadbd8] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{formatCurrency(order.buyerTotalCents || order.amountCents)}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.offering?.title ?? "Custom booking"} · {order.buyer.name ?? order.buyer.email}
                      </div>
                      {order.payout ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Payout {order.payout.status.toLowerCase()} · {formatCurrency(order.payout.netAmountCents)}
                        </div>
                      ) : null}
                    </div>
                    <form action={updateOrderStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="orderId" value={order.id} />
                      <select name="status" defaultValue={order.status} className="h-9 rounded-full border border-border bg-white px-3 text-sm">
                        {["paid", "in_progress", "completed", "canceled", "refunded"].map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="secondary">Update</Button>
                    </form>
                  </div>
                  {order.feeBreakdown ? (
                    <div className="mt-3 rounded-[1rem] bg-[#fbf7f5] p-3 text-xs">
                      <FeeRow label="Net earnings" value={formatCurrency(order.feeBreakdown.adjustedSellerNetPayoutCents)} strong />
                      <FeeRow label="Total fees" value={formatCurrency(order.feeBreakdown.adjustedTotalFeesCents)} />
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyInline
                icon={<ShoppingBag className="h-5 w-5" />}
                title="No bookings yet"
                body="Bookings will stay here as operational history while the top of the page remains portfolio-first."
              />
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function VendorOnboardingGate() {
  return (
    <div className="-mx-3 overflow-hidden rounded-[2rem] border border-white/80 bg-[#fbf6f2] shadow-[0_24px_80px_rgba(72,44,43,0.1)] sm:mx-0">
      <div className="relative min-h-[680px]">
        <div className="absolute inset-0 select-none p-5 opacity-55 blur-[1.5px] saturate-75 sm:p-8">
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white">
            <div className="h-56 bg-[linear-gradient(135deg,#f1c8c3,#f7efe8_48%,#e9b7b3)]" />
            <div className="grid gap-px bg-[#eadbd8] sm:grid-cols-4">
              {["Parties Served", "Reviews", "Repeat Clients", "Profile Views"].map((item, index) => (
                <div key={item} className="bg-white p-5">
                  <div className="text-3xl font-semibold">{["128", "42", "31", "2.4k"][index]}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{item}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[fallbackHero, fallbackService, fallbackPortfolio].map((image, index) => (
              <div key={image} className="overflow-hidden rounded-[1.75rem] border border-white bg-white">
                <div className="relative aspect-[4/3]">
                  <Image src={image} alt="" fill className="object-cover" />
                </div>
                <div className="space-y-2 p-4">
                  <div className="h-4 w-2/3 rounded-full bg-[#eadbd8]" />
                  <div className="h-3 w-full rounded-full bg-[#f4e7e2]" />
                  <div className="h-3 w-1/2 rounded-full bg-[#f4e7e2]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 grid place-items-center bg-white/58 px-5 backdrop-blur-[6px]">
          <div className="max-w-2xl rounded-[2rem] border border-white/90 bg-white/96 p-7 text-center shadow-[0_24px_80px_rgba(72,44,43,0.14)] sm:p-10">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f8deda] text-primary">
              <Store className="h-6 w-6" />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Vendor profile center
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
              Turn your creativity into bookings.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Create your vendor profile to showcase services, collect reviews, and get discovered through real parties.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Create Vendor Profile
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/">
                  Learn More
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type PartyPostSource = {
  taggedPartyPhotos: Array<{
    eventId: string | null;
    id: string;
    updatedAt: Date;
    event: {
      location: string | null;
      slug: string;
      tags: string[];
      title: string;
      user: { name: string | null; username: string | null };
    } | null;
  }>;
  taggedPartyEvents: Array<{
    coverImageUrl: string | null;
    id: string;
    imageUrls: string[];
    location: string | null;
    photos: Array<{ id: string; updatedAt: Date }>;
    slug: string;
    tags: string[];
    title: string;
    user: { name: string | null; username: string | null };
  }>;
};

function buildPartyPosts(vendor: PartyPostSource, heroImage: string) {
  const photoPosts = vendor.taggedPartyPhotos.map((photo) => ({
    id: photo.id,
    credit: formatHost(photo.event?.user),
    image: `/api/party-photos/${photo.id}?v=${photo.updatedAt.getTime()}`,
    location: photo.event?.location ?? null,
    slug: photo.event?.slug ?? null,
    tags: photo.event?.tags ?? [],
    title: photo.event?.title ?? "Tagged party photo"
  }));
  const photoEventIds = new Set(vendor.taggedPartyPhotos.map((photo) => photo.eventId).filter(Boolean));
  const eventPosts = vendor.taggedPartyEvents
    .filter((event) => !photoEventIds.has(event.id))
    .map((event) => {
      const firstPhoto = event.photos[0];
      return {
        id: event.id,
        credit: formatHost(event.user),
        image: firstPhoto
          ? `/api/party-photos/${firstPhoto.id}?v=${firstPhoto.updatedAt.getTime()}`
          : event.coverImageUrl ?? event.imageUrls[0] ?? heroImage,
        location: event.location,
        slug: event.slug,
        tags: event.tags,
        title: event.title
      };
    });

  return [...photoPosts, ...eventPosts].slice(0, 8);
}

function countRepeatClients(buyerIds: string[]) {
  const seen = new Set<string>();
  const repeat = new Set<string>();

  buyerIds.forEach((buyerId) => {
    if (seen.has(buyerId)) {
      repeat.add(buyerId);
      return;
    }
    seen.add(buyerId);
  });

  return repeat.size;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatLocation(city: string, state?: string | null) {
  return state ? `${city}, ${state}` : city;
}

function formatHost(user?: { name: string | null; username: string | null } | null) {
  if (!user) return "ShopFia host";
  return user.username ? `@${user.username}` : user.name ?? "ShopFia host";
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Message for pricing";
  return offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing";
}

function VendorLogo({
  className = "h-16 w-16",
  logoUrl,
  name
}: {
  className?: string;
  logoUrl?: string | null;
  name: string;
}) {
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#f8deda] text-xl font-semibold text-primary ${className}`}>
      {logoUrl ? <img src={logoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

function Avatar({ image, name }: { image?: string | null; name: string }) {
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f8deda] text-sm font-semibold text-primary">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : name.charAt(0)}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.07)] ${className}`}>
      {children}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-5 py-5">
      <div className="text-3xl font-semibold tracking-[-0.035em]">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.2rem] border border-[#eadbd8] bg-white p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function SectionKicker({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[#f8ece9] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
      {icon}
      {label}
    </div>
  );
}

function SectionHeader({
  action,
  body,
  eyebrow,
  title
}: {
  action?: React.ReactNode;
  body?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_18px_50px_rgba(72,44,43,0.06)] sm:flex-row sm:items-end sm:justify-between sm:p-7">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</div>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{title}</h2>
        {body ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

function SoftChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[#eadbd8] bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function ReadinessRow({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-[#eadbd8] bg-white p-3">
      <span className="text-sm font-medium">{label}</span>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-[#e5f4df] text-[#507343]" : "bg-[#f8ece9] text-primary"}`}>
        {complete ? "Ready" : "Needs detail"}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#eadbd8] py-3 last:border-b-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="max-w-[65%] text-right text-sm font-medium">{value}</div>
    </div>
  );
}

function EmptyState({
  action,
  body,
  href,
  icon,
  title
}: {
  action: string;
  body: string;
  href: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-[2rem] border border-dashed border-[#dfc8c3] bg-white/80 p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f8deda] text-primary">{icon}</div>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{body}</p>
      <Button asChild className="mt-5">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

function EmptyInline({ body, icon, title }: { body: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[#dfc8c3] bg-[#fbf7f5] p-6 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#f8deda] text-primary">{icon}</div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function FeeRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
