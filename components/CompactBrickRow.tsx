import { Pressable, StyleSheet, Text, View } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";

/**
 * Shared homepage "brick" row — a compact, fixed-height horizontal listing used
 * by Local Events, Activities, Food & Drinks (and the Local Deals placeholder).
 *
 * Presentation only: a small rounded accent square on the left, a bold title,
 * and one concise secondary detail line. Long text truncates cleanly without
 * changing the row height. The entire row is a single tap target.
 */
export type CompactBrickRowProps = {
  title: string;
  /** One concise detail line beneath the title (city, category, price…). */
  secondary?: string | null;
  /** Editorial category emoji shown inside the accent square (optional). */
  icon?: string | null;
  /** Section accent color for the left rounded square. */
  accentColor: string;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Fixed row height — identical for every section so the stack reads evenly. */
export const COMPACT_ROW_HEIGHT = 68;
/** Consistent vertical spacing between stacked rows. */
export const COMPACT_ROW_GAP = 10;

export function CompactBrickRow({
  title,
  secondary,
  icon,
  accentColor,
  onPress,
  accessibilityLabel,
}: CompactBrickRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={
        accessibilityLabel ?? [title, secondary].filter(Boolean).join(". ")
      }
      style={({ pressed }) => [
        styles.row,
        onPress && pressed && { opacity: press.opacity },
      ]}
    >
      <View style={[styles.square, { backgroundColor: accentColor }]}>
        {icon ? (
          <Text style={styles.icon} allowFontScaling={false}>
            {icon}
          </Text>
        ) : null}
      </View>

      <View style={styles.copy}>
        <Text
          style={styles.title}
          numberOfLines={1}
          ellipsizeMode="tail"
          maxFontSizeMultiplier={1.15}
        >
          {title}
        </Text>
        {secondary ? (
          <Text
            style={styles.secondary}
            numberOfLines={1}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.1}
          >
            {secondary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    height: COMPACT_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    backgroundColor: "#FFFFFF",
  },
  square: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 20,
    lineHeight: 24,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
  },
  secondary: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    letterSpacing: 0.1,
    color: paper.inkMuted,
  },
});
