import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../theme";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    backgroundColor: "rgba(255, 255, 255, 0.74)",
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.lg
  },
  title: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "800"
  },
  body: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 20
  }
});
