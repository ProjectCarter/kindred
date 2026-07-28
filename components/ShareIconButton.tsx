import {
  Pressable,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { paper, press } from "../lib/edition/newspaperTheme";

/**
 * The one Kindred Share action.
 *
 * Renders the standard share glyph in the app's gold/orange accent
 * (`paper.terracotta`) — the same tone as every primary action (Google Maps,
 * Learn More, See all, Back to Homepage). Defining the icon and color once here
 * means every detail page (Events, Activities, Food & Drinks, Deals,
 * Masterpiece, Story of Your City, Today in History, History Around Town, and
 * any future screen) shares through the same component, so Share always reads as
 * an action and stays visually consistent app-wide.
 *
 * Callers keep their own container geometry via `style` — only the glyph and its
 * accent color are standardized here.
 */
export const SHARE_ACTION_COLOR = paper.terracotta;

export function ShareIconButton({
  onPress,
  size = 20,
  accessibilityLabel = "Share",
  style,
}: {
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [style, pressed && { opacity: press.opacity }]}
    >
      <SymbolView
        name="square.and.arrow.up"
        size={size}
        weight="regular"
        tintColor={SHARE_ACTION_COLOR}
        accessibilityElementsHidden
        importantForAccessibility="no"
        fallback={
          <Ionicons name="share-outline" size={size} color={SHARE_ACTION_COLOR} />
        }
      />
    </Pressable>
  );
}
