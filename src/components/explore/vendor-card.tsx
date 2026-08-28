import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CroppedImage } from "@/components/ui/cropped-image";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { storefrontPath } from "@/lib/businesses";
import { normalizeImageCrop } from "@/lib/image-crop";
import { getProfileBadge } from "@/lib/profile-badges";
import { formatCurrency } from "@/lib/utils";
import { getVendorTrustStatus } from "@/lib/vendor-status";

type VendorCardProps = {
  vendor: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string | null;
    coverPhoto: string | null;
    logoCrop?: unknown;
    logoUrl?: string | null;
    photos: string[];
    status: string;
    verified: boolean;
    averageRating: number;
    reviewCount: number;
    rankingScore: { score: number; tierLabel: string } | null;
    startingPriceCents: number | null;
    user: {
      createdAt: Date | string;
      email: string | null;
      username: string | null;
    } | null;
    categories: { category: { name: string } }[];
    offerings: { category: { name: string }; photos?: string[] }[];
  };
  isSaved?: boolean;
  originalMemberCutoff?: Date | string | null;
};

export function VendorCard({ isSaved = false, originalMemberCutoff = null, vendor }: VendorCardProps) {
  const serviceImage = vendor.offerings.flatMap((offering) => offering.photos ?? [])[0] ?? null;
  const image = serviceImage ?? vendor.coverPhoto ?? vendor.photos[0] ?? null;
  const trustStatus = getVendorTrustStatus(vendor);
  const profileBadge = vendor.user
    ? getProfileBadge(vendor.user, originalMemberCutoff, {
        includeFounder: false,
        vendorContext: true
      })
    : null;
  const categoryNames = unique([
    ...vendor.categories.map((vc) => vc.category.name),
    ...vendor.offerings.map((offering) => offering.category.name)
  ]);
  const hasVerifiedReviews = vendor.reviewCount > 0;

  return (
    <Card className="group relative overflow-hidden rounded-[1.05rem] border-white/50 bg-white/90 transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-3xl">
      <Link href={storefrontPath(vendor.slug)} className="absolute inset-0 z-10" aria-label={`View ${vendor.name}`} />
      <div className="relative aspect-[4/5] sm:aspect-[4/3]">
        {image ? (
          <Image src={image} alt={vendor.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[#f8ece9] px-5 text-center text-sm font-medium text-muted-foreground">
            {vendor.categories[0]?.category.name ?? "ShopFia vendor"}
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1 sm:left-3 sm:top-3 sm:gap-2">
          <Badge variant={trustStatus.tone === "verified" ? "accent" : "outline"}>{trustStatus.label}</Badge>
        </div>
        <div className="absolute right-3 top-3 z-20">
          <FavoriteToggle targetType="vendor" targetId={vendor.id} isSaved={isSaved} variant="floating" />
        </div>
      </div>
      <CardContent className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-[11px] font-semibold text-primary">
                {vendor.logoUrl ? (
                  <CroppedImage
                    src={vendor.logoUrl}
                    alt={`${vendor.name} logo`}
                    crop={normalizeImageCrop(vendor.logoCrop)}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : (
                  getInitials(vendor.name)
                )}
              </span>
              <h3 className="line-clamp-1 min-w-0 text-sm font-semibold sm:text-base">{vendor.name}</h3>
              <ProfileBadge badge={profileBadge} />
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {vendor.city}
                {vendor.state ? `, ${vendor.state}` : ""}
              </span>
            </div>
          </div>
          {hasVerifiedReviews ? (
            <div className="hidden items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs sm:flex">
              <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
              <span>{vendor.averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">({vendor.reviewCount})</span>
            </div>
          ) : null}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {hasVerifiedReviews ? <Badge variant="accent">Verified reviews only</Badge> : null}
          {vendor.rankingScore ? (
            <Badge variant="outline">{vendor.rankingScore.tierLabel}</Badge>
          ) : null}
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {categoryNames.slice(0, 3).map((category) => (
            <Badge key={category} variant="outline">
              {displayCategoryName(category)}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs sm:text-sm">
            {vendor.startingPriceCents ? "From " : ""}
            <span className="font-semibold">
              {vendor.startingPriceCents ? formatCurrency(vendor.startingPriceCents) : "Custom pricing"}
            </span>
          </p>
          <Link href={storefrontPath(vendor.slug)} className="relative z-20 hidden sm:block">
            <Button size="sm">View Storefront</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function displayCategoryName(name: string) {
  return name;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
