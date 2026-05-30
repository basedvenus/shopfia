import Link from "next/link";
import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileBadge } from "@/components/badges/profile-badge";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { getProfileBadge } from "@/lib/profile-badges";
import { formatCurrency } from "@/lib/utils";

type VendorCardProps = {
  vendor: {
    id: string;
    slug: string;
    name: string;
    city: string;
    state: string | null;
    coverPhoto: string | null;
    photos: string[];
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
    offerings: { category: { name: string } }[];
  };
  isSaved?: boolean;
  originalMemberCutoff?: Date | string | null;
};

export function VendorCard({ isSaved = false, originalMemberCutoff = null, vendor }: VendorCardProps) {
  const image = vendor.coverPhoto ?? vendor.photos[0] ?? "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1000&q=80";
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

  return (
    <Card className="group relative overflow-hidden rounded-[1.05rem] border-white/50 bg-white/90 transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-3xl">
      <Link href={`/vendor/profile/${vendor.slug}`} className="absolute inset-0 z-10" aria-label={`View ${vendor.name}`} />
      <div className="relative aspect-[4/5] sm:aspect-[4/3]">
        <Image src={image} alt={vendor.name} fill className="object-cover" />
        <div className="absolute left-2 top-2 flex gap-1 sm:left-3 sm:top-3 sm:gap-2">
          {vendor.verified && <Badge variant="accent">Verified</Badge>}
        </div>
        <div className="absolute right-1.5 top-1.5 z-20 origin-top-right scale-75 sm:right-3 sm:top-3 sm:scale-100">
          <FavoriteToggle targetType="vendor" targetId={vendor.id} isSaved={isSaved} />
        </div>
      </div>
      <CardContent className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="line-clamp-1 text-sm font-semibold sm:text-base">{vendor.name}</h3>
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
          <div className="hidden items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs sm:flex">
            <Star className="h-3.5 w-3.5 fill-current text-amber-500" />
            <span>{vendor.averageRating.toFixed(1)}</span>
            <span className="text-muted-foreground">({vendor.reviewCount})</span>
          </div>
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Badge variant="accent">Verified reviews only</Badge>
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
          <Link href={`/vendor/profile/${vendor.slug}`} className="relative z-20 hidden sm:block">
            <Button size="sm">View Profile</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function displayCategoryName(name: string) {
  return name === "Party Favors and Gifts" ? "Party Favors & Gifts" : name;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
