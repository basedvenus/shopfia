import { useCallback, useEffect, useMemo, useState } from "react";
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
import { colors, radii, screen, spacing } from "../theme";
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
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading && Boolean(data)} onRefresh={load} tintColor={colors.primary} />}
    >
      <ShopFiaLogo />

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Discover local celebrations</Text>
        <Text style={styles.heading}>Find vendors, services, and real party inspiration.</Text>
        <View style={styles.searchRow}>
          <TextInput
            autoCapitalize="none"
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmittedQuery(query.trim())}
            placeholder="Search balloons, cakes, themes..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        <Pill label="All services" onPress={() => setCategoryId(undefined)} selected={!categoryId} />
        {data?.categories.slice(0, 12).map((category) => (
          <Pill
            key={category.id}
            label={category.name}
            onPress={() => setCategoryId(category.id)}
            selected={category.id === categoryId}
          />
        ))}
      </ScrollView>

      <View style={styles.segmented}>
        <Pill label={`Vendors ${data?.vendors.length ?? 0}`} onPress={() => setMode("vendors")} selected={mode === "vendors"} />
        <Pill label={`Offerings ${data?.offerings.length ?? 0}`} onPress={() => setMode("offerings")} selected={mode === "offerings"} />
        <Pill label={`Parties ${data?.parties.length ?? 0}`} onPress={() => setMode("parties")} selected={mode === "parties"} />
      </View>

      {selectedCategory ? (
        <Text style={styles.filterText}>Filtered by {selectedCategory.name}</Text>
      ) : null}

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
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
    gap: spacing.md,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  hero: {
    backgroundColor: "rgba(255, 250, 247, 0.86)",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  heading: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34
  },
  searchRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1
  },
  searchInput: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 48,
    paddingHorizontal: spacing.md
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
    fontSize: 13,
    fontWeight: "700"
  },
  center: {
    alignItems: "center",
    padding: spacing.xl
  }
});
