import { useMemo, useState } from "react";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "./src/api/auth";
import { AccountScreen } from "./src/screens/AccountScreen";
import { BrowseScreen } from "./src/screens/BrowseScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { MarketplaceDetailScreen } from "./src/screens/MarketplaceDetailScreen";
import { MessagesScreen } from "./src/screens/MessagesScreen";
import { FavoritesProvider } from "./src/api/favorites";
import { colors, radii, spacing } from "./src/theme";
import type { Offering, Vendor } from "./src/types/shopfia";

type TabKey = "browse" | "favorites" | "messages" | "account";
type DetailTarget =
  | { kind: "vendor"; slug: string; name?: string }
  | { kind: "offering"; id: string; title?: string };

const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "browse", label: "Explore", icon: "map-outline" },
  { key: "favorites", label: "Favorites", icon: "heart-outline" },
  { key: "messages", label: "Messages", icon: "chatbubbles-outline" },
  { key: "account", label: "Account", icon: "person-circle-outline" }
];

function Shell() {
  const [activeTab, setActiveTab] = useState<TabKey>("browse");
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const { booting } = useAuth();

  function openVendor(vendor: Pick<Vendor, "name" | "slug">) {
    setActiveTab("browse");
    setDetailTarget({ kind: "vendor", name: vendor.name, slug: vendor.slug });
  }

  function openOffering(offering: Pick<Offering, "id" | "title">) {
    setActiveTab("browse");
    setDetailTarget({ kind: "offering", id: offering.id, title: offering.title });
  }

  const screen = useMemo(() => {
    if (detailTarget) {
      return (
        <MarketplaceDetailScreen
          onBack={() => setDetailTarget(null)}
          onOpenOffering={openOffering}
          onOpenVendor={openVendor}
          target={detailTarget}
        />
      );
    }
    if (activeTab === "messages") return <MessagesScreen />;
    if (activeTab === "favorites") {
      return (
        <FavoritesScreen
          onOpenAccount={() => setActiveTab("account")}
          onOpenOffering={openOffering}
          onOpenVendor={openVendor}
        />
      );
    }
    if (activeTab === "account") return <AccountScreen />;
    return <BrowseScreen onOpenOffering={openOffering} onOpenVendor={openVendor} />;
  }, [activeTab, detailTarget]);

  if (booting) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Opening ShopFia</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.shell}>
      <View style={styles.content}>{screen}</View>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = tab.key === activeTab;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => {
                setDetailTarget(null);
                setActiveTab(tab.key);
              }}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Ionicons
                color={selected ? colors.primaryForeground : colors.mutedForeground}
                name={tab.icon}
                size={21}
              />
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <FavoritesProvider>
          <Shell />
        </FavoritesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.background,
    flex: 1
  },
  content: {
    flex: 1
  },
  loading: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.sm,
    justifyContent: "center"
  },
  loadingText: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700"
  },
  tabBar: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  tab: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    gap: 3,
    minHeight: 54,
    justifyContent: "center"
  },
  tabSelected: {
    backgroundColor: colors.primary
  },
  tabText: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: "700"
  },
  tabTextSelected: {
    color: colors.primaryForeground
  }
});
