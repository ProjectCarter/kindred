import { useMemo, type ReactNode } from "react";
import {
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
  articleFromTopStory,
  type TopStoryItem,
} from "../lib/edition/topStories";
import { whyThisMatters } from "../lib/edition/knowledge";
import type { KnowledgePayload } from "../lib/edition/knowledge";
import { paper, press, space, type } from "../lib/edition/newspaperTheme";
import { sectionIntro } from "../lib/edition/sectionIntro";
import type { HeroRegionId } from "../lib/edition/HeroImageService";
import { parseLocalEventsBody, type LocalEventCard } from "../lib/edition/localEvents";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator";
import { resolveArticleHero } from "../lib/edition/articleHero";
import { experienceImageFor } from "../lib/edition/experiences";
import { activityImageFor } from "../lib/edition/activities";
import { MorningArrival } from "./MorningArrival";
import { LocalEventsGrid } from "./LocalEventsGrid";
import { TimeStylePackage } from "./TimeStylePackage";
import { ActivitiesSection } from "./ActivitiesSection";
import { RecommendationsSection } from "./RecommendationsSection";
import { BanditsNotebook } from "./BanditsNotebook";
import { FolioReveal } from "./FolioReveal";
import { EditionClose } from "./EditionClose";

type Props = {
  sections: EditionSection[];
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
  onSeeAllRecommendations?: () => void;
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
};

/**
 * Every TimeStylePackage card needs a photo — a wire photo when the story
 * has one, otherwise a curated editorial fallback matched to its subject.
 * Never the blank cream box: a headline without a real photo still deserves
 * a real image, not an empty rectangle.
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

const BANDITS_PICK_KICKER: Record<BanditsPickData["kind"], string> = {
  article: "From Bandit",
  event: "Happening Soon",
  activity: "Something To Do",
  hidden_gem: "Hidden Gem",
  place: "Worth Finding",
  seasonal: "Right Now",
};

const SEASONAL_IMAGE_BY_MONTH: ImageSourcePropType[] = [
  require("../assets/heroes/hero-winter-snowfall.jpg"), // Jan
  require("../assets/heroes/hero-winter-snowfall.jpg"), // Feb
  require("../assets/heroes/hero-spring-flowers.jpg"), // Mar
  require("../assets/heroes/hero-spring-flowers.jpg"), // Apr
  require("../assets/heroes/hero-spring-flowers.jpg"), // May
  require("../assets/heroes/hero-summer-sunrise.jpg"), // Jun
  require("../assets/heroes/hero-summer-sunrise.jpg"), // Jul
  require("../assets/heroes/hero-summer-sunrise.jpg"), // Aug
  require("../assets/heroes/hero-autumn-leaves.jpg"), // Sep
  require("../assets/heroes/hero-autumn-leaves.jpg"), // Oct
  require("../assets/heroes/hero-autumn-leaves.jpg"), // Nov
  require("../assets/heroes/hero-winter-snowfall.jpg"), // Dec
];

/**
 * Bandit's Pick is not always an article — give each kind its own honest
 * photograph instead of stretching the wire-photo fallback (built for
 * news headlines) over an event, a place, or a seasonal moment.
 */
function banditsPickImage(
  pick: BanditsPickData,
  editionDate?: string | null
): ImageSourcePropType {
  const { kind, story } = pick;
  const realPhoto = story.imageUrl?.trim();
  if (realPhoto) return { uri: realPhoto };

  if (kind === "article") {
    return wireOrFallbackImage({
      imageUrl: story.imageUrl,
      headline: story.headline,
      section: "bandits_pick",
      summary: story.summary,
      source: story.source,
    });
  }

  if (kind === "activity" && story.discoveryItem) {
    return activityImageFor(story.discoveryItem);
  }

  if (kind === "seasonal") {
    const month = editionDate?.match(/^\d{4}-(\d{2})/)?.[1];
    const index = month ? Number(month) - 1 : new Date().getMonth();
    return (
      SEASONAL_IMAGE_BY_MONTH[index] ??
      require("../assets/heroes/hero-default-morning.jpg")
    );
  }

  // event / place / hidden_gem without a real listing photo
  return experienceImageFor(story.discoveryItem?.category ?? "experiences", story.id);
}

/**
 * Local businesses (coffee, restaurants) never carry a provider photo —
 * Foursquare's photo field is a paid tier Kindred doesn't use. Give each
 * a real category-matched photograph instead of leaving the side card
 * blank, and keep the pair visually distinct from one another.
 */
function localBizSideImages(
  items: RankedDiscoveryItem[]
): ImageSourcePropType[] {
  const used = new Set<ImageSourcePropType>();
  return items.map((d) => {
    const primary = experienceImageFor(d.item.category, d.item.id);
    if (!used.has(primary)) {
      used.add(primary);
      return primary;
    }
    const alt = experienceImageFor(d.item.category, `${d.item.id}:alt`);
    used.add(alt);
    return alt;
  });
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

export function EditionReader({
  sections,
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
  morningOpening,
  morningBriefing,
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
  const topStoriesSection = remaining.find((s) => s.section_type === "top_stories");
  const otherSections = remaining.filter(
    (s) =>
      s.section_type !== "looking_ahead" &&
      s.section_type !== "today_in_history" &&
      s.section_type !== "top_stories"
  );

  const dateLabel = editionDate ? formatEditionDate(editionDate) : null;
  const welcomeMessage =
    morningOpening?.text?.trim() ||
    greetingSection?.body?.trim()?.split(/\n/)[0] ||
    null;

  // One discovery pool — every surface, flattened — partitioned once so
  // Weekend Escapes (Experiences), Bandit's Notebook, and Recommendations
  // never show the same item twice. Real local events are excluded here
  // entirely: they live only in Local Events, above, which reads `events`
  // directly and never touches this pool.
  const sectionAllocation = useMemo(
    () => allocateDiscoverySections(discovery, discoveryItems),
    [discovery, discoveryItems]
  );

  // Activities/Recommendations need the true full claimed list on the
  // front page too, not just the first 8 — EditorialCardGrid already
  // decides how many cards to actually show (its own `limit`, default
  // 8) and only reveals "See more" once the real total exceeds that,
  // exactly like Local Events. Capping the pool itself to 8 here would
  // make "See more" never appear. Notebook/localBiz below intentionally
  // keep using the capped `sectionAllocation` — unrelated to this fix.
  const fullSectionAllocation = useMemo(
    () => allocateDiscoverySections(discovery, discoveryItems, { max: Infinity }),
    [discovery, discoveryItems]
  );

  const localBiz = sectionAllocation.nonEventItems.filter((d) =>
    ["coffee", "restaurants"].includes(d.item.category)
  );
  const banditPickSides = localBiz.slice(0, 2);
  const banditPickSideImages = localBizSideImages(banditPickSides);

  const localTopStories = topStories.filter((s) =>
    /local/i.test(s.role ?? "")
  );
  const nationalTopStories = topStories.filter(
    (s) => !/local/i.test(s.role ?? "")
  );

  let folioCursor = 0;

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
      onOpenArticle(articleFromEditionSection(section));
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
  void knowledge;
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
          onOpenEvent={onOpenEvent}
          onSeeAll={events.length > 0 ? onSeeAllEvents : undefined}
        />
      </FolioReveal>

      <FolioReveal index={folioCursor++}>
        <ActivitiesSection
          items={fullSectionAllocation.activities}
          locationCity={locationCity}
          onOpenItem={
            onOpenArticle
              ? (item) => onOpenArticle(articleFromDiscoveryItem(item))
              : undefined
          }
          onSeeAll={
            fullSectionAllocation.activities.length > 0
              ? onSeeAllActivities
              : undefined
          }
        />
      </FolioReveal>

      <FolioReveal index={folioCursor++}>
        <RecommendationsSection
          items={fullSectionAllocation.recommendations}
          locationCity={locationCity}
          onOpenItem={
            onOpenArticle
              ? (item) => onOpenArticle(articleFromDiscoveryItem(item))
              : undefined
          }
          onSeeAll={
            fullSectionAllocation.recommendations.length > 0
              ? onSeeAllRecommendations
              : undefined
          }
        />
      </FolioReveal>

      {banditsPick ? (
        <FolioReveal index={folioCursor++}>
          <TimeStylePackage
            sectionLabel="Bandit’s Pick"
            feature={{
              id: banditsPick.story.id,
              kicker: BANDITS_PICK_KICKER[banditsPick.kind],
              headline: banditsPick.story.headline,
              dek: banditsPick.intro || banditsPick.story.summary,
              byline:
                banditsPick.kind === "article" && banditsPick.story.source
                  ? `by ${banditsPick.story.source}`
                  : "— Bandit",
              image: banditsPickImage(banditsPick, editionDate),
            }}
            sides={banditPickSides.map((d, i) => ({
              id: d.item.id,
              kicker: "Local",
              headline: d.item.title,
              byline: d.item.place?.city ?? d.item.source?.name ?? null,
              image: banditPickSideImages[i],
            }))}
            onOpen={
              onOpenArticle
                ? (id) => {
                    if (id === banditsPick.story.id) {
                      if (
                        banditsPick.kind !== "article" &&
                        banditsPick.story.discoveryItem
                      ) {
                        onOpenArticle(
                          articleFromDiscoveryItem({
                            item: banditsPick.story.discoveryItem,
                            score: 0,
                            reasons: [],
                            surfaces: [],
                          })
                        );
                        return;
                      }
                      onOpenArticle(articleFromBanditsPick(banditsPick.story));
                      return;
                    }
                    const hit = localBiz.find((d) => d.item.id === id);
                    if (hit) onOpenArticle(articleFromDiscoveryItem(hit));
                  }
                : undefined
            }
          />
        </FolioReveal>
      ) : null}

      {history || lookingAhead ? (
        <FolioReveal index={folioCursor++}>
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabel}>Community</Text>
              <View style={styles.sectionRule} />
            </View>
            <Text style={styles.sectionIntro}>
              Notes from the neighborhood desk.
            </Text>
            {history ? (
              <Pressable
                onPress={
                  onOpenArticle
                    ? () => onOpenArticle(articleFromEditionSection(history))
                    : undefined
                }
                style={({ pressed }) => [pressed && styles.tapPressed]}
              >
                <Text style={styles.cardKicker}>Today in history</Text>
                <Text style={styles.sectionHeadline}>{history.headline}</Text>
                <Text style={styles.sectionDek} numberOfLines={3}>
                  {folioTeaser(history.body).dek}
                </Text>
              </Pressable>
            ) : null}
            {lookingAhead ? (
              <Pressable
                onPress={
                  onOpenArticle
                    ? () =>
                        onOpenArticle(articleFromEditionSection(lookingAhead))
                    : undefined
                }
                style={({ pressed }) => [
                  history ? styles.communitySecond : null,
                  pressed && styles.tapPressed,
                ]}
              >
                <Text style={styles.cardKicker}>Looking ahead</Text>
                <Text style={styles.sectionHeadline}>
                  {lookingAhead.headline}
                </Text>
                <Text style={styles.sectionDek} numberOfLines={3}>
                  {folioTeaser(lookingAhead.body).dek}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </FolioReveal>
      ) : null}

      {leadStory && /local/i.test(leadStory.role ?? "") ? (
        <FolioReveal index={folioCursor++}>
          <TimeStylePackage
            sectionLabel="Local Articles"
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
          items={sectionAllocation.notebook}
          discovery={null}
          onOpenItem={
            onOpenArticle
              ? (item) => onOpenArticle(articleFromNotebookItem(item, events))
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


const styles = StyleSheet.create({
  folio: {
    paddingBottom: space.endPadding,
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
