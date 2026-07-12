import { Text, View, Pressable, StyleSheet } from "react-native";
import {
  SECTION_LABELS,
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
import { paper, press, type } from "../lib/edition/newspaperTheme";
import { editionColophon } from "../lib/edition/morningRitual";
import { LocalEventsSection } from "./LocalEventsSection";
import { MorningGreeting } from "./MorningGreeting";
import { LeadStorySection } from "./LeadStorySection";
import { DiscoveryDesk } from "./DiscoveryDesk";
import { FolioReveal } from "./FolioReveal";

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
  endText?: string;
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
  endText = editionColophon(),
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

  const localEventsIndex = remaining.findIndex(
    (s) => s.section_type === "local_events"
  );

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
    // Fall back to the lead story itself.
    openLead(leadStory);
  }

  function renderSection(section: EditionSection, folioIndex: number) {
    const clipped = clippedSectionIds?.has(section.id) ?? false;
    const pending = clipPendingId === section.id;
    const isWeather = section.section_type === "weather";
    const opensReader =
      Boolean(onOpenArticle) && sectionOpensArticleReader(section.section_type);

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
                clipped ? "Saved to Clippings" : "Save for later"
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
                    ? "Saved to Clippings"
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
        headline={discoveryHeadline ?? "Bandit’s Picks"}
        editorNote={discoveryEditorNote}
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
        heroImageUri={heroImageUri}
        banditGreeting={banditGreeting}
        banditAside={banditAside}
        memoryNote={memoryNote}
        morningOpening={morningOpening}
        morningBriefing={morningBriefing}
        weatherText={weather?.body ?? weather?.headline ?? null}
        locationCity={locationCity}
        locationState={locationState}
        birthdayMMDD={birthdayMMDD}
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

      {weather ? renderSection(weather, folioCursor++) : null}

      {remaining.map((section, index) => {
        const afterThis =
          discoveryBlock &&
          ((localEventsIndex >= 0 && index === localEventsIndex) ||
            (localEventsIndex < 0 && index === remaining.length - 1));
        const sectionIndex = folioCursor++;
        return (
          <View key={`block-${section.id}`}>
            {renderSection(section, sectionIndex)}
            {afterThis ? discoveryBlock : null}
          </View>
        );
      })}

      {remaining.length === 0 ? discoveryBlock : null}

      <FolioReveal index={folioCursor + 2}>
        <View style={styles.endMarker}>
          <View style={styles.endRule} />
          <Text style={styles.endText}>{endText}</Text>
          <View style={styles.endRule} />
        </View>
      </FolioReveal>
    </View>
  );
}

const styles = StyleSheet.create({
  folio: {
    paddingBottom: 12,
  },
  sectionCard: {
    marginBottom: 38,
    paddingBottom: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  weatherCard: {
    marginTop: 4,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  sectionHeadline: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 12,
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
  readLink: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingVertical: 6,
  },
  readLinkText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  tapPressed: {
    opacity: press.opacity,
  },
  clipLink: {
    alignSelf: "flex-start",
    marginTop: 18,
    paddingVertical: 4,
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
  endMarker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingVertical: 56,
  },
  endRule: {
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkMuted,
    opacity: 0.3,
  },
  endText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.inkFaint,
    fontStyle: "italic",
    letterSpacing: 0.25,
  },
});
