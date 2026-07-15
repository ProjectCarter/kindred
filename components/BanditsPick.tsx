import { Text, View, Pressable, StyleSheet } from "react-native";
import type { BanditsPick as BanditsPickData } from "../lib/edition/bandit";
import { containsEngineLanguage } from "../lib/edition/editorialVoice";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";
import { FolioReveal } from "./FolioReveal";

type Props = {
  pick: BanditsPickData;
  onOpen?: () => void;
  folioIndex?: number;
};

/**
 * What's Special Right Now — Bandit's timely desk note after the main paper.
 * Not a feed. Not a stack. One thing worth noticing this month.
 */
export function BanditsPick({ pick, onOpen, folioIndex = 11 }: Props) {
  const canOpen = Boolean(onOpen);
  const whyRaw = pick.story.why?.trim();
  const why = whyRaw && !containsEngineLanguage(whyRaw) ? whyRaw : "";

  return (
    <FolioReveal index={folioIndex}>
      <View style={styles.wrap} accessibilityRole="summary">
        <View style={styles.kickerRow}>
          <Text style={styles.kicker}>What's Special Right Now</Text>
          <View style={styles.kickerRule} />
        </View>

        <Text style={styles.intro} maxFontSizeMultiplier={1.3}>
          {pick.intro}
        </Text>
        <Text style={styles.sign}>— Bandit</Text>

        <Pressable
          onPress={canOpen ? onOpen : undefined}
          disabled={!canOpen}
          accessibilityRole={canOpen ? "link" : undefined}
          accessibilityLabel={
            canOpen ? `Read Bandit’s pick: ${pick.story.headline}` : undefined
          }
          style={({ pressed }) => [canOpen && pressed && styles.pressed]}
        >
          <Text style={styles.headline} maxFontSizeMultiplier={1.3}>
            {pick.story.headline}
          </Text>
        </Pressable>

        <Text style={styles.summary} maxFontSizeMultiplier={1.3}>
          {pick.story.summary}
        </Text>

        {why ? (
          <Text style={styles.why} maxFontSizeMultiplier={1.25}>
            {why}
          </Text>
        ) : null}

        <Text style={styles.source} maxFontSizeMultiplier={1.2}>
          From {pick.story.source}
        </Text>

        {canOpen ? (
          <Pressable
            onPress={onOpen}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Read the story"
            style={({ pressed }) => [
              styles.readLink,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.readLinkText}>Read the story</Text>
          </Pressable>
        ) : null}
      </View>
    </FolioReveal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.sectionGap,
    paddingBottom: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
  },
  kickerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  intro: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 28,
    fontStyle: "italic",
    color: paper.inkBody,
    marginBottom: 10,
    maxWidth: 420,
  },
  sign: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkFaint,
    letterSpacing: 0.2,
    marginBottom: 22,
  },
  headline: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 12,
  },
  summary: {
    ...type.body,
    color: paper.inkBody,
    marginBottom: 12,
  },
  why: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 12,
    maxWidth: 400,
  },
  source: {
    ...type.meta,
    color: paper.inkFaint,
    fontStyle: "italic",
    fontFamily: "Georgia",
  },
  readLink: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  readLinkText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.25,
  },
  pressed: {
    opacity: press.opacity,
  },
});
