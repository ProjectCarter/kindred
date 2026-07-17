import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { EditionSection } from "../lib/edition/types";
import type { HistoricalImageAsset } from "../lib/edition/knowledgeGrounding";
import {
  parseStoryOfSourceNote,
  storyOfCardIntro,
  storyOfTitle,
} from "../lib/edition/storyOf";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";

type Props = {
  section: EditionSection;
  cityName?: string | null;
  image?: HistoricalImageAsset | null;
  subtitle?: string | null;
  onOpen?: () => void;
};

/**
 * The Story of [City Name] — permanent civic editorial desk.
 * Card order: historic photograph → title → subtitle → preview.
 */
export function StoryOfSection({
  section,
  cityName,
  image,
  subtitle,
  onOpen,
}: Props) {
  const preview = storyOfCardIntro(section.body);
  const imageUri = image?.url?.trim() || null;
  const title =
    section.headline?.trim() ||
    storyOfTitle(cityName ?? "");
  const resolvedSubtitle =
    subtitle?.trim() ||
    storyOfSubtitleFromSection(section) ||
    null;

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>History of Your City</Text>
        <View style={styles.rule} />
      </View>

      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : "text"}
        accessibilityLabel={`${title}. ${resolvedSubtitle ?? ""}. ${preview}`}
        style={({ pressed }) => [
          styles.card,
          onOpen && pressed && { opacity: press.opacity },
        ]}
      >
        {imageUri ? (
          <View style={styles.imageWrap}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={image?.caption || title}
            />
            {image?.credit ? (
              <Text style={styles.imageCredit} numberOfLines={2}>
                {image.credit}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.title} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>

        {resolvedSubtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.2}>
            {resolvedSubtitle}
          </Text>
        ) : null}

        {preview ? (
          <Text style={styles.preview} maxFontSizeMultiplier={1.2}>
            {preview}
          </Text>
        ) : null}

        {onOpen ? (
          <Text style={styles.continueReading}>Continue Reading</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

/** Resolve subtitle from source_note when not passed explicitly. */
export function storyOfSubtitleFromSection(section: EditionSection): string | null {
  return parseStoryOfSourceNote(section.source_note)?.subtitle?.trim() || null;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: space.sectionGap,
    paddingBottom: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  card: {
    alignSelf: "stretch",
  },
  imageWrap: {
    marginBottom: 16,
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: paper.creamDeep,
  },
  imageCredit: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 15,
    color: paper.inkFaint,
    fontFamily: "Georgia",
  },
  title: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 10,
  },
  subtitle: {
    ...type.folioDek,
    color: paper.inkBody,
    marginBottom: 14,
    maxWidth: 480,
    fontSize: 17,
    lineHeight: 26,
  },
  preview: {
    ...type.folioDek,
    color: paper.inkFaint,
    maxWidth: 480,
    marginBottom: 14,
  },
  continueReading: {
    fontSize: 13,
    letterSpacing: 0.4,
    fontWeight: "600",
    color: paper.terracotta,
    fontFamily: "Georgia",
  },
});
