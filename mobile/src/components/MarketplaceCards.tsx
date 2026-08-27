import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  absoluteImageUrl,
  formatCurrency,
} from "../api/client";
import { colors, fonts, radii, spacing } from "../theme";
import { FavoriteButton } from "./FavoriteButton";
import type { Offering, Party, Vendor } from "../types/shopfia";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function TrustBadge({ verified }: { verified: boolean }) {
  return (
    <View style={[styles.badge, verified ? styles.badgeVerified : styles.badgeNeutral]}>
      <Text style={[styles.badgeText, verified && styles.badgeTextVerified]}>
        {verified ? "Verified" : "Community"}
      </Text>
    </View>
  );
}

export function VendorCard({ onPress, vendor }: { onPress?: (vendor: Vendor) => void; vendor: Vendor }) {
  const image = absoluteImageUrl(vendor.coverPhoto ?? vendor.photos[0]);
  const categories = unique([
    ...vendor.categories.map((item) => item.category.name),
    ...vendor.offerings.map((item) => item.category.name)
  ]);

  return (
    <Pressable onPress={() => onPress?.(vendor)} style={styles.card}>
      <View style={styles.imageWrap}>
        {image ? <Image alt={`${vendor.name} cover photo`} source={{ uri: image }} style={styles.image} /> : <View style={styles.placeholder} />}
        <View style={styles.badgePosition}>
          <TrustBadge verified={vendor.verified} />
        </View>
        <View style={styles.favoritePosition}>
          <FavoriteButton targetId={vendor.id} targetType="vendor" />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{vendor.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons color={colors.mutedForeground} name="location-outline" size={14} />
          <Text style={styles.meta} numberOfLines={1}>
            {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
          </Text>
        </View>
        <View style={styles.chipRow}>
          {categories.slice(0, 3).map((category) => (
            <Text key={category} style={styles.chip} numberOfLines={1}>{category}</Text>
          ))}
        </View>
        <View style={styles.footerRow}>
          <Text style={styles.price}>
            {vendor.startingPriceCents ? `From ${formatCurrency(vendor.startingPriceCents)}` : "Custom pricing"}
          </Text>
          {vendor.reviewCount > 0 ? (
            <Text style={styles.rating}>{vendor.averageRating.toFixed(1)} ({vendor.reviewCount})</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function OfferingCard({ offering, onPress }: { offering: Offering; onPress?: (offering: Offering) => void }) {
  const image = absoluteImageUrl(offering.photos[0] ?? offering.vendor.coverPhoto ?? offering.vendor.photos[0]);
  const categories = unique([
    offering.category.name,
    ...offering.categories.map((item) => item.category.name)
  ]);

  return (
    <Pressable onPress={() => onPress?.(offering)} style={styles.card}>
      <View style={styles.imageWrapWide}>
        {image ? <Image alt={`${offering.title} photo`} source={{ uri: image }} style={styles.image} /> : <View style={styles.placeholder} />}
        <View style={styles.badgePosition}>
          <TrustBadge verified={offering.vendor.verified} />
        </View>
        <View style={styles.favoritePosition}>
          <FavoriteButton targetId={offering.id} targetType="offering" />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{offering.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {offering.vendor.name} in {offering.vendor.city}
        </Text>
        <View style={styles.chipRow}>
          {categories.slice(0, 3).map((category) => (
            <Text key={category} style={styles.chip} numberOfLines={1}>{category}</Text>
          ))}
        </View>
        <Text style={styles.price}>
          {offering.messageForPricing ? "Custom pricing" : `From ${formatCurrency(offering.basePriceCents)}`}
        </Text>
      </View>
    </Pressable>
  );
}

export function PartyCard({ party }: { party: Party }) {
  const image = absoluteImageUrl(party.coverImageUrl ?? party.imageUrls[0]);

  return (
    <View style={styles.partyCard}>
      <View style={styles.partyImageWrap}>
        {image ? <Image alt={`${party.title} party photo`} source={{ uri: image }} style={styles.partyImage} /> : null}
        <View style={styles.favoritePosition}>
          <FavoriteButton targetId={party.id} targetType="party" />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{party.title}</Text>
        <Text style={styles.meta} numberOfLines={2}>
          {[party.theme, party.city ?? party.location].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: "rgba(234, 223, 216, 0.85)",
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18
  },
  imageWrap: {
    aspectRatio: 1.12,
    backgroundColor: colors.accent
  },
  imageWrapWide: {
    aspectRatio: 1.45,
    backgroundColor: colors.accent
  },
  image: {
    height: "100%",
    width: "100%"
  },
  placeholder: {
    backgroundColor: colors.accent,
    height: "100%",
    width: "100%"
  },
  badgePosition: {
    left: spacing.sm,
    position: "absolute",
    top: spacing.sm
  },
  favoritePosition: {
    position: "absolute",
    right: spacing.sm,
    top: spacing.sm
  },
  badge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  badgeNeutral: {
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderColor: colors.border,
    borderWidth: 1
  },
  badgeVerified: {
    backgroundColor: colors.primary
  },
  badgeText: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600"
  },
  badgeTextVerified: {
    color: colors.primaryForeground
  },
  body: {
    gap: spacing.sm,
    padding: spacing.md
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: "600"
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4
  },
  meta: {
    color: colors.mutedForeground,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "400"
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  chip: {
    backgroundColor: colors.muted,
    borderRadius: radii.sm,
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "500",
    maxWidth: 135,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5
  },
  footerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  price: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "600"
  },
  rating: {
    color: colors.warning,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "600"
  },
  partyCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: "hidden"
  },
  partyImageWrap: {
    aspectRatio: 1.25,
    backgroundColor: colors.muted,
    position: "relative",
    width: "100%"
  },
  partyImage: {
    height: "100%",
    width: "100%"
  }
});
