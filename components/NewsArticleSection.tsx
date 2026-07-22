import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import { trackSectionViewedOnce } from "../lib/analytics";
import { EditorialTitle } from "./EditorialTitle";
import type { NewsArticleTeaser } from "../lib/edition/homepageNewsTeasers";

const NEWS_DESK_ICON = "📰";

type Props = {
  sectionLabel: string;
  articles: NewsArticleTeaser[];
  emptyCopy?: string;
  onOpenArticle?: (id: string) => void;
  analyticsSectionType?: string;
};

/**
 * Local + National News — editorial article teasers on the homepage folio.
 * Distinct from discovery listing grids: headline, attribution, teaser, read cue.
 */
export function NewsArticleSection({
  sectionLabel,
  articles,
  emptyCopy = "Nothing to report here today.",
  onOpenArticle,
  analyticsSectionType,
}: Props) {
  useEffect(() => {
    if (!analyticsSectionType || articles.length === 0) return;
    trackSectionViewedOnce(analyticsSectionType);
  }, [analyticsSectionType, articles.length]);

  if (articles.length === 0) {
    return null;
  }

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>{sectionLabel}</Text>
        <View style={styles.labelRule} />
      </View>

      {articles.map((article, index) => {
        const open = onOpenArticle ? () => onOpenArticle(article.id) : undefined;

        return (
          <Pressable
            key={article.id}
            onPress={open}
            disabled={!open}
            accessibilityRole={open ? "button" : "text"}
            accessibilityLabel={[
              article.headline,
              article.attribution,
              article.teaser,
              open ? "Read story" : null,
            ]
              .filter(Boolean)
              .join(". ")}
            style={({ pressed }) => [
              styles.article,
              index < articles.length - 1 && styles.articleRule,
              open && pressed && { opacity: press.opacity },
            ]}
          >
            <EditorialTitle
              icon={NEWS_DESK_ICON}
              title={article.headline}
              style={styles.headline}
              maxFontSizeMultiplier={1.2}
            />

            {article.attribution ? (
              <Text style={styles.attribution} maxFontSizeMultiplier={1.1}>
                {article.attribution}
              </Text>
            ) : null}

            {article.teaser ? (
              <Text style={styles.teaser} maxFontSizeMultiplier={1.15}>
                {article.teaser}
              </Text>
            ) : null}

            {open ? (
              <Text style={styles.readCue} maxFontSizeMultiplier={1.15}>
                Read Story →
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
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
  empty: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  article: {
    paddingBottom: 18,
  },
  articleRule: {
    marginBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.35,
    color: paper.ink,
    marginBottom: 8,
  },
  attribution: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.15,
    color: paper.inkMuted,
    marginBottom: 10,
  },
  teaser: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    color: paper.inkBody,
    marginBottom: 10,
  },
  readCue: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    letterSpacing: 0.15,
    color: paper.terracotta,
  },
});
