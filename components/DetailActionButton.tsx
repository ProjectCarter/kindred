import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";

/**
 * The one Kindred detail-page action button — the official design cloned from the
 * Local Deals page and used identically on every detail page (Events, Activities,
 * Food & Drinks, Local Deals). Full-width, rounded, 14pt corners.
 *
 * - `secondary` (default): outlined bronze — the Google Maps button and any
 *   "Learn More" / "Visit Website" / "View Menu" style link.
 * - `primary`: filled bronze — the section's main action (Buy Tickets, Redeem
 *   Deal). One per page at most, directly below Google Maps.
 *
 * Do not restyle per section. Only the label (and variant) changes.
 */
export function DetailActionButton({
  label,
  onPress,
  variant = "secondary",
  accessibilityLabel,
  accessibilityRole = "button",
}: {
  label: string;
  onPress: () => void;
  variant?: "secondary" | "primary";
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "link";
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        pressed && { opacity: press.opacity },
      ]}
    >
      <Text style={isPrimary ? styles.primaryText : styles.secondaryText}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Vertical stack for the standardized detail action buttons (12pt gap). */
export function DetailActionStack({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.stack, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  secondary: {
    paddingVertical: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.terracotta,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    color: paper.terracotta,
  },
  primary: {
    paddingVertical: 15,
    backgroundColor: paper.terracotta,
  },
  primaryText: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: "#FFFFFF",
  },
});
