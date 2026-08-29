import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  BadgeCheck,
  Edit3,
  ExternalLink,
  Heart,
  LayoutDashboard,
  MapPin,
  Send,
  Star,
  UserPlus
} from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { toggleFollowAction } from "@/app/actions/auth";
import { claimUnclaimedVendorAction } from "@/app/actions/vendor";
import { ListingInquiryPanel } from "@/components/inquiries/listing-inquiry-form";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StorefrontPortfolioGallery } from "@/components/vendor/storefront-portfolio-gallery";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import { db } from "@/lib/db";
import { getOriginalMemberCutoffDate, getProfileBadge } from "@/lib/profile-badges";
import { imageCropToCss, normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { formatCurrency } from "@/lib/utils";
import { getVendorProfileBySlug } from "@/lib/data/vendor";
import { getVendorTrustStatus } from "@/lib/vendor-status";
import { STOREFRONT_PALETTES, STOREFRONT_SECTION_LABELS, coverageAreaLabels, getStorefrontFontFamilies, getStorefrontPalette, normalizeStorefrontLayout, sanitizeHiddenStorefrontSections, sanitizeStorefrontSectionLabels, sanitizeStorefrontSections, storefrontUrl } from "@/lib/businesses";

export const dynamic = "force-dynamic";

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

export default async function VendorProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [vendor, session, originalMemberCutoff] = await Promise.all([
    getVendorProfileBySlug(slug),
    auth(),
    getOriginalMemberCutoffDate(db)
  ]);
  if (!vendor) return notFound();

  const portfolioPhotos = vendor.photos;
  const hero = vendor.coverPhoto ?? portfolioPhotos[0] ?? null;
  const instagramFeedUrl = vendor.storefrontInstagramFeedEnabled
    ? vendor.storefrontInstagramFeedUrl ?? vendor.instagramUrl
    : null;
  const coverCrop = normalizeImageCrop(vendor.coverPhotoCrop);
  const logoCrop = normalizeImageCrop(vendor.logoCrop);
  const photoTaggedEventMap = new Map<
    string,
    {
      title: string;
      slug: string;
      theme: string | null;
      tags: string[];
      coverImageUrl: string;
      credit: string;
      contributionNotes: string[];
      photoCount: number;
    }
  >();
  vendor.taggedPartyPhotos.forEach((photo) => {
    if (!photo.event) return;
    const contributionNote = photo.vendorRatings.find((credit) => credit.vendorId === vendor.id)?.contributionNote?.trim();
    const existing = photoTaggedEventMap.get(photo.event.id);
    if (existing) {
      existing.photoCount += 1;
      if (contributionNote) {
        existing.contributionNotes.push(contributionNote);
      }
      return;
    }
    photoTaggedEventMap.set(photo.event.id, {
      title: photo.event.title,
      slug: photo.event.slug,
      theme: photo.event.theme,
      tags: photo.event.tags,
      coverImageUrl: partyPhotoUrl(photo.id, photo.updatedAt, { width: 900 }),
      credit: photo.event.user.username ? `@${photo.event.user.username}` : photo.event.user.name ?? "a ShopFia host",
      contributionNotes: contributionNote ? [contributionNote] : [],
      photoCount: 1
    });
  });
  vendor.partyPhotoRatings.forEach((credit) => {
    const event = credit.photo.event;
    if (!event) return;
    const contributionNote = credit.contributionNote?.trim();
    const existing = photoTaggedEventMap.get(event.id);
    if (existing) {
      existing.photoCount += 1;
      if (contributionNote) {
        existing.contributionNotes.push(contributionNote);
      }
      return;
    }
    photoTaggedEventMap.set(event.id, {
      title: event.title,
      slug: event.slug,
      theme: event.theme,
      tags: event.tags,
      coverImageUrl: partyPhotoUrl(credit.photo.id, credit.photo.updatedAt, { width: 900 }),
      credit: event.user.username ? `@${event.user.username}` : event.user.name ?? "a ShopFia host",
      contributionNotes: contributionNote ? [contributionNote] : [],
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
          coverImageUrl: event.coverImageUrl ?? event.imageUrls[0] ?? "",
          credit: event.user.username ? `@${event.user.username}` : event.user.name ?? "a ShopFia host",
          contributionNotes: [],
          photoCount: 0
        }))
      : [...(demoTaggedEvents[vendor.slug as keyof typeof demoTaggedEvents] ?? [])].map((event) => ({
          ...event,
          contributionNotes: [],
          photoCount: 0
        }));
  const currentUserId = session?.user?.id;
  const isUnclaimed = vendor.status === "UNCLAIMED";
  const trustStatus = getVendorTrustStatus(vendor);
  const verifiedCredentials = getVerifiedCredentials(vendor.verificationDocuments);
  const vendorBadge = vendor.user ? getProfileBadge(vendor.user, originalMemberCutoff, { vendorContext: true }) : null;
  const verifiedReviewCount = vendor.sellerRatingAggregate?.totalReviews ?? vendor.reviewCount;
  const verifiedAverageRating = vendor.sellerRatingAggregate?.weightedAverageRating ?? vendor.averageRating;
  const palette = getStorefrontPalette(vendor.storefrontPalette);
  const storefrontLayout = normalizeStorefrontLayout(vendor.storefrontLayout);
  const aboutHeading = vendor.storefrontAboutHeading ?? `About ${vendor.name}`;
  const tagline = vendor.storefrontTagline ?? vendor.bio;
  const heroHeadline = vendor.storefrontAboutHeading ?? vendor.name;
  const primaryCategory = vendor.categories[0]?.category.name ?? "Event vendor";
  const followerCount = vendor.user?._count.followers ?? 0;
  const savedVendorCount = vendor._count.favorites;
  const serviceAreaLabel = [vendor.city, vendor.state].filter(Boolean).join(", ");
  const coverageAreas = coverageAreaLabels(vendor.serviceAreaNotes, serviceAreaLabel || vendor.city);
  const publicStorefrontUrl = storefrontUrl(vendor.slug);
  const hiddenSections = sanitizeHiddenStorefrontSections(vendor.storefrontHiddenSections);
  const sectionLabels = sanitizeStorefrontSectionLabels(vendor.storefrontSectionLabels);
  const sectionLabel = (section: keyof typeof STOREFRONT_SECTION_LABELS) => sectionLabels[section] ?? STOREFRONT_SECTION_LABELS[section];
  const sectionOrder = sanitizeStorefrontSections(vendor.storefrontSectionOrder).filter((section) => !hiddenSections.includes(section));
  const sectionPriority = (section: string) => sectionOrder.indexOf(section) === -1 ? 999 : sectionOrder.indexOf(section);
  const showSection = (section: string) => sectionOrder.includes(section as never);
  const visibleOfferings = vendor.offerings.filter((offering) => !vendor.storefrontHiddenOfferingIds.includes(offering.id));
  const orderedOfferings = [...visibleOfferings].sort((a, b) => {
    const aIndex = vendor.storefrontOfferingOrder.indexOf(a.id);
    const bIndex = vendor.storefrontOfferingOrder.indexOf(b.id);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  const featuredOfferings = orderedOfferings.filter((offering) => vendor.storefrontFeaturedOfferingIds.includes(offering.id));
  const displayedFeaturedOfferings = featuredOfferings.length ? featuredOfferings : orderedOfferings.slice(0, 3);
  const faqItems = readStorefrontFaqs(vendor.storefrontFaqJson);
  const bookingInfo = readStorefrontBooking(vendor.storefrontBookingJson);
  const policies = readStorefrontPolicies(vendor.storefrontPoliciesJson);
  const theme = getStorefrontTheme({
    fontStyle: vendor.storefrontFontStyle,
    imageShape: vendor.storefrontImageShape,
    palette: palette.value,
    textTone: vendor.storefrontTextTone
  });
  const isFollowingVendor =
    currentUserId && vendor.user && currentUserId !== vendor.user.id
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
  const [savedFavorites, completedOrderCount] = await Promise.all([
    currentUserId
      ? db.favorite.findMany({
          where: {
            buyerId: currentUserId,
            OR: [
              { vendorId: vendor.id },
              { offeringId: { in: vendor.offerings.map((offering) => offering.id) } }
            ]
          },
          select: { offeringId: true, vendorId: true }
        })
      : Promise.resolve([]),
    db.order.count({
      where: {
        vendorProfileId: vendor.id,
        status: { in: ["paid", "in_progress", "completed"] },
        paymentSucceededAt: { not: null }
      }
    })
  ]);
  const savedOfferingIds = new Set(savedFavorites.map((favorite) => favorite.offeringId).filter((id): id is string => Boolean(id)));
  const isSavedVendor = savedFavorites.some((favorite) => favorite.vendorId === vendor.id);
  const isOwnerViewing =
    Boolean(currentUserId) &&
    (vendor.userId === currentUserId || vendor.managers.some((manager) => manager.userId === currentUserId) || session?.user?.role === "ADMIN");

  async function toggleFollow(formData: FormData) {
    "use server";

    await toggleFollowAction(formData);
  }

  return (
    <div className={`flex flex-col gap-8 rounded-[1.25rem] bg-gradient-to-br ${palette.className} p-0 md:p-2 ${theme.shellClass}`} style={theme.bodyStyle}>
      {isOwnerViewing ? (
        <div className="sticky top-0 z-30 flex flex-col gap-2 rounded-[1rem] border border-[#eadbd7] bg-white/95 px-3 py-2 shadow-[0_12px_34px_rgba(47,38,38,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Owner view</p>
            <p className="truncate text-xs text-muted-foreground">You are viewing your live ShopFia storefront.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/vendor/business/${vendor.slug}/storefront`}>
                <Edit3 className="h-4 w-4" />
                Edit Storefront
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/vendor/business/${vendor.slug}`}>
                <LayoutDashboard className="h-4 w-4" />
                Business Dashboard
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
      <header className="overflow-hidden rounded-[1rem] border bg-white shadow-[0_16px_50px_rgba(47,38,38,0.10)]" style={theme.headerShellStyle}>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={theme.platformBarStyle}>
          <span>ShopFia Storefront</span>
          <span className="hidden sm:inline">Verified identity, saved services, quotes, and bookings</span>
        </div>
        <div className="grid gap-3 p-3 md:grid-cols-[auto_1fr_auto] md:items-center md:p-4">
          <div className={`relative h-20 w-20 overflow-hidden border border-[#eadbd7] bg-[#f8ece9] md:h-24 md:w-24 ${theme.logoRadius}`}>
            {vendor.logoUrl ? (
              <Image
                src={vendor.logoUrl}
                alt={`${vendor.name} logo`}
                fill
                sizes="96px"
                className="object-contain p-1"
                style={imageCropToCss(logoCrop)}
              />
            ) : hero ? (
              <Image src={hero} alt={vendor.name} fill sizes="96px" className="object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-xl font-semibold" style={theme.accentTextStyle}>
                {vendor.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl" style={theme.headingStyle}>{vendor.name}</h1>
              {trustStatus.tone === "verified" || vendor.verified ? (
                <Badge variant="accent" className="gap-1 rounded-full" style={theme.badgeStyle}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              ) : null}
              <ProfileBadge badge={vendorBadge} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {vendor.username ? <span>@{vendor.username}</span> : null}
              <span>{primaryCategory}</span>
              {serviceAreaLabel ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {serviceAreaLabel}
                  {vendor.serviceRadiusMiles ? ` + ${vendor.serviceRadiusMiles} mi` : ""}
                </span>
              ) : null}
            </div>
            <div className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm ${theme.profileMetricClass}`}>
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-current text-amber-500" />
                {verifiedReviewCount > 0 ? `${verifiedAverageRating.toFixed(1)} (${verifiedReviewCount})` : "No reviews yet"}
              </span>
              <span>{completedOrderCount} completed ShopFia event{completedOrderCount === 1 ? "" : "s"}</span>
              <span>{followerCount} follower{followerCount === 1 ? "" : "s"}</span>
              <span>{savedVendorCount} save{savedVendorCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {session?.user?.id && vendor.user && session.user.id !== vendor.user.id ? (
              <form action={toggleFollow}>
                <input type="hidden" name="followingId" value={vendor.user.id} />
                <Button type="submit" variant={isFollowingVendor ? "secondary" : "default"} size="sm" className="min-w-[108px]" style={isFollowingVendor ? undefined : theme.ctaStyle}>
                  {isFollowingVendor ? <Heart className="h-4 w-4 fill-current" /> : <UserPlus className="h-4 w-4" />}
                  {isFollowingVendor ? "Following" : "Follow"}
                </Button>
              </form>
            ) : !session?.user?.id && vendor.user ? (
              <Button asChild size="sm" className="min-w-[108px]" style={theme.ctaStyle}>
                <Link href={`/account?redirectTo=${encodeURIComponent(`/${vendor.slug}`)}`}>
                  <UserPlus className="h-4 w-4" />
                  Follow
                </Link>
              </Button>
            ) : null}
            <CopyStorefrontLinkButton label="Share" url={publicStorefrontUrl} className="h-9 px-3" style={theme.secondaryButtonStyle} />
            <FavoriteToggle targetType="vendor" targetId={vendor.id} isSaved={isSavedVendor} variant="pill" label={isSavedVendor ? "Saved" : "Save"} style={theme.secondaryButtonStyle} />
            {!isUnclaimed ? (
              <Button asChild size="sm" style={theme.ctaStyle}>
                <a href="#inquiry">
                  <Send className="h-4 w-4" />
                  Get a quote
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <nav className="sticky top-16 z-10 flex gap-1 overflow-x-auto border-t bg-white px-3 py-1.5 text-sm font-medium backdrop-blur" style={theme.navStyle}>
          {[
            ["#storefront-home", "Home"],
            ["#services", sectionLabel("all-services")],
            ["#portfolio", sectionLabel("portfolio")],
            ["#about", sectionLabel("about")],
            ["#reviews", sectionLabel("reviews")],
            ["#faq", sectionLabel("faq")]
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3 py-2 text-muted-foreground transition hover:text-foreground"
              style={label === "Home" ? theme.activeNavItemStyle : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <StorefrontTemplateIntro
        completedOrderCount={completedOrderCount}
        coverCrop={coverCrop}
        displayedFeaturedOfferings={displayedFeaturedOfferings}
        hero={hero}
        heroHeadline={heroHeadline}
        isUnclaimed={isUnclaimed}
        layout={storefrontLayout}
        logoCrop={logoCrop}
        portfolioPhotos={portfolioPhotos}
        primaryCategory={primaryCategory}
        serviceAreaLabel={serviceAreaLabel}
        tagline={tagline}
        theme={theme}
        vendor={vendor}
        verifiedAverageRating={verifiedAverageRating}
        verifiedCredentials={verifiedCredentials}
        verifiedReviewCount={verifiedReviewCount}
      />

      {showSection("about") ? (
        <section id="about" className={`grid scroll-mt-28 gap-5 p-5 md:grid-cols-[0.8fr_1.2fr] md:p-8 ${theme.cardClass} ${theme.sectionRadius}`} style={{ ...theme.cardStyle, order: sectionPriority("about") }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={theme.accentTextStyle}>About</p>
            <h2 className="mt-3 text-4xl font-normal tracking-normal" style={theme.headingStyle}>
              {aboutHeading}
            </h2>
            {vendor.storefrontAboutImage ? (
              <div className={`relative mt-5 aspect-[4/3] overflow-hidden bg-white ${theme.imageRadius}`}>
                <Image src={vendor.storefrontAboutImage} alt={`${vendor.name} founder or team photo`} fill sizes="(min-width: 768px) 32vw, 100vw" className="object-contain p-2" />
              </div>
            ) : null}
          </div>
          <div className="grid gap-4">
            <p className={`text-base leading-8 ${theme.copyClass}`}>
              {vendor.bio ?? "This storefront is being prepared with business details, services, and recent work."}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <EditorialStat label={verifiedReviewCount > 0 ? "Verified rating" : "Event credits"} value={verifiedReviewCount > 0 ? verifiedAverageRating.toFixed(1) : String(taggedEvents.length)} theme={theme} />
              <EditorialStat label="Completed events" value={String(completedOrderCount)} theme={theme} />
              <EditorialStat label="Theme" value={vendor.storefrontLayout.toLowerCase()} theme={theme} />
            </div>
          </div>
        </section>
      ) : null}

      {showSection("featured-services") ? (
      <section id="featured-services" className="scroll-mt-28 space-y-4" style={{ order: sectionPriority("featured-services") }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{sectionLabel("featured-services")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A curated first look at the services this vendor wants customers to discover first.
            </p>
          </div>
          <Badge variant="outline" style={theme.outlineBadgeStyle}>{displayedFeaturedOfferings.length} featured</Badge>
        </div>

        {displayedFeaturedOfferings.length > 0 ? (
          <ServiceListingGrid
            offerings={displayedFeaturedOfferings}
            savedOfferingIds={savedOfferingIds}
            theme={theme}
            verifiedAverageRating={verifiedAverageRating}
            verifiedReviewCount={verifiedReviewCount}
          />
        ) : (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Featured services will appear here once the vendor publishes services.
            </CardContent>
          </Card>
        )}
      </section>
      ) : null}

      {showSection("portfolio") ? (
      <section id="portfolio" className="scroll-mt-28 space-y-5" style={{ order: sectionPriority("portfolio") }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{sectionLabel("portfolio")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A browsable look at this vendor&apos;s uploaded work, styled and ordered from the storefront editor.
            </p>
          </div>
          <Badge variant="outline" style={theme.outlineBadgeStyle}>{portfolioPhotos.length} photo{portfolioPhotos.length === 1 ? "" : "s"}</Badge>
        </div>

        {portfolioPhotos.length > 0 ? (
          <StorefrontPortfolioGallery
            businessName={vendor.name}
            cardClass={`${theme.cardClass} ${theme.sectionRadius}`}
            cardStyle={theme.cardStyle}
            imageRadius={theme.sectionRadius}
            photos={portfolioPhotos}
          />
        ) : (
          <Card className="border-white/70 bg-white/90">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Portfolio images will appear here once this vendor publishes photos from the storefront editor.
            </CardContent>
          </Card>
        )}
        {instagramFeedUrl ? (
          <a
            href={instagramFeedUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex flex-wrap items-center justify-between gap-3 p-4 shadow-sm transition hover:-translate-y-0.5 ${theme.cardClass} ${theme.sectionRadius}`}
            style={theme.cardStyle}
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em]" style={theme.accentTextStyle}>Instagram</span>
              <span className="mt-1 block text-lg font-semibold" style={theme.headingStyle}>Live Instagram portfolio</span>
              <span className={`mt-1 block text-sm ${theme.copyClass}`}>{instagramHandleFromUrl(instagramFeedUrl)}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold" style={theme.ctaStyle}>
              Open feed
              <ExternalLink className="h-4 w-4" />
            </span>
          </a>
        ) : null}

      </section>
      ) : null}

      {showSection("all-services") ? (
      <section id="services" className="scroll-mt-28 space-y-4" style={{ order: sectionPriority("all-services") }}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{sectionLabel("all-services")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click a tile to see the work, pricing anchor, and what the client booked.
            </p>
          </div>
          <Badge variant="outline" style={theme.outlineBadgeStyle}>{orderedOfferings.length} listing{orderedOfferings.length === 1 ? "" : "s"}</Badge>
        </div>

        {orderedOfferings.length > 0 ? (
        <ServiceListingGrid
          offerings={orderedOfferings}
          savedOfferingIds={savedOfferingIds}
          theme={theme}
          verifiedAverageRating={verifiedAverageRating}
          verifiedReviewCount={verifiedReviewCount}
        />
        ) : null}

      </section>
      ) : null}

      {showSection("how-it-works") ? (
        <section id="how-it-works" className={`scroll-mt-28 p-5 shadow-sm ${theme.cardClass} ${theme.sectionRadius}`} style={{ ...theme.cardStyle, order: sectionPriority("how-it-works") }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={theme.accentTextStyle}>Booking</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight" style={theme.headingStyle}>{sectionLabel("how-it-works")}</h2>
            </div>
            <Badge variant="outline" className="rounded-full" style={theme.outlineBadgeStyle}>ShopFia-supported quotes</Badge>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <TrustFaqItem title="Process" body={bookingInfo.process} theme={theme} />
            <TrustFaqItem title="Lead time" body={bookingInfo.leadTime || vendor.availabilityNotes || "Availability is confirmed in ShopFia messages."} theme={theme} />
            <TrustFaqItem title="Payment details" body={bookingInfo.deposit || "Deposit and payment details are confirmed in the quote."} theme={theme} />
          </div>
          <p className={`mt-4 text-sm leading-6 ${theme.copyClass}`}>
            {vendor.serviceAreaNotes ?? `${vendor.name} serves ${serviceAreaLabel || "local events"} within ${vendor.serviceRadiusMiles} miles.`}
          </p>
          <ServiceAreaRadiusCard
            city={serviceAreaLabel || vendor.city || "Local events"}
            coverageAreas={coverageAreas}
            radiusMiles={vendor.serviceRadiusMiles}
            serviceAreaNotes={vendor.serviceAreaNotes}
            theme={theme}
          />
          {policies.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {policies.slice(0, 4).map((policy) => (
                <TrustFaqItem key={policy.id} title={policy.title} body={policy.body} theme={theme} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]" style={{ order: Math.min(sectionPriority("final-quote"), sectionPriority("reviews")) }}>
        {showSection("final-quote") ? (
        <div id="inquiry" className="scroll-mt-28" style={{ order: sectionPriority("final-quote") }}>
          {!isUnclaimed ? (
            <ListingInquiryPanel
              defaultName={session?.user?.name}
              description="Share what you are planning and this vendor can reply inside ShopFia messages."
              vendorProfileId={vendor.id}
            />
          ) : null}
        </div>
        ) : <div />}

        {showSection("reviews") ? (
        <div id="reviews" className="space-y-4 scroll-mt-28" style={{ order: sectionPriority("reviews") }}>
            <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">{sectionLabel("reviews")}</h2>
            <div className="text-sm text-muted-foreground">
              {verifiedReviewCount > 0
                ? `${verifiedAverageRating.toFixed(1)} average from ${verifiedReviewCount} booking-based review${verifiedReviewCount === 1 ? "" : "s"}`
                : "Reserved for completed ShopFia bookings"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent" style={theme.badgeStyle}>Verified reviews only</Badge>
            <Badge variant="outline" style={theme.outlineBadgeStyle}>Reviews are only collected for bookings made through ShopFia</Badge>
          </div>

          {vendor.reviews.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                No verified reviews yet. Party tags above are shown as event credits until bookings are completed through ShopFia.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {vendor.reviews.map((review) => {
                const reviewerBadge = getProfileBadge(review.buyer, originalMemberCutoff);

                return (
                <Card key={review.id} className={`${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold" style={theme.badgeStyle}>
                          {getInitials(review.buyer.name)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{review.buyer.name ?? "Buyer"}</span>
                            <ProfileBadge badge={reviewerBadge} />
                          </div>
                          <div className={`text-xs ${theme.mutedClass}`}>
                            {review.reviewerDisplayLabel} · {formatReviewDate(review.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm text-foreground">
                        <Star className="h-4 w-4 fill-current text-amber-500" />
                        {review.rating}
                      </div>
                    </div>
                    {review.body ? (
                      <p className={`text-sm leading-6 ${theme.copyClass}`}>{review.body}</p>
                    ) : null}
                    {review.response ? (
                      <div className="rounded-2xl bg-muted/40 p-3 text-sm">
                        <div className="font-medium">Seller response</div>
                        <p className="mt-1 leading-6 text-muted-foreground">{review.response.body}</p>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
        ) : null}
      </section>

      {showSection("faq") ? (
      <section id="faq" className={`scroll-mt-28 p-5 shadow-sm ${theme.cardClass} ${theme.sectionRadius}`} style={{ ...theme.cardStyle, order: sectionPriority("faq") }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={theme.headingStyle}>{sectionLabel("faq")}</h2>
            <p className={`mt-1 text-sm leading-6 ${theme.copyClass}`}>
              ShopFia keeps quoting, messaging, saved services, reviews, and booking records connected to your account.
            </p>
          </div>
          <Badge variant="outline" className="rounded-full" style={theme.outlineBadgeStyle}>Powered by ShopFia</Badge>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {faqItems.map((faq) => (
            <TrustFaqItem key={faq.id} title={faq.question} body={faq.answer} theme={theme} />
          ))}
        </div>
      </section>
      ) : null}

      {taggedEvents.length > 0 ? (
        <section id="party-credits" className="scroll-mt-28 space-y-4" style={{ order: 998 }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight" style={theme.headingStyle}>Seen In Real Parties</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Party credits are connected from ShopFia host galleries and vendor tags.
              </p>
            </div>
            <Badge variant="outline" style={theme.outlineBadgeStyle}>{taggedEvents.length} party credit{taggedEvents.length === 1 ? "" : "s"}</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {taggedEvents.filter((event) => event.coverImageUrl).map((event) => (
              <Link key={event.slug} href={`/events/${event.slug}`}>
                <article className={`group overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
                  <div className="relative aspect-[4/3] bg-muted">
                    <Image src={event.coverImageUrl} alt={event.title} fill sizes="(min-width: 1280px) 31vw, (min-width: 768px) 48vw, 100vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold" style={theme.headingStyle}>{event.title}</h3>
                    {event.theme ? (
                      <span className="mt-2 inline-flex h-7 max-w-full items-center rounded-full px-2.5 text-[13px]" style={theme.softChipStyle}>
                        <span className="truncate">{event.theme}</span>
                      </span>
                    ) : null}
                    {event.contributionNotes[0] ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.contributionNotes[0]}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Credited by {event.credit}
                      {event.photoCount ? ` in ${event.photoCount} tagged photo${event.photoCount === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <footer className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm ${theme.mutedClass} ${theme.cardClass} ${theme.sectionRadius}`} style={{ ...theme.cardStyle, order: 999 }}>
        <span>{vendor.name} storefront, powered by ShopFia.</span>
        <span>Verified vendors, quote requests, messaging, payments, and booking support.</span>
      </footer>
    </div>
  );
}

type VendorProfileData = NonNullable<Awaited<ReturnType<typeof getVendorProfileBySlug>>>;

function StorefrontTemplateIntro({
  completedOrderCount,
  coverCrop,
  displayedFeaturedOfferings,
  hero,
  heroHeadline,
  isUnclaimed,
  layout,
  logoCrop,
  portfolioPhotos,
  primaryCategory,
  serviceAreaLabel,
  tagline,
  theme,
  vendor,
  verifiedAverageRating,
  verifiedCredentials,
  verifiedReviewCount
}: {
  completedOrderCount: number;
  coverCrop: ReturnType<typeof normalizeImageCrop>;
  displayedFeaturedOfferings: VendorProfileData["offerings"];
  hero: string | null;
  heroHeadline: string;
  isUnclaimed: boolean;
  layout: string;
  logoCrop: ReturnType<typeof normalizeImageCrop>;
  portfolioPhotos: string[];
  primaryCategory: string;
  serviceAreaLabel: string;
  tagline: string | null;
  theme: StorefrontTheme;
  vendor: VendorProfileData;
  verifiedAverageRating: number;
  verifiedCredentials: string[];
  verifiedReviewCount: number;
}) {
  const introCopy = tagline ?? vendor.bio ?? "Explore services, real event credits, and booking details before starting a ShopFia quote.";
  const quoteHref = isUnclaimed ? undefined : "#inquiry";
  const logo = (
    <div className={`relative h-24 w-24 shrink-0 overflow-hidden border bg-white md:h-28 md:w-28 ${theme.logoRadius}`} style={theme.cardStyle}>
      {vendor.logoUrl ? (
        <Image
          src={vendor.logoUrl}
          alt={`${vendor.name} logo`}
          fill
          sizes="112px"
          className="object-contain p-1"
          style={imageCropToCss(logoCrop)}
        />
      ) : (
        <div className="grid h-full place-items-center px-2 text-center text-lg font-semibold" style={theme.accentTextStyle}>{vendor.name}</div>
      )}
    </div>
  );
  const quoteButton = quoteHref ? (
    <a href={quoteHref} className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold transition" style={theme.heroCtaStyle}>
      Request a quote
    </a>
  ) : (
    <form action={claimUnclaimedVendorAction}>
      <input type="hidden" name="vendorId" value={vendor.id} />
      <Button type="submit">Claim This Business</Button>
    </form>
  );
  const detailPanel = (
    <div className={`grid gap-4 p-5 text-sm ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
      <TemplateFact label="Starting at" value={vendor.startingPriceCents ? formatCurrency(vendor.startingPriceCents) : "Custom quote"} theme={theme} />
      <TemplateFact label="Service area" value={vendor.serviceAreaNotes ?? `${serviceAreaLabel || "Local events"} within ${vendor.serviceRadiusMiles} miles`} theme={theme} />
      <TemplateFact label="Lead time" value={vendor.availabilityNotes ?? "Availability confirmed in ShopFia messages"} theme={theme} />
      <TemplateFact label="ShopFia events" value={`${completedOrderCount} completed`} theme={theme} />
      {verifiedCredentials.length ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {verifiedCredentials.map((credential) => (
            <span key={credential} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={theme.heroCtaStyle}>
              <BadgeCheck className="h-3.5 w-3.5" />
              {credential}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
  const imageStrip = (
    <div className="grid grid-cols-3 gap-1 md:gap-2">
      {(portfolioPhotos.length ? portfolioPhotos : hero ? [hero] : []).slice(0, 3).map((photo, index) => (
        <div key={`${photo}-${index}`} className={`relative aspect-[4/3] overflow-hidden bg-muted ${theme.imageRadius}`}>
          <Image src={photo} alt={`${vendor.name} portfolio image ${index + 1}`} fill sizes="(min-width: 768px) 30vw, 33vw" className="object-cover" />
        </div>
      ))}
    </div>
  );

  if (layout === "PORTFOLIO_FIRST") {
    return (
      <section id="storefront-home" className="scroll-mt-28 overflow-hidden" style={{ order: 0 }}>
        <div className={`grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-8 ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {logo}
            <div className="min-w-0">
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={theme.headingStyle}>{vendor.name}</h2>
              <div className={`mt-2 flex flex-wrap gap-3 text-sm ${theme.copyClass}`}>
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-current text-amber-500" />{verifiedReviewCount > 0 ? `${verifiedAverageRating.toFixed(1)} (${verifiedReviewCount})` : "No reviews yet"}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{serviceAreaLabel || vendor.city} within {vendor.serviceRadiusMiles} miles</span>
              </div>
              <p className={`mt-3 max-w-2xl text-sm leading-6 ${theme.copyClass}`}>{introCopy}</p>
            </div>
          </div>
          {quoteButton}
        </div>
        <div className="mt-4 overflow-hidden rounded-[1rem] bg-white shadow-sm">{imageStrip}</div>
      </section>
    );
  }

  if (layout === "BRAND_SPOTLIGHT") {
    return (
      <section id="storefront-home" className={`scroll-mt-28 overflow-hidden p-6 text-white md:p-10 ${theme.heroRadius}`} style={{ ...theme.accentBlockStyle, order: 0 }}>
        <div className="mx-auto grid max-w-5xl justify-items-center gap-6 text-center">
          {logo}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Featured storefront</p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl" style={theme.headingStyle}>{heroHeadline}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/86">{introCopy}</p>
          </div>
          <div className="w-full max-w-4xl">{detailPanel}</div>
          {quoteButton}
        </div>
      </section>
    );
  }

  if (layout === "STOREFRONT_CLASSIC") {
    return (
      <section id="storefront-home" className={`grid scroll-mt-28 gap-5 p-5 md:grid-cols-[280px_1fr] md:p-6 ${theme.cardClass} ${theme.sectionRadius}`} style={{ ...theme.cardStyle, order: 0 }}>
        <aside className="grid content-start gap-4 border-b pb-5 md:border-b-0 md:border-r md:pr-5" style={theme.navStyle}>
          {logo}
          <div>
            <h2 className="text-3xl font-semibold tracking-tight" style={theme.headingStyle}>{vendor.name}</h2>
            <p className={`mt-3 text-sm leading-6 ${theme.copyClass}`}>{introCopy}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-sm ${theme.copyClass}`}><MapPin className="h-4 w-4" />{serviceAreaLabel || vendor.city} within {vendor.serviceRadiusMiles} miles</span>
          {quoteButton}
        </aside>
        <div className="grid gap-5">
          <div>
            <h3 className="text-lg font-semibold" style={theme.headingStyle}>Featured services</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {displayedFeaturedOfferings.slice(0, 3).map((offering) => (
                <Link key={offering.id} href={`/offering/${offering.id}`} className={`grid gap-2 p-3 text-sm font-semibold ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
                  <span>{offering.title}</span>
                  <span className={`text-xs font-normal ${theme.copyClass}`}>{offering.messageForPricing ? "Custom quote" : formatOfferingPrice(offering)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold" style={theme.headingStyle}>Portfolio</h3>
            <div className="mt-3">{imageStrip}</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="storefront-home" className={`grid scroll-mt-28 overflow-hidden ${theme.cardClass} ${theme.sectionRadius} md:grid-cols-[minmax(0,1fr)_minmax(360px,0.88fr)]`} style={{ ...theme.cardStyle, order: 0 }}>
      <div className="relative min-h-[360px] bg-muted md:min-h-[540px]">
        {hero ? (
          <Image
            src={hero}
            alt={`${vendor.name} cover image`}
            fill
            priority
            className="object-cover"
            style={imageCropToCss(vendor.coverPhoto ? coverCrop : null)}
          />
        ) : (
          <NeutralVendorPlaceholder label={primaryCategory} />
        )}
      </div>
      <div className="grid content-center justify-items-center gap-5 p-6 text-center md:p-10">
        {logo}
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={theme.accentTextStyle}>Featured storefront</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl" style={theme.headingStyle}>{heroHeadline}</h2>
          <p className={`mx-auto mt-4 max-w-lg text-base leading-7 ${theme.copyClass}`}>{introCopy}</p>
        </div>
        <span className={`inline-flex items-center gap-1 text-sm ${theme.copyClass}`}><MapPin className="h-4 w-4" />{serviceAreaLabel || vendor.city}</span>
        {quoteButton}
      </div>
    </section>
  );
}

function TrustFaqItem({ body, theme, title }: { body: string; theme: StorefrontTheme; title: string }) {
  return (
    <div className={`p-4 ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
      <h3 className="font-semibold" style={theme.headingStyle}>{title}</h3>
      <p className={`mt-2 text-sm leading-6 ${theme.copyClass}`}>{body}</p>
    </div>
  );
}

function TemplateFact({ label, theme, value }: { label: string; theme: StorefrontTheme; value: string }) {
  return (
    <div className="border-b pb-4 last:border-b-0 last:pb-0" style={theme.navStyle}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={theme.accentTextStyle}>{label}</div>
      <div className={`mt-2 text-base font-semibold leading-6 ${theme.copyClass}`}>{value}</div>
    </div>
  );
}

function ServiceAreaRadiusCard({
  city,
  coverageAreas,
  radiusMiles,
  serviceAreaNotes,
  theme
}: {
  city: string;
  coverageAreas: string[];
  radiusMiles: number;
  serviceAreaNotes: string | null;
  theme: StorefrontTheme;
}) {
  return (
    <div className={`mt-4 grid gap-4 p-4 md:grid-cols-[220px_1fr] md:items-center ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
      <div className="relative min-h-[180px] overflow-hidden rounded-[1rem] border border-current/15" style={theme.softChipStyle}>
        <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(90deg,currentColor_1px,transparent_1px),linear-gradient(currentColor_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute left-[12%] top-[18%] h-28 w-40 rotate-[-18deg] rounded-full border border-current/20" />
        <div className="absolute bottom-[8%] right-[10%] h-24 w-32 rotate-[18deg] rounded-full border border-current/20" />
        <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-current/35 bg-white/20" />
        <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-current/25 bg-white/35" />
        <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-center text-[10px] font-semibold shadow-sm" style={theme.badgeStyle}>
          Base
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={theme.accentTextStyle}>Service radius</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight" style={theme.headingStyle}>
          {radiusMiles} mile standard range
        </h3>
        <p className={`mt-2 text-sm leading-6 ${theme.copyClass}`}>
          Based around {city}. {serviceAreaNotes ? "Travel details and expanded coverage are confirmed in the quote." : "For events beyond this range, request a quote and the vendor can confirm travel availability."}
        </p>
        {coverageAreas.length ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={theme.accentTextStyle}>Counties/cities covered</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {coverageAreas.map((area) => (
                <span key={area} className="rounded-full px-3 py-1 text-xs font-semibold" style={theme.softChipStyle}>
                  {area}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ServiceListingGrid({
  offerings,
  savedOfferingIds,
  theme,
  verifiedAverageRating,
  verifiedReviewCount
}: {
  offerings: Array<{
    basePriceCents: number | null;
    category: { name: string };
    description: string;
    eventCategories: Array<{ id: string; category: { name: string } }>;
    id: string;
    messageForPricing: boolean;
    photos: string[];
    title: string;
  }>;
  savedOfferingIds: Set<string>;
  theme: StorefrontTheme;
  verifiedAverageRating: number;
  verifiedReviewCount: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {offerings.map((offering) => {
        const photo = offering.photos[0] ?? null;

        return (
          <article key={offering.id} className={`group relative overflow-hidden shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${theme.cardClass} ${theme.sectionRadius}`} style={theme.cardStyle}>
            <Link href={`/offering/${offering.id}`} className="block">
              <div className="relative aspect-[4/3] bg-muted">
                {photo ? (
                  <Image
                    src={photo}
                    alt={offering.title}
                    fill
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <NeutralVendorPlaceholder label={offering.category.name} />
                )}
              </div>
              <div className="grid gap-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-full" style={theme.outlineBadgeStyle}>
                    {offering.category.name}
                  </Badge>
                  {offering.eventCategories.slice(0, 1).map((eventCategory) => (
                    <Badge key={eventCategory.id} variant="outline" className="rounded-full" style={theme.outlineBadgeStyle}>
                      {eventCategory.category.name}
                    </Badge>
                  ))}
                </div>
                <div>
                  <h3 className="line-clamp-1 text-lg font-semibold" style={theme.headingStyle}>{offering.title}</h3>
                  <p className={`mt-1 line-clamp-2 text-sm leading-6 ${theme.copyClass}`}>
                    {offering.description}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold" style={theme.accentTextStyle}>
                    {offering.messageForPricing ? "Custom quote" : formatOfferingPrice(offering)}
                  </span>
                  {verifiedReviewCount > 0 ? (
                    <span className={`inline-flex items-center gap-1 ${theme.mutedClass}`}>
                      <Star className="h-4 w-4 fill-current text-amber-500" />
                      {verifiedAverageRating.toFixed(1)}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
            <div className="absolute right-3 top-3">
              <FavoriteToggle
                targetType="offering"
                targetId={offering.id}
                isSaved={savedOfferingIds.has(offering.id)}
                variant="floating"
                style={theme.floatingButtonStyle}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EditorialFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-white/15 pb-4 last:border-b-0 last:pb-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">{label}</div>
      <div className="mt-2 text-base font-semibold leading-6 text-white">{value}</div>
    </div>
  );
}

function EditorialStat({ label, theme, value }: { label: string; theme: StorefrontTheme; value: string }) {
  return (
    <div className="border-l pl-4" style={theme.accentBorderStyle}>
      <div className="text-2xl font-semibold" style={theme.accentTextStyle}>{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
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

function NeutralVendorPlaceholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#f8ece9] px-5 text-center text-sm font-medium text-muted-foreground">
      {label}
    </div>
  );
}

function getVerifiedCredentials(
  documents: Array<{ expiresAt: Date | null; status: string; type: string }>
) {
  const now = new Date();
  return documents
    .filter((document) => document.status === "VERIFIED" && (!document.expiresAt || document.expiresAt > now))
    .map((document) => {
      if (document.type === "INSURANCE") return "Insured";
      if (document.type === "LICENSE") return "Licensed";
      return "Permit Verified";
    })
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Message for pricing";
  return offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing";
}

type StorefrontTheme = ReturnType<typeof getStorefrontTheme>;

function getStorefrontTheme({
  fontStyle,
  imageShape,
  palette,
  textTone
}: {
  fontStyle: string;
  imageShape: string;
  palette: string;
  textTone: string;
}) {
  const isDark = textTone === "LIGHT" || (textTone === "AUTO" && palette === "BLACK_AND_WHITE");
  const imageRadius = imageShape === "SQUARE" ? "rounded-none" : imageShape === "SOFT" ? "rounded-[1.75rem]" : "rounded-[0.9rem]";
  const sectionRadius = imageShape === "SQUARE" ? "rounded-none" : imageShape === "SOFT" ? "rounded-[1.5rem]" : "rounded-[1.25rem]";
  const logoRadius = imageShape === "SQUARE" ? "rounded-[0.35rem]" : imageShape === "SOFT" ? "rounded-[1rem]" : "rounded-full";
  const fontFamilies = getStorefrontFontFamilies(fontStyle);
  const paletteConfig = STOREFRONT_PALETTES.find((item) => item.value === palette) ?? STOREFRONT_PALETTES[0];
  const accent = paletteConfig.accent;
  const ctaBackground = "gradient" in paletteConfig ? paletteConfig.gradient : accent;
  const ctaText = "ctaText" in paletteConfig ? paletteConfig.ctaText : "#ffffff";
  const accentSoft = `${accent}24`;
  const accentWash = `${accent}14`;

  return {
    accent,
    accentBlockStyle: { background: "gradient" in paletteConfig ? paletteConfig.gradient : `linear-gradient(135deg, ${paletteConfig.swatches.join(", ")})` } as CSSProperties,
    accentBorderStyle: { borderColor: accent } as CSSProperties,
    accentTextStyle: { color: accent } as CSSProperties,
    activeNavItemStyle: { backgroundColor: accentSoft, color: isDark ? "#ffffff" : "#2f2626" } as CSSProperties,
    bodyStyle: { fontFamily: fontFamilies.body } as CSSProperties,
    badgeStyle: { background: ctaBackground, borderColor: accent, color: ctaText } as CSSProperties,
    cardStyle: { borderColor: isDark ? `${accent}44` : `${accent}40` } as CSSProperties,
    cardClass: isDark ? "border border-white/15 bg-[#201b1e]/88 text-white" : "border bg-white/88 text-[#2f2626]",
    ctaStyle: { background: ctaBackground, borderColor: accent, color: ctaText } as CSSProperties,
    copyClass: isDark ? "text-white/86" : "text-[#5f5550]",
    headerShellStyle: { borderColor: `${accent}55` } as CSSProperties,
    headingStyle: { fontFamily: fontFamilies.heading } as CSSProperties,
    heroChipStyle: { backgroundColor: `${accent}33`, borderColor: `${accent}99`, color: "#ffffff" } as CSSProperties,
    heroCtaStyle: { background: ctaBackground, borderColor: accent, color: ctaText } as CSSProperties,
    heroRadius: imageRadius,
    imageRadius,
    logoRadius,
    mutedClass: isDark ? "text-white/62" : "text-muted-foreground",
    navStyle: { borderColor: `${accent}33` } as CSSProperties,
    outlineBadgeStyle: { backgroundColor: accentWash, borderColor: `${accent}66`, color: isDark ? "#ffffff" : "#4b403c" } as CSSProperties,
    platformBarStyle: { backgroundColor: accentWash, borderColor: `${accent}33`, color: isDark ? "#ffffffcc" : "#5f5550" } as CSSProperties,
    profileMetricClass: isDark ? "text-white/78" : "text-[#4b403c]",
    secondaryButtonStyle: { backgroundColor: accentWash, borderColor: `${accent}66`, color: isDark ? "#ffffff" : "#4b403c" } as CSSProperties,
    sectionRadius,
    shellClass: isDark ? "text-white" : "text-[#2f2626]",
    floatingButtonStyle: { backgroundColor: isDark ? "#201b1eee" : "#fffffff2", borderColor: `${accent}66`, color: accent } as CSSProperties,
    softChipStyle: { backgroundColor: accentSoft, color: isDark ? "#ffffffcc" : "#5f5550" } as CSSProperties
  };
}

function readStorefrontFaqs(value: unknown) {
  if (Array.isArray(value)) {
    const faqs = value
      .filter((item): item is { answer: string; id?: string; question: string } => Boolean(item) && typeof item === "object" && "question" in item && "answer" in item)
      .map((item, index) => ({
        answer: String(item.answer),
        id: item.id ?? `faq-${index}`,
        question: String(item.question)
      }));
    if (faqs.length) return faqs;
  }
  return [
    {
      id: "quotes",
      question: "How do quotes work?",
      answer: "Send your event details through ShopFia. The vendor can reply in messages with a custom quote tied to this storefront."
    },
    {
      id: "reviews",
      question: "Are reviews verified?",
      answer: "Public reviews are collected from completed ShopFia bookings, so ratings stay tied to real orders."
    },
    {
      id: "saves",
      question: "Can I save services?",
      answer: "Yes. Saved vendors and services stay connected to your ShopFia account for future planning."
    }
  ];
}

function readStorefrontBooking(value: unknown) {
  const fallback = {
    deposit: "Deposit and payment details are confirmed in the quote.",
    leadTime: "Availability is confirmed in ShopFia messages.",
    process: "Request a quote, confirm details in messages, then book securely through ShopFia when supported."
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const record = value as Partial<typeof fallback>;
  return {
    deposit: record.deposit || fallback.deposit,
    leadTime: record.leadTime || fallback.leadTime,
    process: record.process || fallback.process
  };
}

function readStorefrontPolicies(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { body: string; id?: string; title: string } => Boolean(item) && typeof item === "object" && "title" in item && "body" in item)
    .map((item, index) => ({
      body: String(item.body),
      id: item.id ?? `policy-${index}`,
      title: String(item.title)
    }));
}

function instagramHandleFromUrl(href: string) {
  try {
    const url = new URL(href);
    const handle = url.pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : url.hostname;
  } catch {
    return href;
  }
}
