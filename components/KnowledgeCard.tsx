import { Text, View, StyleSheet } from "react-native";
import type { KnowledgeCard as KnowledgeCardData } from "../lib/edition/knowledgeCards";
import { paper, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  card: KnowledgeCardData;
};

/**
 * Knowledge Card — a calm desk gloss after the story.
 * Optional editorial context; never a chatbot or encyclopedia dump.
 */
export function KnowledgeCard({ card }: Props) {
  if (!card.body.trim()) return null;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${card.kicker}. ${card.title}. ${card.body}`}
    >
      <View style={styles.topRule} />
      <Text style={styles.kicker}>{card.kicker}</Text>
      <Text style={styles.title} maxFontSizeMultiplier={1.3}>
        {card.title}
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={1.35}>
        {card.body}
      </Text>
      {card.sourceName?.trim() ? (
        <Text style={styles.source} maxFontSizeMultiplier={1.2}>
          {card.sourceName.trim()}
        </Text>
      ) : null}
      <View style={styles.bottomRule} />
    </View>
  );
}

type ListProps = {
  cards: KnowledgeCardData[];
};

/**
 * Optional cluster of Knowledge Cards at the end of an article.
 * Renders nothing when the desk has no substantive glosses.
 */
export function KnowledgeCardList({ cards }: ListProps) {
  if (!cards.length) return null;

  return (
    <View style={styles.list} accessibilityRole="summary">
      <Text style={styles.heading}>In brief</Text>
      <View style={styles.headingRule} />
      <Text style={styles.intro} maxFontSizeMultiplier={1.25}>
        Quiet notes from the desk — so you needn’t leave the paper to understand
        a name or place.
      </Text>
      {cards.map((card, i) => (
        <KnowledgeCard key={`${card.kind}-${card.title}-${i}`} card={card} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: 12,
    marginBottom: 8,
  },
  heading: {
    ...type.kicker,
    color: paper.inkFaint,
    letterSpacing: 2,
    marginBottom: 12,
  },
  headingRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 14,
  },
  intro: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 20,
    maxWidth: 400,
  },
  wrap: {
    marginBottom: 28,
    backgroundColor: paper.creamWash,
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  topRule: {
    height: 2,
    width: 28,
    backgroundColor: paper.terracotta,
    marginBottom: 14,
    opacity: 0.85,
  },
  bottomRule: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 8,
    letterSpacing: 1.8,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  body: {
    ...reader.calloutBody,
    color: paper.inkBody,
  },
  source: {
    ...reader.credit,
    color: paper.inkFaint,
    marginTop: 12,
    textTransform: "uppercase",
  },
});
