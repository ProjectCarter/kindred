import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import type { SFSymbol } from "expo-symbols";
import {
  eventInfoBadgeAccessibilitySummary,
  type EventInfoBadgeId,
} from "../lib/edition/eventBadges";
import { paper } from "../lib/edition/newspaperTheme";

type BadgeDef = {
  label: string;
  symbol: SFSymbol;
  ion: keyof typeof Ionicons.glyphMap;
  /** Terracotta icon — used sparingly for high-signal utility. */
  accent?: boolean;
};

const BADGE_DEFS: Record<EventInfoBadgeId, BadgeDef> = {
  free: {
    label: "Free",
    symbol: "tag.fill",
    ion: "pricetag-outline",
    accent: true,
  },
  free_parking: {
    label: "Free Parking",
    symbol: "parkingsign.circle",
    ion: "car-outline",
  },
  tickets_required: {
    label: "Tickets Required",
    symbol: "ticket",
    ion: "ticket-outline",
  },
  dog_friendly: {
    label: "Dog Friendly",
    symbol: "pawprint",
    ion: "paw-outline",
  },
  food_drinks: {
    label: "Food & Drinks",
    symbol: "fork.knife",
    ion: "restaurant-outline",
  },
  live_music: {
    label: "Live Music",
    symbol: "music.note",
    ion: "musical-notes-outline",
  },
};

type Props = {
  badges: EventInfoBadgeId[];
  style?: StyleProp<ViewStyle>;
};

function EventInfoBadge({ id }: { id: EventInfoBadgeId }) {
  const def = BADGE_DEFS[id];
  const tint = def.accent ? paper.terracotta : paper.inkMuted;

  return (
    <View style={styles.chip} accessible={false} importantForAccessibility="no">
      <SymbolView
        name={def.symbol}
        size={10}
        weight="medium"
        tintColor={tint}
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no"
        fallback={<Ionicons name={def.ion} size={10} color={tint} />}
      />
      <Text
        style={[styles.label, def.accent && styles.labelAccent]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
        accessible={false}
      >
        {def.label}
      </Text>
    </View>
  );
}

/**
 * One horizontal row of utility badges — Apple Wallet / Calendar density.
 * Renders nothing when there are no badges (no empty space reserved).
 */
export function EventInfoBadgeRow({ badges, style }: Props) {
  if (!badges.length) return null;

  const summary = eventInfoBadgeAccessibilitySummary(badges);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.row, style]}
      contentContainerStyle={styles.rowContent}
      accessible
      accessibilityRole="text"
      accessibilityLabel={summary}
    >
      {badges.map((id) => (
        <EventInfoBadge key={id} id={id} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexGrow: 0,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    backgroundColor: paper.creamWash,
    maxHeight: 22,
  },
  icon: {
    width: 10,
    height: 10,
  },
  label: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.15,
    fontWeight: "500",
    color: paper.inkMuted,
  },
  labelAccent: {
    color: paper.terracotta,
  },
});
