import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import type { EditionSection } from "../lib/edition/types";
import type { HistoricalImageAsset } from "../lib/edition/knowledgeGrounding";
import {
  parseStoryOfSourceNote,
  storyOfCardIntro,
  storyOfTitle,
} from "../lib/edition/storyOf";
import {
  logStoryOfImageEvent,
  nextStoryOfImageFallback,
  resolveStoryOfCityImage,
  STORY_OF_CARD_ASPECT_RATIO,
  type ResolvedStoryOfImage,
} from "../lib/edition/storyOfImage";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type Props = {
  section: EditionSection;
  cityName?: string | null;
  /** @deprecated Resolved from section.source_note — kept for call-site compat. */
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
  subtitle,
  onOpen,
}: Props) {
  const preview = storyOfCardIntro(section.body);
  const title =
    section.headline?.trim() ||
    storyOfTitle(cityName ?? "");
  const resolvedSubtitle =
    subtitle?.trim() ||
    storyOfSubtitleFromSection(section) ||
    null;

  const metroKey = parseStoryOfSourceNote(section.source_note)?.metroKey ?? null;

  const initialImage = useMemo(
    () =>
      resolveStoryOfCityImage({
        sourceNote: section.source_note,
        metroKey,
      }),
    [section.source_note, metroKey]
  );

  const [displayImage, setDisplayImage] = useState<ResolvedStoryOfImage | null>(
    initialImage
  );

  useEffect(() => {
    setDisplayImage(initialImage);
  }, [initialImage]);

  function handleImageError() {
    const failedUrl = displayImage?.resolvedUrl ?? displayImage?.url ?? null;
    logStoryOfImageEvent("load_error", {
      sectionType: "story_of",
      originalUrl: displayImage?.originalUrl ?? failedUrl,
      resolvedUrl: failedUrl,
      metroKey,
      fallbackLevel: displayImage?.fallbackLevel ?? null,
    });

    if (!failedUrl) {
      setDisplayImage(null);
      return;
    }

    const next = nextStoryOfImageFallback({
      sourceNote: section.source_note,
      metroKey,
      failedUrl,
    });
    if (next) {
      logStoryOfImageEvent("resolve", {
        sectionType: "story_of",
        originalUrl: displayImage?.originalUrl ?? failedUrl,
        resolvedUrl: next.resolvedUrl,
        fallbackLevel: next.fallbackLevel,
        metroKey,
        reason: "homepage_load_error",
      });
      setDisplayImage(next);
      return;
    }

    setDisplayImage(null);
  }

  function handleImageLoad() {
    if (!displayImage) return;
    logStoryOfImageEvent("load_success", {
      sectionType: "story_of",
      originalUrl: displayImage.originalUrl,
      resolvedUrl: displayImage.resolvedUrl,
      fallbackLevel: displayImage.fallbackLevel,
      metroKey,
    });
  }

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
        {displayImage ? (
          <View style={styles.imageWrap}>
            <Image
              key={displayImage.resolvedUrl}
              source={{ uri: displayImage.resolvedUrl }}
              style={styles.image}
              resizeMode="cover"
              accessibilityLabel={displayImage.caption || title}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
            {displayImage.credit ? (
              <Text style={styles.imageCredit} numberOfLines={2}>
                {displayImage.credit}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.imagePlaceholder} accessibilityLabel="Historic photograph unavailable">
            <Text style={styles.placeholderLabel}>Historic photograph</Text>
          </View>
        )}

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
    marginBottom: 28,
    paddingBottom: 28,
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
    overflow: "hidden",
    borderRadius: 2,
  },
  image: {
    width: "100%",
    aspectRatio: STORY_OF_CARD_ASPECT_RATIO,
    backgroundColor: paper.creamDeep,
  },
  imagePlaceholder: {
    width: "100%",
    height: 72,
    marginBottom: 16,
    borderRadius: 2,
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderLabel: {
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: paper.inkFaint,
    fontFamily: "Georgia",
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
