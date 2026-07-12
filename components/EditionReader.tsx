import { type ReactNode } from "react";
import { Text, View, Pressable, StyleSheet, Animated } from "react-native";
import {
  SECTION_LABELS,
  formatEditionDate,
  type EditionSection,
} from "../lib/edition/types";
import type { LeadStory } from "../lib/edition/LeadStory";
import type { MorningBriefing } from "../lib/edition/morningEdition";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import type { KindredArticle } from "../lib/edition/article";
import type { BanditsPick as BanditsPickData } from "../lib/edition/bandit";
import {
  articleFromBanditsPick,
  articleFromDiscoveryItem,
  articleFromEditionSection,
  articleFromKnowledgeFacet,
  articleFromLeadStory,
  sectionOpensArticleReader,
} from "../lib/edition/article";
import {
  articleFromTopStory,
  type TopStoryItem,
} from "../lib/edition/topStories";
import { whyThisMatters } from "../lib/edition/knowledge";
import type { KnowledgePayload } from "../lib/edition/knowledge";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";
import { sectionIntro } from "../lib/edition/sectionIntro";
import type { HeroRegionId } from "../lib/edition/HeroImageService";
import { LocalEventsSection } from "./LocalEventsSection";
import { MorningGreeting } from "./MorningGreeting";
import { MorningHeroImage } from "./MorningHeroImage";
import { LeadStorySection } from "./LeadStorySection";
import { DiscoveryDesk } from "./DiscoveryDesk";
import { BanditsPick } from "./BanditsPick";
import { FolioReveal } from "./FolioReveal";
import { EditionClose } from "./EditionClose";

type Props = {
  sections: EditionSection[];
  editionDate?: string | null;
  leadStory?: LeadStory | null;
  /** Opens any Kindred article in the shared native reader. */
  onOpenArticle?: (article: KindredArticle) => void;
  /** Stored knowledge payload — used when tapping explainer notes. */
  knowledge?: KnowledgePayload | null;
  heroImageUri?: string | null;
  banditGreeting?: string | null;
  banditAside?: string | null;
  /** Memory continuity — quiet line under Bandit when present. */
  memoryNote?: string | null;
  banditFirstName?: string | null;
  birthdayMMDD?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationState?: string | null;
  morningOpening?: MorningBriefing | null;
  morningBriefing?: MorningBriefing | null;
  leadWhyThisMatters?: string | null;
  leadWhyChosen?: string | null;
  leadContinuityKicker?: string | null;
  discoveryHeadline?: string | null;
  discoveryEditorNote?: string | null;
  discoveryItems?: RankedDiscoveryItem[];
  /** One thoughtful Bandit's Pick after the main paper. */
  banditsPick?: BanditsPickData | null;
  /**
   * Individual Top Stories — each opens as one cohesive article.
   * When present, the combined top_stories section body is not opened as a mashup.
   */
  topStories?: TopStoryItem[];
  clippedSectionIds?: Set<string>;
  onToggleClip?: (section: EditionSection) => void;
  clipPendingId?: string | null;
  onOpenClippings?: () => void;
  onOpenArchive?: () => void;
  onShareEdition?: () => void;
  /** Collapsing masthead — trailing action while expanded (e.g. Library). */
  mastheadTrailing?: ReactNode;
  mastheadLeading?: ReactNode;
  mastheadScrollY?: Animated.Value;
};

/**
 * Folio teaser — invite the full story without reprinting it on the front page.
 * Keeps the edition finite and magazine-like.
 */
function folioTeaser(body: string): { dek: string; clamped: boolean } {
  const cleaned = body.replace(/\s+/g, " ").trim();
  if (!cleaned) return { dek: "", clamped: false };

  const words = cleaned.split(/\s+/).filter(Boolean);
  const WORD_CAP = 42;
  if (words.length <= WORD_CAP) {
    return { dek: cleaned, clamped: words.length > 28 };
  }
  return {
    dek: `${words.slice(0, WORD_CAP).join(" ")}…`,
    clamped: true,
  };
}

export function EditionReader({
  sections,
  editionDate,
  leadStory,
  onOpenArticle,
  knowledge,
  heroImageUri,
  banditGreeting,
  banditAside,
  memoryNote,
  banditFirstName,
  birthdayMMDD,
  locationCity,
  locationRegion,
  locationState,
  morningOpening,
  morningBriefing,
  leadWhyThisMatters,
  leadWhyChosen,
  leadContinuityKicker,
  discoveryHeadline,
  discoveryEditorNote,
  discoveryItems,
  banditsPick,
  topStories = [],
  clippedSectionIds,
  onToggleClip,
  clipPendingId,
  onOpenClippings,
  onOpenArchive,
  onShareEdition,
  mastheadTrailing,
  mastheadLeading,
  mastheadScrollY,
}: Props) {
  const weather = sections.find((s) => s.section_type === "weather");
  const greeting = sections.find((s) => s.section_type === "greeting");
  const remaining = sections.filter(
    (s) => s.section_type !== "greeting" && s.section_type !== "weather"
  );
  const hasLocalEvents = remaining.some(
    (s) => s.section_type === "local_events"
  );
  const welcomeMessage =
    greeting?.body?.trim() || greeting?.headline?.trim() || null;

  const lookingAheadIndex = remaining.findIndex(
    (s) => s.section_type === "looking_ahead"
  );

  const dateLabel = editionDate ? formatEditionDate(editionDate) : null;

  function openLead(lead: LeadStory) {
    onOpenArticle?.(articleFromLeadStory(lead));
  }

  function openLeadKnowledge(kind: "why_this_matters" | "why_chosen") {
    if (!leadStory || !onOpenArticle) return;
    if (kind === "why_this_matters") {
      const facet = whyThisMatters(knowledge?.byStoryKey?.[leadStory.id]);
      if (facet) {
        onOpenArticle(articleFromKnowledgeFacet(facet, leadStory.id));
        return;
      }
      if (leadWhyThisMatters?.trim()) {
        onOpenArticle(
          articleFromKnowledgeFacet(
            {
              type: "why_this_matters",
              title: "Why this matters",
              summary: leadWhyThisMatters.trim(),
              source: { name: "Kindred", tier: "kindred" },
              reasons: [],
            },
            leadStory.id
          )
        );
        return;
      }
    }
    openLead(leadStory);
  }

  function renderTopStoriesSlate(
    section: EditionSection,
    folioIndex: number
  ) {
    const clipped = clippedSectionIds?.has(section.id) ?? false;
    const pending = clipPendingId === section.id;
    const intro = sectionIntro(section.section_type);

    return (
      <FolioReveal index={folioIndex} key={section.id}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>
              {SECTION_LABELS[section.section_type] ?? section.section_type}
            </Text>
            <View style={styles.sectionRule} />
          </View>

          {intro ? (
            <Text style={styles.sectionIntro}>{intro}</Text>
          ) : null}

          {topStories.map((story, index) => (
            <Pressable
              key={story.id}
              onPress={() => onOpenArticle?.(articleFromTopStory(story))}
              accessibilityRole="link"
              accessibilityLabel={`Read: ${story.headline}`}
              accessibilityHint="Opens this single story in the Kindred reader"
              style={({ pressed }) => [
                styles.topStoryItem,
                index === topStories.length - 1 && styles.topStoryItemLast,
                pressed && styles.tapPressed,
              ]}
            >
              <Text style={styles.sectionHeadline}>{story.headline}</Text>
              {story.summary ? (
                <Text
                  style={styles.sectionDek}
                  numberOfLines={3}
                  maxFontSizeMultiplier={1.25}
                >
                  {folioTeaser(story.summary).dek}
                </Text>
              ) : null}
              <Text style={styles.topStoryMeta}>
                {[story.source, story.role ? story.role.replace(/_/g, " ") : null]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
              <Text style={styles.continueCue}>Continue reading</Text>
            </Pressable>
          ))}

          {onToggleClip ? (
            <Pressable
              style={({ pressed }) => [
                styles.clipLink,
                pressed && styles.clipPressed,
              ]}
              onPress={() => onToggleClip(section)}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={clipped ? "Saved" : "Save for later"}
            >
              <Text
                style={[
                  styles.clipLinkText,
                  clipped && styles.clipLinkTextSaved,
                ]}
              >
                {pending
                  ? "Saving…"
                  : clipped
                    ? "Saved"
                    : "Save for later"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </FolioReveal>
    );
  }

  function renderSection(section: EditionSection, folioIndex: number) {
    if (
      section.section_type === "top_stories" &&
      topStories.length > 0 &&
      onOpenArticle
    ) {
      return renderTopStoriesSlate(section, folioIndex);
    }

    const clipped = clippedSectionIds?.has(section.id) ?? false;
    const pending = clipPendingId === section.id;
    const isWeather = section.section_type === "weather";
    const opensReader =
      Boolean(onOpenArticle) && sectionOpensArticleReader(section.section_type);
    const intro = sectionIntro(section.section_type);

    function openSection() {
      if (!onOpenArticle) return;
      onOpenArticle(articleFromEditionSection(section));
    }

    const teaser = opensReader ? folioTeaser(section.body) : null;

    return (
      <FolioReveal index={folioIndex} key={section.id}>
        <View style={[styles.sectionCard, isWeather && styles.weatherCard]}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>
              {SECTION_LABELS[section.section_type] ?? section.section_type}
            </Text>
            <View style={styles.sectionRule} />
          </View>

          {intro ? (
            <Text style={styles.sectionIntro}>{intro}</Text>
          ) : null}

          {section.section_type === "local_events" ? (
            <LocalEventsSection
              headline={section.headline}
              body={section.body}
              sourceNote={section.source_note}
            />
          ) : opensReader && teaser ? (
            <>
              <Pressable
                onPress={openSection}
                accessibilityRole="link"
                accessibilityLabel={`Read: ${section.headline}`}
                accessibilityHint="Opens the full story in the Kindred reader"
                hitSlop={{ top: 6, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => [
                  styles.sectionTeaser,
                  pressed && styles.tapPressed,
                ]}
              >
                <Text style={styles.sectionHeadline}>{section.headline}</Text>
                {teaser.dek ? (
                  <Text
                    style={styles.sectionDek}
                    numberOfLines={3}
                    maxFontSizeMultiplier={1.25}
                  >
                    {teaser.dek}
                  </Text>
                ) : null}
                {section.source_note ? (
                  <Text style={styles.sourceNote}>{section.source_note}</Text>
                ) : null}
                {teaser.clamped ? (
                  <Text style={styles.continueCue}>Continue reading</Text>
                ) : null}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionHeadline}>{section.headline}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
              {section.source_note ? (
                <Text style={styles.sourceNote}>{section.source_note}</Text>
              ) : null}
            </>
          )}

          {onToggleClip ? (
            <Pressable
              style={({ pressed }) => [
                styles.clipLink,
                pressed && styles.clipPressed,
              ]}
              onPress={() => onToggleClip(section)}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel={clipped ? "Saved" : "Save for later"}
            >
              <Text
                style={[
                  styles.clipLinkText,
                  clipped && styles.clipLinkTextSaved,
                ]}
              >
                {pending
                  ? "Saving…"
                  : clipped
                    ? "Saved"
                    : "Save for later"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </FolioReveal>
    );
  }

  const discoveryBlock =
    discoveryItems && discoveryItems.length > 0 ? (
      <DiscoveryDesk
        headline={discoveryHeadline ?? "Worth your time"}
        editorNote={
          discoveryEditorNote?.trim() ||
          "A few quiet recommendations for today."
        }
        items={discoveryItems}
        onOpenItem={
          onOpenArticle
            ? (item) => onOpenArticle(articleFromDiscoveryItem(item))
            : undefined
        }
      />
    ) : null;

  let folioCursor = 1;

  return (
    <View style={styles.folio}>
      <MorningGreeting
        editionDate={editionDate}
        welcomeMessage={welcomeMessage}
        banditGreeting={banditGreeting}
        banditAside={banditAside}
        memoryNote={memoryNote}
        morningOpening={morningOpening}
        morningBriefing={morningBriefing}
        weatherText={weather?.body ?? weather?.headline ?? null}
        mastheadLeading={mastheadLeading}
        mastheadTrailing={mastheadTrailing}
        mastheadScrollY={mastheadScrollY}
        banditContext={{
          firstName: banditFirstName,
          weatherText: weather?.body ?? weather?.headline ?? null,
          hasLocalEvents,
          editionDate,
          birthdayMMDD,
        }}
      />

      {leadStory ? (
        <FolioReveal index={folioCursor++}>
          <LeadStorySection
            lead={leadStory}
            onContinueReading={onOpenArticle ? openLead : undefined}
            whyThisMatters={leadWhyThisMatters}
            whyChosen={leadWhyChosen}
            continuityKicker={leadContinuityKicker}
            onOpenKnowledge={onOpenArticle ? openLeadKnowledge : undefined}
          />
        </FolioReveal>
      ) : null}

      {/* Morning photograph follows the Lead so the cover story owns the first scroll. */}
      <FolioReveal index={folioCursor++}>
        <MorningHeroImage
          uri={heroImageUri}
          context={{
            date: editionDate,
            weatherText: weather?.body ?? weather?.headline ?? null,
            birthdayMMDD,
            location: {
              city: locationCity,
              region: (locationRegion as HeroRegionId | null | undefined) ?? null,
              state: locationState,
            },
          }}
        />
      </FolioReveal>

      {weather ? renderSection(weather, folioCursor++) : null}

      {/* Desk picks precede Looking Ahead so tomorrow’s note closes the paper. */}
      {remaining.map((section, index) => {
        const insertDiscoveryBefore =
          discoveryBlock &&
          lookingAheadIndex >= 0 &&
          index === lookingAheadIndex;
        const insertDiscoveryAfter =
          discoveryBlock &&
          lookingAheadIndex < 0 &&
          index === remaining.length - 1;
        const sectionIndex = folioCursor++;
        return (
          <View key={`block-${section.id}`}>
            {insertDiscoveryBefore ? discoveryBlock : null}
            {renderSection(section, sectionIndex)}
            {insertDiscoveryAfter ? discoveryBlock : null}
          </View>
        );
      })}

      {remaining.length === 0 ? discoveryBlock : null}

      {banditsPick ? (
        <BanditsPick
          pick={banditsPick}
          folioIndex={folioCursor++}
          onOpen={
            onOpenArticle
              ? () => onOpenArticle(articleFromBanditsPick(banditsPick.story))
              : undefined
          }
        />
      ) : null}

      <EditionClose
        folioIndex={folioCursor + 2}
        editionDateLabel={dateLabel}
        onOpenClippings={onOpenClippings}
        onOpenArchive={onOpenArchive}
        onShareEdition={onShareEdition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  folio: {
    paddingBottom: 28,
  },
  sectionCard: {
    marginBottom: space.sectionGap,
    paddingBottom: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  weatherCard: {
    marginTop: 2,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 12,
  },
  sectionLabel: {
    ...type.kicker,
    color: paper.terracotta,
  },
  sectionRule: {
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
  sectionHeadline: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 12,
  },
  sectionTeaser: {
    alignSelf: "stretch",
  },
  sectionDek: {
    ...type.folioDek,
    color: paper.inkBody,
    maxWidth: 440,
  },
  sectionBody: {
    ...type.body,
    color: paper.inkBody,
  },
  sourceNote: {
    ...type.meta,
    color: paper.inkFaint,
    marginTop: 14,
    fontStyle: "italic",
    fontFamily: "Georgia",
  },
  continueCue: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
    marginTop: 16,
  },
  topStoryItem: {
    paddingBottom: 28,
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  topStoryItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 8,
  },
  topStoryMeta: {
    ...type.meta,
    color: paper.inkFaint,
    marginTop: 12,
    textTransform: "capitalize",
  },
  tapPressed: {
    opacity: press.opacity,
  },
  clipLink: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  clipPressed: {
    opacity: press.opacity,
  },
  clipLinkText: {
    fontFamily: "Georgia",
    fontSize: 14,
    letterSpacing: 0.2,
    color: paper.inkMuted,
    fontStyle: "italic",
  },
  clipLinkTextSaved: {
    color: paper.inkFaint,
  },
});
