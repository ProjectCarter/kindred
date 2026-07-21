import { useEffect } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { HistoryAroundTownCard } from "../lib/edition/historyAroundTown/types";
import { trackSectionViewedOnce } from "../lib/analytics";
import { paper, press, space } from "../lib/edition/newspaperTheme";

type Props = {
  cards: HistoryAroundTownCard[];
  subtitle?: string | null;
  onOpenPlace?: (card: HistoryAroundTownCard) => void;
  onSeeAll?: () => void;
  seeAllTotal?: number;
};

/** History Around Town — final calm discovery at the end of the paper. */
export function HistoryAroundTownSection({
  cards,
  subtitle,
  onOpenPlace,
  onSeeAll,
  seeAllTotal,
}: Props) {
  const { width: screenW } = useWindowDimensions();

  useEffect(() => {
    if (cards.length > 0) {
      trackSectionViewedOnce("history_around_town");
    }
  }, [cards.length]);

  if (!cards.length) return null;

  const folioGutter = space.folioGutter;
  const gap = 14;
  const cardW = Math.round(screenW * 0.76);
  const photoH = Math.round(cardW * 0.68);
  const sidePad = Math.round((screenW - cardW) / 2);
  const snap = cardW + gap;

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
            History Around Town
          </Text>
          <View style={styles.labelRule} />
        </View>
        {subtitle?.trim() ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.12}>
            {subtitle.trim()}
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snap}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        bounces
        overScrollMode="never"
        style={styles.scroller}
        contentContainerStyle={{
          paddingLeft: sidePad - folioGutter,
          paddingRight: sidePad - folioGutter,
          paddingVertical: 4,
        }}
        accessibilityLabel="History Around Town carousel"
      >
        {cards.map((card, index) => (
          <HistoryPlaceCard
            key={card.id}
            card={card}
            width={cardW}
            photoH={photoH}
            marginRight={index < cards.length - 1 ? gap : 0}
            onPress={onOpenPlace ? () => onOpenPlace(card) : undefined}
          />
        ))}
      </ScrollView>

      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [styles.seeAllRow, pressed && { opacity: press.opacity }]}
          accessibilityRole="button"
          accessibilityLabel="See all History Around Town places"
        >
          <Text style={styles.seeAll}>
            See all {seeAllTotal ?? cards.length} places →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HistoryPlaceCard({
  card,
  width,
  photoH,
  marginRight,
  onPress,
}: {
  card: HistoryAroundTownCard;
  width: number;
  photoH: number;
  marginRight: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={[card.categoryLabel, card.placeName, card.teaser]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.card,
        { width, marginRight },
        onPress && pressed && { opacity: press.opacity },
      ]}
    >
      <View style={styles.photoFrame}>
        {card.imageUrl ? (
          <Image
            source={{ uri: card.imageUrl }}
            style={{ width: "100%", height: photoH }}
            resizeMode="cover"
            accessibilityLabel={card.placeName}
          />
        ) : (
          <View style={[styles.photoFallback, { height: photoH }]} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={styles.rubric} maxFontSizeMultiplier={1.1}>
          {card.categoryLabel}
        </Text>
        <Text style={styles.headline} numberOfLines={3} maxFontSizeMultiplier={1.15}>
          {card.placeName}
        </Text>
        {card.historicalMetadataLine ? (
          <Text style={styles.metadata} maxFontSizeMultiplier={1.12}>
            {card.historicalMetadataLine}
          </Text>
        ) : null}
        <Text style={styles.teaser} numberOfLines={3} maxFontSizeMultiplier={1.15}>
          {card.teaser}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 56,
    paddingBottom: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  header: {
    marginBottom: 26,
    paddingRight: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 340,
  },
  scroller: {
    marginHorizontal: -space.folioGutter,
  },
  card: {
    backgroundColor: paper.creamWash,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    borderRadius: 10,
    overflow: "hidden",
    paddingBottom: 20,
  },
  photoFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    width: "100%",
  },
  photoFallback: {
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
  },
  copy: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  rubric: {
    fontSize: 10,
    letterSpacing: 1.9,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 12,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: paper.ink,
    marginBottom: 8,
  },
  metadata: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    color: paper.terracottaSoft,
    marginBottom: 10,
  },
  teaser: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkBody,
  },
  seeAllRow: {
    paddingTop: 18,
  },
  seeAll: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.terracotta,
    fontWeight: "600",
  },
});
