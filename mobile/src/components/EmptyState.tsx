import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radii, spacing } from "../theme";

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
    fontFamily: fonts.sans,
    fontSize: 16,
    fontWeight: "600"
  },
  body: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20
  }
});
