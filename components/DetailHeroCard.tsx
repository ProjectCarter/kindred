import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { paper } from "../lib/edition/newspaperTheme";

/**
 * Kindred detail hero — the single visual identity for every detail page.
 *
 * A large rounded card in the section accent color carrying ONLY a large emoji,
 * the item title, and a small category pill. No photographs, no image
 * placeholders — the emoji and color are the identity. Per Kindred's detail
 * design law, this emoji must never be repeated elsewhere on the page.
 */
export function DetailHeroCard({
  emoji,
  title,
  categoryLabel,
  accent,
  style,
}: {
  emoji: string;
  title: string;
  categoryLabel: string;
  accent: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.hero, { backgroundColor: accent }, style]}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`${title}. ${categoryLabel}.`}
    >
      <Text style={styles.emoji} allowFontScaling={false}>
        {emoji}
      </Text>
      <Text style={styles.title} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      {categoryLabel ? (
        <View style={styles.pill}>
          <Text style={styles.pillText} maxFontSizeMultiplier={1.1}>
            {categoryLabel.toUpperCase()}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Quick Overview card — a subtle wash of the section accent that turns a detail
 * page into a decision page. Everything important in one calm card: an identity
 * line, location (with a pin), a quick fact line, a short factual summary, and a
 * bulleted highlight list. Not an article; the fast facts that help someone
 * decide in about ten seconds. Every field is optional and omitted when the
 * source has nothing to show — Kindred never invents to fill a slot.
 */
export function DetailAboutCard({
  label,
  title,
  meta,
  body,
  knownFor,
  highlights,
  tint,
  style,
  children,
}: {
  label: string;
  /** Bold title line — "Name • City". The single informational identity line. */
  title?: string;
  /** Secondary quick fact (e.g. date · time for events, expiration for deals). */
  meta?: string;
  /** Editorial "About" copy — one or two concise paragraphs. */
  body?: string | string[];
  /** One or two warm "Why you'll love it" sentences — verified only, omitted when absent. */
  knownFor?: string;
  /**
   * "Why you'll love it" as 2–4 short verified highlights, rendered as a compact
   * bulleted list. Takes precedence over `knownFor` when provided.
   */
  highlights?: string[];
  tint: string;
  style?: StyleProp<ViewStyle>;
  /** Section-specific extras. */
  children?: ReactNode;
}) {
  const hasHeader = Boolean(title?.trim() || meta?.trim());
  const paragraphs = (Array.isArray(body) ? body : body ? [body] : [])
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  const cleanHighlights = (highlights ?? [])
    .map((h) => h?.trim())
    .filter((h): h is string => Boolean(h));
  return (
    <View style={[styles.about, { backgroundColor: tint }, style]}>
      <Text style={styles.aboutLabel} maxFontSizeMultiplier={1.2}>
        {label.toUpperCase()}
      </Text>
      {title?.trim() ? (
        <Text style={styles.aboutPrimary} maxFontSizeMultiplier={1.2}>
          {title.trim()}
        </Text>
      ) : null}
      {meta?.trim() ? (
        <Text style={styles.aboutMeta} maxFontSizeMultiplier={1.2}>
          {meta.trim()}
        </Text>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <Text
          key={index}
          style={[
            styles.aboutBody,
            (index > 0 || hasHeader) && styles.aboutBodySpaced,
          ]}
          maxFontSizeMultiplier={1.35}
        >
          {paragraph}
        </Text>
      ))}
      {cleanHighlights.length || knownFor?.trim() ? (
        <View style={styles.knownFor}>
          <Text style={styles.knownForLabel} maxFontSizeMultiplier={1.2}>
            WHY YOU'LL LOVE IT
          </Text>
          {cleanHighlights.length ? (
            cleanHighlights.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.highlightRow,
                  index > 0 && styles.highlightRowSpaced,
                ]}
              >
                <Text style={styles.highlightBullet} maxFontSizeMultiplier={1.3}>
                  {"\u2022"}
                </Text>
                <Text style={styles.highlightText} maxFontSizeMultiplier={1.3}>
                  {item}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.knownForText} maxFontSizeMultiplier={1.3}>
              {knownFor!.trim()}
            </Text>
          )}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: "100%",
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 64,
    lineHeight: 74,
    marginBottom: 16,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.4,
    // Fixed near-black — the hero sits on a bright section-accent color, so its
    // text stays dark for contrast regardless of the app's dark theme.
    color: "#15161B",
    textAlign: "center",
    maxWidth: "94%",
  },
  pill: {
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFFC2",
  },
  pillText: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: "#15161B",
  },
  about: {
    width: "100%",
    borderRadius: 18,
    padding: 20,
  },
  aboutLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.inkMuted,
    marginBottom: 10,
  },
  aboutPrimary: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 3,
  },
  aboutMeta: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginTop: 2,
  },
  aboutBody: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 26,
    color: paper.inkBody,
  },
  aboutBodySpaced: {
    marginTop: 12,
  },
  knownFor: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
  },
  knownForLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: paper.inkMuted,
    marginBottom: 6,
  },
  knownForText: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkBody,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  highlightRowSpaced: {
    marginTop: 6,
  },
  highlightBullet: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkBody,
    marginRight: 8,
  },
  highlightText: {
    flex: 1,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkBody,
  },
});
