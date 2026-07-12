import { Text, View, Pressable, StyleSheet } from "react-native";
import {
  SECTION_LABELS,
  formatEditionDate,
  type EditionSection,
} from "../lib/edition/types";
import type { LeadStory } from "../lib/edition/LeadStory";
import type { MorningBriefing } from "../lib/edition/morningEdition";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import type { KindredArticle } from "../lib/edition/article";
import {
  articleFromDiscoveryItem,
  articleFromEditionSection,
  articleFromKnowledgeFacet,
  articleFromLeadStory,
  sectionOpensArticleReader,
} from "../lib/edition/article";
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
  discoveryHeadline?: string | null;
  discoveryEditorNote?: string | null;
  discoveryItems?: RankedDiscoveryItem[];
  clippedSectionIds?: Set<string>;
  onToggleClip?: (section: EditionSection) => void;
  clipPendingId?: string | null;
  onOpenClippings?: () => void;
  onOpenArchive?: () => void;
  onShareEdition?: () => void;
};

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
  discoveryHeadline,
  discoveryEditorNote,
  discoveryItems,
  clippedSectionIds,
  onToggleClip,
  clipPendingId,
  onOpenClippings,
  onOpenArchive,
  onShareEdition,
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

  function renderSection(section: EditionSection, folioIndex: number) {
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
          ) : opensReader ? (
            <>
              <Pressable
                onPress={openSection}
                accessibilityRole="link"
                accessibilityLabel={`Read: ${section.headline}`}
                hitSlop={{ top: 6, bottom: 4, left: 2, right: 2 }}
                style={({ pressed }) => pressed && styles.tapPressed}
              >
                <Text style={styles.sectionHeadline}>{section.headline}</Text>
              </Pressable>
              <Pressable
                onPress={openSection}
                accessibilityRole="link"
                accessibilityLabel="Read the story"
                hitSlop={4}
                style={({ pressed }) => pressed && styles.tapPressed}
              >
                <Text style={styles.sectionBody}>{section.body}</Text>
              </Pressable>
              {section.source_note ? (
                <Text style={styles.sourceNote}>{section.source_note}</Text>
              ) : null}
              <Pressable
                onPress={openSection}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Read the story"
                style={({ pressed }) => [
                  styles.readLink,
                  pressed && styles.tapPressed,
                ]}
              >
                <Text style={styles.readLinkText}>Read the story</Text>
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
              accessibilityLabel={
                clipped ? "Saved" : "Save for later"
              }
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
    marginBottom: 14,
  },
  sectionBody: {
    ...type.body,
    color: paper.inkBody,
  },
  sourceNote: {
    ...type.meta,
    color: paper.inkFaint,
    marginTop: 16,
    fontStyle: "italic",
    fontFamily: "Georgia",
  },
  readLink: {
    alignSelf: "flex-start",
    marginTop: 18,
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
  tapPressed: {
    opacity: press.opacity,
  },
  clipLink: {
    alignSelf: "flex-start",
    marginTop: 14,
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
    color: paper.terracotta,
    fontStyle: "italic",
  },
  clipLinkTextSaved: {
    color: paper.inkMuted,
  },
});
