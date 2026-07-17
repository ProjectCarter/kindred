import { memo, useMemo, type ReactNode } from "react";
import {
  Image,
  Text,
  View,
  Pressable,
  StyleSheet,
  Animated,
  type ImageSourcePropType,
} from "react-native";
import {
  SECTION_LABELS,
  formatEditionDate,
  type EditionSection,
} from "../lib/edition/types";
import type { LeadStory } from "../lib/edition/LeadStory";
import type { MorningBriefing } from "../lib/edition/morningEdition";
import type { RankedDiscoveryItem, DiscoveryPayload } from "../lib/edition/discovery";
import type { KindredArticle } from "../lib/edition/article";
import type { BanditsPick as BanditsPickData } from "../lib/edition/bandit";
import {
  articleFromBanditsPick,
  articleFromDiscoveryItem,
  articleFromEditionSection,
  articleFromKnowledgeFacet,
  articleFromLeadStory,
  articleFromNotebookItem,
  sectionOpensArticleReader,
} from "../lib/edition/article";
import {
  isStoryOfSection,
  parseStoryOfSourceNote,
  storyOfImageFromSourceNote,
} from "../lib/edition/storyOf";
import { discoveryArticlesById } from "../lib/edition/discoveryArticleCache";
import {
  articleFromTopStory,
  type TopStoryItem,
} from "../lib/edition/topStories";
import { whyThisMatters } from "../lib/edition/knowledge";
import type { KnowledgePayload } from "../lib/edition/knowledge";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";
import { sectionIntro } from "../lib/edition/sectionIntro";
import type { HeroRegionId } from "../lib/edition/HeroImageService";
import { parseLocalEventsBody, type LocalEventCard } from "../lib/edition/localEvents";
import {
  buildEditionAnchors,
  curateHomepageEdition,
} from "../lib/edition/editionCuration";
import { HOMEPAGE_INITIAL_RENDER_COUNT } from "../lib/edition/editorialPublishing";
import {
  logLocalEventsPipeline,
  pipelineCountsFromSections,
  type LocalEventsLoadStatus,
} from "../lib/edition/localEventsPipeline";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator";
import {
  resolveReaderLocation,
  type ReaderLocation,
} from "../lib/edition/localDiscoveryScope";
import { resetImageRegistry } from "../lib/edition/imageRegistry";
import {
  freezeEdition,
  getFrozenDiscovery,
} from "../lib/edition/editionFreeze";
import { resolveArticleHero } from "../lib/edition/articleHero";
import { onThisDayImageFromKnowledge } from "../lib/edition/historicalImages";
import { historyYearLabel } from "../lib/edition/historyCard";
import { MorningArrival } from "./MorningArrival";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { LocalEventsGrid } from "./LocalEventsGrid";
import { TimeStylePackage } from "./TimeStylePackage";
import { ActivitiesSection } from "./ActivitiesSection";
import { RecommendationsSection } from "./RecommendationsSection";
import { BanditsNotebook } from "./BanditsNotebook";
import { TodayInHistorySection } from "./TodayInHistorySection";
import { StoryOfSection, storyOfSubtitleFromSection } from "./StoryOfSection";
import { FolioReveal } from "./FolioReveal";
import { EditionClose } from "./EditionClose";
import { traceEditionReaderRender } from "../lib/perf/coldLaunchTrace";
import { BanditCharacter } from "./BanditCharacter";

type Props = {
  sections: EditionSection[];
  editionId?: string | null;
  editionDate?: string | null;
  leadStory?: LeadStory | null;
  /** Opens any Kindred article in the shared native reader. */
  onOpenArticle?: (article: KindredArticle) => void;
  /** Opens Local Event detail. */
  onOpenEvent?: (event: LocalEventCard) => void;
  /** Front-page "See all N events →" — opens the full Events list. */
  onSeeAllEvents?: () => void;
  /** Front-page "See all N activities →" — opens the full Activities list. */
  onSeeAllActivities?: () => void;
  /** Front-page "See all N recommendations →" — opens the full Recommendations list. */
  onSeeAllRecommendations?: (items: RankedDiscoveryItem[]) => void;
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
  readerLocation?: ReaderLocation | null;
  morningOpening?: MorningBriefing | null;
  morningBriefing?: MorningBriefing | null;
  morningHero?: MorningHeroExperience | null;
  /** Future: navigate to full Today's Masterpiece reader. */
  onOpenMasterpiece?: () => void;
  leadWhyThisMatters?: string | null;
  leadWhyChosen?: string | null;
  leadContinuityKicker?: string | null;
  discoveryHeadline?: string | null;
  discoveryEditorNote?: string | null;
  discoveryItems?: RankedDiscoveryItem[];
  /** Full discovery payload — Experiences pulls place-led surfaces from here. */
  discovery?: DiscoveryPayload | null;
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
  localEventsStatus?: LocalEventsLoadStatus;
};

const BANDITS_PICK_KICKER: Record<BanditsPickData["kind"], string> = {
  article: "From Bandit",
  event: "Happening Soon",
  activity: "Something To Do",
  hidden_gem: "Hidden Gem",
  place: "Worth Finding",
  seasonal: "Right Now",
};

/**
 * Wire photo when the story has one, otherwise a curated editorial fallback.
 * Used for authorized news desks — not listing sections.
 */
function wireOrFallbackImage(input: {
  imageUrl?: string | null;
  headline: string;
  section: string;
  summary?: string | null;
  source?: string | null;
}): ImageSourcePropType {
  const uri = input.imageUrl?.trim();
  if (uri) return { uri };
  const hero = resolveArticleHero({
    headline: input.headline,
    section: input.section,
    body: input.summary ? [input.summary] : [],
    source: input.source ?? null,
  });
  return (hero.source ?? require("../assets/heroes/hero-default-morning.jpg")) as ImageSourcePropType;
}

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

function EditionReaderInner({
  sections,
  editionId,
  editionDate,
  leadStory,
  onOpenArticle,
  onOpenEvent,
  onSeeAllEvents,
  onSeeAllActivities,
  onSeeAllRecommendations,
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
  readerLocation,
  morningOpening,
  morningBriefing,
  morningHero,
  onOpenMasterpiece,
  leadWhyThisMatters,
  leadWhyChosen,
  leadContinuityKicker,
  discoveryHeadline,
  discoveryEditorNote,
  discoveryItems,
  discovery,
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
  localEventsStatus = "ready",
}: Props) {
  const weather = sections.find((s) => s.section_type === "weather");
  const localEvents = sections.find((s) => s.section_type === "local_events");
  const greetingSection = sections.find((s) => s.section_type === "greeting");
  const events =
    (localEvents?.body ? parseLocalEventsBody(localEvents.body) : null) ?? [];

  const remaining = sections.filter(
    (s) =>
      s.section_type !== "greeting" &&
      s.section_type !== "weather" &&
      s.section_type !== "local_events"
  );

  const lookingAhead = remaining.find((s) => s.section_type === "looking_ahead");
  const history = remaining.find((s) => s.section_type === "today_in_history");
  const storyOf = remaining.find((s) => isStoryOfSection(s.section_type));
  const storyOfImage = useMemo(
    () => (storyOf ? storyOfImageFromSourceNote(storyOf.source_note) : null),
    [storyOf?.source_note]
  );
  const storyOfSubtitle = useMemo(
    () => (storyOf ? storyOfSubtitleFromSection(storyOf) : null),
    [storyOf]
  );
  const historyImage = useMemo(
    () => onThisDayImageFromKnowledge(knowledge),
    [knowledge]
  );
  const historyYear = useMemo(
    () => (history ? historyYearLabel(history, knowledge) : null),
    [history, knowledge]
  );
  const topStoriesSection = remaining.find((s) => s.section_type === "top_stories");
  const otherSections = remaining.filter(
    (s) =>
      s.section_type !== "looking_ahead" &&
      s.section_type !== "today_in_history" &&
      s.section_type !== "story_of" &&
      s.section_type !== "your_city" &&
      s.section_type !== "top_stories"
  );

  const dateLabel = editionDate ? formatEditionDate(editionDate) : null;
  const welcomeMessage =
    morningOpening?.text?.trim() ||
    greetingSection?.body?.trim()?.split(/\n/)[0] ||
    null;

  // Today's edition is generated once and must read the same on every
  // re-render (scrolling, clip toggles, live-refresh patches) — reset the
  // shared cross-section image ledger only when the edition itself
  // changes, never on every render, so a photo never flips under the
  // reader mid-scroll (kindred-mission.mdc: freeze today's edition).
  useMemo(() => {
    resetImageRegistry(editionId ?? editionDate ?? null);
  }, [editionId, editionDate]);

  // Freeze the discovery pool on first render of this edition — Activities,
  // Recommendations, and Bandit's Pick sides all derive from this snapshot
  // so live-refresh discovery patches never reshuffle the printed paper.
  // freezeEdition allows null→full fill-in if the first pass raced ahead of
  // the network payload; it never replaces a populated pool mid-read.
  useMemo(() => {
    if (!editionId || !editionDate) return;
    freezeEdition({
      editionId,
      editionDate,
      discovery,
      discoveryItems,
    });
  }, [editionId, editionDate, discovery, discoveryItems]);

  const frozenDiscovery = getFrozenDiscovery();
  const stableDiscovery = frozenDiscovery.discovery ?? discovery;
  const stableDiscoveryItems =
    frozenDiscovery.discoveryItems ?? discoveryItems;

  // A business already introduced in Local Events should never resurface
  // as a "new" Activity or Recommendation later on the same page — same
  // venue, same day, one appearance (kindred-mission.mdc: no duplicates).
  const eventVenueNames = useMemo(
    () =>
      new Set(
        events.flatMap((e) => {
          const keys: string[] = [];
          const venue = e.venue?.trim();
          if (venue && venue.toLowerCase() !== "venue tba") {
            keys.push(
              venue
                .toLowerCase()
                .replace(/[''`]/g, "")
                .replace(/\b(the|a|an)\b/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
            );
          }
          const name = e.name?.trim();
          if (name) {
            keys.push(
              name
                .toLowerCase()
                .replace(/[''`]/g, "")
                .replace(/\b(the|a|an)\b/g, "")
                .replace(/[^a-z0-9]+/g, " ")
                .trim()
            );
          }
          return keys;
        })
      ),
    [events]
  );

  // One discovery pool — every surface, flattened — partitioned once so
  // Weekend Escapes (Experiences), Bandit's Notebook, and Recommendations
  // never show the same item twice. Real local events are excluded here
  // entirely: they live only in Local Events, above, which reads `events`
  // directly and never touches this pool.
  const resolvedReaderLocation = useMemo(
    () =>
      resolveReaderLocation({
        readerLocation: readerLocation ?? null,
        discovery: stableDiscovery,
      }),
    [readerLocation, stableDiscovery]
  );

  const sectionAllocation = useMemo(
    () =>
      allocateDiscoverySections(stableDiscovery, stableDiscoveryItems, {
        excludeVenueNames: eventVenueNames,
        readerLocation: resolvedReaderLocation,
      }),
    [
      stableDiscovery,
      stableDiscoveryItems,
      eventVenueNames,
      resolvedReaderLocation,
    ]
  );

  // Activities/Recommendations need the true full claimed list on the
  // front page too, not just the first 8 — EditorialCardGrid already
  // decides how many cards to actually show (its own `limit`, default
  // 8) and only reveals "See more" once the real total exceeds that,
  // exactly like Local Events. Capping the pool itself to 8 here would
  // make "See more" never appear. Notebook/localBiz below intentionally
  // keep using the capped `sectionAllocation` — unrelated to this fix.
  const fullSectionAllocation = useMemo(
    () =>
      allocateDiscoverySections(stableDiscovery, stableDiscoveryItems, {
        max: Infinity,
        excludeVenueNames: eventVenueNames,
        readerLocation: resolvedReaderLocation,
      }),
    [
      stableDiscovery,
      stableDiscoveryItems,
      eventVenueNames,
      resolvedReaderLocation,
    ]
  );

  const editionAnchors = useMemo(
    () =>
      buildEditionAnchors({
        banditsPickTitle: banditsPick?.story.headline ?? null,
        banditsPickCategory:
          banditsPick?.story.discoveryItem?.category ?? banditsPick?.kind ?? null,
        historyHeadline: history?.headline ?? history?.body?.slice(0, 160) ?? null,
        heroStyle: [
          morningHero?.artworkTitle,
          morningHero?.aboutArtworkBody,
          ...(morningHero?.collections ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      }),
    [banditsPick, history, morningHero]
  );

  const curatedEdition = useMemo(
    () =>
      curateHomepageEdition({
        localEvents: events,
        allocation: fullSectionAllocation,
        anchors: editionAnchors,
      }),
    [events, fullSectionAllocation, editionAnchors]
  );

  const curatedFullAllocation = curatedEdition.allocation;

  const curatedSectionAllocation = useMemo(
    () => ({
      ...sectionAllocation,
      notebook: curatedFullAllocation.notebook.slice(0, HOMEPAGE_INITIAL_RENDER_COUNT),
    }),
    [sectionAllocation, curatedFullAllocation.notebook]
  );

  const curatedLocalEvents = curatedEdition.localEvents;

  const visibleEvents = useMemo(
    () => curatedLocalEvents.slice(0, HOMEPAGE_INITIAL_RENDER_COUNT),
    [curatedLocalEvents]
  );

  useMemo(() => {
    logLocalEventsPipeline(
      "EditionReader render",
      pipelineCountsFromSections(sections, visibleEvents.length),
      {
        editionId,
        editionDate,
        loadStatus: localEventsStatus,
      }
    );
  }, [sections, visibleEvents.length, editionId, editionDate, localEventsStatus]);

  useMemo(() => {
    if (!editionId) return;
    traceEditionReaderRender({
      sections,
      discovery: stableDiscovery ?? null,
      discoveryItems: stableDiscoveryItems ?? [],
      banditsPickPresent: Boolean(banditsPick),
      storyOfPresent: Boolean(storyOf),
      leadStory: leadStory ?? null,
      morningHeroPresent: Boolean(morningHero),
      readerLocation: resolvedReaderLocation,
    });
  }, [
    editionId,
    sections,
    stableDiscovery,
    stableDiscoveryItems,
    banditsPick,
    leadStory,
    morningHero,
    resolvedReaderLocation,
    storyOf,
  ]);

  const activityArticlesById = useMemo(
    () => discoveryArticlesById(curatedFullAllocation.activities, "activity", editionDate),
    [curatedFullAllocation.activities, editionDate]
  );

  const recommendationArticlesById = useMemo(
    () =>
      discoveryArticlesById(
        curatedFullAllocation.recommendations,
        "recommendation",
        editionDate
      ),
    [curatedFullAllocation.recommendations, editionDate]
  );

  const notebookArticlesById = useMemo(() => {
    const map = new Map<string, KindredArticle>();
    for (const item of curatedSectionAllocation.notebook) {
      map.set(item.item.id, articleFromNotebookItem(item, events, { editionDate }));
    }
    return map;
  }, [curatedSectionAllocation.notebook, events, editionDate]);

  const localBiz = sectionAllocation.nonEventItems.filter((d) =>
    ["coffee", "restaurants"].includes(d.item.category)
  );
  const banditPickSides = localBiz.slice(0, 2);
  const localBizArticlesById = useMemo(
    () => discoveryArticlesById(localBiz, undefined, editionDate),
    [localBiz, editionDate]
  );

  const banditsPickArticle = useMemo(() => {
    if (!banditsPick) return null;
    if (banditsPick.kind !== "article" && banditsPick.story.discoveryItem) {
      return articleFromDiscoveryItem(
        {
          item: banditsPick.story.discoveryItem,
          score: 0,
          reasons: [],
          surfaces: [],
        },
        { editionDate }
      );
    }
    return articleFromBanditsPick(
      {
        ...banditsPick.story,
        discoveryItem: banditsPick.story.discoveryItem ?? null,
      },
      { kind: banditsPick.kind }
    );
  }, [banditsPick, editionDate]);

  const localTopStories = topStories.filter((s) =>
    /local/i.test(s.role ?? "")
  );
  const nationalTopStories = topStories.filter(
    (s) => !/local/i.test(s.role ?? "")
  );

  let folioCursor = 0;

  function articleForSection(section: EditionSection): KindredArticle {
    if (section.section_type === "today_in_history") {
      return articleFromEditionSection(section, {
        historicalImage: onThisDayImageFromKnowledge(knowledge),
      });
    }
    if (isStoryOfSection(section.section_type)) {
      return articleFromEditionSection(section, {
        historicalImage: storyOfImageFromSourceNote(section.source_note),
        dek: parseStoryOfSourceNote(section.source_note)?.subtitle ?? null,
      });
    }
    return articleFromEditionSection(section);
  }

  function openLead(lead: LeadStory) {
    onOpenArticle?.(articleFromLeadStory(lead));
  }

  function renderSection(section: EditionSection, folioIndex: number) {
    const clipped = clippedSectionIds?.has(section.id) ?? false;
    const pending = clipPendingId === section.id;
    const opensReader =
      Boolean(onOpenArticle) && sectionOpensArticleReader(section.section_type);
    const intro = sectionIntro(section.section_type);

    function openSection() {
      if (!onOpenArticle) return;
      onOpenArticle(articleForSection(section));
    }

    const teaser = opensReader ? folioTeaser(section.body) : null;

    return (
      <FolioReveal index={folioIndex} key={section.id}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabel}>
              {SECTION_LABELS[section.section_type] ?? section.section_type}
            </Text>
            <View style={styles.sectionRule} />
          </View>

          {intro ? <Text style={styles.sectionIntro}>{intro}</Text> : null}

          <Pressable
            onPress={opensReader ? openSection : undefined}
            disabled={!opensReader}
            accessibilityRole={opensReader ? "link" : "text"}
            style={({ pressed }) => [opensReader && pressed && styles.tapPressed]}
          >
            <Text style={styles.sectionHeadline}>{section.headline}</Text>
            {teaser?.dek ? (
              <Text style={styles.sectionDek} numberOfLines={4}>
                {teaser.dek}
              </Text>
            ) : section.body ? (
              <Text style={styles.sectionDek} numberOfLines={5}>
                {section.body}
              </Text>
            ) : null}
            {opensReader ? (
              <Text style={styles.continueCue}>Continue reading</Text>
            ) : null}
          </Pressable>

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
                {pending ? "Saving…" : clipped ? "Saved" : "Save for later"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </FolioReveal>
    );
  }

  // Props retained for API stability with home/edition screens.
  void heroImageUri;
  void banditAside;
  void memoryNote;
  void banditFirstName;
  void morningBriefing;
  void leadWhyThisMatters;
  void leadWhyChosen;
  void leadContinuityKicker;
  void discoveryHeadline;
  void discoveryEditorNote;
  void mastheadLeading;

  return (
    <View style={styles.folio}>
      <MorningArrival
        editionDate={editionDate}
        locationCity={locationCity}
        locationRegion={locationRegion}
        locationState={locationState}
        weatherHeadline={weather?.headline ?? null}
        weatherBody={weather?.body ?? null}
        banditGreeting={banditGreeting}
        welcomeMessage={welcomeMessage}
        morningHero={morningHero}
        onOpenMasterpiece={onOpenMasterpiece}
        mastheadTrailing={mastheadTrailing}
        mastheadScrollY={mastheadScrollY}
        heroContext={{
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

      <FolioReveal index={folioCursor++}>
        <LocalEventsGrid
          events={events}
          homepageOrder={curatedLocalEvents}
          onOpenEvent={onOpenEvent}
          onSeeAll={events.length > 0 ? onSeeAllEvents : undefined}
          loadStatus={localEventsStatus}
        />
      </FolioReveal>

      <FolioReveal index={folioCursor++}>
        <ActivitiesSection
          items={curatedFullAllocation.activities}
          locationCity={locationCity}
          readerLocation={resolvedReaderLocation}
          onOpenItem={
            onOpenArticle
              ? (item) => {
                  const article = activityArticlesById.get(item.item.id);
                  if (article) onOpenArticle(article);
                }
              : undefined
          }
          onSeeAll={
            curatedFullAllocation.activities.length > 0
              ? onSeeAllActivities
              : undefined
          }
        />
      </FolioReveal>

      <FolioReveal index={folioCursor++}>
        <RecommendationsSection
          items={curatedFullAllocation.recommendations}
          locationCity={locationCity}
          readerLocation={resolvedReaderLocation}
          onOpenItem={
            onOpenArticle
              ? (item) => {
                  const article = recommendationArticlesById.get(item.item.id);
                  if (article) onOpenArticle(article);
                }
              : undefined
          }
          onSeeAll={
            curatedFullAllocation.recommendations.length > 0 &&
            onSeeAllRecommendations
              ? () =>
                  onSeeAllRecommendations(curatedFullAllocation.recommendations)
              : undefined
          }
        />
      </FolioReveal>

      {storyOf ? (
        <FolioReveal index={folioCursor++}>
          <StoryOfSection
            section={storyOf}
            cityName={locationCity}
            image={storyOfImage}
            subtitle={storyOfSubtitle}
            onOpen={
              onOpenArticle
                ? () => onOpenArticle(articleForSection(storyOf))
                : undefined
            }
          />
        </FolioReveal>
      ) : null}

      {history ? (
        <FolioReveal index={folioCursor++}>
          <TodayInHistorySection
            section={history}
            historicalYear={historyYear}
            image={historyImage}
            onOpen={
              onOpenArticle
                ? () => onOpenArticle(articleForSection(history))
                : undefined
            }
          />
        </FolioReveal>
      ) : null}

      {banditsPick ? (
        <FolioReveal index={folioCursor++}>
          {banditsPick.intro?.trim() ? (
            <View
              style={styles.banditPickNoteRow}
              accessible
              accessibilityLabel={`Bandit says: ${banditsPick.intro.trim()}`}
            >
              <BanditCharacter
                pose="head-portrait"
                size={40}
                style={styles.banditPickAvatar}
                decorative
              />
              <Text style={styles.banditPickNote} maxFontSizeMultiplier={1.3}>
                {banditsPick.intro.trim()}
              </Text>
            </View>
          ) : null}
          <TimeStylePackage
            sectionLabel="Bandit’s Pick"
            feature={{
              id: banditsPick.story.id,
              kicker: BANDITS_PICK_KICKER[banditsPick.kind],
              headline: banditsPick.story.headline,
              categoryIcon: banditsPickArticle?.categoryIcon ?? null,
              dek: banditsPick.story.summary,
              byline:
                banditsPick.kind === "article" && banditsPick.story.source
                  ? `by ${banditsPick.story.source}`
                  : "— Bandit",
            }}
            sides={banditPickSides.map((d) => ({
              id: d.item.id,
              kicker: "Local",
              headline: d.item.title,
              categoryIcon: localBizArticlesById.get(d.item.id)?.categoryIcon ?? null,
              byline: d.item.place?.city ?? d.item.source?.name ?? null,
            }))}
            onOpen={
              onOpenArticle
                ? (id) => {
                    if (id === banditsPick.story.id) {
                      if (banditsPickArticle) onOpenArticle(banditsPickArticle);
                      return;
                    }
                    const article = localBizArticlesById.get(id);
                    if (article) onOpenArticle(article);
                  }
                : undefined
            }
          />
        </FolioReveal>
      ) : null}

      {leadStory && /local/i.test(leadStory.role ?? "") ? (
        <FolioReveal index={folioCursor++}>
          <TimeStylePackage
            sectionLabel="Local News"
            feature={{
              id: leadStory.id,
              kicker: "Local",
              headline: leadStory.headline,
              dek: leadStory.summary,
              byline: leadStory.source,
              image: wireOrFallbackImage({
                imageUrl: leadStory.heroImage?.uri,
                headline: leadStory.headline,
                section: "local_news",
                summary: leadStory.summary,
                source: leadStory.source,
              }),
              imageLabel: leadStory.heroImage?.alt,
            }}
            sides={localTopStories.slice(0, 2).map((s) => ({
              id: s.id,
              headline: s.headline,
              byline: s.source,
              image: wireOrFallbackImage({
                imageUrl: s.imageUrl,
                headline: s.headline,
                section: "local_news",
                summary: s.summary,
                source: s.source,
              }),
            }))}
            onOpen={
              onOpenArticle
                ? (id) => {
                    if (id === leadStory.id) {
                      openLead(leadStory);
                      return;
                    }
                    const story = localTopStories.find((s) => s.id === id);
                    if (story) onOpenArticle(articleFromTopStory(story));
                  }
                : undefined
            }
          />
        </FolioReveal>
      ) : null}

      {lookingAhead ? (
        <FolioReveal index={folioCursor++}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Community</Text>
              <View style={styles.sectionRule} />
            </View>
            <Text style={styles.sectionIntro}>
              Notes from the neighborhood desk.
            </Text>
            <Pressable
              onPress={
                onOpenArticle
                  ? () =>
                      onOpenArticle(articleFromEditionSection(lookingAhead))
                  : undefined
              }
              style={({ pressed }) => [pressed && styles.tapPressed]}
            >
              <Text style={styles.cardKicker}>Looking ahead</Text>
              <Text style={styles.sectionHeadline}>
                {lookingAhead.headline}
              </Text>
              <Text style={styles.sectionDek} numberOfLines={3}>
                {folioTeaser(lookingAhead.body).dek}
              </Text>
            </Pressable>
          </View>
        </FolioReveal>
      ) : null}

      {leadStory && !/local/i.test(leadStory.role ?? "") ? (
        <FolioReveal index={folioCursor++}>
          <TimeStylePackage
            sectionLabel="From the wider world"
            feature={{
              id: leadStory.id,
              kicker: leadStory.role?.replace(/_/g, " ") ?? "National",
              headline: leadStory.headline,
              dek: leadStory.summary,
              byline: leadStory.source,
              image: wireOrFallbackImage({
                imageUrl: leadStory.heroImage?.uri,
                headline: leadStory.headline,
                section: leadStory.role ?? "national",
                summary: leadStory.summary,
                source: leadStory.source,
              }),
            }}
            sides={nationalTopStories.slice(0, 2).map((s) => ({
              id: s.id,
              headline: s.headline,
              byline: s.source,
              image: wireOrFallbackImage({
                imageUrl: s.imageUrl,
                headline: s.headline,
                section: s.role ?? "national",
                summary: s.summary,
                source: s.source,
              }),
            }))}
            onOpen={
              onOpenArticle
                ? (id) => {
                    if (id === leadStory.id) {
                      openLead(leadStory);
                      return;
                    }
                    const story = nationalTopStories.find((s) => s.id === id);
                    if (story) onOpenArticle(articleFromTopStory(story));
                  }
                : undefined
            }
          />
        </FolioReveal>
      ) : nationalTopStories.length > 0 || topStoriesSection ? (
        <FolioReveal index={folioCursor++}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>From the wider world</Text>
              <View style={styles.sectionRule} />
            </View>
            {(nationalTopStories.length > 0 ? nationalTopStories : topStories)
              .slice(0, 4)
              .map((story, index, arr) => (
                <Pressable
                  key={story.id}
                  onPress={() => onOpenArticle?.(articleFromTopStory(story))}
                  style={({ pressed }) => [
                    styles.topStoryItem,
                    index === arr.length - 1 && styles.topStoryItemLast,
                    pressed && styles.tapPressed,
                  ]}
                >
                  <Text style={styles.sectionHeadline}>{story.headline}</Text>
                  {story.summary ? (
                    <Text style={styles.sectionDek} numberOfLines={2}>
                      {folioTeaser(story.summary).dek}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
          </View>
        </FolioReveal>
      ) : null}

      {otherSections.map((section) => renderSection(section, folioCursor++))}

      <FolioReveal index={folioCursor++}>
        <BanditsNotebook
          items={curatedSectionAllocation.notebook}
          discovery={null}
          onOpenItem={
            onOpenArticle
              ? (item) => {
                  const article = notebookArticlesById.get(item.item.id);
                  if (article) onOpenArticle(article);
                }
              : undefined
          }
        />
      </FolioReveal>

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

function editionReaderPropsAreEqual(prev: Props, next: Props): boolean {
  return (
    prev.editionId === next.editionId &&
    prev.editionDate === next.editionDate &&
    prev.sections === next.sections &&
    prev.leadStory === next.leadStory &&
    prev.discovery === next.discovery &&
    prev.discoveryItems === next.discoveryItems &&
    prev.banditsPick === next.banditsPick &&
    prev.knowledge === next.knowledge &&
    prev.morningHero === next.morningHero &&
    prev.morningOpening === next.morningOpening &&
    prev.morningBriefing === next.morningBriefing &&
    prev.localEventsStatus === next.localEventsStatus &&
    prev.clippedSectionIds === next.clippedSectionIds &&
    prev.readerLocation === next.readerLocation &&
    prev.topStories === next.topStories &&
    prev.heroImageUri === next.heroImageUri
  );
}

export const EditionReader = memo(EditionReaderInner, editionReaderPropsAreEqual);

const styles = StyleSheet.create({
  folio: {
    paddingBottom: space.endPadding,
  },
  banditPickNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  banditPickAvatar: {
    marginTop: 2,
  },
  banditPickNote: {
    flex: 1,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.inkBody,
  },
  sectionCard: {
    marginBottom: space.sectionGap,
    paddingBottom: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  weatherCard: {
    marginTop: 2,
  },
  cardKicker: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 8,
    marginTop: 4,
  },
  communitySecond: {
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
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
