import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type {
  DiscoveryPayload,
  RankedDiscoveryItem,
} from "../lib/edition/discovery";
import {
  notebookIntro,
  selectNotebookCards,
  type NotebookCard,
} from "../lib/edition/notebook";
import { paper, press, space } from "../lib/edition/newspaperTheme";

type Props = {
  items: RankedDiscoveryItem[];
  discovery?: DiscoveryPayload | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
};

/**
 * Bandit’s Notebook — calm reward at the end of the paper.
 * Horizontal snap + peek from Apple’s “In the Loop” lesson;
 * stationery cards and notebook voice are Kindred’s.
 *
 * No autoplay, indicators, infinite loop, or shadows.
 */
export function BanditsNotebook({ items, discovery, onOpenItem }: Props) {
  const { width: screenW } = useWindowDimensions();
  const cards = selectNotebookCards(items, { discovery, max: 6 });

  if (!cards.length) return null;

  const folioGutter = space.folioGutter;
  const gap = 14;
  /** ~76–78% so neighbors tempt the next swipe. */
  const cardW = Math.round(screenW * 0.76);
  const photoH = Math.round(cardW * 0.68);
  const sidePad = Math.round((screenW - cardW) / 2);
  const snap = cardW + gap;
  const intro = notebookIntro(cards);

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.header}>
        <Text style={styles.kicker} maxFontSizeMultiplier={1.1}>
          🐶 Bandit’s Notebook
        </Text>
        <Text style={styles.intro} maxFontSizeMultiplier={1.15}>
          {intro}
        </Text>
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
        accessibilityLabel="Bandit’s Notebook carousel"
      >
        {cards.map((card, index) => (
          <NotebookPage
            key={card.id}
            card={card}
            width={cardW}
            photoH={photoH}
            marginRight={index < cards.length - 1 ? gap : 0}
            onPress={onOpenItem ? () => onOpenItem(card.ranked) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function NotebookPage({
  card,
  width,
  photoH,
  marginRight,
  onPress,
}: {
  card: NotebookCard;
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
      accessibilityLabel={[card.category, card.headline, card.note]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.card,
        { width, marginRight },
        onPress && pressed && { opacity: press.opacity },
      ]}
    >
      <View style={styles.photoFrame}>
        <Image
          source={card.image}
          style={{ width: "100%", height: photoH }}
          resizeMode="cover"
          accessibilityLabel={card.headline}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rubric} maxFontSizeMultiplier={1.1}>
          {card.category}
        </Text>
        <Text
          style={styles.headline}
          numberOfLines={3}
          maxFontSizeMultiplier={1.15}
        >
          {card.headline}
        </Text>
        <Text style={styles.note} numberOfLines={3} maxFontSizeMultiplier={1.15}>
          {card.note}
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
  kicker: {
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 14,
  },
  intro: {
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
    marginBottom: 12,
  },
  note: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkBody,
  },
});
