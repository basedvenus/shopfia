import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, spacing } from "../theme";

type PillProps = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
};

export function Pill({ label, onPress, selected = false }: PillProps) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, selected && styles.selected]}>
      <Text style={[styles.text, selected && styles.selectedText]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    maxWidth: 190,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  text: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "700"
  },
  selectedText: {
    color: colors.primaryForeground
  }
});
