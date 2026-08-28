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
import { absoluteImageUrl, getPartyDetail, openWebsitePath } from "../api/client";
import { useAuth } from "../api/auth";
import { EmptyState } from "../components/EmptyState";
import { FavoriteButton } from "../components/FavoriteButton";
import { colors, fonts, radii, screen, spacing } from "../theme";
import type { PartyDetail, PartyDetailPhoto, PartyDetailVendor, Vendor } from "../types/shopfia";

type PartyTarget = { id: string; slug: string; title?: string };

type PartyDetailScreenProps = {
  onBack: () => void;
  onOpenVendor: (vendor: Pick<Vendor, "name" | "slug">) => void;
  target: PartyTarget;
};

function formatPartyDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(new Date(value));
}

function initials(name: string | null, username: string | null) {
  return (name ?? username ?? "SF").slice(0, 2).toUpperCase();
}

function PartyImage({ label, photo, style }: { label: string; photo: PartyDetailPhoto; style: object }) {
  const uri = absoluteImageUrl(photo.url);
  return (
    <View style={[styles.photoFrame, style]}>
      {uri ? (
        <Image
          accessibilityLabel={label}
          alt={label}
          source={{ uri }}
          style={[
            styles.photo,
            {
              transform: [{ scale: photo.crop.zoom }],
              transformOrigin: `${photo.crop.x}% ${photo.crop.y}%`
            }
          ]}
        />
      ) : null}
    </View>
  );
}

function HostAvatar({ image, name, username }: { image: string | null; name: string | null; username: string | null }) {
  const uri = absoluteImageUrl(image);
  return (
    <View style={styles.avatar}>
      {uri ? <Image alt={name ?? username ?? "ShopFia host"} source={{ uri }} style={styles.avatarImage} /> : (
        <Text style={styles.avatarText}>{initials(name, username)}</Text>
      )}
    </View>
  );
}

function VendorCredit({
  onPress,
  vendor
}: {
  onPress: (vendor: PartyDetailVendor) => void;
  vendor: PartyDetailVendor;
}) {
  const image = absoluteImageUrl(vendor.logoUrl ?? vendor.coverPhoto);
  const location = [vendor.city, vendor.state].filter(Boolean).join(", ");

  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(vendor)} style={styles.vendorCard}>
      <View style={styles.vendorIdentity}>
        <View style={styles.vendorImageWrap}>
          {image ? <Image alt={`${vendor.name} logo`} source={{ uri: image }} style={styles.vendorImage} /> : (
            <Text style={styles.vendorInitials}>{initials(vendor.name, null)}</Text>
          )}
        </View>
        <View style={styles.vendorText}>
          <Text numberOfLines={1} style={styles.vendorName}>{vendor.name}</Text>
          <Text numberOfLines={1} style={styles.vendorCategory}>
            {vendor.categories[0] ?? "Event Vendor"}
          </Text>
          <Text numberOfLines={1} style={styles.vendorMeta}>
            {vendor.taggedPhotoCount > 0
              ? `${vendor.taggedPhotoCount} tagged photo${vendor.taggedPhotoCount === 1 ? "" : "s"}`
              : location || "Tagged on this party"}
          </Text>
        </View>
        <Ionicons color={colors.foreground} name="chevron-forward" size={18} />
      </View>
      <View style={styles.vendorFooter}>
        <Text style={styles.vendorLink}>View storefront</Text>
        {location ? <Text numberOfLines={1} style={styles.vendorLocation}>{location}</Text> : null}
      </View>
    </Pressable>
  );
}

function PartyContent({
  onOpenVendor,
  party
}: {
  onOpenVendor: PartyDetailScreenProps["onOpenVendor"];
  party: PartyDetail;
}) {
  const heroPhoto = party.photos[0];
  const hero = absoluteImageUrl(heroPhoto?.url ?? party.coverImageUrl);
  const hostName = party.host?.name ?? party.host?.username ?? "ShopFia host";
  const hostHandle = party.host?.username ? `@${party.host.username}` : null;

  return (
    <>
      <View style={styles.hero}>
        {hero ? (
          <Image
            accessibilityLabel={`${party.title} cover photo`}
            alt={`${party.title} cover photo`}
            source={{ uri: hero }}
            style={[
              styles.heroImage,
              heroPhoto ? {
                transform: [{ scale: heroPhoto.crop.zoom }],
                transformOrigin: `${heroPhoto.crop.x}% ${heroPhoto.crop.y}%`
              } : null
            ]}
          />
        ) : null}
        <View style={styles.heroShade} />
        <View style={styles.favoritePosition}>
          <FavoriteButton targetId={party.id} targetType="party" />
        </View>
        <View style={styles.heroContent}>
          <View style={styles.badgeRow}>
            <Text style={styles.heroBadge}>Party</Text>
            {party.theme ? <Text style={styles.heroBadge}>{party.theme}</Text> : null}
          </View>
          <Text style={styles.title}>{party.title}</Text>
          {party.description ? <Text style={styles.description}>{party.description}</Text> : null}
          <View style={styles.detailRow}>
            {party.location ? (
              <View style={styles.detailPill}>
                <Ionicons color="rgba(255,255,255,0.88)" name="location-outline" size={14} />
                <Text numberOfLines={1} style={styles.detailText}>{party.location}</Text>
              </View>
            ) : null}
            {party.eventDate ? (
              <View style={styles.detailPill}>
                <Ionicons color="rgba(255,255,255,0.88)" name="calendar-outline" size={14} />
                <Text style={styles.detailText}>{formatPartyDate(party.eventDate)}</Text>
              </View>
            ) : null}
          </View>
          {party.host ? (
            <View style={styles.hostRow}>
              <HostAvatar image={party.host.image} name={party.host.name} username={party.host.username} />
              <Text style={styles.hostText}>
                Posted by <Text style={styles.hostStrong}>{hostName}</Text>{hostHandle ? ` ${hostHandle}` : ""}
              </Text>
            </View>
          ) : null}
          {party.tags.length ? (
            <View style={styles.tagRow}>
              {party.tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}
            </View>
          ) : null}
        </View>
      </View>

      {party.collaborators.length > 1 ? (
        <View style={styles.hostCard}>
          <View style={styles.hostAvatarStack}>
            {party.collaborators.slice(0, 5).map((collaborator) => (
              <View key={collaborator.id} style={styles.stackedAvatar}>
                <HostAvatar
                  image={collaborator.user.image}
                  name={collaborator.user.name}
                  username={collaborator.user.username}
                />
              </View>
            ))}
          </View>
          <Text style={styles.hostedBy}>
            Hosted by {party.collaborators.slice(0, 2).map((item) => item.user.name ?? item.user.username ?? "ShopFia host").join(" and ")}
            {party.collaborators.length > 2 ? ` + ${party.collaborators.length - 2} others` : ""}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Party gallery</Text>
        <Text style={styles.sectionMeta}>{party.photos.length} photo{party.photos.length === 1 ? "" : "s"}</Text>
      </View>
      {party.photos.length ? (
        <View style={styles.gallery}>
          {party.photos.map((photo, index) => (
            <PartyImage
              key={photo.id}
              label={`${party.title} party photo ${index + 1}`}
              photo={photo}
              style={index === 0 ? styles.leadPhoto : styles.galleryPhoto}
            />
          ))}
        </View>
      ) : (
        <View style={styles.noPhotos}>
          <Ionicons color={colors.primary} name="images-outline" size={26} />
          <Text style={styles.noPhotosText}>Photos from this celebration are coming soon.</Text>
        </View>
      )}

      <View style={styles.vendorSection}>
        <Text style={styles.sectionTitle}>Featured Vendors</Text>
        <Text style={styles.sectionBody}>The creative team behind this celebration.</Text>
        <View style={styles.vendorList}>
          {party.vendors.length ? party.vendors.map((vendor) => (
            <VendorCredit key={vendor.id} onPress={(item) => onOpenVendor(item)} vendor={vendor} />
          )) : (
            <Text style={styles.emptyVendorText}>Featured vendors will appear here once this party has tagged credits.</Text>
          )}
        </View>
      </View>

      {party.partyfulUrl ? (
        <Pressable onPress={() => openWebsitePath(party.partyfulUrl!)} style={styles.partyfulButton}>
          <Ionicons color={colors.foreground} name="open-outline" size={17} />
          <Text style={styles.partyfulText}>Partyful invite</Text>
        </Pressable>
      ) : null}
    </>
  );
}

export function PartyDetailScreen({ onBack, onOpenVendor, target }: PartyDetailScreenProps) {
  const { cookie } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<PartyDetail | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await getPartyDetail(cookie, target.slug);
      setParty(result.data.party);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load party details.");
    } finally {
      setLoading(false);
    }
  }, [cookie, target.slug]);

  useEffect(() => {
    load();
  }, [load]);

  const body = useMemo(() => {
    if (loading && !party) {
      return <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>;
    }
    if (error) return <EmptyState title="Party unavailable" body={error} />;
    if (party) return <PartyContent onOpenVendor={onOpenVendor} party={party} />;
    return <EmptyState title="Party not found" body="This celebration may have moved or is no longer public." />;
  }, [error, loading, onOpenVendor, party]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading && Boolean(party)} onRefresh={load} tintColor={colors.primary} />}
    >
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back to Explore" accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
          <Ionicons color={colors.foreground} name="chevron-back" size={22} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>{target.title ?? "Party inspiration"}</Text>
        <View style={styles.iconPlaceholder} />
      </View>
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
  iconPlaceholder: { width: 42 },
  topTitle: {
    color: colors.foreground,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center"
  },
  hero: {
    aspectRatio: 0.78,
    backgroundColor: colors.muted,
    borderRadius: 32,
    overflow: "hidden",
    position: "relative"
  },
  heroImage: {
    height: "100%",
    position: "absolute",
    width: "100%"
  },
  heroShade: {
    backgroundColor: "rgba(20, 16, 14, 0.42)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  favoritePosition: { position: "absolute", right: spacing.md, top: spacing.md },
  heroContent: {
    bottom: 0,
    gap: spacing.sm,
    left: 0,
    padding: spacing.lg,
    position: "absolute",
    right: 0
  },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    color: "#fff",
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "500",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  title: {
    color: "#fff",
    fontFamily: fonts.sans,
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: -0.8,
    lineHeight: 39
  },
  description: {
    color: "rgba(255,255,255,0.86)",
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21
  },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  detailPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  detailText: { color: "rgba(255,255,255,0.88)", flexShrink: 1, fontFamily: fonts.sans, fontSize: 11 },
  hostRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(230,175,173,0.75)",
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36
  },
  avatarImage: { height: "100%", width: "100%" },
  avatarText: { color: "#fff", fontFamily: fonts.sans, fontSize: 11, fontWeight: "600" },
  hostText: { color: "rgba(255,255,255,0.84)", flex: 1, fontFamily: fonts.sans, fontSize: 12 },
  hostStrong: { color: "#fff", fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    color: "#fff",
    fontFamily: fonts.sans,
    fontSize: 11,
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  hostCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  hostAvatarStack: { flexDirection: "row", paddingRight: 18 },
  stackedAvatar: { marginRight: -18 },
  hostedBy: { color: colors.mutedForeground, flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18 },
  sectionHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  sectionTitle: { color: colors.foreground, fontFamily: fonts.sans, fontSize: 22, fontWeight: "600", letterSpacing: -0.4 },
  sectionMeta: { color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 12 },
  sectionBody: { color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoFrame: { backgroundColor: colors.muted, borderRadius: radii.lg, overflow: "hidden" },
  photo: { height: "100%", width: "100%" },
  leadPhoto: { aspectRatio: 1.05, width: "100%" },
  galleryPhoto: { aspectRatio: 0.9, flexBasis: "47%", flexGrow: 1 },
  noPhotos: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.xl
  },
  noPhotosText: { color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 13, textAlign: "center" },
  vendorSection: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 32,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  vendorList: { gap: spacing.sm, marginTop: spacing.sm },
  vendorCard: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderColor: "#eadbd7",
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md
  },
  vendorIdentity: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  vendorImageWrap: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderColor: "rgba(255,255,255,0.8)",
    borderRadius: 28,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    overflow: "hidden",
    width: 56
  },
  vendorImage: { height: "100%", width: "100%" },
  vendorInitials: { color: colors.primary, fontFamily: fonts.sans, fontSize: 14, fontWeight: "600" },
  vendorText: { flex: 1, gap: 2 },
  vendorName: { color: colors.foreground, fontFamily: fonts.sans, fontSize: 14, fontWeight: "600" },
  vendorCategory: { color: "rgba(169,104,103,0.9)", fontFamily: fonts.sans, fontSize: 12, fontWeight: "500" },
  vendorMeta: { color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 11 },
  vendorFooter: {
    alignItems: "center",
    borderTopColor: "#f1e2dd",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md
  },
  vendorLink: { color: colors.foreground, fontFamily: fonts.sans, fontSize: 12, fontWeight: "600" },
  vendorLocation: { color: colors.mutedForeground, flex: 1, fontFamily: fonts.sans, fontSize: 11, marginLeft: spacing.sm, textAlign: "right" },
  emptyVendorText: { color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 13, lineHeight: 20 },
  partyfulButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg
  },
  partyfulText: { color: colors.foreground, fontFamily: fonts.sans, fontSize: 14, fontWeight: "600" },
  loading: { alignItems: "center", padding: spacing.xl }
});
