import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  absoluteImageUrl,
  formatCurrency,
  getOfferingDetail,
  getVendorDetail,
  marketplacePathForOffering,
  marketplacePathForVendor,
  openWebsitePath
} from "../api/client";
import { useAuth } from "../api/auth";
import { EmptyState } from "../components/EmptyState";
import { OfferingCard } from "../components/MarketplaceCards";
import { FavoriteButton } from "../components/FavoriteButton";
import { colors, radii, screen, spacing } from "../theme";
import type { Offering, OfferingSummary, Vendor } from "../types/shopfia";

type DetailTarget =
  | { kind: "vendor"; slug: string; name?: string }
  | { kind: "offering"; id: string; title?: string };

type MarketplaceDetailScreenProps = {
  onBack: () => void;
  onOpenOffering: (offering: Offering) => void;
  onOpenVendor: (vendor: Vendor) => void;
  target: DetailTarget;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatOfferingSummaryPrice(offering: OfferingSummary) {
  return offering.messageForPricing ? "Custom pricing" : `From ${formatCurrency(offering.basePriceCents)}`;
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
        <Ionicons color={colors.foreground} name="chevron-back" size={22} />
      </Pressable>
      <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.iconButtonPlaceholder} />
    </View>
  );
}

function HeroImage({ image, label, logo, targetId, targetType }: { image: string | null; label: string; logo?: string | null; targetId: string; targetType: "vendor" | "offering" }) {
  const logoUrl = absoluteImageUrl(logo);

  return (
    <View style={styles.heroImageWrap}>
      {image ? (
        <Image alt={`${label} hero photo`} source={{ uri: image }} style={styles.heroImage} />
      ) : (
        <View style={styles.heroPlaceholder}>
          <Text style={styles.heroPlaceholderText}>{label}</Text>
        </View>
      )}
      {logoUrl ? (
        <Image alt={`${label} logo`} source={{ uri: logoUrl }} style={styles.logo} />
      ) : null}
      <View style={styles.favoritePosition}>
        <FavoriteButton targetId={targetId} targetType={targetType} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tagRow}>
      {tags.slice(0, 10).map((tag) => (
        <Text key={tag} numberOfLines={1} style={styles.tag}>{tag}</Text>
      ))}
    </View>
  );
}

function CTAButton({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.cta, secondary && styles.ctaSecondary]}>
      <Text style={[styles.ctaText, secondary && styles.ctaSecondaryText]}>{label}</Text>
    </Pressable>
  );
}

function VendorDetail({
  onOpenOffering,
  vendor
}: {
  onOpenOffering: (offering: Offering) => void;
  vendor: Vendor;
}) {
  const hero = absoluteImageUrl(vendor.coverPhoto ?? vendor.photos[0]);
  const categories = unique(vendor.categories.map((item) => item.category.name));
  const visibleOfferings = vendor.offerings.slice(0, 8);
  const reviewAverage = vendor.reviewCount > 0 ? vendor.averageRating.toFixed(1) : "New";
  const tagline = vendor.storefrontTagline ?? vendor.bio;

  return (
    <>
      <HeroImage image={hero} label={vendor.name} logo={vendor.logoUrl} targetId={vendor.id} targetType="vendor" />
      <View style={styles.contentBlock}>
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, vendor.verified && styles.badgeVerified]}>
            {vendor.verified ? "Verified Vendor" : vendor.status === "UNCLAIMED" ? "Community tagged" : "ShopFia vendor"}
          </Text>
          {vendor.rankingScore?.tierLabel ? <Text style={styles.badge}>{vendor.rankingScore.tierLabel}</Text> : null}
        </View>
        <Text style={styles.title}>{vendor.name}</Text>
        <Text style={styles.location}>
          {vendor.city}{vendor.state ? `, ${vendor.state}` : ""} · Serves {vendor.serviceRadiusMiles} mi
        </Text>
        {tagline ? <Text style={styles.bodyText}>{tagline}</Text> : null}
        <TagList tags={categories} />
      </View>

      <View style={styles.statsRow}>
        <Stat label="Rating" value={reviewAverage} />
        <Stat label="Reviews" value={String(vendor.reviewCount)} />
        <Stat label="Starting at" value={vendor.startingPriceCents ? formatCurrency(vendor.startingPriceCents) : "Custom"} />
      </View>

      <View style={styles.contentBlock}>
        <Text style={styles.sectionTitle}>Services</Text>
        {visibleOfferings.length ? visibleOfferings.map((offering) => (
          <Pressable
            key={offering.id}
            onPress={() => onOpenOffering({ ...offering, categories: [], description: "", durationMinutes: null, messageForPricing: Boolean(offering.messageForPricing), photos: offering.photos ?? [], turnaroundDays: null, vendor })}
            style={styles.serviceRow}
          >
            <View style={styles.serviceText}>
              <Text style={styles.serviceTitle}>{offering.title}</Text>
              <Text style={styles.serviceMeta}>{offering.category.name} · {formatOfferingSummaryPrice(offering)}</Text>
            </View>
            <Ionicons color={colors.mutedForeground} name="chevron-forward" size={18} />
          </Pressable>
        )) : (
          <Text style={styles.bodyText}>This vendor has not published active services yet.</Text>
        )}
      </View>

      <View style={styles.contentBlock}>
        <Text style={styles.sectionTitle}>Service Area</Text>
        <Text style={styles.bodyText}>
          {vendor.serviceAreaNotes || `Based in ${vendor.city}${vendor.state ? `, ${vendor.state}` : ""} and serving nearby celebrations.`}
        </Text>
        {vendor.availabilityNotes ? <Text style={styles.bodyText}>{vendor.availabilityNotes}</Text> : null}
      </View>

      {vendor.reviews?.length ? (
        <View style={styles.contentBlock}>
          <Text style={styles.sectionTitle}>Reviews</Text>
          {vendor.reviews.slice(0, 3).map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <Text style={styles.reviewRating}>{review.rating.toFixed(1)} stars</Text>
              {review.comment ? <Text style={styles.bodyText}>{review.comment}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actionStack}>
        <CTAButton label="Request a quote" onPress={() => openWebsitePath(`${marketplacePathForVendor(vendor.slug)}#inquiry`)} />
        <CTAButton label="Open full storefront" onPress={() => openWebsitePath(marketplacePathForVendor(vendor.slug))} secondary />
      </View>
    </>
  );
}

function OfferingDetail({
  offering,
  onOpenVendor
}: {
  offering: Offering;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  const hero = absoluteImageUrl(offering.photos[0] ?? offering.vendor.coverPhoto ?? offering.vendor.photos[0]);
  const tags = unique([
    offering.category.name,
    ...offering.categories.map((item) => item.category.name),
    ...(offering.eventCategories ?? []).map((item) => item.category.name),
    ...(offering.tags ?? [])
  ]);

  return (
    <>
      <HeroImage image={hero} label={offering.title} targetId={offering.id} targetType="offering" />
      <View style={styles.contentBlock}>
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, offering.vendor.verified && styles.badgeVerified]}>
            {offering.vendor.verified ? "Verified Vendor" : "ShopFia vendor"}
          </Text>
          <Text style={styles.badge}>{offering.type.replace("_", " ").toLowerCase()}</Text>
        </View>
        <Text style={styles.title}>{offering.title}</Text>
        <Pressable onPress={() => onOpenVendor(offering.vendor)} style={styles.vendorLink}>
          <Text style={styles.vendorLinkText}>By {offering.vendor.name}</Text>
          <Ionicons color={colors.primary} name="chevron-forward" size={17} />
        </Pressable>
        <Text style={styles.bodyText}>{offering.description}</Text>
        <TagList tags={tags} />
      </View>

      <View style={styles.statsRow}>
        <Stat
          label="Pricing"
          value={offering.messageForPricing ? "Custom" : formatCurrency(offering.basePriceCents)}
        />
        <Stat label="Turnaround" value={offering.turnaroundDays ? `${offering.turnaroundDays} days` : "Custom"} />
        <Stat label="Duration" value={offering.durationMinutes ? `${offering.durationMinutes} min` : "Varies"} />
      </View>

      <View style={styles.contentBlock}>
        <Text style={styles.sectionTitle}>Good to know</Text>
        <Text style={styles.bodyText}>
          Sold by {offering.vendor.name} in {offering.vendor.city}{offering.vendor.state ? `, ${offering.vendor.state}` : ""}.
        </Text>
        <Text style={styles.bodyText}>Share event details and the vendor can reply through ShopFia messages.</Text>
      </View>

      <View style={styles.contentBlock}>
        <Text style={styles.sectionTitle}>More from this vendor</Text>
        <OfferingCard offering={offering} />
      </View>

      <View style={styles.actionStack}>
        <CTAButton label="Request a quote" onPress={() => openWebsitePath(`${marketplacePathForOffering(offering.id)}#inquiry`)} />
        <CTAButton label="Open full listing" onPress={() => openWebsitePath(marketplacePathForOffering(offering.id))} secondary />
      </View>
    </>
  );
}

export function MarketplaceDetailScreen({
  onBack,
  onOpenOffering,
  onOpenVendor,
  target
}: MarketplaceDetailScreenProps) {
  const { cookie } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);

  const title = target.kind === "vendor" ? target.name ?? "Vendor" : target.title ?? "Offering";

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      if (target.kind === "vendor") {
        const result = await getVendorDetail(cookie, target.slug);
        setVendor(result.data.vendor);
        setOffering(null);
      } else {
        const result = await getOfferingDetail(cookie, target.id);
        setOffering(result.data.offering);
        setVendor(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load details.");
    } finally {
      setLoading(false);
    }
  }, [cookie, target]);

  useEffect(() => {
    load();
  }, [load]);

  const body = useMemo(() => {
    if (loading && !vendor && !offering) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (error) return <EmptyState title="Details unavailable" body={error} />;
    if (vendor) return <VendorDetail onOpenOffering={onOpenOffering} vendor={vendor} />;
    if (offering) return <OfferingDetail offering={offering} onOpenVendor={onOpenVendor} />;
    return <EmptyState title="Not found" body="This ShopFia page may have moved or is no longer active." />;
  }, [error, loading, offering, onOpenOffering, onOpenVendor, vendor]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading && Boolean(vendor || offering)} onRefresh={load} tintColor={colors.primary} />}
    >
      <Header onBack={onBack} title={title} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  iconButtonPlaceholder: {
    width: 42
  },
  topTitle: {
    color: colors.foreground,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  heroImageWrap: {
    aspectRatio: 0.92,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    overflow: "hidden"
  },
  heroImage: {
    height: "100%",
    width: "100%"
  },
  favoritePosition: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md
  },
  heroPlaceholder: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg
  },
  heroPlaceholderText: {
    color: colors.mutedForeground,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center"
  },
  logo: {
    backgroundColor: colors.card,
    borderColor: "rgba(255, 255, 255, 0.88)",
    borderRadius: 22,
    borderWidth: 2,
    bottom: spacing.md,
    height: 64,
    left: spacing.md,
    position: "absolute",
    width: 64
  },
  contentBlock: {
    backgroundColor: "rgba(255, 250, 247, 0.9)",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  badge: {
    backgroundColor: colors.muted,
    borderRadius: radii.sm,
    color: colors.foreground,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  badgeVerified: {
    backgroundColor: colors.primary,
    color: colors.primaryForeground
  },
  title: {
    color: colors.foreground,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36
  },
  location: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "700"
  },
  bodyText: {
    color: colors.mutedForeground,
    fontSize: 15,
    lineHeight: 23
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  tag: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 160,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 7
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  stat: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 82,
    justifyContent: "center",
    padding: spacing.sm
  },
  statValue: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase"
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "900"
  },
  serviceRow: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  serviceText: {
    flex: 1,
    gap: 3
  },
  serviceTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "900"
  },
  serviceMeta: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "700"
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  reviewRating: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: "900"
  },
  actionStack: {
    gap: spacing.sm
  },
  cta: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  ctaSecondary: {
    backgroundColor: colors.accent
  },
  ctaText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "900"
  },
  ctaSecondaryText: {
    color: colors.foreground
  },
  vendorLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs
  },
  vendorLinkText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900"
  },
  loading: {
    alignItems: "center",
    padding: spacing.xl
  }
});
