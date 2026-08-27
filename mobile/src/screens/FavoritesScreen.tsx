import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { absoluteImageUrl, openWebsitePath } from "../api/client";
import { useAuth } from "../api/auth";
import { useFavorites } from "../api/favorites";
import { EmptyState } from "../components/EmptyState";
import { FavoriteButton } from "../components/FavoriteButton";
import { ShopFiaLogo } from "../components/ShopFiaLogo";
import { colors, radii, screen, spacing } from "../theme";
import type { FavoriteItem, Offering, Vendor } from "../types/shopfia";

const starterCollections = [
  "Baby Shower Ideas",
  "Wedding Inspiration",
  "Vendors I Love",
  "Future Birthday Ideas",
  "Outdoor Party Inspiration"
];

export function FavoritesScreen({
  onOpenAccount,
  onOpenOffering,
  onOpenVendor
}: {
  onOpenAccount: () => void;
  onOpenOffering: (offering: Pick<Offering, "id" | "title">) => void;
  onOpenVendor: (vendor: Pick<Vendor, "name" | "slug">) => void;
}) {
  const { session } = useAuth();
  const { createCollection, error, loading, payload, refresh } = useFavorites();
  const [collectionName, setCollectionName] = useState("");

  async function submitCollection() {
    const name = collectionName.trim();
    if (!name) return;
    try {
      await createCollection(name);
      setCollectionName("");
    } catch (reason) {
      Alert.alert("Collection unavailable", reason instanceof Error ? reason.message : "Please try again.");
    }
  }

  function openFavorite(item: FavoriteItem) {
    if (item.targetType === "vendor") {
      onOpenVendor({ name: item.title, slug: item.href.replace(/^\//, "") });
      return;
    }
    if (item.targetType === "offering") {
      onOpenOffering({ id: item.targetId, title: item.title });
      return;
    }
    openWebsitePath(item.href);
  }

  if (!session?.user) {
    return (
      <View style={styles.signedOutContainer}>
        <ShopFiaLogo />
        <View style={styles.signedOutCard}>
          <Ionicons color={colors.primary} name="heart-outline" size={34} />
          <Text style={styles.signedOutTitle}>Save ideas for later.</Text>
          <Text style={styles.signedOutBody}>
            Sign in to collect vendors, parties, and services into your own inspiration boards.
          </Text>
          <Pressable onPress={onOpenAccount} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const collections = payload.collections.length
    ? payload.collections
    : starterCollections.map((name) => ({ count: 0, id: name, name }));
  const sections = [
    { label: "Parties", type: "party" },
    { label: "Vendors", type: "vendor" },
    { label: "Services", type: "offering" }
  ] as const;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl onRefresh={refresh} refreshing={loading} tintColor={colors.primary} />}
    >
      <ShopFiaLogo />
      <View style={styles.hero}>
        <View style={styles.eyebrowRow}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={15} />
          <Text style={styles.eyebrow}>Saved inspiration</Text>
        </View>
        <Text style={styles.heading}>Your favorites, curated.</Text>
        <Text style={styles.heroBody}>
          Collect party ideas, vendors, and services as you plan. Build boards for every celebration and vendor you love.
        </Text>
      </View>

      <View style={styles.collectionForm}>
        <Text style={styles.formLabel}>Start a collection</Text>
        <View style={styles.formRow}>
          <TextInput
            onChangeText={setCollectionName}
            onSubmitEditing={submitCollection}
            placeholder="Baby Shower Ideas"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            style={styles.input}
            value={collectionName}
          />
          <Pressable disabled={!collectionName.trim() || loading} onPress={submitCollection} style={styles.createButton}>
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Ionicons color={colors.primaryForeground} name="add" size={22} />}
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Collections</Text>
        <Text style={styles.sectionCount}>{payload.collections.length} created</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionsRow}>
        {collections.map((collection) => (
          <View key={collection.id} style={styles.collectionCard}>
            <Ionicons color={colors.primary} name="folder-open-outline" size={22} />
            <Text numberOfLines={2} style={styles.collectionTitle}>{collection.name}</Text>
            <Text style={styles.collectionCount}>{collection.count} saved item{collection.count === 1 ? "" : "s"}</Text>
          </View>
        ))}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && payload.favorites.length === 0 ? (
        <EmptyState
          title="Nothing saved yet."
          body="Tap the hearts on vendors, parties, and services to build your planning board."
        />
      ) : null}

      {sections.map((section) => {
        const items = payload.favorites.filter((item) => item.targetType === section.type);
        if (!items.length) return null;
        return (
          <View key={section.type} style={styles.savedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              <Text style={styles.sectionCount}>{items.length} saved</Text>
            </View>
            {items.map((item) => (
              <SavedCard item={item} key={item.id} onOpen={openFavorite} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SavedCard({ item, onOpen }: { item: FavoriteItem; onOpen: (item: FavoriteItem) => void }) {
  const { isBusy, toggle } = useFavorites();
  const busy = isBusy(item.targetType, item.targetId);

  async function remove(event: GestureResponderEvent) {
    event.stopPropagation();
    try {
      await toggle(item.targetType, item.targetId);
    } catch (reason) {
      Alert.alert("Favorites unavailable", reason instanceof Error ? reason.message : "Please try again.");
    }
  }

  return (
    <Pressable onPress={() => onOpen(item)} style={styles.savedCard}>
      <View style={styles.savedImageWrap}>
        <Image alt={item.title} source={{ uri: absoluteImageUrl(item.image) ?? undefined }} style={styles.savedImage} />
        <View style={styles.favoritePosition}>
          <FavoriteButton targetId={item.targetId} targetType={item.targetType} />
        </View>
      </View>
      <View style={styles.savedBody}>
        <Text style={styles.savedEyebrow}>{item.eyebrow}</Text>
        <Text numberOfLines={1} style={styles.savedTitle}>{item.title}</Text>
        <Text numberOfLines={1} style={styles.savedMeta}>{item.meta}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={remove}
          style={styles.removeButton}
        >
          {busy ? <ActivityIndicator color={colors.foreground} size="small" /> : (
            <Text style={styles.removeButtonText}>Remove from favorites</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  signedOutContainer: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.lg,
    padding: screen.horizontal
  },
  signedOutCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 32,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl
  },
  signedOutTitle: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: "700"
  },
  signedOutBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center"
  },
  hero: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 32,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  eyebrowRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderColor: "rgba(230, 175, 173, 0.22)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  heading: {
    color: colors.foreground,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.7,
    lineHeight: 39
  },
  heroBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 23
  },
  collectionForm: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.82)",
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  formLabel: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "700"
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.sm
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    flex: 1,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  createButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  createButtonText: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: "800"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 20,
    fontWeight: "700"
  },
  sectionCount: {
    color: colors.mutedForeground,
    fontSize: 13
  },
  collectionsRow: {
    gap: spacing.sm,
    paddingRight: screen.horizontal
  },
  collectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.86)",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 132,
    padding: spacing.md,
    width: 164
  },
  collectionTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "700"
  },
  collectionCount: {
    color: colors.mutedForeground,
    fontSize: 12
  },
  savedSection: {
    gap: spacing.md
  },
  savedCard: {
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16
  },
  savedImageWrap: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.muted
  },
  savedImage: {
    height: "100%",
    width: "100%"
  },
  favoritePosition: {
    position: "absolute",
    right: spacing.md,
    top: spacing.md
  },
  savedBody: {
    gap: spacing.xs,
    padding: spacing.md
  },
  savedEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  savedTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.xs
  },
  savedMeta: {
    color: colors.mutedForeground,
    fontSize: 13
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    minHeight: 40,
    justifyContent: "center"
  },
  removeButtonText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 48,
    minWidth: 110,
    paddingHorizontal: spacing.lg
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "800"
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700"
  }
});
