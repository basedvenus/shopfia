import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { getExplore } from "../api/client";
import { useAuth } from "../api/auth";
import { EmptyState } from "../components/EmptyState";
import { OfferingCard, PartyCard, VendorCard } from "../components/MarketplaceCards";
import { Pill } from "../components/Pill";
import { ShopFiaLogo } from "../components/ShopFiaLogo";
import { colors, fonts, screen, spacing } from "../theme";
import type { ExplorePayload } from "../types/shopfia";
import type { Offering, Vendor } from "../types/shopfia";

type BrowseMode = "vendors" | "offerings" | "parties";

export function BrowseScreen({
  onOpenOffering,
  onOpenVendor
}: {
  onOpenOffering: (offering: Offering) => void;
  onOpenVendor: (vendor: Vendor) => void;
}) {
  const { cookie } = useAuth();
  const [data, setData] = useState<ExplorePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<BrowseMode>("vendors");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();

  const selectedCategory = useMemo(
    () => data?.categories.find((category) => category.id === categoryId),
    [categoryId, data?.categories]
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await getExplore(cookie, { categoryId, q: submittedQuery });
      setData(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load marketplace data.");
    } finally {
      setLoading(false);
    }
  }, [categoryId, cookie, submittedQuery]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} tintColor={colors.primary} />}
    >
      <ShopFiaLogo />

      <View style={styles.hero}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrow}>Discover local celebrations</Text>
        </View>
        <Text style={styles.heading}>Discover local vendors, offerings, and real party inspiration.</Text>
        <Text style={styles.intro}>
          Search by business, service, category, location, or style, then browse party posts for extra inspiration.
        </Text>
        <View style={styles.searchRow}>
          <Ionicons color={colors.mutedForeground} name="search-outline" size={18} />
          <TextInput
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmittedQuery(query.trim())}
            placeholder="Search vendors, services, themes, or events..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
      </View>

      {data ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            <Pill label="All services" onPress={() => setCategoryId(undefined)} selected={!categoryId} />
            {data.categories.slice(0, 12).map((category) => (
              <Pill
                key={category.id}
                label={category.name}
                onPress={() => setCategoryId(category.id)}
                selected={category.id === categoryId}
              />
            ))}
          </ScrollView>

          <View style={styles.segmented}>
            <Pill label={`Vendors ${data.vendors.length}`} onPress={() => setMode("vendors")} selected={mode === "vendors"} />
            <Pill label={`Offerings ${data.offerings.length}`} onPress={() => setMode("offerings")} selected={mode === "offerings"} />
            <Pill label={`Parties ${data.parties.length}`} onPress={() => setMode("parties")} selected={mode === "parties"} />
          </View>
        </>
      ) : null}

      {selectedCategory ? (
        <Text style={styles.filterText}>Filtered by {selectedCategory.name}</Text>
      ) : null}

      {loading && !data ? (
        <ExploreSkeleton />
      ) : null}

      {error ? <EmptyState title="Marketplace unavailable" body={error} /> : null}

      {!error && data && mode === "vendors" ? (
        data.vendors.length ? data.vendors.map((vendor) => <VendorCard key={vendor.id} onPress={onOpenVendor} vendor={vendor} />) : (
          <EmptyState title="No vendors found" body="Try another service, theme, or nearby city." />
        )
      ) : null}

      {!error && data && mode === "offerings" ? (
        data.offerings.length ? data.offerings.map((offering) => (
          <OfferingCard key={offering.id} offering={offering} onPress={onOpenOffering} />
        )) : (
          <EmptyState title="No offerings found" body="Search another service or clear the selected category." />
        )
      ) : null}

      {!error && data && mode === "parties" ? (
        data.parties.length ? data.parties.map((party) => <PartyCard key={party.id} party={party} />) : (
          <EmptyState title="No party inspiration found" body="Try a broader search to browse recent celebrations." />
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  hero: {
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    gap: 16,
    padding: 24
  },
  eyebrowPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderColor: "rgba(230, 175, 173, 0.2)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.16,
    lineHeight: 16,
    textTransform: "uppercase"
  },
  heading: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.75,
    lineHeight: 36
  },
  intro: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24
  },
  searchRow: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: 16
  },
  searchInput: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    paddingVertical: 0
  },
  pillRow: {
    gap: spacing.sm,
    paddingRight: screen.horizontal
  },
  segmented: {
    flexDirection: "row",
    gap: spacing.sm
  },
  filterText: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "500"
  },
  skeletonWrap: {
    alignItems: "center",
    gap: spacing.md
  },
  skeletonPills: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%"
  },
  skeletonLine: {
    backgroundColor: colors.muted
  },
  skeletonPill: {
    borderRadius: 999,
    height: 34,
    width: 92
  },
  skeletonCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%"
  },
  skeletonImage: {
    aspectRatio: 1.12,
    backgroundColor: colors.muted,
    width: "100%"
  },
  skeletonBody: {
    gap: spacing.sm,
    padding: spacing.md
  },
  skeletonTitle: {
    borderRadius: 6,
    height: 20,
    width: "64%"
  },
  skeletonMeta: {
    borderRadius: 6,
    height: 14,
    width: "42%"
  }
});

function ExploreSkeleton() {
  return (
    <View accessibilityLabel="Loading ShopFia Explore" style={styles.skeletonWrap}>
      <View style={styles.skeletonPills}>
        <View style={[styles.skeletonLine, styles.skeletonPill]} />
        <View style={[styles.skeletonLine, styles.skeletonPill]} />
        <View style={[styles.skeletonLine, styles.skeletonPill]} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonBody}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonMeta]} />
        </View>
      </View>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
