import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type {
  RankedDiscoveryItem,
  DiscoveryPayload,
} from "../lib/edition/discovery";
import {
  selectExperiences,
  type ExperienceCard,
} from "../lib/edition/experiences";
import { paper, press } from "../lib/edition/newspaperTheme";

type Props = {
  items: RankedDiscoveryItem[];
  discovery?: DiscoveryPayload | null;
  locationCity?: string | null;
  onOpenItem?: (item: RankedDiscoveryItem) => void;
};

/**
 * Experiences — Condé Nast Traveler–inspired destination storytelling.
 * Cinematic photography, narrative serif headlines, stacked story packages.
 * Kindred paper tokens only — no CNT branding. No cards, shadows, or chrome.
 */
export function ExperiencesSection({
  items,
  discovery,
  locationCity,
  onOpenItem,
}: Props) {
  const { width } = useWindowDimensions();
  const pageW = width - 56;
  const halfGap = 14;
  const colInner = Math.floor(
    (pageW - halfGap * 2 - StyleSheet.hairlineWidth) / 2
  );
  /** CNT-style cinematic lead — landscape, image-dominant. */
  const featureH = Math.round(pageW * 0.68);
  /** Full-bleed stacked stories — still landscape, slightly shorter. */
  const storyH = Math.round(pageW * 0.55);
  /** Closing pair — wide landscape, not portrait tiles. */
  const pairH = Math.round(colInner * 0.78);

  const { featured, stories, pair } = selectExperiences(items, {
    city: locationCity,
    maxStories: 2,
    discovery,
  });

  if (!featured) return null;

  const open = (card: ExperienceCard) => {
    onOpenItem?.(card.ranked);
  };

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>Experiences</Text>
        <View style={styles.labelRule} />
      </View>

      <Text style={styles.editorNote} maxFontSizeMultiplier={1.15}>
        Places worth leaving the house for — hand-picked for today.
      </Text>

      <StoryLead
        card={featured}
        photoH={featureH}
        onPress={onOpenItem ? () => open(featured) : undefined}
        featured
      />

      {stories.map((card) => (
        <View key={card.id}>
          <View style={styles.storyRule} />
          <StoryLead
            card={card}
            photoH={storyH}
            onPress={onOpenItem ? () => open(card) : undefined}
          />
        </View>
      ))}

      {pair.length > 0 ? (
        <>
          <View style={styles.storyRule} />
          <View style={styles.pairRow}>
            {pair.map((card, colIndex) => {
              const isLeft = colIndex === 0;
              return (
                <Pressable
                  key={card.id}
                  onPress={onOpenItem ? () => open(card) : undefined}
                  disabled={!onOpenItem}
                  accessibilityRole={onOpenItem ? "button" : "text"}
                  accessibilityLabel={a11yLabel(card)}
                  style={({ pressed }) => [
                    styles.pairCell,
                    isLeft ? styles.pairLeft : styles.pairRight,
                    onOpenItem && pressed && { opacity: press.opacity },
                  ]}
                >
                  <View style={styles.photoFrame}>
                    <Image
                      source={card.image}
                      style={{ width: "100%", height: pairH }}
                      resizeMode="cover"
                      accessibilityLabel={card.headline}
                    />
                  </View>
                  <View style={styles.pairCopy}>
                    <Text style={styles.rubric} maxFontSizeMultiplier={1.1}>
                      {card.category}
                    </Text>
                    <Text
                      style={styles.pairTitle}
                      numberOfLines={3}
                      maxFontSizeMultiplier={1.15}
                    >
                      {card.headline}
                    </Text>
                    {card.dek ? (
                      <Text
                        style={styles.pairDek}
                        numberOfLines={3}
                        maxFontSizeMultiplier={1.15}
                      >
                        {card.dek}
                      </Text>
                    ) : null}
                    {card.location ? (
                      <Text
                        style={styles.location}
                        numberOfLines={1}
                        maxFontSizeMultiplier={1.1}
                      >
                        {card.location}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {pair.length === 1 ? <View style={styles.pairCell} /> : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

function a11yLabel(card: ExperienceCard): string {
  return [card.category, card.headline, card.dek, card.location]
    .filter(Boolean)
    .join(". ");
}

function StoryLead({
  card,
  photoH,
  onPress,
  featured = false,
}: {
  card: ExperienceCard;
  photoH: number;
  onPress?: () => void;
  featured?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={a11yLabel(card)}
      style={({ pressed }) => [
        styles.story,
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

      <View style={styles.storyCopy}>
        <Text style={styles.rubric} maxFontSizeMultiplier={1.1}>
          {card.category}
        </Text>
        <Text
          style={featured ? styles.featureTitle : styles.storyTitle}
          numberOfLines={featured ? 4 : 3}
          maxFontSizeMultiplier={1.15}
        >
          {card.headline}
        </Text>
        {card.dek ? (
          <Text
            style={featured ? styles.featureDek : styles.storyDek}
            numberOfLines={featured ? 4 : 3}
            maxFontSizeMultiplier={1.15}
          >
            {card.dek}
          </Text>
        ) : null}
        {card.location ? (
          <Text style={styles.location} maxFontSizeMultiplier={1.1}>
            {card.location}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 52,
    paddingBottom: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  editorNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 28,
  },
  story: {
    marginBottom: 0,
  },
  photoFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    width: "100%",
  },
  storyCopy: {
    paddingTop: 22,
    paddingBottom: 8,
  },
  storyRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginTop: 36,
    marginBottom: 36,
  },
  rubric: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 12,
  },
  featureTitle: {
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "600",
    letterSpacing: -0.55,
    color: paper.ink,
    marginBottom: 14,
  },
  storyTitle: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.35,
    color: paper.ink,
    marginBottom: 12,
  },
  featureDek: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 26,
    color: paper.inkBody,
    marginBottom: 16,
  },
  storyDek: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    color: paper.inkBody,
    marginBottom: 14,
  },
  location: {
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: paper.inkMuted,
  },
  pairRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  pairCell: {
    flex: 1,
    minWidth: 0,
  },
  pairLeft: {
    paddingRight: 14,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: paper.inkRule,
  },
  pairRight: {
    paddingLeft: 14,
  },
  pairCopy: {
    paddingTop: 16,
  },
  pairTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: -0.25,
    color: paper.ink,
    marginBottom: 10,
  },
  pairDek: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkBody,
    marginBottom: 12,
  },
});
