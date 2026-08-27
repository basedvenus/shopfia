import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMessages, openWebsitePath } from "../api/client";
import { useAuth } from "../api/auth";
import { EmptyState } from "../components/EmptyState";
import { ShopFiaLogo } from "../components/ShopFiaLogo";
import { colors, radii, screen, spacing } from "../theme";
import type { MessagesPayload } from "../types/shopfia";

export function MessagesScreen() {
  const { cookie, session } = useAuth();
  const [data, setData] = useState<MessagesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMessages(cookie);
      setData(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, [cookie, session?.user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session?.user) {
    return (
      <View style={styles.container}>
        <ShopFiaLogo />
        <EmptyState title="Sign in for messages" body="Your ShopFia conversations and quote updates use the same protected backend as the website." />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ShopFiaLogo />
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Messages</Text>
        <Pressable onPress={load} style={styles.refreshButton}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="Messages unavailable" body={error} /> : null}
      {!error && data?.conversations.length === 0 ? (
        <EmptyState title="No conversations yet" body="Start from a vendor storefront or offering to begin a quote conversation." />
      ) : null}
      {data?.conversations.map((conversation) => {
        const lastMessage = conversation.messages?.[conversation.messages.length - 1];
        return (
          <Pressable
            key={conversation.id}
            onPress={() => openWebsitePath(`/messages?conversationId=${conversation.id}`)}
            style={styles.messageCard}
          >
            <Text style={styles.messageTitle} numberOfLines={1}>
              {conversation.vendorProfile?.name ?? conversation.vendor?.name ?? conversation.buyer?.name ?? "ShopFia conversation"}
            </Text>
            <Text style={styles.messageBody} numberOfLines={2}>
              {lastMessage?.body ?? "Open this conversation for quote details and checkout updates."}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: spacing.md,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  heading: {
    color: colors.foreground,
    fontSize: 25,
    fontWeight: "900"
  },
  refreshButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  refreshText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800"
  },
  messageCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  messageTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "900"
  },
  messageBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20
  }
});
