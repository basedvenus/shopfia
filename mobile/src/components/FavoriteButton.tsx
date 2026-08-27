import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, GestureResponderEvent, Pressable, StyleSheet } from "react-native";
import { useFavorites } from "../api/favorites";
import { colors } from "../theme";
import type { FavoriteTargetType } from "../types/shopfia";

export function FavoriteButton({ targetId, targetType }: { targetId: string; targetType: FavoriteTargetType }) {
  const { isBusy, isSaved, toggle } = useFavorites();
  const saved = isSaved(targetType, targetId);
  const busy = isBusy(targetType, targetId);

  async function onPress(event: GestureResponderEvent) {
    event.stopPropagation();
    try {
      await toggle(targetType, targetId);
    } catch (reason) {
      Alert.alert(
        reason instanceof Error && reason.message.includes("Sign in") ? "Sign in to save" : "Favorites unavailable",
        reason instanceof Error ? reason.message : "Please try again."
      );
    }
  }

  return (
    <Pressable
      accessibilityLabel={saved ? "Remove from favorites" : "Save to favorites"}
      accessibilityRole="button"
      accessibilityState={{ busy, checked: saved }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {busy ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <Ionicons color={saved ? colors.primary : colors.foreground} name={saved ? "heart" : "heart-outline"} size={19} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderColor: "rgba(255, 255, 255, 0.78)",
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    shadowColor: colors.foreground,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    width: 36
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.96 }]
  }
});
