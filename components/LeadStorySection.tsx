import { useRef, useState } from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import type { LeadStory } from "../lib/edition/LeadStory";
import { paper, press, shadow, space, type } from "../lib/edition/newspaperTheme";
import { sectionIntro } from "../lib/edition/sectionIntro";
import { EditorialNote } from "./EditorialNote";

type Props = {
  lead: LeadStory;
  /** Opens the shared native article reader (same as every other section). */
  onContinueReading?: (lead: LeadStory) => void;
  /** Knowledge Engine — why this story matters. */
  whyThisMatters?: string | null;
  /** Personalization / editorial — why it earned the front page. */
  whyChosen?: string | null;
  /** Opens a knowledge/explainer article in the native reader. */
  onOpenKnowledge?: (kind: "why_this_matters" | "why_chosen") => void;
};

const ROLE_TAG: Record<string, string> = {
  local: "Local",
  national: "National",
  world: "World",
  breaking: "Developing",
};

function formatPublicationTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Published ${time}`;

  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Published ${day}, ${time}`;
}

/** Estimate from the front-page brief when full article body isn’t available. */
function estimateReadMinutes(lead: LeadStory): number | null {
  const text = `${lead.headline} ${lead.summary}`.trim();
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 40) return null;
  return Math.max(1, Math.round(words / 200));
}

function publicationByline(source: string): string {
  const trimmed = source.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return "From the wires";
  }
  return `From ${trimmed}`;
}

function leadWhyChosen(lead: LeadStory, override?: string | null): string | null {
  if (override?.trim()) return override.trim();
  const reasons = lead.selection?.reasons ?? [];
  const top = reasons
    .filter(
      (r) =>
        r.weight > 0 &&
        !r.code.startsWith("role_") &&
        !/score|algorithm|boost|rank|weight/i.test(r.label) &&
        !/score|algorithm|boost|rank/i.test(r.code)
    )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((r) => r.label.replace(/\.$/, ""));
  if (!top.length) return null;
  return top.join(". ") + ".";
}

/**
 * Front Page Lead — cover-story presentation for Kindred’s morning paper.
 * Headline, image, summary, and “Read the story” all open the same reader.
 */
export function LeadStorySection({
  lead,
  onContinueReading,
  whyThisMatters,
  whyChosen,
  onOpenKnowledge,
}: Props) {
  const roleTag = ROLE_TAG[lead.role];
  const published = formatPublicationTime(lead.publishedAt);
  const readMinutes = estimateReadMinutes(lead);
  const byline = publicationByline(lead.source);
  const chosen = leadWhyChosen(lead, whyChosen);
  const readScale = useRef(new Animated.Value(1)).current;
  const [heroFailed, setHeroFailed] = useState(false);
  const intro = sectionIntro("lead");

  const metaParts = [
    roleTag,
    published,
    readMinutes
      ? readMinutes === 1
        ? "A one-minute read"
        : `About ${readMinutes} minutes`
      : null,
  ].filter(Boolean) as string[];

  function openStory() {
    onContinueReading?.(lead);
  }

  const canOpen = Boolean(onContinueReading);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>Lead Story</Text>
        <View style={styles.kickerRule} />
      </View>

      {intro ? <Text style={styles.intro}>{intro}</Text> : null}

      <Pressable
        onPress={canOpen ? openStory : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? "link" : undefined}
        accessibilityLabel={canOpen ? `Read: ${lead.headline}` : undefined}
        hitSlop={{ top: 8, bottom: 4, left: 4, right: 4 }}
        style={({ pressed }) => [canOpen && pressed && styles.linkPressed]}
      >
        <Text style={styles.headline} maxFontSizeMultiplier={1.35}>
          {lead.headline}
        </Text>
      </Pressable>

      <Text style={styles.byline} maxFontSizeMultiplier={1.25}>
        {byline}
      </Text>

      {lead.heroImage?.uri && !heroFailed ? (
        <Pressable
          onPress={canOpen ? openStory : undefined}
          disabled={!canOpen}
          accessibilityRole={canOpen ? "button" : "image"}
          accessibilityLabel={
            canOpen
              ? `Read story photo: ${lead.heroImage.alt || lead.headline}`
              : lead.heroImage.alt || lead.headline
          }
          style={({ pressed }) => [
            styles.imageBlock,
            canOpen && pressed && styles.linkPressed,
          ]}
        >
          <View style={[styles.imageFrame, shadow.photo]}>
            <Image
              source={{ uri: lead.heroImage.uri }}
              style={styles.image}
              resizeMode="cover"
              accessible={false}
              onError={() => setHeroFailed(true)}
            />
          </View>
          {lead.heroImage.source === "article" ? (
            <Text style={styles.imageCredit} maxFontSizeMultiplier={1.2}>
              Photograph via {lead.source}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {lead.summary ? (
        <Pressable
          onPress={canOpen ? openStory : undefined}
          disabled={!canOpen}
          accessibilityRole={canOpen ? "link" : undefined}
          accessibilityLabel={canOpen ? "Read the story summary" : undefined}
          hitSlop={6}
          style={({ pressed }) => [canOpen && pressed && styles.linkPressed]}
        >
          <Text style={styles.summary} maxFontSizeMultiplier={1.35}>
            {lead.summary}
          </Text>
        </Pressable>
      ) : null}

      {whyThisMatters?.trim() ? (
        <EditorialNote
          kicker="Why this matters"
          body={whyThisMatters}
          onPress={
            onOpenKnowledge
              ? () => onOpenKnowledge("why_this_matters")
              : canOpen
                ? openStory
                : undefined
          }
        />
      ) : null}

      {chosen ? (
        <EditorialNote
          kicker="Why it’s on the front page"
          body={chosen}
          compact
          onPress={
            onOpenKnowledge
              ? () => onOpenKnowledge("why_chosen")
              : canOpen
                ? openStory
                : undefined
          }
        />
      ) : null}

      {metaParts.length > 0 ? (
        <Text style={styles.metaLine} maxFontSizeMultiplier={1.25}>
          {metaParts.join("  ·  ")}
        </Text>
      ) : (
        <Text style={styles.metaLine} maxFontSizeMultiplier={1.25}>
          {lead.source}
        </Text>
      )}

      {canOpen ? (
        <Pressable
          onPress={openStory}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Read the story"
          onPressIn={() =>
            Animated.spring(readScale, {
              toValue: press.scale,
              useNativeDriver: true,
              friction: 8,
            }).start()
          }
          onPressOut={() =>
            Animated.spring(readScale, {
              toValue: 1,
              useNativeDriver: true,
              friction: 8,
            }).start()
          }
          style={({ pressed }) => [
            styles.readRow,
            pressed && styles.linkPressed,
          ]}
        >
          <Animated.Text
            style={[styles.link, { transform: [{ scale: readScale }] }]}
          >
            Read the story
          </Animated.Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: space.afterLead,
    paddingBottom: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.1,
  },
  kickerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  intro: {
    ...type.sectionIntro,
    color: paper.inkFaint,
    marginBottom: 16,
    maxWidth: 420,
  },
  headline: {
    ...type.leadHeadline,
    color: paper.ink,
    marginBottom: 14,
  },
  byline: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 22,
  },
  imageBlock: {
    marginBottom: 22,
  },
  imageFrame: {
    width: "100%",
    aspectRatio: 3 / 2,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  image: {
    width: "100%",
    height: "112%",
    marginTop: "-6%",
  },
  imageCredit: {
    marginTop: 12,
    fontFamily: "Georgia",
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.25,
    color: paper.inkFaint,
    fontStyle: "italic",
  },
  summary: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 30,
    color: paper.inkBody,
    marginBottom: 18,
    letterSpacing: 0.05,
  },
  metaLine: {
    ...type.meta,
    color: paper.inkFaint,
    letterSpacing: 0.3,
    marginBottom: 18,
    fontFamily: "Georgia",
    fontStyle: "italic",
  },
  readRow: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  link: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  linkPressed: {
    opacity: press.opacity,
  },
});
