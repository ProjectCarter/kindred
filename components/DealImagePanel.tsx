import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { paper } from "../lib/edition/newspaperTheme";
import { dealCategory, type LocalDeal } from "../lib/deals/localDeals";

type Props = {
  deal: LocalDeal;
  /** Panel height — larger on the detail hero, smaller on See All cards. */
  height: number;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Deal imagery — shown only after the reader enters the Local Deals section.
 *
 * When a merchant provides authorized photography (`deal.imageUrl`), it is shown
 * edge to edge. Until then we render a calm, branded panel — the category accent
 * with the deal's editorial emoji and merchant name — rather than a stock or
 * AI-generated photo. This keeps the See All and detail pages visual and premium
 * without fabricating an image of a real place.
 */
export function DealImagePanel({ deal, height, rounded = true, style }: Props) {
  const category = dealCategory(deal.category);
  const radius = rounded ? styles.rounded : null;

  if (deal.imageUrl?.trim()) {
    return (
      <Image
        source={{ uri: deal.imageUrl }}
        style={[styles.image, radius, { height }, style] as StyleProp<ImageStyle>}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        accessibilityLabel={`${deal.merchant} — ${deal.title}`}
      />
    );
  }

  return (
    <View
      style={[styles.panel, radius, { height, backgroundColor: category.accent }, style]}
      accessible
      accessibilityLabel={`${category.title} deal from ${deal.merchant}`}
    >
      <Text style={styles.emoji} allowFontScaling={false}>
        {deal.emoji}
      </Text>
      <Text style={styles.merchant} numberOfLines={1}>
        {deal.merchant}
      </Text>
      <View style={styles.categoryPill}>
        <Text style={styles.categoryText}>
          {category.emoji}  {category.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rounded: {
    borderRadius: 18,
  },
  image: {
    width: "100%",
    backgroundColor: paper.creamDeep,
  },
  panel: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 20,
  },
  emoji: {
    fontSize: 52,
    lineHeight: 60,
    marginBottom: 10,
  },
  merchant: {
    fontFamily: "Georgia",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    textAlign: "center",
    maxWidth: "90%",
  },
  categoryPill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FFFFFFB0",
  },
  categoryText: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.ink,
  },
});
