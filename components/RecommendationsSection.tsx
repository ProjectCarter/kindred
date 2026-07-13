import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import {
  recommendationOpenerImage,
  selectRecommendations,
  type RecommendationCard,
} from "../lib/edition/recommendations";
import { paper, press } from "../lib/edition/newspaperTheme";

type Props = {
  items: RankedDiscoveryItem[];
  onOpenItem?: (item: RankedDiscoveryItem) => void;
};

/**
 * Recommendations — Kindred’s calm editorial voice.
 * Kinfolk taught the white space and intimacy; this is Bandit’s desk:
 * a few hand-picked suggestions meant to improve someone’s day.
 * No link lists, no chrome — each pick is one quiet, fully tappable story.
 */
export function RecommendationsSection({ items, onOpenItem }: Props) {
  const { width } = useWindowDimensions();
  const pageW = width - 56;
  const openerH = Math.round(pageW * 0.52);
  const picks = selectRecommendations(items, { max: 5 });

  if (!picks.length) return null;

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
            From the desk
          </Text>
          <View style={styles.labelRule} />
        </View>

        <Text style={styles.headline} maxFontSizeMultiplier={1.2}>
          Recommendations
        </Text>

      <Text style={styles.intro} maxFontSizeMultiplier={1.2}>
        A few things I think you’ll enjoy today — chosen quietly, not loudly.
      </Text>
      </View>

      <View style={styles.openerFrame}>
        <Image
          source={recommendationOpenerImage()}
          style={{ width: "100%", height: openerH }}
          resizeMode="cover"
          accessibilityLabel="Morning light — from the desk"
        />
      </View>

      <View style={styles.list}>
        {picks.map((card, index) => (
          <RecommendationRow
            key={card.id}
            card={card}
            isLast={index === picks.length - 1}
            onPress={onOpenItem ? () => onOpenItem(card.ranked) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

function RecommendationRow({
  card,
  isLast,
  onPress,
}: {
  card: RecommendationCard;
  isLast: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[card.category, card.headline, card.note]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowRule,
        onPress && pressed && { opacity: press.opacity },
      ]}
    >
      <Text style={styles.rubric} maxFontSizeMultiplier={1.1}>
        {card.category}
      </Text>
      <Text
        style={styles.title}
        numberOfLines={3}
        maxFontSizeMultiplier={1.2}
      >
        {card.headline}
      </Text>
      <Text style={styles.note} numberOfLines={4} maxFontSizeMultiplier={1.2}>
        {card.note}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
    marginBottom: 56,
    paddingTop: 8,
    paddingBottom: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  header: {
    marginBottom: 0,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.8,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 0,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: paper.ink,
    marginBottom: 16,
  },
  intro: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 32,
    maxWidth: 420,
  },
  openerFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    width: "100%",
    marginBottom: 44,
  },
  list: {
    gap: 0,
  },
  row: {
    paddingTop: 8,
    paddingBottom: 36,
  },
  rowRule: {
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  rubric: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 14,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: paper.ink,
    marginBottom: 14,
  },
  note: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
  },
});
