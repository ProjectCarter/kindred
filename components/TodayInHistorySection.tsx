import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { EditionSection } from "../lib/edition/types";
import type { HistoricalImageAsset } from "../lib/edition/knowledgeGrounding";
import { historyCardIntro, historyHeadlineIncludesYear } from "../lib/edition/historyCard";
import { sectionIntro } from "../lib/edition/sectionIntro";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";

type Props = {
  section: EditionSection;
  historicalYear?: string | null;
  image?: HistoricalImageAsset | null;
  onOpen?: () => void;
};

/**
 * Dedicated Today in History homepage desk — photography when authentic,
 * editorial preview, and a clear path into the native article reader.
 */
export function TodayInHistorySection({
  section,
  historicalYear,
  image,
  onOpen,
}: Props) {
  const intro = sectionIntro("today_in_history");
  const preview = historyCardIntro(section.body);
  const imageUri = image?.url?.trim() || null;
  const showYearLine =
    Boolean(historicalYear) && !historyHeadlineIncludesYear(section.headline);

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>Today in History</Text>
        <View style={styles.rule} />
      </View>

      {intro ? (
        <Text style={styles.sectionIntro} maxFontSizeMultiplier={1.2}>
          {intro}
        </Text>
      ) : null}

      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : "text"}
        accessibilityLabel={`Today in History: ${section.headline}`}
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
              accessibilityLabel={image?.caption || section.headline}
            />
            {image?.credit ? (
              <Text style={styles.imageCredit} numberOfLines={2}>
                {image.credit}
              </Text>
            ) : null}
          </View>
        ) : null}

        {showYearLine ? (
          <Text style={styles.yearLine} maxFontSizeMultiplier={1.15}>
            {historicalYear}
          </Text>
        ) : null}

        <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
          {section.headline}
        </Text>

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
  sectionIntro: {
    ...type.sectionIntro,
    color: paper.inkFaint,
    marginBottom: 16,
    maxWidth: 400,
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
  yearLine: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.inkMuted,
    marginBottom: 10,
  },
  headline: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 12,
  },
  preview: {
    ...type.folioDek,
    color: paper.inkBody,
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
