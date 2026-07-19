import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Animated,
  Pressable,
  RefreshControl,
  AppState,
  type AppStateStatus,
  type ScrollView,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { type EditionSection } from "../lib/edition/types";
import {
  fetchAdjacentEditions,
  type AdjacentEdition,
} from "../lib/edition/adjacent";
import { parseLeadStory, type LeadStory } from "../lib/edition/LeadStory";
import { openKindredArticle } from "../lib/edition/openArticle";
import { openKindredEvent } from "../lib/edition/openEvent";
import { openMasterpiece } from "../lib/edition/openMasterpiece";
import { setActiveEditionId } from "../lib/edition/editionContext";
import { articleFromEditionSectionWithKnowledge } from "../lib/edition/article";
import { saveClipping, removeClipping } from "../lib/edition/clippings";
import { resolveArticleForStoryKey } from "../lib/edition/relatedArticle";
import { stashArticle } from "../lib/edition/articleStore";
import { parseLocalEventsBody } from "../lib/edition/localEvents";
import { stashTodaysEvents } from "../lib/edition/eventsListStore";
import { stashTodaysActivities } from "../lib/edition/activitiesListStore";
import { stashTodaysHistoryPlaces } from "../lib/edition/historyAroundTownListStore";
import { stashTodaysRecommendations } from "../lib/edition/recommendationsListStore";
import { sliceForSeeAll } from "../lib/edition/editorialPublishing";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator";
import {
  banditMorningLine,
  banditsPick,
  parseBanditPayload,
  type BanditPayload,
} from "../lib/edition/bandit";
import { isBanditsPicksEnabled } from "../lib/edition/banditsPicksFeature";
import { preloadMorningHeroImage } from "../lib/edition/heroArtwork/preload";
import {
  companionForArticle,
  enrichEditionIntelligenceKnowledgeMemory,
  parseEditionIntelligence,
  type EditionIntelligence,
} from "../lib/edition/surfaceIntelligence";
import {
  topStoriesFromEditorialContext,
  type TopStoryItem,
} from "../lib/edition/topStories";
import {
  resolveNationalNewsForRender,
  type NationalNewsPackage,
} from "../lib/edition/nationalNews";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../lib/personalization";
import {
  morningSalutation,
  waitingCopy,
  PREPARING_LINES,
} from "../lib/edition/morningRitual";
import { localEditionDate } from "../lib/edition/dates";
import {
  fetchGenerationJobForEdition,
  GENERATION_FIRST_PAINT_MAX_MS,
  GENERATION_INVOKE_TIMEOUT_MS,
  GENERATION_POLL_MAX_MS,
  GENERATION_STALL_MESSAGE,
  parseGenerateEditionResponse,
  waitForEditionGeneration,
} from "../lib/edition/generationJobs";
import { isProcessingEditionPaintable } from "../lib/edition/minimumViableEdition";
import { syncDeviceTimezone } from "../lib/edition/timezone";
import { maybeTriggerLiveRefresh } from "../lib/edition/liveRefresh";
import {
  clearEditionFreeze,
  freezeEdition,
  isEditionFrozen,
  mergeFrozenSections,
  setFrozenHeroImageId,
} from "../lib/edition/editionFreeze";
import {
  loadCachedEdition,
  peekMemoryCachedEdition,
  saveCachedEdition,
  scheduleCachedEditionSave,
  clearCachedEdition,
  type CachedEditionBundle,
} from "../lib/edition/editionCache";
import {
  isCachedEditionPaintable,
  isStaleCachedEdition,
  networkSectionsMatchCache,
} from "../lib/edition/instantEdition";
import { loadWithRetry } from "../lib/edition/loadWithRetry";
import {
  countValidEventsInSections,
  logLocalEventsPipeline,
  pipelineCountsFromSections,
  type LocalEventsLoadStatus,
} from "../lib/edition/localEventsPipeline";
import {
  needsLocalEventsRecovery,
  recoverLocalEvents,
} from "../lib/edition/localEventsRecovery";
import { recoverTodayInHistory } from "../lib/edition/todayInHistoryRecovery";
import { fetchUsNationalDailyByDate } from "../lib/edition/fetchUsNationalDaily";
import type { UsNationalDailyRecord } from "../lib/edition/usNationalDaily";
import {
  articleIdentityFromSection,
  imageIdentityFromAsset,
  logTodayInHistorySyncTrace,
  resolvePairedNationalDailyForCache,
} from "../lib/edition/todayInHistorySync";
import { todayInHistoryImageFromNationalDaily } from "../lib/edition/todayInHistoryImage";
import { recoverStoryOf } from "../lib/edition/storyOfRecovery";
import { recoverMorningHero } from "../lib/edition/morningHeroRecovery";
import { metroExpectsStoryOf } from "../lib/edition/storyOfCoverage";
import { metroKeyFromKindredPlace } from "../lib/location/metroKey";
import { paper, press } from "../lib/edition/newspaperTheme";
import { PaperLoading } from "../components/PaperLoading";
import { EditionReader } from "../components/EditionReader";
import { EditionAdjacentNav } from "../components/EditionAdjacentNav";
import {
  KindredFullMasthead,
  KindredStickyMasthead,
  MastheadLink,
} from "../components/KindredMasthead";
import {
  locationPayload,
  returnToHomeCity,
  type ActiveLocation,
  type KindredPlace,
} from "../lib/location/deviceLocation";
import {
  hydrateDevEditionOverrideState,
} from "../lib/dev/editionOverrideStore";
import { consumePendingDevEditionGenerate, peekPendingDevEditionGenerate } from "../lib/dev/pendingDevGenerate";
import {
  createDevGenerateTraceId,
  devGenerateTrace,
  devGenerateTraceSummary,
} from "../lib/dev/devGenerateTrace";
import { shouldDeferLoadEditionDuringGenerate } from "../lib/dev/devGenerateGuard";
import {
  HOME_SCROLL_AT_TOP_PX,
  logHomeScrollDebug,
  scrollDebugSnapshot,
  type ArticleReturnRestorePhase,
  type HomeScrollSessionPhase,
} from "../lib/dev/homeScrollDebug";
import {
  developerPreviewPlace,
  displayCityForEdition,
  getDeveloperPreviewContextSync,
  hydrateDeveloperPreviewContext,
  isDeveloperPreviewSessionActive,
  setDeveloperPreviewContext,
} from "../lib/dev/developerPreviewContext";
import { resolveEditionLoadIdentity } from "../lib/dev/editionLoadIdentity";
import {
  maybeRecordDevEditionSnapshot,
  tryApplyDevEditionPreview,
} from "../lib/dev/devEditionHomeIntegration";
import {
  resolveEffectiveEditionDate,
  resolveEffectiveEditionDateSync,
  resolveEffectivePlace,
  shouldBypassEditionCityMismatch,
  isDevEditionOverrideActive,
} from "../lib/edition/resolveEditionContext";
import { locationKey } from "../lib/location/locationKey";
import {
  getTemperatureUnitPreference,
} from "../lib/weather/units";
import {
  resolveEditionBuiltCity,
  cityFromEditionSections,
} from "../lib/edition/editionLocation";
import { shouldWithholdEditionForCityMismatch } from "../lib/edition/editionCityMismatch";
import {
  LocationFirstRun,
  useLocationFirstRun,
} from "../components/LocationFirstRun";
import {
  clearHomeScroll,
  homeScrollSessionKey,
  loadHomeScroll,
  updateHomeScroll,
} from "../lib/edition/homeSession";
import { markStartup, logStartupSummary } from "../lib/perf/startupTiming";
import {
  pipelineStageBegin,
  pipelineStageEnd,
  reportStartupPipeline,
} from "../lib/perf/startupPipeline";
import { getLaunchSessionOrFetch, getPrimedLaunchUserId } from "../lib/auth/launchSession";
import {
  assessEditionCompleteness,
  logEditionCompleteness,
} from "../lib/perf/editionCompleteness";
import {
  isPersistedEditionComplete,
  traceParsedIntelligence,
  traceReactState,
  traceSupabaseEditionRow,
  traceSupabaseEditionSections,
} from "../lib/perf/coldLaunchTrace";
import { parseDiscoveryPayload } from "../lib/edition/discovery";
import {
  mergeMorningHeroIntoCachedBundle,
  mergeMorningHeroIntoIntelligence,
  needsNetworkMorningHeroMerge,
  resolveMorningHero,
} from "../lib/edition/resolveMorningHero";
import {
  mergeHistoryAroundTownIntoCachedBundle,
  mergeHistoryAroundTownIntoIntelligence,
  needsNetworkHistoryAroundTownMerge,
  resolveHistoryAroundTown,
} from "../lib/edition/resolveHistoryAroundTown";
import {
  mergeWeatherSummaryIntoIntelligence,
  needsNetworkWeatherSummaryMerge,
  resolveWeatherSummary,
} from "../lib/edition/resolveWeatherSummary";
import { parseHistoryAroundTownPayload } from "../lib/edition/historyAroundTown/types";
import {
  masterpieceTraceAsync,
} from "../lib/edition/masterpieceDiagnostics";
import { SUPPORTED_REGION_MESSAGE } from "../lib/markets/constants";
import { editionMetroKeyFromPlace } from "../lib/markets/editionIdentity";

function isNonUsEditionResponse(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as { code?: unknown; error?: unknown };
  if (record.code === "NON_US_REGION") return true;
  const message = String(record.error ?? "");
  return message.includes(SUPPORTED_REGION_MESSAGE);
}

function editionCacheMetroKey(place: KindredPlace | null | undefined): string | null {
  if (!place?.city) return null;
  return editionMetroKeyFromPlace(place);
}

const EDITION_SECTIONS_HOME_SELECT =
  "id, section_type, position, headline, body, source_note";

function queryEditionSections(editionId: string) {
  return supabase
    .from("edition_sections")
    .select(EDITION_SECTIONS_HOME_SELECT)
    .eq("edition_id", editionId)
    .order("position", { ascending: true });
}

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preparingStep, setPreparingStep] = useState(0);
  const [sections, setSections] = useState<EditionSection[]>([]);
  const [editionDate, setEditionDate] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [leadStory, setLeadStory] = useState<LeadStory | null>(null);
  const [topStories, setTopStories] = useState<TopStoryItem[]>([]);
  const [nationalNews, setNationalNews] = useState<NationalNewsPackage | null>(null);
  const [bandit, setBandit] = useState<BanditPayload | null>(null);
  const [intelligence, setIntelligence] =
    useState<EditionIntelligence | null>(null);
  const [nationalDaily, setNationalDaily] =
    useState<UsNationalDailyRecord | null>(null);
  const [pairedNationalDaily, setPairedNationalDaily] =
    useState<UsNationalDailyRecord | null>(null);
  const [clippedIds, setClippedIds] = useState<Set<string>>(new Set());
  const [clipPendingId, setClipPendingId] = useState<string | null>(null);
  const [older, setOlder] = useState<AdjacentEdition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(
    null
  );
  const [showFirstRun, setShowFirstRun] = useState(false);
  const [locationMismatch, setLocationMismatch] = useState<string | null>(null);
  const [pendingCityRegen, setPendingCityRegen] = useState(false);
  /** Overnight job status for today's edition — drives the "on the press" state. */
  const [backgroundJob, setBackgroundJob] = useState<{
    status: string;
    lastError: string | null;
  } | null>(null);
  const [localEventsStatus, setLocalEventsStatus] =
    useState<LocalEventsLoadStatus>("loading");
  const { pending: firstRunPending, dismiss: dismissFirstRun } =
    useLocationFirstRun();
  const loadGen = useRef(0);
  const mountedRef = useRef(true);
  /** Sync guard — React state alone can miss rapid double-taps. */
  const generatingRef = useRef(false);
  const devGenerationMsRef = useRef<number | null>(null);
  /** Abort in-flight generate-edition fetch on timeout / unmount / supersede. */
  const generateAbortRef = useRef<AbortController | null>(null);
  /** True while waitForEditionGeneration is polling — exempt from spinner safety timeout. */
  const generationPollActiveRef = useRef(false);
  const devGenerateTraceIdRef = useRef<string | null>(null);
  /** Collapsing editorial masthead — scroll position drives compact sticky chrome. */
  const mastheadScrollY = useRef(new Animated.Value(0)).current;
  /** One auto-regen per edition id + active city. */
  const autoRegenKey = useRef<string | null>(null);
  /** True once today's ready edition has been painted — blocks disruptive reloads. */
  const editionFrozenRef = useRef(false);
  /** Cached bundle painted before network — skip duplicate hydrate/parse. */
  const instantHydratedRef = useRef(false);
  const startupSummaryLoggedRef = useRef(false);
  /** Cached bundle used when the network is slow or unavailable. */
  const cachedBundleRef = useRef<CachedEditionBundle | null>(null);

  /** Tracks location when home last focused — reload edition if it changes. */
  const focusedLocationKeyRef = useRef<string | null>(null);
  /** Homepage scroll — preserve exact offset when returning from detail screens. */
  const scrollRef = useRef<ScrollView>(null);
  const homeScrollYRef = useRef(0);
  const pendingScrollRestoreY = useRef(0);
  const restoredScrollRef = useRef(false);
  const skipScrollRestoreRef = useRef(false);
  const resetScrollOnLoadRef = useRef(false);
  /** Initial launch restore — independent of article return. */
  const scrollSessionPhaseRef = useRef<HomeScrollSessionPhase>("initial");
  /** One-shot article-return restore lifecycle. */
  const articleReturnPhaseRef = useRef<ArticleReturnRestorePhase>("idle");
  const articleReturnTargetYRef = useRef(0);
  const articleReturnGenerationRef = useRef(0);
  /** Set on focus cleanup — gates navigation-return restore. */
  const homeScreenBlurredRef = useRef(false);
  const homeScrollDraggingRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const homeFocusTransitionCountRef = useRef(0);
  const initialRestoreEditionRef = useRef<string | null>(null);
  const restoreInitialScrollIfNeededRef = useRef<
    (contentHeight?: number) => void
  >(() => {});
  const restoreArticleReturnScrollIfNeededRef = useRef<
    (contentHeight?: number) => void
  >(() => {});
  const editionIdRef = useRef<string | null>(null);
  const activeLocationRef = useRef<ActiveLocation | null>(null);
  /** Mount effect resolves location once — skip duplicate read on first focus. */
  const initialFocusLocationHandledRef = useRef(false);

  editionIdRef.current = editionId;
  activeLocationRef.current = activeLocation;

  /** Keep ref in sync immediately — React state can lag behind loadEdition. */
  function applyActiveLocation(next: ActiveLocation): void {
    activeLocationRef.current = next;
    setActiveLocation(next);
  }

  function readerDisplayCity(): string | undefined {
    const preview = getDeveloperPreviewContextSync();
    return displayCityForEdition({
      preview,
      discoveryCity: intelligence?.discovery?.location?.city ?? null,
      activeCity: activeLocation?.place?.city ?? null,
    });
  }

  function readerDisplayPlace(): KindredPlace | null {
    const preview = getDeveloperPreviewContextSync();
    if (preview) {
      return {
        city: preview.city,
        state: preview.state,
        region: preview.region,
        lat: preview.lat,
        lon: preview.lon,
      };
    }
    const discoveryLoc = intelligence?.discovery?.location;
    if (discoveryLoc?.city && typeof discoveryLoc.lat === "number" && typeof discoveryLoc.lon === "number") {
      return {
        city: discoveryLoc.city,
        state: discoveryLoc.state ?? null,
        region: discoveryLoc.region ?? null,
        lat: discoveryLoc.lat,
        lon: discoveryLoc.lon,
      };
    }
    return activeLocation?.place ?? null;
  }

  useEffect(() => {
    setActiveEditionId(editionId);
    logHomeScrollDebug("edition_id_change", { editionId });
  }, [editionId]);

  useEffect(() => {
    if (!__DEV__) return;
    logHomeScrollDebug("sections_replaced", {
      editionId,
      count: sections.length,
      types: sections.map((section) => section.section_type),
    });
  }, [sections, editionId]);

  useEffect(() => {
    if (!__DEV__) return;
    logHomeScrollDebug("intelligence_replaced", {
      editionId,
      hasDiscovery: Boolean(intelligence?.discovery),
    });
  }, [intelligence, editionId]);

  useEffect(() => {
    logHomeScrollDebug("home_scroll_mount");
    return () => {
      logHomeScrollDebug("home_scroll_unmount");
    };
  }, []);

  /** One initial restore per edition — only before the reader takes control. */
  useEffect(() => {
    if (!editionId || sections.length === 0) return;
    if (initialRestoreEditionRef.current === editionId) return;
    if (scrollSessionPhaseRef.current !== "initial") return;

    initialRestoreEditionRef.current = editionId;
    let cancelled = false;

    void (async () => {
      const key = homeScrollSessionKey(
        editionId,
        activeLocationKey(activeLocationRef.current)
      );
      const saved = await loadHomeScroll(key);
      if (
        cancelled ||
        scrollSessionPhaseRef.current !== "initial" ||
        restoredScrollRef.current
      ) {
        return;
      }

      logHomeScrollDebug(
        "restore_arm_eval",
        scrollRestoreSnapshot("initial_launch", {
          targetY: saved,
        })
      );

      if (saved <= 0) {
        restoredScrollRef.current = true;
        scrollSessionPhaseRef.current = "complete";
        return;
      }

      pendingScrollRestoreY.current = saved;
      restoredScrollRef.current = false;
      restoreInitialScrollIfNeededRef.current(undefined);
    })();

    return () => {
      cancelled = true;
    };
  }, [editionId, sections.length]);

  function currentHomeScrollKey(): string | null {
    const id = editionIdRef.current;
    if (!id) return null;
    return homeScrollSessionKey(id, activeLocationKey(activeLocationRef.current));
  }

  function scrollRestoreSnapshot(reason: string, extra?: Record<string, unknown>) {
    return scrollDebugSnapshot({
      reason,
      currentY: homeScrollYRef.current,
      pendingRestoreY: pendingScrollRestoreY.current,
      restored: restoredScrollRef.current,
      sessionPhase: scrollSessionPhaseRef.current,
      articleReturnPhase: articleReturnPhaseRef.current,
      userLocked: scrollSessionPhaseRef.current === "user_control",
      dragging: homeScrollDraggingRef.current,
      focusTransitions: homeFocusTransitionCountRef.current,
      editionId: editionIdRef.current,
      articleReturnTargetY: articleReturnTargetYRef.current,
      returnGeneration: articleReturnGenerationRef.current,
      ...extra,
    });
  }

  function logArticleReturnPhaseChange(
    next: ArticleReturnRestorePhase,
    reason: string
  ): void {
    const prev = articleReturnPhaseRef.current;
    if (prev === next) return;
    articleReturnPhaseRef.current = next;
    logHomeScrollDebug("article_return_phase", {
      ...scrollRestoreSnapshot(reason),
      previousPhase: prev,
      nextPhase: next,
    });
  }

  function clearArticleReturnRestoreTarget(reason: string): void {
    if (
      pendingScrollRestoreY.current !== 0 ||
      articleReturnTargetYRef.current !== 0
    ) {
      logHomeScrollDebug("pending_target_cleared", scrollRestoreSnapshot(reason));
    }
    pendingScrollRestoreY.current = 0;
    articleReturnTargetYRef.current = 0;
  }

  function completeArticleReturnRestore(reason: string): void {
    clearArticleReturnRestoreTarget(reason);
    logArticleReturnPhaseChange("complete", reason);
    homeScreenBlurredRef.current = false;
    restoredScrollRef.current = true;
  }

  function lockScrollRestore(reason: string): void {
    const returnAlreadyComplete = articleReturnPhaseRef.current === "complete";
    const sessionAlreadyLocked = scrollSessionPhaseRef.current === "user_control";
    if (returnAlreadyComplete && sessionAlreadyLocked) {
      return;
    }

    articleReturnGenerationRef.current += 1;
    if (scrollSessionPhaseRef.current !== "user_control") {
      scrollSessionPhaseRef.current = "user_control";
    }
    if (articleReturnPhaseRef.current !== "complete") {
      completeArticleReturnRestore(`user_interaction_lock:${reason}`);
      logHomeScrollDebug(
        "user_interaction_lock",
        scrollRestoreSnapshot(reason)
      );
      return;
    }
    clearArticleReturnRestoreTarget(reason);
    restoredScrollRef.current = true;
    logHomeScrollDebug("user_interaction_lock", scrollRestoreSnapshot(reason));
  }

  function programmaticScrollTo(
    y: number,
    reason: string,
    extra?: Record<string, unknown>
  ): void {
    programmaticScrollRef.current = true;
    logHomeScrollDebug(
      "scrollTo",
      scrollRestoreSnapshot(reason, { targetY: y, ...extra })
    );
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      mastheadScrollY.setValue(y);
      homeScrollYRef.current = y;
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    });
  }

  function markHomeScrollForReset(): void {
    const key = currentHomeScrollKey();
    if (key) clearHomeScroll(key);
    skipScrollRestoreRef.current = true;
    articleReturnGenerationRef.current += 1;
    clearArticleReturnRestoreTarget("markHomeScrollForReset");
    restoredScrollRef.current = true;
    scrollSessionPhaseRef.current = "complete";
    logArticleReturnPhaseChange("complete", "markHomeScrollForReset");
    initialRestoreEditionRef.current = null;
    homeScrollYRef.current = 0;
    mastheadScrollY.setValue(0);
    programmaticScrollTo(0, "markHomeScrollForReset");
  }

  function persistHomeScrollNow(): void {
    const key = currentHomeScrollKey();
    if (key) updateHomeScroll(key, homeScrollYRef.current);
  }

  /**
   * A "Related story" / "Continue reading" card in the article reader
   * should open the real piece it names, not a thin restatement of its
   * own summary. Today's edition (sections, top stories, discovery
   * items) is only fully in memory here on the homepage, so resolve and
   * pre-stash each continuation item's real destination article right
   * before the reader opens — cheap (at most a handful of items) and
   * reuses the same bounded article cache the reader already checks
   * first when a screen opens.
   */
  function prestashRelatedArticles(
    companion: ReturnType<typeof companionForArticle>,
    currentArticleId: string
  ): void {
    const localEvents = (() => {
      const section = sections.find((s) => s.section_type === "local_events");
      return section?.body ? parseLocalEventsBody(section.body) : [];
    })();
    for (const item of companion.continueReading ?? []) {
      if (!item.targetArticleId || item.targetArticleId === currentArticleId) {
        continue;
      }
      const resolved = resolveArticleForStoryKey(item.targetArticleId, {
        sections,
        topStories,
        leadStory,
        discoveryItems: intelligence?.discoveryItems,
        localEvents,
      });
      if (resolved) stashArticle(resolved);
    }
  }

  /**
   * One-shot initial launch restore only.
   */
  const restoreInitialScrollIfNeeded = useCallback((contentHeight?: number) => {
    if (scrollSessionPhaseRef.current !== "initial") return;
    if (restoredScrollRef.current) return;
    if (homeScrollDraggingRef.current) return;
    if (skipScrollRestoreRef.current) return;
    if (articleReturnPhaseRef.current !== "idle") return;

    const target = pendingScrollRestoreY.current;
    if (target <= 0) return;

    const y =
      contentHeight != null
        ? Math.max(0, Math.min(target, contentHeight - 1))
        : target;
    if (y <= 0) {
      restoredScrollRef.current = true;
      scrollSessionPhaseRef.current = "complete";
      pendingScrollRestoreY.current = 0;
      return;
    }

    pendingScrollRestoreY.current = 0;
    restoredScrollRef.current = true;
    scrollSessionPhaseRef.current = "complete";

    logHomeScrollDebug(
      "initial_restore",
      scrollRestoreSnapshot("restoreInitialScrollIfNeeded", {
        targetY: target,
        contentHeight: contentHeight ?? null,
      })
    );
    programmaticScrollTo(y, "restoreInitialScrollIfNeeded", {
      targetY: target,
      contentHeight: contentHeight ?? null,
    });
  }, [mastheadScrollY]);

  restoreInitialScrollIfNeededRef.current = restoreInitialScrollIfNeeded;

  /**
   * One-shot article-return restore — at most one programmatic scrollTo.
   */
  const restoreArticleReturnScrollIfNeeded = useCallback(
    (contentHeight?: number) => {
      const returnPhase = articleReturnPhaseRef.current;
      if (returnPhase === "complete") {
        logHomeScrollDebug(
          "restore_blocked_after_complete",
          scrollRestoreSnapshot("restoreArticleReturnScrollIfNeeded", {
            contentHeight: contentHeight ?? null,
          })
        );
        return;
      }
      if (returnPhase === "idle") return;
      if (returnPhase !== "waiting_for_return_layout") return;
      if (homeScrollDraggingRef.current) return;
      if (skipScrollRestoreRef.current) return;
      if (scrollSessionPhaseRef.current === "user_control") return;

      const target = articleReturnTargetYRef.current;
      if (target <= 0) {
        completeArticleReturnRestore("no_article_return_target");
        return;
      }

      const y =
        contentHeight != null
          ? Math.max(0, Math.min(target, contentHeight - 1))
          : target;
      if (y <= 0) {
        completeArticleReturnRestore("article_return_target_clamped_to_zero");
        return;
      }

      logArticleReturnPhaseChange(
        "restoring_return_position",
        "restoreArticleReturnScrollIfNeeded"
      );
      logHomeScrollDebug(
        "article_return_restore",
        scrollRestoreSnapshot("restoreArticleReturnScrollIfNeeded", {
          targetY: target,
          contentHeight: contentHeight ?? null,
        })
      );

      programmaticScrollTo(y, "restoreArticleReturnScrollIfNeeded", {
        targetY: target,
        contentHeight: contentHeight ?? null,
      });

      completeArticleReturnRestore("article_return_restore_issued");
    },
    [mastheadScrollY]
  );

  restoreArticleReturnScrollIfNeededRef.current =
    restoreArticleReturnScrollIfNeeded;

  const onHomeContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const returnPhase = articleReturnPhaseRef.current;
      const sessionPhase = scrollSessionPhaseRef.current;
      logHomeScrollDebug(
        "content_size_change",
        scrollRestoreSnapshot("content_size_change", {
          contentHeight: h,
          articleReturnPhase: returnPhase,
          sessionPhase,
        })
      );

      if (returnPhase === "complete" || returnPhase === "idle") {
        if (
          returnPhase === "complete" &&
          (articleReturnTargetYRef.current > 0 || pendingScrollRestoreY.current > 0)
        ) {
          logHomeScrollDebug(
            "restore_blocked_after_complete",
            scrollRestoreSnapshot("content_size_change_blocked", {
              contentHeight: h,
            })
          );
        }
      } else if (returnPhase === "waiting_for_return_layout") {
        restoreArticleReturnScrollIfNeededRef.current(h);
      }

      if (sessionPhase === "initial" && !restoredScrollRef.current) {
        restoreInitialScrollIfNeededRef.current(h);
      }
    },
    []
  );

  function activeLocationKey(active: ActiveLocation | null): string {
    if (!active) return "none";
    if (!active.place) return `${active.mode}|needs-setup`;
    return `${active.mode}|${locationKey(active.place)}`;
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
    };
  }, []);

  // The presses can run close to a minute — a single static hint over that
  // long a wait reads as stalled. Quietly advance through a few calm lines
  // so the wait still feels like something is happening, never technical.
  useEffect(() => {
    if (!generating) {
      setPreparingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setPreparingStep((step) =>
        Math.min(step + 1, PREPARING_LINES.length - 1)
      );
    }, 15000);
    return () => clearInterval(interval);
  }, [generating]);

  // Resolve shared location from prefs — never block first paint on GPS.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateDevEditionOverrideState();
      await hydrateDeveloperPreviewContext();
      const active = await resolveEffectivePlace({ refreshIfStale: false });
      if (!cancelled && mountedRef.current) {
        applyActiveLocation(active);
        focusedLocationKeyRef.current = activeLocationKey(active);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (firstRunPending) setShowFirstRun(true);
  }, [firstRunPending]);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const morningHeroFromIntel = intelligence?.morningHero ?? null;

  const morningHero = useMemo(() => {
    if (morningHeroFromIntel) return morningHeroFromIntel;

    return resolveMorningHero({
      intelligence,
      cachedBundle: cachedBundleRef.current,
    });
  }, [morningHeroFromIntel, intelligence, editionId]);

  function logFirstPaintIfNeeded(
    context: string,
    editionComplete?: boolean
  ): void {
    if (startupSummaryLoggedRef.current) return;
    startupSummaryLoggedRef.current = true;
    logStartupSummary(context, { editionComplete });
  }

  function applyEditionNewsDesks(
    edition: { national_news?: unknown; editorial_context?: unknown },
    editionDate: string
  ): TopStoryItem[] {
    const stories = topStoriesFromEditorialContext(edition.editorial_context);
    setTopStories(stories);
    setNationalNews(
      resolveNationalNewsForRender({
        edition,
        topStories: stories,
        editionDate,
      })
    );
    return stories;
  }

  function tryApplyInstantCache(
    bundle: CachedEditionBundle,
    source: "memory" | "disk",
    metroKey: string
  ): boolean {
    if (
      instantHydratedRef.current ||
      editionIdRef.current ||
      !mountedRef.current
    ) {
      return false;
    }
    const todayStr = resolveEffectiveEditionDateSync();
    if (!isCachedEditionPaintable(bundle, todayStr, metroKey)) return false;

    instantHydratedRef.current = true;
    applyCachedBundle(bundle);
    editionIdRef.current = bundle.editionId;
    setLoading(false);
    markStartup(
      source === "memory" ? "home_instant_cache_paint" : "home_cache_paint"
    );

    const completeness = assessEditionCompleteness({
      sections: bundle.sections,
      intelligence: bundle.intelligence,
      bandit: bundle.bandit,
      leadStory: bundle.leadStory,
      readerLocation: null,
    });
    logFirstPaintIfNeeded("repeat_launch", completeness.complete);
    return true;
  }

  // Paint from local cache before the network path — layout already primed auth.
  useLayoutEffect(() => {
    const userId = getPrimedLaunchUserId();
    if (!userId) return;

    void hydrateDevEditionOverrideState().then(async () => {
      if (await peekPendingDevEditionGenerate()) {
        pipelineStageEnd("cache_load", { source: "layout", hit: false, pendingDevGenerate: true });
        return;
      }
      await hydrateDeveloperPreviewContext();
      const identity = await resolveEditionLoadIdentity({
        handoff: "layout-cache",
        preferPreview: true,
      });
      const todayStr = resolveEffectiveEditionDateSync();
      const metroKey = identity.metroKey;
      if (!metroKey) {
        pipelineStageEnd("cache_load", { source: "layout", hit: false, reason: "no_metro" });
        return;
      }
      pipelineStageBegin("cache_load", { source: "layout", metroKey });
      const memory = peekMemoryCachedEdition(userId, todayStr, metroKey);
      if (memory && tryApplyInstantCache(memory, "memory", metroKey)) {
        pipelineStageEnd("cache_load", { source: "memory", hit: true, metroKey });
        return;
      }

      void loadCachedEdition(userId, todayStr, metroKey).then((cached) => {
        if (!cached || !mountedRef.current) {
          pipelineStageEnd("cache_load", { source: "disk", hit: false, metroKey });
          return;
        }
        const painted = tryApplyInstantCache(cached, "disk", metroKey);
        pipelineStageEnd("cache_load", { source: "disk", hit: painted, metroKey });
      });
    });
  }, []);

  useEffect(() => {
    if (loading || !editionId) return;
    markStartup("home_interactive");
  }, [loading, editionId]);

  useEffect(() => {
    scheduleNationalDailyLoad(editionDate);
  }, [editionDate]);

  function scheduleNationalDailyLoad(editionDate: string | null | undefined): void {
    const date = editionDate?.trim();
    if (!date) {
      setNationalDaily(null);
      setPairedNationalDaily(null);
      return;
    }
    // Drop the prior date's row so sync gates never pair against stale years.
    setNationalDaily(null);
    void fetchUsNationalDailyByDate(date).then((record) => {
      if (!mountedRef.current) return;
      setNationalDaily(record);
      setPairedNationalDaily((existing) =>
        resolvePairedNationalDailyForCache({
          sections: cachedBundleRef.current?.sections ?? [],
          networkDaily: record,
          existingPaired: existing,
        })
      );
    });
  }

  function traceEditionSectionsTodayInHistory(
    sections: EditionSection[],
    editionId: string,
    editionDate: string,
    usNationalDailyId?: string | null
  ): void {
    const section = sections.find((s) => s.section_type === "today_in_history");
    if (!section) return;
    logTodayInHistorySyncTrace({
      step: "edition_sections",
      editionId,
      editionDate,
      usNationalDailyId: usNationalDailyId ?? null,
      article: articleIdentityFromSection(section),
      image: imageIdentityFromAsset(null, { source: null }),
      synced: false,
      reason: "section_only_trace",
    });
  }

  function logHistoryAroundTownPipeline(
    step: string,
    input: {
      editionRaw?: unknown;
      intelligence?: EditionIntelligence | null;
      cachedBundle?: CachedEditionBundle | null;
    }
  ): void {
    if (!__DEV__) return;
    const raw = input.editionRaw;
    const rawPlaces =
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as { places?: unknown[] }).places)
        ? (raw as { places: unknown[] }).places.length
        : 0;
    const rawCarousel =
      raw &&
      typeof raw === "object" &&
      Array.isArray((raw as { carousel?: unknown[] }).carousel)
        ? (raw as { carousel: unknown[] }).carousel.length
        : 0;
    const parsedFromRaw = parseHistoryAroundTownPayload(raw);
    console.log("[home:historyPlaces:pipeline]", {
      step,
      editionJsonPlaces: rawPlaces,
      editionJsonCarousel: rawCarousel,
      editionJsonParsedPlaces: parsedFromRaw?.places?.length ?? 0,
      editionJsonParsedCarousel: parsedFromRaw?.carousel?.length ?? 0,
      loaderIntelligencePlaces:
        input.intelligence?.historyAroundTown?.places?.length ?? 0,
      cacheIntelligencePlaces:
        input.cachedBundle?.intelligence?.historyAroundTown?.places?.length ?? 0,
    });
  }

  function applyCachedBundle(bundle: CachedEditionBundle): void {
    const merged = mergeHistoryAroundTownIntoCachedBundle(
      mergeMorningHeroIntoCachedBundle(bundle)
    );
    cachedBundleRef.current = merged;
    editionIdRef.current = merged.editionId;
    setSections(merged.sections);
    setEditionDate(merged.editionDate);
    setEditionId(merged.editionId);
    setLeadStory(merged.leadStory);
    setTopStories(merged.topStories);
    setNationalNews(merged.nationalNews ?? null);
    setBandit(merged.bandit);
    setIntelligence(merged.intelligence);
    setPairedNationalDaily(merged.pairedNationalDaily ?? null);
    logHistoryAroundTownPipeline("cache_hydrate", {
      intelligence: merged.intelligence,
      cachedBundle: merged,
    });
    freezeEdition({
      editionId: merged.editionId,
      editionDate: merged.editionDate,
      discovery: merged.intelligence?.discovery ?? null,
      discoveryItems: merged.intelligence?.discoveryItems ?? null,
      heroImageId: merged.heroImageId ?? null,
    });
    if (merged.heroImageId) setFrozenHeroImageId(merged.heroImageId);
    editionFrozenRef.current = true;
    preloadMorningHeroImage(
      resolveMorningHero({
        intelligence: merged.intelligence,
        cachedBundle: merged,
      })
    );
    const cachedEventCount = countValidEventsInSections(merged.sections);
    setLocalEventsStatus(cachedEventCount > 0 ? "ready" : "loading");

    if (
      !resolveMorningHero({
        intelligence: merged.intelligence,
        cachedBundle: merged,
      })
    ) {
      void recoverMorningHero({
        editionDate: merged.editionDate,
        intelligence: merged.intelligence,
        cachedBundle: merged,
      }).then((result) => applyMorningHeroRecovery(result, loadGen.current));
    }
  }

  function applyMorningHeroRecovery(
    result: Awaited<ReturnType<typeof recoverMorningHero>>,
    gen: number
  ): void {
    if (!result.recovered || !result.morningHero) return;
    if (!mountedRef.current || gen !== loadGen.current) return;

    setIntelligence(result.intelligence);
    if (cachedBundleRef.current) {
      const nextBundle = mergeMorningHeroIntoCachedBundle({
        ...cachedBundleRef.current,
        intelligence: result.intelligence,
        morningHero: result.morningHero,
      });
      cachedBundleRef.current = nextBundle;
      void saveCachedEdition(nextBundle);
    }
    preloadMorningHeroImage(result.morningHero);
  }

  function scheduleMorningHeroRecovery(
    editionDate: string,
    intelligence: EditionIntelligence | null,
    gen: number
  ): void {
    if (resolveMorningHero({ intelligence, cachedBundle: cachedBundleRef.current })) {
      return;
    }
    void recoverMorningHero({
      editionDate,
      intelligence,
      cachedBundle: cachedBundleRef.current,
    }).then((result) => applyMorningHeroRecovery(result, gen));
  }

  function intelligenceWithPreservedMorningHero(
    intel: EditionIntelligence,
    morningEdition?: unknown,
    historyAroundTownRaw?: unknown
  ): EditionIntelligence {
    const preserved = resolveMorningHero({
      intelligence: intel,
      cachedBundle: cachedBundleRef.current,
      morningEdition,
    });
    let merged = mergeMorningHeroIntoIntelligence(intel, preserved) ?? intel;
    const networkHistory = resolveHistoryAroundTown({
      intelligence: intel,
      historyAroundTown: historyAroundTownRaw,
    });
    merged =
      mergeHistoryAroundTownIntoIntelligence(merged, networkHistory) ?? merged;
    merged =
      mergeWeatherSummaryIntoIntelligence(merged, intel.weatherSummary) ?? merged;
    return merged;
  }

  function applyNetworkWeatherSummaryMerge(
    networkIntel: EditionIntelligence,
    editorialContext: unknown,
    gen: number
  ): void {
    if (!mountedRef.current || gen !== loadGen.current) return;
    if (
      !needsNetworkWeatherSummaryMerge({
        networkIntelligence: networkIntel,
        onScreenIntelligence: cachedBundleRef.current?.intelligence ?? null,
        cachedBundle: cachedBundleRef.current,
        editorialContext,
      })
    ) {
      return;
    }

    const networkSummary = resolveWeatherSummary({
      intelligence: networkIntel,
      editorialContext,
    });
    if (!networkSummary) return;

    const mergedIntel = mergeWeatherSummaryIntoIntelligence(
      cachedBundleRef.current?.intelligence ?? networkIntel,
      networkSummary
    );
    if (!mergedIntel) return;

    setIntelligence(mergedIntel);
    if (cachedBundleRef.current) {
      const nextBundle = {
        ...cachedBundleRef.current,
        intelligence: mergedIntel,
        cachedAt: Date.now(),
      };
      cachedBundleRef.current = nextBundle;
      scheduleCachedEditionSave(nextBundle);
    }

    if (__DEV__) {
      console.log("[home] loadEdition: merged network weatherSummary", {
        summary: networkSummary,
      });
    }
  }

  function applyNetworkHistoryAroundTownMerge(
    networkIntel: EditionIntelligence,
    historyAroundTownRaw: unknown,
    gen: number
  ): void {
    if (!mountedRef.current || gen !== loadGen.current) return;
    if (
      !needsNetworkHistoryAroundTownMerge({
        networkIntelligence: networkIntel,
        onScreenIntelligence: cachedBundleRef.current?.intelligence ?? null,
        cachedBundle: cachedBundleRef.current,
        historyAroundTown: historyAroundTownRaw,
      })
    ) {
      return;
    }

    const networkHistory = resolveHistoryAroundTown({
      intelligence: networkIntel,
      historyAroundTown: historyAroundTownRaw,
    });
    if (!networkHistory?.places?.length) return;

    const mergedIntel = mergeHistoryAroundTownIntoIntelligence(
      cachedBundleRef.current?.intelligence ?? networkIntel,
      networkHistory
    );
    if (!mergedIntel) return;

    setIntelligence(mergedIntel);
    if (cachedBundleRef.current) {
      const nextBundle = mergeHistoryAroundTownIntoCachedBundle(
        { ...cachedBundleRef.current, intelligence: mergedIntel },
        networkHistory
      );
      cachedBundleRef.current = nextBundle;
      scheduleCachedEditionSave(nextBundle);
    }

    if (__DEV__) {
      console.log("[home] loadEdition: merged network historyAroundTown", {
        places: networkHistory.places.length,
        carousel: networkHistory.carousel.length,
      });
    }
  }

  function persistSectionsToCache(mergedSections: EditionSection[]): void {
    const bundle = cachedBundleRef.current;
    if (!bundle) return;
    const next: CachedEditionBundle = {
      ...bundle,
      sections: mergedSections,
      cachedAt: Date.now(),
    };
    cachedBundleRef.current = next;
    scheduleCachedEditionSave(next);
  }

  function persistBundleToCache(bundle: CachedEditionBundle): void {
    cachedBundleRef.current = bundle;
    scheduleCachedEditionSave(bundle);
  }

  async function maybeRecoverTodayInHistory(params: {
    userId: string;
    editionId: string;
    editionDate: string;
    sections: EditionSection[];
    intelligence: EditionIntelligence | null;
  }): Promise<{
    sections: EditionSection[];
    intelligence: EditionIntelligence | null;
    pairedNationalDaily: UsNationalDailyRecord | null;
  }> {
    const result = await recoverTodayInHistory({
      userId: params.userId,
      editionId: params.editionId,
      editionDate: params.editionDate,
      currentSections: params.sections,
      intelligence: params.intelligence,
      cachedBundle: cachedBundleRef.current,
    });

    if (!result.recovered) {
      return {
        sections: params.sections,
        intelligence: params.intelligence,
        pairedNationalDaily: cachedBundleRef.current?.pairedNationalDaily ?? null,
      };
    }

    if (__DEV__) {
      console.log("[home] todayInHistory recovery applied", {
        source: result.source,
        headline: result.headline,
        pairedNationalDailyId: result.pairedNationalDaily?.id ?? null,
      });
    }

    if (result.pairedNationalDaily) {
      setPairedNationalDaily(result.pairedNationalDaily);
      setNationalDaily(result.pairedNationalDaily);
    }

    if (cachedBundleRef.current) {
      persistBundleToCache({
        ...cachedBundleRef.current,
        sections: result.sections,
        intelligence: result.intelligence,
        pairedNationalDaily: result.pairedNationalDaily ?? cachedBundleRef.current.pairedNationalDaily ?? null,
        cachedAt: Date.now(),
      });
    }

    return {
      sections: result.sections,
      intelligence: result.intelligence,
      pairedNationalDaily: result.pairedNationalDaily ?? null,
    };
  }

  async function maybeRecoverStoryOf(params: {
    editionId: string;
    editionDate: string;
    place: KindredPlace | null;
    sections: EditionSection[];
  }): Promise<EditionSection[]> {
    const result = await recoverStoryOf({
      editionId: params.editionId,
      editionDate: params.editionDate,
      place: params.place,
      currentSections: params.sections,
      cachedBundle: cachedBundleRef.current,
    });

    if (!result.recovered) return params.sections;

    if (__DEV__) {
      console.log("[home] storyOf recovery applied", {
        metroKey: result.metroKey,
        headline: result.headline,
      });
    }

    if (cachedBundleRef.current) {
      persistBundleToCache({
        ...cachedBundleRef.current,
        sections: result.sections,
        cachedAt: Date.now(),
      });
    }

    return result.sections;
  }

  async function maybeRecoverLocalEvents(params: {
    editionId: string;
    editionDate: string;
    place: KindredPlace | null;
    sections: EditionSection[];
    expectedMetroKey?: string | null;
    traceId?: string | null;
  }): Promise<EditionSection[]> {
    const { editionId, editionDate, place, sections, expectedMetroKey, traceId } = params;
    if (!place || !needsLocalEventsRecovery(sections)) {
      const count = countValidEventsInSections(sections);
      setLocalEventsStatus(count > 0 ? "ready" : "quiet_day");
      return sections;
    }

    if (
      expectedMetroKey &&
      editionCacheMetroKey(place) !== expectedMetroKey
    ) {
      if (__DEV__) {
        console.warn("[home] localEvents recovery rejected — metro mismatch", {
          expectedMetroKey,
          placeCity: place.city,
          placeMetroKey: editionCacheMetroKey(place),
          traceId,
        });
      }
      setLocalEventsStatus("quiet_day");
      return sections;
    }

    setLocalEventsStatus("recovering");
    const result = await recoverLocalEvents({
      editionId,
      editionDate,
      place,
      expectedMetroKey,
      currentSections: sections,
      cachedBundle: cachedBundleRef.current,
    });

    if (result.recovered) {
      setLocalEventsStatus("ready");
      if (__DEV__) {
        console.log("[home] localEvents recovery succeeded", {
          eventCount: result.eventCount,
        });
      }
      return result.mergedSections;
    }

    setLocalEventsStatus(result.attempted ? "failed" : "quiet_day");
    if (__DEV__) {
      console.warn("[home] localEvents recovery did not restore events", result);
    }
    return sections;
  }

  type LoadEditionOptions = {
    isRefresh?: boolean;
    /** Background fetch — never clear the folio or show a spinner. */
    quiet?: boolean;
    /** Only patch structured local event facts; ignore discovery reshuffles. */
    eventsOnly?: boolean;
    /** After generate-edition succeeded — bypass in-flight generate guard. */
    afterGenerate?: boolean;
    /** Exact edition returned by generate-edition — never load an unscoped row. */
    editionId?: string | null;
    metroKey?: string | null;
    traceId?: string | null;
  };

  function parseLoadOptions(
    input?: boolean | LoadEditionOptions
  ): LoadEditionOptions {
    if (typeof input === "boolean") return { isRefresh: input };
    return input ?? {};
  }

  const loadEdition = useCallback(async (input?: boolean | LoadEditionOptions) => {
    const { isRefresh = false, quiet = false, eventsOnly = false, afterGenerate = false, editionId: loadEditionId = null, metroKey: loadMetroKey = null, traceId = null } =
      parseLoadOptions(input);
    const gen = ++loadGen.current;
    const resetScroll = isRefresh && !quiet;
    /** When true, this call intentionally left loading=true for a generate handoff. */
    let deferKeepLoading = false;
    if (__DEV__) {
      logHomeScrollDebug("load_edition_start", {
        isRefresh,
        quiet,
        eventsOnly,
        afterGenerate,
        resetScroll,
        currentY: homeScrollYRef.current,
        editionId: editionIdRef.current,
      });
    }
    if (resetScroll) {
      resetScrollOnLoadRef.current = false;
      markHomeScrollForReset();
    } else if (!quiet) {
      skipScrollRestoreRef.current = false;
    }
    if (isRefresh && !quiet) setRefreshing(true);
    if (!quiet) setError(null);

    // Withhold the previous folio immediately so a reload never flashes a
    // wrong-city or superseded edition while location/edition resolve.
    // Preserve a printed paper during quiet background repair/refresh.
    if (mountedRef.current && resetScroll) {
      editionFrozenRef.current = false;
      clearEditionFreeze();
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
      setNationalNews(null);
      setBandit(null);
      setIntelligence(null);
      setClippedIds(new Set());
      setLocationMismatch(null);
    }

    try {
    await hydrateDevEditionOverrideState();
    const pendingDevGenerate = await peekPendingDevEditionGenerate();
    if (
      shouldDeferLoadEditionDuringGenerate({
        pendingDevGenerate,
        generating: generatingRef.current,
        eventsOnly,
        afterGenerate,
      })
    ) {
      devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "load_edition_blocked", {
        pendingDevGenerate,
        generating: generatingRef.current,
        quiet,
      });
      if (!quiet && !generatingRef.current) {
        deferKeepLoading = true;
        setLoading(true);
      }
      return;
    }

    devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "load_edition_start", {
      isRefresh,
      quiet,
      eventsOnly,
      afterGenerate,
    });
    // Never short-circuit on a local history snapshot when the caller already
    // named the edition to open (Retry / post-generate). That snapshot can pin
    // a deleted developer-preview id and skip the network load entirely.
    if (
      !eventsOnly &&
      !pendingDevGenerate &&
      !loadEditionId &&
      (await tryApplyDevEditionPreview((bundle) => {
        if (mountedRef.current && gen === loadGen.current) {
          applyCachedBundle(bundle);
          setLoading(false);
          setRefreshing(false);
        }
      }))
    ) {
      if (__DEV__) {
        console.log("[RETRY_TRACE] loadEdition_short_circuited_dev_preview_bundle");
      }
      return;
    }

    if (!isSupabaseConfigured) {
      if (mountedRef.current && gen === loadGen.current) {
        setError("Kindred isn’t configured for this build yet.");
        setLoading(false);
        setRefreshing(false);
      }
      return;
    }

    const fetchEdition = async () => {
    markStartup("home_fetch_start");
    const {
      data: { session },
      error: sessionError,
    } = await getLaunchSessionOrFetch();
    const user = session?.user ?? null;

    if (__DEV__) {
      console.log("[home] loadEdition: start", {
        isRefresh,
        quiet,
        eventsOnly,
        userId: user?.id ?? null,
        sessionError: sessionError?.message ?? null,
      });
    }

    if (!user) {
      if (__DEV__) console.warn("[home] loadEdition: no user", sessionError?.message);
      return { kind: "no_user" as const, userError: sessionError };
    }

    // Fire-and-forget — lets overnight generation compute this user's own
    // local morning instead of one shared UTC instant. Never blocks load.
    void syncDeviceTimezone(user.id);

    const todayStr = await resolveEffectiveEditionDate();
    const identity = await resolveEditionLoadIdentity({
      handoff: "loadEdition",
      traceId,
      loadEditionId,
      loadMetroKey,
      preferPreview:
        afterGenerate || Boolean(loadEditionId) || Boolean(loadMetroKey),
    });

    if (identity.activeLocation) {
      applyActiveLocation(identity.activeLocation);
    }

    const cacheMetroKey = identity.metroKey;
    const scopedMetroKey = identity.metroKey;
    const resolvedEditionId = identity.editionId;

    if (__DEV__) {
      console.log("[home] loadEdition: date filters", {
        localEditionDate: todayStr,
        cacheMetroKey,
        scopedMetroKey,
        resolvedEditionId,
        identitySource: identity.source,
        previewCity: identity.place?.city ?? null,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
    }

    if (!cacheMetroKey && !resolvedEditionId) {
      if (__DEV__) {
        console.warn("[home] loadEdition: no market identity — refusing unscoped lookup", {
          activeCity: identity.place?.city ?? null,
        });
      }
      setLoading(false);
      setRefreshing(false);
      return { kind: "not_ready" as const, user, adjacent: { older: null, newer: null }, jobResult: { data: null, error: null }, editionError: null, edition: null };
    }

    // Overlap cache read with the editions network query on cold start.
    const shouldHydrateCache =
      !quiet &&
      !isRefresh &&
      !editionIdRef.current &&
      !instantHydratedRef.current &&
      !pendingDevGenerate &&
      Boolean(cacheMetroKey);

    const prefetchEditionId =
      cachedBundleRef.current?.editionId ??
      (cacheMetroKey
        ? peekMemoryCachedEdition(user.id, todayStr, cacheMetroKey)?.editionId
        : null) ??
      null;

    const editionSelect =
      "id, edition_date, status, user_id, metro_key, lead_story, national_news, bandit, discovery, knowledge, memory, morning_edition, history_around_town, editorial_context";

    const editionQuery = resolvedEditionId
      ? supabase
          .from("editions")
          .select(editionSelect)
          .eq("id", resolvedEditionId)
          .maybeSingle()
      : supabase
          .from("editions")
          .select(editionSelect)
          .eq("user_id", user.id)
          .eq("edition_date", todayStr)
          .eq("metro_key", scopedMetroKey!)
          .maybeSingle();

    let prefetchedSectionsPromise: ReturnType<typeof queryEditionSections> | null =
      prefetchEditionId ? queryEditionSections(prefetchEditionId) : null;

    const cachePromise = shouldHydrateCache && cacheMetroKey
      ? (() => {
          const warm =
            peekMemoryCachedEdition(user.id, todayStr, cacheMetroKey) ??
            (cachedBundleRef.current?.editionDate === todayStr &&
            cachedBundleRef.current?.metroKey === cacheMetroKey
              ? cachedBundleRef.current
              : null);
          if (warm) {
            if (
              warm &&
              mountedRef.current &&
              gen === loadGen.current &&
              !instantHydratedRef.current
            ) {
              instantHydratedRef.current = true;
              applyCachedBundle(warm);
              setLoading(false);
              markStartup("home_cache_paint");
              const completeness = assessEditionCompleteness({
                sections: warm.sections,
                intelligence: warm.intelligence,
                bandit: warm.bandit,
                leadStory: warm.leadStory,
                readerLocation: null,
              });
              logFirstPaintIfNeeded("repeat_launch", completeness.complete);
              if (__DEV__) {
                console.log("[home] loadEdition: hydrated from warm cache", {
                  editionId: warm.editionId,
                  metroKey: warm.metroKey,
                  sectionCount: warm.sections.length,
                });
              }
            }
            if (!prefetchedSectionsPromise && warm.editionId) {
              prefetchedSectionsPromise = queryEditionSections(warm.editionId);
            }
            return Promise.resolve(warm);
          }
          pipelineStageBegin("cache_load", { source: "fetch_parallel", metroKey: cacheMetroKey });
          return loadCachedEdition(user.id, todayStr, cacheMetroKey).then((cached) => {
            pipelineStageEnd("cache_load", {
              source: "fetch_parallel",
              hit: Boolean(cached),
              metroKey: cacheMetroKey,
            });
            if (
              cached &&
              mountedRef.current &&
              gen === loadGen.current &&
              !instantHydratedRef.current
            ) {
              instantHydratedRef.current = true;
              applyCachedBundle(cached);
              setLoading(false);
              markStartup("home_cache_paint");
              const completeness = assessEditionCompleteness({
                sections: cached.sections,
                intelligence: cached.intelligence,
                bandit: cached.bandit,
                leadStory: cached.leadStory,
                readerLocation: null,
              });
              logFirstPaintIfNeeded("repeat_launch", completeness.complete);
              void maybeRecoverTodayInHistory({
                userId: user.id,
                editionId: cached.editionId,
                editionDate: cached.editionDate,
                sections: cached.sections,
                intelligence: cached.intelligence,
              }).then(async (recovered) => {
                if (!mountedRef.current || gen !== loadGen.current) return;
                let nextSections = recovered.sections;
                let nextIntel = recovered.intelligence;
                if (
                  recovered.sections !== cached.sections ||
                  recovered.intelligence !== cached.intelligence
                ) {
                  setSections(nextSections);
                  setIntelligence(nextIntel);
                }
                if (recovered.pairedNationalDaily) {
                  setPairedNationalDaily(recovered.pairedNationalDaily);
                  setNationalDaily(recovered.pairedNationalDaily);
                }
                const active = activeLocationRef.current?.place ?? null;
                const storySections = await maybeRecoverStoryOf({
                  editionId: cached.editionId,
                  editionDate: cached.editionDate,
                  place: active,
                  sections: nextSections,
                });
                if (
                  storySections !== nextSections &&
                  mountedRef.current &&
                  gen === loadGen.current
                ) {
                  setSections(storySections);
                }
              });
              if (__DEV__) {
                console.log("[home] loadEdition: hydrated from cache", {
                  editionId: cached.editionId,
                  sectionCount: cached.sections.length,
                });
              }
            }
            if (cached?.editionId && !prefetchedSectionsPromise) {
              prefetchedSectionsPromise = queryEditionSections(cached.editionId);
            }
            return cached;
          });
        })()
      : Promise.resolve(null);

    pipelineStageBegin("edition_lookup");
    const [cached, editionResultInitial] = await Promise.all([
      cachePromise,
      (async () => {
        if (__DEV__) console.log("[generate] fetchEdition editions query BEGIN");
        const started = Date.now();
        const result = await editionQuery;
        if (__DEV__) {
          console.log("[generate] fetchEdition editions query END", {
            ms: Date.now() - started,
            status: (result.data as { status?: string } | null)?.status ?? null,
          });
        }
        return result;
      })(),
    ]);

    // Stale / deleted developer-preview editionId after rebuild → prefer job edition.
    // Use identity.editionDate (preview date) first; calendar todayStr can diverge.
    let editionResult = editionResultInitial;
    if (resolvedEditionId && scopedMetroKey) {
      const recoveryDates = Array.from(
        new Set(
          [identity.editionDate, todayStr].filter(
            (d): d is string => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d))
          )
        )
      );
      let jobEditionId: string | null = null;
      let jobEditionDate: string | null = null;
      let jobStatus: string | null = null;
      for (const date of recoveryDates) {
        const jobForIdentity = await fetchGenerationJobForEdition(supabase, {
          userId: user.id,
          editionDate: date,
          metroKey: scopedMetroKey,
        });
        const id =
          (
            jobForIdentity.data as { edition_id?: string | null } | null
          )?.edition_id?.trim() || null;
        const status =
          (jobForIdentity.data as { status?: string } | null)?.status ?? null;
        if (id && status === "ready") {
          jobEditionId = id;
          jobEditionDate = date;
          jobStatus = status;
          break;
        }
        if (!jobEditionId && id) {
          jobEditionId = id;
          jobEditionDate = date;
          jobStatus = status;
        }
      }
      const pinnedMissing =
        Boolean(editionResultInitial.error) || !editionResultInitial.data;
      // V1: never treat a missing Bandit's Pick as an incomplete edition.
      const pinnedIncomplete = false;
      const pinnedStaleVsJob =
        Boolean(jobEditionId) &&
        jobEditionId !== resolvedEditionId &&
        jobStatus === "ready";
      // Stale / deleted developer-preview pin → recover via ready job edition.
      const shouldRecover = pinnedMissing || pinnedStaleVsJob;
      if (shouldRecover) {
        if (__DEV__) {
          console.warn("[home] loadEdition: stale preview editionId — recovering", {
            staleEditionId: resolvedEditionId,
            jobEditionId,
            jobEditionDate,
            jobStatus,
            pinnedMissing,
            pinnedIncomplete,
            pinnedStaleVsJob,
            metroKey: scopedMetroKey,
            identityEditionDate: identity.editionDate,
            todayStr,
            pinnedQueryError: editionResultInitial.error?.message ?? null,
          });
        }
        const fallbackDate = jobEditionDate ?? identity.editionDate ?? todayStr;
        editionResult =
          jobEditionId && jobStatus === "ready"
            ? await supabase
                .from("editions")
                .select(editionSelect)
                .eq("id", jobEditionId)
                .maybeSingle()
            : await supabase
                .from("editions")
                .select(editionSelect)
                .eq("user_id", user.id)
                .eq("edition_date", fallbackDate)
                .eq("metro_key", scopedMetroKey)
                .eq("status", "ready")
                .maybeSingle();
        const recoveredId =
          (editionResult.data as { id?: string } | null)?.id?.trim() || null;
        const recoveredDate =
          (editionResult.data as { edition_date?: string } | null)
            ?.edition_date?.trim() || fallbackDate;
        if (recoveredId && identity.preview) {
          await setDeveloperPreviewContext({
            ...identity.preview,
            editionId: recoveredId,
            editionDate: recoveredDate,
          });
        }
        if (
          recoveredId &&
          recoveredId !== resolvedEditionId &&
          cacheMetroKey
        ) {
          cachedBundleRef.current = null;
          instantHydratedRef.current = false;
          void clearCachedEdition(user.id, fallbackDate, cacheMetroKey);
        }
      }
    }

    pipelineStageEnd("edition_lookup", {
      status: (editionResult.data as { status?: string } | null)?.status ?? null,
    });

    const {
      data: edition,
      error: editionError,
      status: editionStatus,
      statusText: editionStatusText,
    } = editionResult;

    markStartup("home_editions_query_done");

    const leadRaw = (edition as { lead_story?: unknown } | null)?.lead_story;
    const ctxRaw = (edition as { editorial_context?: unknown } | null)
      ?.editorial_context;
    const ctxObj =
      ctxRaw && typeof ctxRaw === "object"
        ? (ctxRaw as Record<string, unknown>)
        : null;
    const ctxSections = Array.isArray(ctxObj?.sections)
      ? (ctxObj!.sections as Array<{ sectionType?: string; items?: unknown[] }>)
      : [];
    const topStoriesSection = ctxSections.find(
      (s) => s.sectionType === "top_stories"
    );
    console.log("[LOCAL_NEWS_TRACE] edition_load_boundary", {
      editionId: (edition as { id?: string } | null)?.id ?? null,
      metroKey: (edition as { metro_key?: string } | null)?.metro_key ?? null,
      identitySource: identity.source,
      resolvedEditionId,
      topLevelKeys: edition ? Object.keys(edition as object) : [],
      local_news: (edition as { local_news?: unknown } | null)?.local_news ?? null,
      localNews: (edition as { localNews?: unknown } | null)?.localNews ?? null,
      lead_story: leadRaw
        ? {
            role: (leadRaw as { role?: string }).role ?? null,
            headline: String(
              (leadRaw as { headline?: string }).headline ?? ""
            ).slice(0, 80),
            summaryLen: String(
              (leadRaw as { summary?: string }).summary ?? ""
            ).length,
          }
        : null,
      editorial_context_keys: ctxObj ? Object.keys(ctxObj) : null,
      top_stories_in_context: topStoriesSection?.items?.length ?? 0,
      national_news_present: Boolean(
        (edition as { national_news?: unknown } | null)?.national_news
      ),
    });

    __DEV__ && console.log("[home] loadEdition: editions query", {
      filterUserId: user.id,
      filterEditionDate: todayStr,
      filterMetroKey: scopedMetroKey,
      filterEditionId: resolvedEditionId,
      result: edition,
      error: editionError
        ? {
            message: editionError.message,
            code: editionError.code,
            details: editionError.details,
            hint: editionError.hint,
          }
        : null,
      httpStatus: editionStatus ?? null,
      statusText: editionStatusText ?? null,
    });

    // Serve ready editions and processing rows that already have core sections.
    const rowStatus = edition ? (edition as { status?: string }).status : null;
    const canLoadEditionRow =
      !!edition && (rowStatus === "ready" || rowStatus === "processing");

    if (!canLoadEditionRow) {
      if (__DEV__) {
        console.warn("[home] loadEdition: no loadable edition", {
          reason: editionError
            ? "query error"
            : edition
              ? `status=${rowStatus ?? "unknown"}`
              : "zero rows for user_id + edition_date + metro_key",
          message: editionError?.message ?? null,
        });
      }
      const [adjacent, jobResult] = await Promise.all([
        fetchAdjacentEditions(user.id, todayStr, scopedMetroKey),
        fetchGenerationJobForEdition(supabase, {
          userId: user.id,
          editionDate: todayStr,
          metroKey: scopedMetroKey,
        }),
      ]);
      return {
        kind: "not_ready" as const,
        user,
        adjacent,
        jobResult,
        editionError,
        edition: edition ?? null,
      };
    }

    const editionRowMetroKey =
      (edition as { metro_key?: string | null }).metro_key?.trim() || null;
    if (
      scopedMetroKey &&
      editionRowMetroKey &&
      editionRowMetroKey !== scopedMetroKey
    ) {
      if (__DEV__) {
        console.warn("[home] loadEdition: edition metro_key mismatch — withholding", {
          expectedMetroKey: scopedMetroKey,
          editionMetroKey: editionRowMetroKey,
          editionId: edition.id,
        });
      }
      editionFrozenRef.current = false;
      clearEditionFreeze();
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
      setNationalNews(null);
      setBandit(null);
      setIntelligence(null);
      setLoading(false);
      setRefreshing(false);
      return { kind: "not_ready" as const, user, adjacent: { older: null, newer: null }, jobResult: { data: null, error: null }, editionError: null, edition };
    }

    const canUsePrefetchedSections =
      prefetchEditionId === edition.id && prefetchedSectionsPromise != null;

    let sectionRows: EditionSection[] | null = null;
    pipelineStageBegin("edition_sections", {
      prefetched: canUsePrefetchedSections,
    });
    const sectionsStarted = Date.now();

    if (canUsePrefetchedSections && prefetchedSectionsPromise) {
      const prefetched = await prefetchedSectionsPromise;
      if (prefetched.error) {
        const sectionsResult = await queryEditionSections(edition.id);
        if (sectionsResult.error) {
          throw new Error(sectionsResult.error.message);
        }
        sectionRows = (sectionsResult.data as EditionSection[] | null) ?? null;
      } else {
        sectionRows = (prefetched.data as EditionSection[] | null) ?? null;
      }
    } else {
      if (__DEV__) console.log("[generate] fetchEdition edition_sections query BEGIN");
      const sectionsResult = await queryEditionSections(edition.id);
      if (__DEV__) {
        console.log("[generate] fetchEdition edition_sections query END", {
          ms: Date.now() - sectionsStarted,
          count: sectionsResult.data?.length ?? 0,
        });
      }
      if (sectionsResult.error) {
        throw new Error(sectionsResult.error.message);
      }
      sectionRows = (sectionsResult.data as EditionSection[] | null) ?? null;
    }

    pipelineStageEnd("edition_sections", {
      ms: Date.now() - sectionsStarted,
      count: sectionRows?.length ?? 0,
      prefetched: canUsePrefetchedSections,
    });

    const loaded = sectionRows ?? [];
    traceEditionSectionsTodayInHistory(
      loaded,
      edition.id,
      edition.edition_date,
      (edition as { us_national_daily_id?: string | null }).us_national_daily_id ?? null
    );

    if (
      rowStatus === "processing" &&
      !isProcessingEditionPaintable(rowStatus, loaded)
    ) {
      const [adjacent, jobResult] = await Promise.all([
        fetchAdjacentEditions(user.id, todayStr, scopedMetroKey),
        fetchGenerationJobForEdition(supabase, {
          userId: user.id,
          editionDate: todayStr,
          metroKey: scopedMetroKey,
        }),
      ]);
      return {
        kind: "not_ready" as const,
        user,
        adjacent,
        jobResult,
        editionError: null,
        edition,
      };
    }

    if (rowStatus === "processing") {
      devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "partial_edition_paint", {
        editionId: edition.id,
        sectionCount: loaded.length,
      });
    }

    pipelineStageBegin("normalization");

    markStartup("home_sections_query_done");

    traceSupabaseEditionRow(edition);
    traceSupabaseEditionSections(loaded);

    let discoveryRaw = (edition as { discovery?: unknown }).discovery;
    const editionDiscovery = parseDiscoveryPayload(discoveryRaw);
    const expectStoryOfForEdition = metroExpectsStoryOf(
      editionDiscovery?.location
        ? metroKeyFromKindredPlace({
            city: editionDiscovery.location.city ?? "",
            state: editionDiscovery.location.state ?? null,
            region: editionDiscovery.location.region ?? null,
            lat: editionDiscovery.location.lat ?? 0,
            lon: editionDiscovery.location.lon ?? 0,
          })
        : null
    );
    const persistedComplete = isPersistedEditionComplete(
      { ...edition, discovery: discoveryRaw },
      loaded,
      { expectStoryOf: expectStoryOfForEdition }
    );

    if (!persistedComplete.complete) {
      console.warn(
        "[home] loadEdition: status=ready edition has completeness gaps — painting anyway",
        {
          editionId: edition.id,
          editionDate: edition.edition_date,
          sectionCount: loaded.length,
          sectionTypes: loaded.map((s) => s.section_type),
          reasons: persistedComplete.reasons,
        }
      );
    }

    if (__DEV__) {
      console.log("[generate] fetchEdition completeness evaluation", {
        complete: persistedComplete.complete,
        reasons: persistedComplete.reasons,
      });
    }

    pipelineStageEnd("normalization");
    pipelineStageBegin("completeness");
    pipelineStageEnd("completeness", {
      complete: persistedComplete.complete,
    });

    __DEV__ && console.log("[home] loadEdition: edition_sections query", {
      editionId: edition.id,
      editionDate: edition.edition_date,
      editionStatus: edition.status,
      editionUserId: edition.user_id,
      sectionCount: loaded.length,
      sectionIds: loaded.map((s) => s.id),
      sectionTypes: loaded.map((s) => s.section_type),
      discoveryPresent: Boolean(parseDiscoveryPayload(discoveryRaw)),
    });

    return {
      kind: "ready" as const,
      user,
      edition: { ...edition, discovery: discoveryRaw },
      loaded,
      expectStoryOf: expectStoryOfForEdition,
    };
    };

    const result = await masterpieceTraceAsync("article/fetchEdition", () =>
      loadWithRetry(fetchEdition, {
        label: "loadEdition",
        timeoutMs: instantHydratedRef.current || editionFrozenRef.current ? 8_000 : 10_000,
        maxAttempts:
          instantHydratedRef.current || editionFrozenRef.current ? 1 : 2,
        onAttempt: (attempt, error) => {
          if (__DEV__) {
            console.log("[home] loadEdition: attempt", {
              attempt,
              error: error?.message ?? null,
              hasCache: Boolean(cachedBundleRef.current),
            });
          }
        },
      })
    );

    if (!mountedRef.current || gen !== loadGen.current) {
      if (__DEV__) {
        console.log("[generate] loadEdition superseded — newer fetch won", {
          gen,
          current: loadGen.current,
        });
      }
      // Newer load owns paint; still drop our refresh spinner. Loading is
      // cleared in finally only when this gen is still current — otherwise
      // the winner is responsible (hard timeout is the backstop).
      if (isRefresh && !quiet) setRefreshing(false);
      return;
    }

    if (!result.ok) {
      if (cachedBundleRef.current || editionFrozenRef.current) {
        if (__DEV__) {
          console.warn("[home] loadEdition: network failed, keeping printed paper", {
            message: result.error.message,
            elapsedMs: result.elapsedMs,
          });
        }
        const id = editionIdRef.current;
        const date =
          cachedBundleRef.current?.editionDate ?? resolveEffectiveEditionDateSync();
        void (async () => {
          const recoveryIdentity = await resolveEditionLoadIdentity({
            handoff: "recovery-path",
            loadEditionId: id,
            loadMetroKey: cachedBundleRef.current?.metroKey ?? null,
            preferPreview: true,
          });
          const place = recoveryIdentity.place;
          if (
            id &&
            date &&
            place &&
            needsLocalEventsRecovery(cachedBundleRef.current?.sections ?? [])
          ) {
            const recovered = await maybeRecoverLocalEvents({
              editionId: id,
              editionDate: date,
              place,
              sections: cachedBundleRef.current?.sections ?? [],
              expectedMetroKey: recoveryIdentity.metroKey,
            });
            if (mountedRef.current && recovered.length > 0) {
              setSections(recovered);
              persistSectionsToCache(recovered);
            }
          } else if (!needsLocalEventsRecovery(cachedBundleRef.current?.sections ?? [])) {
            setLocalEventsStatus("ready");
          } else {
            setLocalEventsStatus("failed");
          }
        })();
        setLoading(false);
        setRefreshing(false);
        return;
      }
      console.warn("[RETRY_TRACE] set_error_couldnt_be_reached", {
        reason: "loadWithRetry_failed",
        message: result.error.message,
        elapsedMs: result.elapsedMs,
        hasCache: false,
      });
      setError("The paper couldn’t be reached. Pull to try again.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const payload = result.value;

    if (payload.kind === "no_user") {
      const msg = payload.userError?.message ?? "";
      if (/jwt|expired|invalid.*token|refresh token/i.test(msg)) {
        void supabase.auth.signOut();
      } else if (payload.userError) {
        console.warn("[RETRY_TRACE] set_error_couldnt_be_reached", {
          reason: "no_user",
          message: msg,
        });
        setError("The paper couldn’t be reached. Pull to try again.");
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (payload.kind === "not_ready") {
      if ((payload as { incompleteReady?: boolean }).incompleteReady) {
        console.warn(
          "[coldLaunch:trace] Supabase marked this edition ready but the persisted payload is incomplete — refusing to paint a partial newspaper",
          {
            reasons: (payload as { incompleteReasons?: string[] }).incompleteReasons ?? [],
          }
        );
      }
      const staleEdition = (payload as { edition?: { morning_edition?: unknown } | null })
        .edition;
      if (staleEdition && cachedBundleRef.current) {
        const recoveredHero = resolveMorningHero({
          intelligence: cachedBundleRef.current.intelligence,
          cachedBundle: cachedBundleRef.current,
          morningEdition: staleEdition.morning_edition,
        });
        if (recoveredHero) {
          const mergedIntel = mergeMorningHeroIntoIntelligence(
            cachedBundleRef.current.intelligence,
            recoveredHero
          );
          if (mergedIntel !== cachedBundleRef.current.intelligence) {
            setIntelligence(mergedIntel);
            const nextBundle = mergeMorningHeroIntoCachedBundle({
              ...cachedBundleRef.current,
              intelligence: mergedIntel,
              morningHero: recoveredHero,
            });
            cachedBundleRef.current = nextBundle;
            void saveCachedEdition(nextBundle);
            preloadMorningHeroImage(recoveredHero);
          }
        }
      }
      if (!cachedBundleRef.current && !editionFrozenRef.current) {
        setSections([]);
        setEditionDate(null);
        setEditionId(null);
        setLeadStory(null);
        setTopStories([]);
        setNationalNews(null);
        setBandit(null);
        setIntelligence(null);
        setClippedIds(new Set());
      }
      setOlder(payload.adjacent.older);
      setBackgroundJob(
        payload.jobResult.data
          ? { status: payload.jobResult.data.status, lastError: payload.jobResult.data.last_error }
          : null
      );
      if (payload.editionError && !cachedBundleRef.current) {
        console.warn("[RETRY_TRACE] set_error_couldnt_be_reached", {
          reason: "not_ready_with_editionError",
          message: payload.editionError.message,
          hasCache: Boolean(cachedBundleRef.current),
        });
        setError("The paper couldn’t be reached. Pull to try again.");
      } else if (!cachedBundleRef.current && !editionFrozenRef.current) {
        console.warn("[RETRY_TRACE] empty_state_not_ready", {
          reason: "not_ready_no_cache",
          jobStatus: payload.jobResult.data?.status ?? null,
          jobEditionId:
            (payload.jobResult.data as { edition_id?: string | null } | null)
              ?.edition_id ?? null,
          editionError: payload.editionError?.message ?? null,
        });
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { user, edition, loaded, expectStoryOf = false } = payload;

    const paintIdentity = await resolveEditionLoadIdentity({
      handoff: "loadEdition-paint",
      traceId,
      loadEditionId: edition.id,
      loadMetroKey:
        (edition as { metro_key?: string | null }).metro_key?.trim() || null,
      preferPreview:
        afterGenerate || Boolean(loadEditionId) || Boolean(loadMetroKey),
    });

    // Use authoritative preview identity — never stale profile ref alone.
    const active =
      paintIdentity.activeLocation ??
      (await resolveEffectivePlace({ refreshIfStale: false }));
    if (paintIdentity.activeLocation) {
      applyActiveLocation(paintIdentity.activeLocation);
    } else if (mountedRef.current && !activeLocationRef.current) {
      applyActiveLocation(active);
    }

    const builtCity = resolveEditionBuiltCity(
      {
        discovery: (edition as { discovery?: unknown }).discovery,
        editorial_context: (edition as { editorial_context?: unknown })
          .editorial_context,
        morning_edition: (edition as { morning_edition?: unknown })
          .morning_edition,
      },
      loaded
    );

    const activeCity = active.place?.city ?? null;
    const sectionCity = cityFromEditionSections(loaded);
    // Authoritative built city wins — metro event cities (e.g. Phoenix for a
    // Gilbert paper) must not block painting a correctly built edition.
    const contentCityMismatch = shouldWithholdEditionForCityMismatch({
      activeCity,
      builtCity,
      sectionCity,
      mode: active.mode,
    });

    if (__DEV__) {
      console.log("[home] loadEdition: location check", {
        mode: active.mode,
        activeCity,
        builtCity,
        sectionCity,
        contentCityMismatch,
        editionId: edition.id,
      });
    }

    // Never silently reuse an edition generated for another city.
    if (contentCityMismatch && activeCity && !shouldBypassEditionCityMismatch()) {
      if (__DEV__) {
        console.warn("[home] loadEdition: withholding wrong-city edition", {
          mode: active.mode,
          activeCity,
          builtCity,
          sectionCity,
          editionId: edition.id,
        });
      }
      editionFrozenRef.current = false;
      clearEditionFreeze();
      markHomeScrollForReset();
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
      setNationalNews(null);
      setBandit(null);
      setIntelligence(null);
      setClippedIds(new Set());
      setBackgroundJob(null);
      setLocationMismatch(builtCity ?? "another city");
      setLoading(false);
      setRefreshing(false);

      void fetchAdjacentEditions(
        user.id,
        edition.edition_date,
        (edition as { metro_key?: string | null }).metro_key ??
          editionCacheMetroKey(active.place)
      ).then((adjacent) => {
        if (mountedRef.current && gen === loadGen.current) {
          setOlder(adjacent.older);
        }
      });

      const regenKey = `${edition.id}:${activeCity}:${active.mode}`;
      if (autoRegenKey.current !== regenKey) {
        autoRegenKey.current = regenKey;
        // Current Location: regenerate automatically. Other modes: show CTA.
        if (active.mode === "current") {
          setPendingCityRegen(true);
        }
      }
      return;
    }

    setLocationMismatch(null);
    setBackgroundJob(null);

    const staleCachedEdition = isStaleCachedEdition(
      cachedBundleRef.current,
      edition.id
    );
    if (staleCachedEdition || (isRefresh && !quiet)) {
      editionFrozenRef.current = false;
      clearEditionFreeze();
      if (staleCachedEdition) {
        const supersededEditionId = cachedBundleRef.current?.editionId ?? null;
        cachedBundleRef.current = null;
        instantHydratedRef.current = false;
        void clearCachedEdition(
          user.id,
          edition.edition_date,
          editionCacheMetroKey(active.place)
        );
        if (__DEV__) {
          console.log("[home] loadEdition: discarded stale cached edition", {
            cachedEditionId: supersededEditionId,
            networkEditionId: edition.id,
          });
        }
      }
    }

    const expectStoryOfForMetro =
      expectStoryOf ||
      metroExpectsStoryOf(
        active.place ? metroKeyFromKindredPlace(active.place) : null
      );

    const frozenNow = isEditionFrozen({
      editionId: edition.id,
      editionDate: edition.edition_date,
    });
    const narrativeFrozen = frozenNow && editionFrozenRef.current;
    const softRefresh =
      isRefresh && quiet && narrativeFrozen && editionFrozenRef.current;
    const patchEventsOnly =
      eventsOnly || (quiet && narrativeFrozen && !softRefresh);
    const syncAfterCache =
      (narrativeFrozen && !isRefresh && !eventsOnly) || softRefresh;
    const cacheMatchesNetwork =
      syncAfterCache &&
      networkSectionsMatchCache(cachedBundleRef.current, edition.id, loaded);

    const lead = parseLeadStory((edition as { lead_story?: unknown }).lead_story);
    const deferKnowledgeMemory = !patchEventsOnly && !syncAfterCache;
    let intel = intelligenceWithPreservedMorningHero(
      parseEditionIntelligence(
        {
          bandit: (edition as { bandit?: unknown }).bandit,
          discovery: (edition as { discovery?: unknown }).discovery,
          knowledge: (edition as { knowledge?: unknown }).knowledge,
          memory: (edition as { memory?: unknown }).memory,
          morning_edition: (edition as { morning_edition?: unknown })
            .morning_edition,
          history_around_town: (edition as { history_around_town?: unknown })
            .history_around_town,
          editorial_context: (edition as { editorial_context?: unknown })
            .editorial_context,
          leadStory: lead,
        },
        { deferKnowledgeMemory }
      ),
      (edition as { morning_edition?: unknown }).morning_edition,
      (edition as { history_around_town?: unknown }).history_around_town
    );

    logHistoryAroundTownPipeline("homepage_loader", {
      editionRaw: (edition as { history_around_town?: unknown }).history_around_town,
      intelligence: intel,
      cachedBundle: cachedBundleRef.current,
    });

    // Never block first paint / generate-edition completion on recovery fetch.
    scheduleMorningHeroRecovery(edition.edition_date, intel, gen);

    let nextSections = loaded;

    if (patchEventsOnly && editionFrozenRef.current) {
      nextSections = mergeFrozenSections(
        cachedBundleRef.current?.sections ?? loaded,
        loaded
      );
      setSections(nextSections);
    } else if (syncAfterCache && cacheMatchesNetwork) {
      nextSections = cachedBundleRef.current?.sections ?? loaded;
      const shouldMergeMorningHero = needsNetworkMorningHeroMerge({
        networkIntelligence: intel,
        onScreenIntelligence: cachedBundleRef.current?.intelligence ?? null,
        cachedBundle: cachedBundleRef.current,
      });
      if (shouldMergeMorningHero) {
        const networkHero = resolveMorningHero({ intelligence: intel });
        setIntelligence(intel);
        if (networkHero && cachedBundleRef.current) {
          const nextBundle = mergeMorningHeroIntoCachedBundle({
            ...cachedBundleRef.current,
            intelligence: intel,
            morningHero: networkHero,
          });
          cachedBundleRef.current = nextBundle;
          void saveCachedEdition(nextBundle);
          preloadMorningHeroImage(networkHero);
        }
        if (__DEV__) {
          console.log(
            "[home] loadEdition: merged network morningHero during cache sync",
            { artworkId: networkHero?.artworkId ?? null }
          );
        }
      } else if (__DEV__) {
        console.log("[home] loadEdition: network verified cache — no UI churn");
      }
      applyNetworkHistoryAroundTownMerge(
        intel,
        (edition as { history_around_town?: unknown }).history_around_town,
        gen
      );
      applyNetworkWeatherSummaryMerge(
        intel,
        (edition as { editorial_context?: unknown }).editorial_context,
        gen
      );
    } else if (syncAfterCache) {
      nextSections = mergeFrozenSections(
        cachedBundleRef.current?.sections ?? loaded,
        loaded
      );
      setSections(nextSections);
      setEditionDate(edition.edition_date);
      setEditionId(edition.id);
      // Network row is authoritative for narrative desks — cache hydrate must
      // not leave discovery/intelligence frozen at an incomplete snapshot.
      setLeadStory(lead);
      applyEditionNewsDesks(
        edition as { national_news?: unknown; editorial_context?: unknown },
        edition.edition_date
      );
      setBandit(parseBanditPayload((edition as { bandit?: unknown }).bandit));
      setIntelligence(intel);
      freezeEdition({
        editionId: edition.id,
        editionDate: edition.edition_date,
        discovery: intel.discovery ?? null,
        discoveryItems: intel.discoveryItems ?? null,
        heroImageId: cachedBundleRef.current?.heroImageId ?? null,
      });
      editionFrozenRef.current = true;
      preloadMorningHeroImage(intel.morningHero);
      const parsedTopStories = topStoriesFromEditorialContext(
        (edition as { editorial_context?: unknown }).editorial_context
      );
      const parsedNationalNews = resolveNationalNewsForRender({
        edition: edition as { national_news?: unknown; editorial_context?: unknown },
        topStories: parsedTopStories,
        editionDate: edition.edition_date,
      });
      const bundle: CachedEditionBundle = {
        userId: user.id,
        editionId: edition.id,
        editionDate: edition.edition_date,
        metroKey:
          (edition as { metro_key?: string | null }).metro_key ??
          editionCacheMetroKey(active.place) ??
          "unknown",
        cachedAt: Date.now(),
        sections: nextSections,
        leadStory: lead,
        topStories: parsedTopStories,
        nationalNews: parsedNationalNews,
        bandit: parseBanditPayload((edition as { bandit?: unknown }).bandit),
        intelligence: intel,
        heroImageId: cachedBundleRef.current?.heroImageId ?? null,
        morningHero: intel.morningHero ?? cachedBundleRef.current?.morningHero ?? null,
        pairedNationalDaily: resolvePairedNationalDailyForCache({
          sections: nextSections,
          networkDaily: nationalDaily,
          existingPaired:
            cachedBundleRef.current?.pairedNationalDaily ?? pairedNationalDaily,
        }),
      };
      cachedBundleRef.current = bundle;
      scheduleCachedEditionSave(bundle);
    } else {
      setSections(loaded);
      nextSections = loaded;
      setEditionDate(edition.edition_date);
      setEditionId(edition.id);
      setLeadStory(lead);
      applyEditionNewsDesks(
        edition as { national_news?: unknown; editorial_context?: unknown },
        edition.edition_date
      );
      setBandit(parseBanditPayload((edition as { bandit?: unknown }).bandit));
      setIntelligence(intel);
      freezeEdition({
        editionId: edition.id,
        editionDate: edition.edition_date,
        discovery: intel.discovery ?? null,
        discoveryItems: intel.discoveryItems ?? null,
        heroImageId: cachedBundleRef.current?.heroImageId ?? null,
      });
      editionFrozenRef.current = true;
    }

    traceParsedIntelligence(
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.intelligence ?? intel
        : intel,
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.leadStory ?? lead
        : lead,
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.bandit ??
            parseBanditPayload((edition as { bandit?: unknown }).bandit)
        : parseBanditPayload((edition as { bandit?: unknown }).bandit),
      active.place
        ? { lat: active.place.lat, lon: active.place.lon }
        : null
    );

    traceReactState({
      sections: nextSections,
      intelligence:
        patchEventsOnly || syncAfterCache
          ? cachedBundleRef.current?.intelligence ?? intel
          : intel,
      leadStory:
        patchEventsOnly || syncAfterCache
          ? cachedBundleRef.current?.leadStory ?? lead
          : lead,
      bandit:
        patchEventsOnly || syncAfterCache
          ? cachedBundleRef.current?.bandit ??
              parseBanditPayload((edition as { bandit?: unknown }).bandit)
          : parseBanditPayload((edition as { bandit?: unknown }).bandit),
      readerLocation: active.place
        ? { lat: active.place.lat, lon: active.place.lon }
        : null,
      applyPath: patchEventsOnly
        ? "patchEventsOnly"
        : syncAfterCache
          ? "syncAfterCache"
          : "full",
    });

    if (__DEV__) {
      logLocalEventsPipeline(
        "loadEdition sections applied",
        pipelineCountsFromSections(nextSections),
        {
          patchEventsOnly,
          syncAfterCache,
          narrativeFrozen,
        }
      );
    }

    // First paint — text is readable; everything below runs in the background.
    // Phase One success requires a complete already-generated edition, not
    // merely a fast Hero + Local Events shell.
    const onScreenIntel =
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.intelligence ?? intel
        : intel;
    const onScreenBandit =
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.bandit ??
          parseBanditPayload((edition as { bandit?: unknown }).bandit)
        : parseBanditPayload((edition as { bandit?: unknown }).bandit);
    const onScreenLead =
      patchEventsOnly || syncAfterCache
        ? cachedBundleRef.current?.leadStory ?? lead
        : lead;
    const completeness = assessEditionCompleteness({
      sections: nextSections,
      intelligence: onScreenIntel,
      bandit: onScreenBandit,
      leadStory: onScreenLead,
      readerLocation: active.place
        ? { lat: active.place.lat, lon: active.place.lon }
        : null,
      expectStoryOf: expectStoryOfForMetro,
    });
    logEditionCompleteness(
      cachedBundleRef.current ? "repeat_launch" : "cold_launch",
      completeness
    );

    setLoading(false);
    setRefreshing(false);
    editionIdRef.current = edition.id;
    console.log("[RETRY_TRACE] painted", {
      editionId: edition.id,
      editionDate: edition.edition_date,
      metroKey:
        (edition as { metro_key?: string | null }).metro_key ?? null,
      sectionCount: nextSections.length,
      sectionTypes: nextSections.map((s) => s.section_type),
    });
    devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "first_paint", {
      editionId: edition.id,
      sectionCount: nextSections.length,
    });
    pipelineStageBegin("first_paint");
    pipelineStageEnd("first_paint");
    if (!startupSummaryLoggedRef.current) {
      markStartup("home_first_paint");
      logFirstPaintIfNeeded(
        instantHydratedRef.current || cachedBundleRef.current
          ? "repeat_launch"
          : "cold_launch",
        completeness.complete
      );
      reportStartupPipeline(
        instantHydratedRef.current || cachedBundleRef.current
          ? "warm_launch"
          : "cold_launch"
      );
    } else if (__DEV__) {
      markStartup("home_network_verified");
      reportStartupPipeline(isRefresh ? "pull_to_refresh" : "background_sync");
    }

    void (async () => {
      if (!mountedRef.current || gen !== loadGen.current) return;

      pipelineStageBegin("background_sync");

      if (deferKnowledgeMemory) {
        const enriched = enrichEditionIntelligenceKnowledgeMemory(intel, {
          knowledge: (edition as { knowledge?: unknown }).knowledge,
          memory: (edition as { memory?: unknown }).memory,
          leadStory: lead,
          morning_edition: (edition as { morning_edition?: unknown })
            .morning_edition,
        });
        intel = enriched;
        if (mountedRef.current && gen === loadGen.current) {
          setIntelligence(enriched);
        }
      }

      void fetchAdjacentEditions(
        user.id,
        edition.edition_date,
        (edition as { metro_key?: string | null }).metro_key ??
          editionCacheMetroKey(active.place)
      ).then((adjacent) => {
        if (mountedRef.current && gen === loadGen.current) {
          setOlder(adjacent.older);
        }
      });

      const syncIdentity = await resolveEditionLoadIdentity({
        handoff: "background-sync",
        traceId,
        loadEditionId: edition.id,
        loadMetroKey:
          (edition as { metro_key?: string | null }).metro_key?.trim() || null,
        preferPreview: true,
      });
      if (syncIdentity.activeLocation && mountedRef.current && gen === loadGen.current) {
        applyActiveLocation(syncIdentity.activeLocation);
      }

      let bgSections = nextSections;
      let bgIntel: EditionIntelligence | null = intel;

      const recoveredSections = await maybeRecoverLocalEvents({
        editionId: edition.id,
        editionDate: edition.edition_date,
        place: syncIdentity.place,
        sections: bgSections,
        expectedMetroKey: syncIdentity.metroKey,
        traceId,
      });

      if (
        recoveredSections !== bgSections &&
        mountedRef.current &&
        gen === loadGen.current
      ) {
        setSections(recoveredSections);
        bgSections = recoveredSections;
        persistSectionsToCache(recoveredSections);
      }

      const historyRecovery = await maybeRecoverTodayInHistory({
        userId: user.id,
        editionId: edition.id,
        editionDate: edition.edition_date,
        sections: bgSections,
        intelligence: bgIntel,
      });

      if (
        (historyRecovery.sections !== bgSections ||
          historyRecovery.intelligence !== bgIntel) &&
        mountedRef.current &&
        gen === loadGen.current
      ) {
        setSections(historyRecovery.sections);
        setIntelligence(historyRecovery.intelligence);
        bgSections = historyRecovery.sections;
        bgIntel = historyRecovery.intelligence;
      }

      const storySections = await maybeRecoverStoryOf({
        editionId: edition.id,
        editionDate: edition.edition_date,
        place: syncIdentity.place,
        sections: bgSections,
      });

      if (
        storySections !== bgSections &&
        mountedRef.current &&
        gen === loadGen.current
      ) {
        setSections(storySections);
        bgSections = storySections;
        persistSectionsToCache(storySections);
      }

      if (loaded.length > 0) {
        const sectionIdsForClips = loaded.map((s) => s.id);
        const { data: clips, error: clipsError } = await supabase
          .from("clippings")
          .select("section_id")
          .eq("user_id", user.id)
          .in("section_id", sectionIdsForClips);

        if (clipsError && __DEV__) {
          console.error("[home] loadEdition: clippings query error", {
            message: clipsError.message,
            code: clipsError.code,
          });
        }

        if (mountedRef.current && gen === loadGen.current && !patchEventsOnly) {
          setClippedIds(new Set((clips ?? []).map((c) => c.section_id)));
        }
      } else if (
        mountedRef.current &&
        gen === loadGen.current &&
        !patchEventsOnly
      ) {
        setClippedIds(new Set());
      }

      if (!patchEventsOnly && !syncAfterCache) {
        const bgTopStories = topStoriesFromEditorialContext(
          (edition as { editorial_context?: unknown }).editorial_context
        );
        const bundle: CachedEditionBundle = {
          userId: user.id,
          editionId: edition.id,
          editionDate: edition.edition_date,
          metroKey:
            (edition as { metro_key?: string | null }).metro_key ??
            editionCacheMetroKey(active.place) ??
            "unknown",
          cachedAt: Date.now(),
          sections: bgSections,
          leadStory: lead,
          topStories: bgTopStories,
          nationalNews: resolveNationalNewsForRender({
            edition: edition as {
              national_news?: unknown;
              editorial_context?: unknown;
            },
            topStories: bgTopStories,
            editionDate: edition.edition_date,
          }),
          bandit: parseBanditPayload((edition as { bandit?: unknown }).bandit),
          intelligence: bgIntel,
          heroImageId: cachedBundleRef.current?.heroImageId ?? null,
          morningHero:
            bgIntel?.morningHero ?? cachedBundleRef.current?.morningHero ?? null,
          pairedNationalDaily:
            historyRecovery.pairedNationalDaily ??
            resolvePairedNationalDailyForCache({
              sections: bgSections,
              networkDaily: nationalDaily,
              existingPaired:
                cachedBundleRef.current?.pairedNationalDaily ?? pairedNationalDaily,
            }),
        };
        cachedBundleRef.current = bundle;
      scheduleCachedEditionSave(bundle);
      void maybeRecordDevEditionSnapshot({
        place: syncIdentity.place ?? active.place,
        editionDate: edition.edition_date,
        bundle,
        discovery: (edition as { discovery?: unknown }).discovery,
        generationTimeMs: devGenerationMsRef.current,
      });
    } else if (bgSections.length > 0) {
        persistSectionsToCache(bgSections);
      }

      if (__DEV__) {
        console.log("[home] loadEdition: post-paint work finished", {
          patchEventsOnly,
          sectionCount: loaded.length,
          elapsedMs: result.elapsedMs,
          attempt: result.attempt,
        });
      }

      if (!syncIdentity.isDeveloperPreview) {
        void maybeTriggerLiveRefresh({
          editionId: edition.id,
          editionDate: edition.edition_date,
          place: syncIdentity.place,
          onEventsChanged: () => {
            if (mountedRef.current) {
              void loadEdition({ quiet: true, eventsOnly: true });
            }
          },
        });
      }

      pipelineStageEnd("background_sync");
    })();
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[home] loadEdition threw",
          err instanceof Error ? err.message : String(err)
        );
      }
      if (mountedRef.current && gen === loadGen.current) {
        if (!editionFrozenRef.current && !cachedBundleRef.current) {
          setError("The paper couldn’t be reached. Pull to try again.");
        }
      }
    } finally {
      if (__DEV__) {
        logHomeScrollDebug("load_edition_end", {
          isRefresh,
          quiet,
          currentY: homeScrollYRef.current,
          editionId: editionIdRef.current,
        });
      }
      if (!mountedRef.current) return;
      if (gen !== loadGen.current) {
        if (isRefresh && !quiet) setRefreshing(false);
        return;
      }
      if (!deferKeepLoading) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const pollBackgroundJobProgress = useCallback(async () => {
    if (!isSupabaseConfigured || generatingRef.current) return;

    const traceId = devGenerateTraceIdRef.current;

    const {
      data: { session },
    } = await getLaunchSessionOrFetch();
    const user = session?.user ?? null;
    if (!user) return;

    const todayStr = await resolveEffectiveEditionDate();
    const pollIdentity = await resolveEditionLoadIdentity({
      handoff: "background-poll",
      preferPreview: true,
    });
    const pollMetroKey = pollIdentity.metroKey;

    const [editionResult, jobResult] = await Promise.all([
      pollMetroKey
        ? supabase
            .from("editions")
            .select("id, status")
            .eq("user_id", user.id)
            .eq("edition_date", todayStr)
            .eq("metro_key", pollMetroKey)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      fetchGenerationJobForEdition(supabase, {
        userId: user.id,
        editionDate: todayStr,
        metroKey: pollMetroKey,
      }),
    ]);

    if (!mountedRef.current) return;

    const pollEditionId = editionResult.data?.id as string | undefined;
    const pollStatus = editionResult.data?.status as string | undefined;

    let pollSectionTypes: string[] = [];
    if (pollEditionId) {
      const { data: sectionRows } = await supabase
        .from("edition_sections")
        .select("section_type")
        .eq("edition_id", pollEditionId);
      pollSectionTypes = (sectionRows ?? []).map((row) =>
        String((row as { section_type: string }).section_type)
      );
    }

    const pollPaintable = isProcessingEditionPaintable(pollStatus, pollSectionTypes.map((t) => ({ section_type: t })));

    devGenerateTrace(traceId, "background_poll_tick", {
      metroKey: pollMetroKey,
      city: pollIdentity.place?.city ?? null,
      editionStatus: pollStatus ?? null,
      sectionCount: pollSectionTypes.length,
      paintable: pollPaintable,
    });

    if (pollEditionId && pollPaintable) {
      devGenerateTrace(traceId, "background_poll_ready", {
        editionId: pollEditionId,
        metroKey: pollMetroKey,
        partial: pollStatus === "processing",
      });
      setBackgroundJob(null);
      setError(null);
      void loadEdition({
        quiet: true,
        afterGenerate: true,
        editionId: pollEditionId,
        metroKey: pollMetroKey,
        traceId: traceId ?? undefined,
      });
      return;
    }

    if (jobResult.data) {
      setBackgroundJob({
        status: jobResult.data.status,
        lastError: jobResult.data.last_error,
      });
      if (jobResult.data.status === "failed" && !editionIdRef.current) {
        setError(GENERATION_STALL_MESSAGE);
      }
    }
  }, [loadEdition]);

  useFocusEffect(
    useCallback(() => {
      if (!initialFocusLocationHandledRef.current) {
        initialFocusLocationHandledRef.current = true;
        return;
      }
      void (async () => {
        const active = await resolveEffectivePlace({ refreshIfStale: false });
        if (!mountedRef.current) return;
        applyActiveLocation(active);
        const nextKey = activeLocationKey(active);
        const prevKey = focusedLocationKeyRef.current;
        focusedLocationKeyRef.current = nextKey;
        if (isDeveloperPreviewSessionActive() || isDevEditionOverrideActive()) {
          return;
        }
        // Reload today's paper when returning from Location settings (or any
        // focus) with a different city/mode — never leave a stale folio up.
        if (prevKey !== null && prevKey !== nextKey) {
          markHomeScrollForReset();
          void loadEdition(true);
        }
      })();
    }, [loadEdition])
  );

  useFocusEffect(
    useCallback(() => {
      homeFocusTransitionCountRef.current += 1;
      logHomeScrollDebug(
        "focus_enter",
        scrollRestoreSnapshot("focus_enter", {
          blurred: homeScreenBlurredRef.current,
        })
      );

      let cancelled = false;
      const focusGeneration = articleReturnGenerationRef.current;

      void (async () => {
        if (skipScrollRestoreRef.current) {
          skipScrollRestoreRef.current = false;
          return;
        }
        if (!homeScreenBlurredRef.current) return;

        logHomeScrollDebug(
          "focus_return_after_blur",
          scrollRestoreSnapshot("focus_return_after_blur")
        );

        logArticleReturnPhaseChange(
          "waiting_for_return_layout",
          "navigation_return_focus"
        );

        const id = editionIdRef.current;
        if (!id) {
          completeArticleReturnRestore("navigation_return_no_edition");
          return;
        }

        const focusEditionId = id;
        const focusLocationKey = activeLocationKey(activeLocationRef.current);
        const key = homeScrollSessionKey(focusEditionId, focusLocationKey);
        const saved = await loadHomeScroll(key);
        if (
          cancelled ||
          focusGeneration !== articleReturnGenerationRef.current ||
          articleReturnPhaseRef.current !== "waiting_for_return_layout"
        ) {
          return;
        }
        if (
          saved <= 0 ||
          editionIdRef.current !== focusEditionId ||
          activeLocationKey(activeLocationRef.current) !== focusLocationKey
        ) {
          completeArticleReturnRestore("navigation_return_no_saved_scroll");
          return;
        }

        articleReturnTargetYRef.current = saved;
        pendingScrollRestoreY.current = saved;

        logHomeScrollDebug(
          "restore_arm_eval",
          scrollRestoreSnapshot("navigation_return", { targetY: saved })
        );

        restoreArticleReturnScrollIfNeededRef.current(undefined);
      })();

      return () => {
        cancelled = true;
        articleReturnGenerationRef.current += 1;
        homeScreenBlurredRef.current = true;
        logArticleReturnPhaseChange("idle", "focus_leave_blur");
        persistHomeScrollNow();
        logHomeScrollDebug("focus_leave_blur", scrollRestoreSnapshot("focus_leave_blur"));
      };
    }, [])
  );

  useEffect(() => {
    loadEdition();
  }, [loadEdition]);

  // Never leave the reader on a spinner indefinitely — any loading/generating
  // path must clear within 30s even if an edition id is already known.
  useEffect(() => {
    if (!loading && !generating) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      if (generationPollActiveRef.current) return;
      if (__DEV__) {
        console.warn("[home] safety timeout — clearing loading/generating spinner", {
          hadEdition: Boolean(editionIdRef.current),
          hadCache: Boolean(cachedBundleRef.current),
        });
      }
      generatingRef.current = false;
      setGenerating(false);
      setLoading(false);
      setRefreshing(false);
      if (!editionIdRef.current && !cachedBundleRef.current) {
        setError(GENERATION_STALL_MESSAGE);
      }
    }, 30_000);
    return () => clearTimeout(timer);
  }, [loading, generating]);

  // After 60s on the presses screen, attempt partial paint or show Retry.
  useEffect(() => {
    if (!generating) return;
    const timer = setTimeout(() => {
      if (!mountedRef.current || !generatingRef.current) return;
      const traceId = devGenerateTraceIdRef.current;
      devGenerateTrace(traceId, "generating_first_paint_timeout");
      void (async () => {
        await loadEdition({
          isRefresh: true,
          afterGenerate: true,
          traceId: traceId ?? undefined,
        });
        if (!mountedRef.current) return;
        if (editionIdRef.current && editionIdRef.current.length > 0) {
          generatingRef.current = false;
          setGenerating(false);
          setLoading(false);
          devGenerateTrace(traceId, "first_paint", {
            editionId: editionIdRef.current,
            via: "60s_timeout",
          });
          return;
        }
        setError(GENERATION_STALL_MESSAGE);
        generatingRef.current = false;
        setGenerating(false);
        setLoading(false);
        void pollBackgroundJobProgress();
      })();
    }, GENERATION_FIRST_PAINT_MAX_MS);
    return () => clearTimeout(timer);
  }, [generating, loadEdition, pollBackgroundJobProgress]);

  // While the overnight job already has today's edition in progress, quietly
  // recheck rather than leaving the reader on a stale "isn't ready yet" —
  // no spinner, no scroll reset, just the same query loadEdition already
  // runs on every focus. Stops the moment the job leaves pending/processing.
  useEffect(() => {
    const jobActive =
      backgroundJob?.status === "pending" || backgroundJob?.status === "processing";
    if (!jobActive) return;
    const interval = setInterval(() => {
      if (mountedRef.current && !generatingRef.current) {
        void pollBackgroundJobProgress();
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [backgroundJob, pollBackgroundJobProgress]);

  // Resume: quietly refresh paper + stale GPS when mode is current.
  useEffect(() => {
    const lastActive = { at: Date.now() };
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      const now = Date.now();
      if (now - lastActive.at < 45_000) return;
      lastActive.at = now;
      void (async () => {
        if (isDeveloperPreviewSessionActive() || isDevEditionOverrideActive()) {
          return;
        }
        const active = await resolveEffectivePlace({ refreshIfStale: true });
        if (mountedRef.current) {
          applyActiveLocation(active);
          focusedLocationKeyRef.current = activeLocationKey(active);
        }
        void loadEdition({ quiet: true });
      })();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [loadEdition]);

  function handleHomeRefresh() {
    logHomeScrollDebug("refresh_start", {
      currentY: homeScrollYRef.current,
      editionId: editionIdRef.current,
    });
    // Keep the printed paper visible — sync quietly under the refresh spinner.
    if (editionIdRef.current && sections.length > 0) {
      setRefreshing(true);
      void loadEdition({ isRefresh: true, quiet: true }).finally(() => {
        logHomeScrollDebug("refresh_end", {
          currentY: homeScrollYRef.current,
          editionId: editionIdRef.current,
        });
      });
      return;
    }
    void loadEdition(true).finally(() => {
      logHomeScrollDebug("refresh_end", {
        currentY: homeScrollYRef.current,
        editionId: editionIdRef.current,
      });
    });
  }

  /**
   * Retry / "check again": open an already-ready job edition before regenerating.
   * Full generate clears the folio first (dev override) — that leaves readers
   * stranded when today's paper is already ready in Supabase.
   */
  async function handleRetryPress() {
    const traceId = createDevGenerateTraceId();
    console.log("[RETRY_TRACE] tap", {
      traceId,
      at: Date.now(),
      sectionsLength: sections.length,
      error,
      generating: generatingRef.current,
      editionIdRef: editionIdRef.current,
    });

    if (generatingRef.current) {
      console.log("[RETRY_TRACE] exit_before_network", {
        reason: "already_generating",
        traceId,
      });
      return;
    }

    try {
      const {
        data: { session },
        error: sessionError,
      } = await getLaunchSessionOrFetch();
      const user = session?.user ?? null;
      if (!user) {
        console.log("[RETRY_TRACE] exit_before_network", {
          reason: "no_user",
          sessionError: sessionError?.message ?? null,
          traceId,
        });
        setError("Sign in to open today's paper.");
        return;
      }

      await hydrateDeveloperPreviewContext();
      await hydrateDevEditionOverrideState();
      const preview = getDeveloperPreviewContextSync();
      const active = await resolveEffectivePlace({ refreshIfStale: true });
      const place = preview
        ? developerPreviewPlace(preview)
        : active.place;
      const metroKey =
        preview?.metroKey?.trim() ||
        editionCacheMetroKey(place) ||
        null;
      const editionDate =
        preview?.editionDate?.trim() ||
        (await resolveEffectiveEditionDate());

      console.log("[RETRY_TRACE] request_identity", {
        traceId,
        metroKey,
        editionDate,
        city: place?.city ?? null,
        developerPreview: Boolean(preview),
        devOverrideActive: isDevEditionOverrideActive(),
        previewEditionId: preview?.editionId ?? null,
        previewDate: preview?.editionDate ?? null,
      });

      if (!metroKey || !place) {
        console.log("[RETRY_TRACE] exit_before_network", {
          reason: "no_metro_or_place",
          traceId,
        });
        await handleGenerate(traceId, { manualBuild: true });
        return;
      }

      const jobStarted = Date.now();
      const jobResult = await fetchGenerationJobForEdition(supabase, {
        userId: user.id,
        editionDate,
        metroKey,
      });
      const job = jobResult.data;
      console.log("[RETRY_TRACE] generation_job", {
        traceId,
        ms: Date.now() - jobStarted,
        jobId: job?.id ?? null,
        jobStatus: job?.status ?? null,
        editionId: job?.edition_id ?? null,
        lastError: job?.last_error ?? null,
        fetchError: jobResult.error?.message ?? null,
      });

      const readyEditionId =
        job?.status === "ready" ? job.edition_id?.trim() || null : null;

      if (!readyEditionId) {
        console.log("[RETRY_TRACE] path", {
          traceId,
          action: "no_ready_job_invoke_generate",
        });
        await handleGenerate(traceId, { manualBuild: true });
        return;
      }

      const editionSelect =
        "id, edition_date, status, user_id, metro_key, lead_story, national_news, bandit, discovery, knowledge, memory, morning_edition, history_around_town, editorial_context";
      const editionStarted = Date.now();
      const editionResult = await supabase
        .from("editions")
        .select(editionSelect)
        .eq("id", readyEditionId)
        .maybeSingle();
      const edition = editionResult.data as {
        id?: string;
        status?: string;
        edition_date?: string;
        metro_key?: string;
        lead_story?: unknown;
        bandit?: unknown;
        discovery?: unknown;
        morning_edition?: unknown;
      } | null;

      console.log("[RETRY_TRACE] edition_row", {
        traceId,
        ms: Date.now() - editionStarted,
        editionId: readyEditionId,
        editionStatus: edition?.status ?? null,
        httpStatus: editionResult.status ?? null,
        error: editionResult.error
          ? {
              message: editionResult.error.message,
              code: editionResult.error.code,
              details: editionResult.error.details,
            }
          : null,
        responseBody: edition
          ? {
              id: edition.id,
              status: edition.status,
              edition_date: edition.edition_date,
              metro_key: edition.metro_key,
              hasBanditPick: Boolean(banditsPick(edition.bandit as BanditPayload | null)),
              hasLead: Boolean(edition.lead_story),
              hasMorningHero: Boolean(
                (edition.morning_edition as { morningHero?: unknown } | null)
                  ?.morningHero
              ),
              hasDiscovery: Boolean(edition.discovery),
            }
          : null,
      });

      if (!edition || edition.status !== "ready") {
        console.log("[RETRY_TRACE] path", {
          traceId,
          action: "ready_job_but_edition_missing_invoke_generate",
          editionExists: Boolean(edition),
          editionStatus: edition?.status ?? null,
        });
        await handleGenerate(traceId, { manualBuild: true });
        return;
      }

      const sectionsStarted = Date.now();
      const sectionsResult = await queryEditionSections(readyEditionId);
      const sectionRows =
        (sectionsResult.data as EditionSection[] | null) ?? [];
      const sectionTypes = sectionRows.map((s) => s.section_type);
      const completeness = isPersistedEditionComplete(
        {
          discovery: edition.discovery,
          lead_story: edition.lead_story,
          bandit: edition.bandit,
          morning_edition: edition.morning_edition,
        },
        sectionRows,
        { expectStoryOf: true }
      );
      const fieldGate = {
        masterpiece: Boolean(
          (edition.morning_edition as { morningHero?: unknown } | null)
            ?.morningHero
        ),
        events: sectionTypes.includes("local_events"),
        activities: completeness.reasons.every(
          (r) => !r.includes("activities")
        ),
        food_drinks: sectionTypes.includes("food_drinks"),
        story_of_city:
          sectionTypes.includes("story_of") ||
          sectionTypes.includes("your_city"),
        // V1: Bandit's Picks disabled — never fail retry on bandit.
        bandit: true,
        today_in_history: sectionTypes.includes("today_in_history"),
        local_news_desk:
          Boolean(edition.lead_story) || sectionTypes.includes("top_stories"),
      };

      console.log("[RETRY_TRACE] completeness_gate", {
        traceId,
        editionId: readyEditionId,
        ms: Date.now() - sectionsStarted,
        sectionTypes,
        complete: completeness.complete,
        failingReasons: completeness.reasons,
        fields: fieldGate,
        failingFields: Object.entries(fieldGate)
          .filter(([, ok]) => !ok)
          .map(([k]) => k),
      });

      console.log("[RETRY_TRACE] path", {
        traceId,
        action: "load_already_ready_edition",
        editionId: readyEditionId,
        jobId: job?.id ?? null,
        jobStatus: job?.status ?? null,
      });

      if (preview || isDevEditionOverrideActive()) {
        await setDeveloperPreviewContext({
          editionId: readyEditionId,
          metroKey,
          city: place.city,
          state: place.state ?? null,
          region: place.region ?? null,
          lat: place.lat,
          lon: place.lon,
          editionDate: edition.edition_date ?? editionDate,
          traceId,
        });
      }

      setError(null);
      setBackgroundJob(null);
      setLoading(true);

      await loadEdition({
        isRefresh: true,
        afterGenerate: true,
        traceId,
        editionId: readyEditionId,
        metroKey,
      });

      // Allow React state → editionIdRef sync from paint, then confirm.
      await new Promise((r) => setTimeout(r, 0));
      console.log("[RETRY_TRACE] load_complete", {
        traceId,
        requestedEditionId: readyEditionId,
        renderedEditionId: editionIdRef.current,
        match: editionIdRef.current === readyEditionId,
        supabaseReadyEditionId: readyEditionId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[RETRY_TRACE] thrown", {
        message,
        stack: err instanceof Error ? err.stack : null,
      });
      setError("The paper couldn’t be reached. Pull to try again.");
      setLoading(false);
    }
  }

  async function handleGenerate(
    continuedTraceId?: string,
    options?: { manualBuild?: boolean }
  ) {
    const traceId = continuedTraceId ?? createDevGenerateTraceId();
    devGenerateTraceIdRef.current = traceId;
    devGenerateTrace(traceId, "handle_generate_enter", {
      manualBuild: options?.manualBuild === true,
    });
    console.log("[generate] ENTER handleGenerate", { traceId, manualBuild: options?.manualBuild });
    console.log("[RETRY_TRACE] handleGenerate_enter", {
      traceId,
      manualBuild: options?.manualBuild === true,
      generating: generatingRef.current,
    });
    if (generatingRef.current) {
      console.log("[generate] EXIT handleGenerate (already running)", { traceId });
      console.log("[RETRY_TRACE] exit_before_network", {
        reason: "already_generating_in_handleGenerate",
        traceId,
      });
      return;
    }
    generatingRef.current = true;
    setGenerating(true);
    setLoading(false);
    setError(null);

    if (options?.manualBuild) {
      devGenerateTrace(traceId, "manual_build_start");
      setBackgroundJob(null);
      console.log("[RETRY_TRACE] path", {
        traceId,
        action: "invoke_generate_edition",
      });
    }

    // Supersede any prior in-flight invoke (should be none when the guard holds).
    generateAbortRef.current?.abort();
    const abort = new AbortController();
    generateAbortRef.current = abort;

    try {
      // Dev override: never flash yesterday's city while the new edition builds.
      if (isDevEditionOverrideActive()) {
        devGenerateTrace(traceId, "dev_cache_clear");
        editionFrozenRef.current = false;
        clearEditionFreeze();
        instantHydratedRef.current = false;
        cachedBundleRef.current = null;
        setSections([]);
        setEditionDate(null);
        setEditionId(null);
        setLeadStory(null);
        setTopStories([]);
        setNationalNews(null);
        setBandit(null);
        setIntelligence(null);
        setClippedIds(new Set());
        setLocationMismatch(null);
      }

      devGenerateTrace(traceId, "location_resolve_start");
      // Always re-resolve — never trust a stale in-memory place for generation.
      const active = await resolveEffectivePlace({ refreshIfStale: true });
      devGenerateTrace(traceId, "location_resolve_end", {
        city: active.place?.city ?? null,
        mode: active.mode,
        metroKey: editionCacheMetroKey(active.place),
      });

      if (isDevEditionOverrideActive()) {
        const {
          data: { session },
        } = await getLaunchSessionOrFetch();
        const user = session?.user ?? null;
        if (user) {
          const editionDate = await resolveEffectiveEditionDate();
          await clearCachedEdition(
            user.id,
            editionDate,
            editionCacheMetroKey(active.place)
          );
        }
      }
      if (!mountedRef.current) return;
      if (abort.signal.aborted) {
        setError(GENERATION_STALL_MESSAGE);
        return;
      }
      applyActiveLocation(active);

      if (!active.place) {
        setError(
          "Choose a home city or enable current location so Kindred knows where your paper belongs."
        );
        setShowFirstRun(true);
        return;
      }

      const loc: KindredPlace = active.place;
      const tempUnit = await getTemperatureUnitPreference();
      const editionDate = await resolveEffectiveEditionDate();

      if (options?.manualBuild && isDevEditionOverrideActive()) {
        const metroKey = editionCacheMetroKey(loc);
        if (metroKey) {
          await setDeveloperPreviewContext({
            editionId: null,
            metroKey,
            city: loc.city,
            state: loc.state ?? null,
            region: loc.region ?? null,
            lat: loc.lat,
            lon: loc.lon,
            editionDate,
            traceId,
          });
        }
      }

      if (__DEV__) {
        console.log("[home] generate-edition: location resolved", {
          mode: active.mode,
          modeLabel: active.modeLabel,
          city: loc.city,
          region: loc.region,
          state: loc.state,
          lat: loc.lat,
          lon: loc.lon,
          editionDate,
          temperatureUnit: tempUnit,
        });
      }

      devGenerateTrace(traceId, "invoke_prepare", {
        city: loc.city,
        editionDate,
      });
      console.log("[generate] invoke BEGIN", { traceId });
      console.log("[RETRY_TRACE] invoke_generate_edition_begin", {
        traceId,
        editionDate,
        city: loc.city,
        metroKey: editionCacheMetroKey(loc),
        devPreview: isDevEditionOverrideActive(),
      });
      const invokeStarted = Date.now();
      const generationStarted = Date.now();
      let invokeTimer: ReturnType<typeof setTimeout> | undefined;
      const invokeTimeout = new Promise<never>((_, reject) => {
        invokeTimer = setTimeout(
          () =>
            reject(
              new Error(
                `generate-edition invoke timed out after ${GENERATION_INVOKE_TIMEOUT_MS}ms`
              )
            ),
          GENERATION_INVOKE_TIMEOUT_MS
        );
      });
      let data: unknown;
      let invokeError: Error | null = null;
      try {
        devGenerateTrace(traceId, "invoke_start");
        const invokeResult = await Promise.race([
          supabase.functions.invoke("generate-edition", {
            body: {
              location: locationPayload(loc),
              editionDate,
              temperatureUnit: tempUnit,
              editionTraceId: traceId,
              ...(isDevEditionOverrideActive() ? { devPreview: true } : {}),
            },
            signal: abort.signal,
          }),
          invokeTimeout,
        ]);
        data = invokeResult.data;
        invokeError = invokeResult.error;
      } finally {
        if (invokeTimer) clearTimeout(invokeTimer);
        console.log("[generate] invoke END", {
          ms: Date.now() - invokeStarted,
          traceId,
        });
        devGenerateTrace(traceId, "invoke_end", {
          ms: Date.now() - invokeStarted,
          hadError: Boolean(invokeError),
        });
      }

      if (!mountedRef.current || abort.signal.aborted) return;

      __DEV__ &&
        console.log("[home] generate-edition: location sent", {
          ...locationPayload(loc),
          editionDate,
          temperatureUnit: tempUnit,
        });
      let responseStatus: number | string | null = null;
      let responseBody: unknown = data;

      if (invokeError) {
        // Prefer the HTTP response body when the Edge Function returned non-2xx.
        const context = (invokeError as { context?: Response }).context;
        if (context && typeof context.status === "number") {
          responseStatus = context.status;
          try {
            responseBody = await context.clone().json();
          } catch {
            try {
              responseBody = await context.clone().text();
            } catch {
              responseBody = null;
            }
          }
        }

        if (__DEV__) console.error("[home] generate-edition: invoke error", {
          message: invokeError.message,
          name: invokeError.name,
          status: responseStatus,
          body: responseBody,
        });
        console.error("[RETRY_TRACE] invoke_generate_edition_error", {
          traceId,
          message: invokeError.message,
          httpStatus: responseStatus,
          responseBody,
          thrown: invokeError.stack ?? null,
        });

        const friendly = isNonUsEditionResponse(responseBody)
          ? SUPPORTED_REGION_MESSAGE
          : "The presses stumbled. Give it another moment.";
        setError(
          __DEV__ && !isNonUsEditionResponse(responseBody)
            ? `${friendly}\n\nmessage: ${invokeError.message}\nstatus: ${responseStatus ?? "(none)"}\nbody: ${JSON.stringify(responseBody)}`
            : friendly
        );
        return;
      }

      __DEV__ && console.log("[home] generate-edition: response", {
        status: responseStatus ?? "ok (no invoke error)",
        body: responseBody,
      });
      console.log("[RETRY_TRACE] invoke_generate_edition_ok", {
        traceId,
        httpStatus: responseStatus ?? 200,
        responseBody,
      });

      // Some failures arrive as JSON in data with no invokeError.
      if (
        responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody &&
        (responseBody as { error?: unknown }).error &&
        !parseGenerateEditionResponse(responseBody)
      ) {
        const bodyError = String((responseBody as { error: unknown }).error);
        if (__DEV__) console.error("[home] generate-edition: error in response body", {
          body: responseBody,
        });
        const friendly = isNonUsEditionResponse(responseBody)
          ? SUPPORTED_REGION_MESSAGE
          : "The presses stumbled. Give it another moment.";
        setError(
          __DEV__ && !isNonUsEditionResponse(responseBody)
            ? `${friendly}\n\nmessage: ${bodyError}\nstatus: (in body)\nbody: ${JSON.stringify(responseBody)}`
            : friendly
        );
        return;
      }

      setLocationMismatch(null);
      autoRegenKey.current = null;
      editionFrozenRef.current = false;
      clearEditionFreeze();
      resetScrollOnLoadRef.current = true;

      const parsed = parseGenerateEditionResponse(responseBody);
      if (!parsed) {
        setError("The presses stumbled. Give it another moment.");
        return;
      }

      if (parsed.kind === "error") {
        const friendly = parsed.code === "NON_US_REGION"
          ? SUPPORTED_REGION_MESSAGE
          : "The presses stumbled. Give it another moment.";
        setError(
          __DEV__ && parsed.code !== "NON_US_REGION"
            ? `${friendly}\n\nmessage: ${parsed.message}\ncode: ${parsed.code ?? "(none)"}`
            : friendly
        );
        return;
      }

      const {
        data: { session: generateSession },
      } = await getLaunchSessionOrFetch();
      const generateUserId = generateSession?.user?.id ?? null;
      if (!generateUserId) {
        setError("Sign in to open today's paper.");
        return;
      }

      let generatedEditionId = parsed.kind === "ready" ? parsed.editionId : null;
      let generatedMetroKey = parsed.metroKey;

      if (parsed.kind === "ready") {
        setBackgroundJob(null);
      }

      if (parsed.kind === "async") {
        setBackgroundJob({ status: parsed.status, lastError: null });
        devGenerateTrace(traceId, "async_poll_start", {
          status: parsed.status,
          metroKey: parsed.metroKey,
        });

        generationPollActiveRef.current = true;
        let waitResult;
        try {
          waitResult = await waitForEditionGeneration(supabase, {
            userId: generateUserId,
            editionDate: parsed.editionDate,
            metroKey: parsed.metroKey,
            pollIntervalMs: 2_000,
            maxWaitMs: GENERATION_POLL_MAX_MS,
            onTick: (status) => {
              devGenerateTrace(traceId, "async_poll_tick", { status });
              if (mountedRef.current) {
                setBackgroundJob({
                  status,
                  lastError: status === "failed" ? "Edition build failed" : null,
                });
              }
            },
            onPoll: (meta) => {
              devGenerateTrace(traceId, "async_poll_tick", meta);
            },
          });
        } finally {
          generationPollActiveRef.current = false;
        }

        devGenerateTrace(traceId, "async_poll_end", {
          outcome: waitResult.outcome,
          partial: waitResult.outcome === "ready" ? waitResult.partial : undefined,
        });

        if (waitResult.outcome === "aborted") {
          if (!mountedRef.current) return;
          devGenerateTrace(traceId, "generation_stalled", { reason: "aborted" });
          setBackgroundJob({ status: "processing", lastError: null });
          setError(GENERATION_STALL_MESSAGE);
          void pollBackgroundJobProgress();
          return;
        }

        if (waitResult.outcome === "timeout") {
          devGenerateTrace(traceId, "generation_stalled", { reason: "timeout" });
          setBackgroundJob({ status: "processing", lastError: null });
          setError(GENERATION_STALL_MESSAGE);
          void pollBackgroundJobProgress();
          return;
        }

        if (waitResult.outcome === "failed") {
          setBackgroundJob({ status: "failed", lastError: waitResult.lastError });
          setError(
            waitResult.lastError?.trim()
              ? "The presses stumbled. Give it another moment."
              : "The presses stumbled. Give it another moment."
          );
          return;
        }

        generatedEditionId = waitResult.editionId;
        setBackgroundJob(null);
      }

      // Release generating UI before loading the saved edition — otherwise
      // loadEdition's in-flight guard returns early and leaves loading stuck.
      generatingRef.current = false;
      if (mountedRef.current) setGenerating(false);
      devGenerateTrace(traceId, "generating_cleared");

      if (
        generatedEditionId &&
        generatedMetroKey &&
        isDevEditionOverrideActive()
      ) {
        await setDeveloperPreviewContext({
          editionId: generatedEditionId,
          metroKey: generatedMetroKey,
          city: loc.city,
          state: loc.state ?? null,
          region: loc.region ?? null,
          lat: loc.lat,
          lon: loc.lon,
          editionDate: parsed.kind === "ready" ? parsed.editionDate : editionDate,
          traceId,
        });
        applyActiveLocation({
          place: loc,
          mode: "home",
          modeLabel: "Dev Preview",
          isTravel: false,
          needsSetup: false,
        });
      }

      // Drop legacy unscoped cache so we never reload a wrong-market row by date alone.
      if (isDevEditionOverrideActive()) {
        const {
          data: { session },
        } = await getLaunchSessionOrFetch();
        const cacheUser = session?.user ?? null;
        if (cacheUser) {
          await clearCachedEdition(cacheUser.id, editionDate, null);
        }
      }

      console.log("[generate] loadEdition BEGIN", {
        traceId,
        generatedEditionId,
        generatedMetroKey,
      });
      const loadStarted = Date.now();
      await loadEdition({
        isRefresh: true,
        afterGenerate: true,
        traceId,
        editionId: generatedEditionId,
        metroKey: generatedMetroKey,
      });
      devGenerationMsRef.current = Date.now() - generationStarted;
      devGenerateTrace(traceId, "load_edition_end", {
        ms: Date.now() - loadStarted,
      });
      console.log("[generate] loadEdition END", { ms: Date.now() - loadStarted, traceId });
      devGenerateTraceSummary(traceId);
      devGenerateTraceIdRef.current = null;
      return;
    } catch (err) {
      if (!mountedRef.current) return;
      // Timeout / explicit abort — do not treat as a generic stumble when we
      // cancelled the client request on purpose.
      const aborted =
        abort.signal.aborted ||
        (err instanceof Error &&
          (err.name === "AbortError" || /aborted|timed out/i.test(err.message)));
      if (aborted) {
        if (__DEV__) {
          console.warn("[home] generate-edition: aborted or timed out", err);
        }
        if (!mountedRef.current) return;
        devGenerateTrace(traceId, "generation_stalled", { reason: "invoke_abort" });
        setBackgroundJob({ status: "processing", lastError: null });
        setError(GENERATION_STALL_MESSAGE);
        void pollBackgroundJobProgress();
        return;
      }
      if (__DEV__) console.error("[home] generate-edition: caught exception", err);
      const message = err instanceof Error ? err.message : String(err);
      const friendly =
        "The presses stumbled. Give it another moment.";
      setError(
        __DEV__
          ? `${friendly}\n\nmessage: ${message}\nstatus: (exception)\nbody: (none)`
          : friendly
      );
    } finally {
      console.log("[generate] finally ENTER", { traceId });
      generationPollActiveRef.current = false;
      if (generateAbortRef.current === abort) {
        generateAbortRef.current = null;
      }
      generatingRef.current = false;
      if (mountedRef.current) {
        setGenerating(false);
        // Always clear loading — a ready (even incomplete) paper must never
        // leave the reader stranded on the spinner after generate exits.
        setLoading(false);
      }
      devGenerateTrace(traceId, "handle_generate_exit", {
        editionId: editionIdRef.current,
      });
      console.log("[generate] setGenerating false", { traceId });
      console.log("[generate] EXIT handleGenerate", { traceId });
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!__DEV__) return;
      void consumePendingDevEditionGenerate().then(({ pending, traceId }) => {
        if (pending) {
          if (traceId) devGenerateTraceIdRef.current = traceId;
          devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "home_focus_consume_pending");
          void handleGenerate(traceId ?? undefined);
        }
      });
    }, [])
  );

  // After withholding a wrong-city paper in Current Location mode, regenerate once.
  // Never duplicate-build while the overnight job is already on the press.
  useEffect(() => {
    if (!pendingCityRegen) return;
    if (generating || loading) return;
    const jobActive =
      backgroundJob?.status === "pending" ||
      backgroundJob?.status === "processing";
    setPendingCityRegen(false);
    if (jobActive) return;
    void handleGenerate();
    // handleGenerate is intentionally stable enough for this one-shot trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCityRegen, generating, loading, backgroundJob]);

  async function handleToggleClip(section: EditionSection) {
    if (clipPendingId) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) {
      setClipError("Sign in again to save passages from your paper.");
      return;
    }

    setClipPendingId(section.id);
    setClipError(null);
    const alreadyClipped = clippedIds.has(section.id);
    const topic = inferTopicFromSection(section.section_type, section.headline);
    const storyKey = `${section.section_type}:${section.headline}`.slice(0, 240);
    const clipKey = `article:${section.id}`;

    try {
      if (alreadyClipped) {
        const result = await removeClipping(user.id, clipKey);
        if (result.ok) {
          setClippedIds((prev) => {
            const next = new Set(prev);
            next.delete(section.id);
            return next;
          });
          void trackReadingSignal({
            signalType: "unclip",
            storyKey,
            sectionType: section.section_type,
            editionId,
            sectionId: section.id,
            source: section.source_note,
            topic,
          });
        } else {
          if (__DEV__) {
            console.error("[home] unclip failed", result.error);
          }
          setClipError("Couldn’t remove that clipping. Please try again.");
        }
      } else {
        const result = await saveClipping(
          user.id,
          { contentType: "article", clipKey, sectionId: section.id },
          articleFromEditionSectionWithKnowledge(section, intelligence?.knowledge, {
            nationalDaily,
            pairedNationalDaily,
          })
        );

        if (result.ok) {
          setClippedIds((prev) => new Set(prev).add(section.id));
          if (!result.duplicate) {
            void trackReadingSignal({
              signalType: "clip",
              storyKey,
              sectionType: section.section_type,
              editionId,
              sectionId: section.id,
              source: section.source_note,
              topic,
              payload: { headline: section.headline.slice(0, 160) },
            });
          }
        } else {
          if (__DEV__) {
            console.error("[home] clip failed", result.error);
          }
          setClipError("Couldn’t save that for later. Please try again.");
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[home] clip threw",
          err instanceof Error ? err.message : String(err)
        );
      }
      setClipError("Couldn’t save that for later. Please try again.");
    } finally {
      setClipPendingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaperLoading hint={waitingCopy.loading} />
      </SafeAreaView>
    );
  }

  // Dedicated waiting surface while the presses run — never leave the folio
  // interactive with only a button-label change.
  if (generating) {
    return (
      <SafeAreaView style={styles.container}>
        <PaperLoading hint={PREPARING_LINES[preparingStep]} />
      </SafeAreaView>
    );
  }

  const backgroundJobActive =
    backgroundJob?.status === "pending" || backgroundJob?.status === "processing";

  return (
    <SafeAreaView style={styles.container}>
      <LocationFirstRun
        visible={showFirstRun}
        onComplete={(active) => {
          setShowFirstRun(false);
          dismissFirstRun();
          if (active) {
            setActiveLocation(active);
            focusedLocationKeyRef.current = activeLocationKey(active);
            void loadEdition(true);
          }
        }}
        onChooseHomeCity={() => {
          setShowFirstRun(false);
          dismissFirstRun();
          router.push("/location-search?purpose=home");
        }}
      />
      <KindredStickyMasthead
        scrollY={mastheadScrollY}
        style={styles.pageBackground}
        subtitle={readerDisplayCity()}
        trailing={
          <MastheadLink
            label="Library"
            onPress={() => router.push("/library")}
            accessibilityLabel="Open library"
          />
        }
      />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.pageBackground}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        scrollEventThrottle={16}
        onTouchStart={() => {
          lockScrollRestore("touch_start");
        }}
        onScrollBeginDrag={() => {
          homeScrollDraggingRef.current = true;
          lockScrollRestore("scroll_begin_drag");
        }}
        onScrollEndDrag={() => {
          homeScrollDraggingRef.current = false;
        }}
        onMomentumScrollBegin={() => {
          lockScrollRestore("momentum_begin");
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: mastheadScrollY } } }],
          {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const y = event.nativeEvent.contentOffset.y;
              homeScrollYRef.current = y;
              if (programmaticScrollRef.current) return;
              if (y > HOME_SCROLL_AT_TOP_PX) {
                lockScrollRestore("user_scroll");
              }
            },
          }
        )}
        onContentSizeChange={onHomeContentSizeChange}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleHomeRefresh()}
            tintColor={paper.terracotta}
            colors={[paper.terracotta]}
          />
        }
      >
        {sections.length === 0 ? (
          <KindredFullMasthead
            dateLabel={today}
            trailing={
              <MastheadLink
                label="Library"
                onPress={() => router.push("/library")}
                accessibilityLabel="Open library"
              />
            }
            scrollY={mastheadScrollY}
          />
        ) : null}

        {clipError ? (
          <Text style={styles.error} accessibilityRole="alert">
            {clipError}
          </Text>
        ) : null}

        {activeLocation?.isTravel && activeLocation.place ? (
          <View style={styles.travelBanner}>
            <Text style={styles.travelText}>
              Travel Edition · {activeLocation.place.city}
            </Text>
            <Pressable
              onPress={() => {
                void (async () => {
                  const next = await returnToHomeCity();
                  setActiveLocation(next);
                  focusedLocationKeyRef.current = activeLocationKey(next);
                  void loadEdition(true);
                })();
              }}
              style={({ pressed }) => pressed && styles.linkPressed}
              accessibilityRole="button"
              accessibilityLabel="Return to home city"
            >
              <Text style={styles.travelReturn}>Return to Home City</Text>
            </Pressable>
          </View>
        ) : null}

        {locationMismatch && activeLocation?.place ? (
          <View
            style={styles.mismatchBanner}
            accessibilityRole="summary"
            accessibilityLabel={`This edition was set for ${locationMismatch}. You’re in ${activeLocation.place.city} now.`}
          >
            <Text style={styles.mismatchText}>
              This edition was set for {locationMismatch}. You’re in{" "}
              {activeLocation.place.city} now — refresh for local news, weather,
              and events.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.mismatchButton,
                pressed && styles.linkPressed,
              ]}
              onPress={() => void handleGenerate()}
              accessibilityRole="button"
              accessibilityLabel="Refresh today’s edition"
            >
              <Text style={styles.mismatchButtonText}>
                Refresh today’s edition
              </Text>
            </Pressable>
          </View>
        ) : null}

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.title}>{morningSalutation()}</Text>
            <View style={styles.emptyRule} />
            <Text style={styles.emptyKicker}>
              {locationMismatch
                ? "Today’s paper needs a refresh."
                : backgroundJobActive
                  ? waitingCopy.backgroundTitle
                  : waitingCopy.emptyTitle}
            </Text>
            <Text style={styles.body}>
              {locationMismatch && activeLocation?.place
                ? `The edition on file was set for ${locationMismatch}. Open a fresh paper for ${activeLocation.place.city}.`
                : backgroundJobActive
                  ? waitingCopy.backgroundBody
                  : waitingCopy.emptyBody}
            </Text>
            {activeLocation?.needsSetup ? (
              <Text style={styles.locationHint}>
                Choose a home city or allow current location so local news,
                weather, and events can find you.
              </Text>
            ) : activeLocation?.place && !locationMismatch ? (
              <Text style={styles.locationHint}>
                {activeLocation.modeLabel} · {activeLocation.place.city}
              </Text>
            ) : null}
            {error && <Text style={styles.error}>{error}</Text>}
            {/* Mismatch refresh lives on the banner — avoid a duplicate CTA. */}
            {!locationMismatch && error ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.linkPressed,
                ]}
                onPress={() => void handleRetryPress()}
                accessibilityRole="button"
                accessibilityLabel="Retry"
              >
                <Text style={styles.buttonText}>Retry</Text>
              </Pressable>
            ) : !locationMismatch && !backgroundJobActive ? (
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.linkPressed,
                ]}
                onPress={() => void handleGenerate()}
                accessibilityRole="button"
                accessibilityLabel={waitingCopy.openAction}
              >
                <Text style={styles.buttonText}>{waitingCopy.openAction}</Text>
              </Pressable>
            ) : null}
            {/* Emergency fallback only — the overnight job is already running. */}
            {!locationMismatch && backgroundJobActive && !error ? (
              <Pressable
                style={styles.previousLink}
                onPress={() => void handleGenerate(undefined, { manualBuild: true })}
                accessibilityRole="button"
                accessibilityLabel={waitingCopy.backgroundBuildNow}
              >
                <Text style={styles.previousLinkText}>
                  {waitingCopy.backgroundBuildNow}
                </Text>
              </Pressable>
            ) : null}
            {activeLocation?.needsSetup ? (
              <Pressable
                style={styles.previousLink}
                onPress={() => router.push("/location")}
                accessibilityRole="button"
                accessibilityLabel="Location settings"
              >
                <Text style={styles.previousLinkText}>Location settings</Text>
              </Pressable>
            ) : null}
            {older ? (
              <Pressable
                style={styles.previousLink}
                onPress={() => router.push(`/edition/${older.id}`)}
                accessibilityRole="button"
                accessibilityLabel={waitingCopy.previous}
              >
                <Text style={styles.previousLinkText}>
                  {waitingCopy.previous}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <EditionReader
              sections={sections}
              editionId={editionId}
              editionDate={editionDate}
              leadStory={leadStory}
              topStories={topStories}
              nationalNews={nationalNews}
              banditGreeting={banditMorningLine(bandit)}
              banditAside={intelligence?.banditAside}
              memoryNote={intelligence?.memoryNote}
              morningOpening={intelligence?.morningOpening}
              morningBriefing={intelligence?.morningBriefing}
              morningHero={morningHero}
              onOpenMasterpiece={() => {
                const hero = morningHero;
                if (!hero) return;
                persistHomeScrollNow();
                openMasterpiece(router, hero, {
                  editionId,
                  backLabel: "← Today's paper",
                });
              }}
              leadWhyThisMatters={intelligence?.leadWhyThisMatters}
              leadWhyChosen={intelligence?.leadWhyChosen}
              leadContinuityKicker={intelligence?.leadContinuityKicker}
              discoveryHeadline={intelligence?.discoveryHeadline}
              discoveryEditorNote={intelligence?.discoveryEditorNote}
              discoveryItems={intelligence?.discoveryItems}
              discovery={intelligence?.discovery}
              banditsPick={
                isBanditsPicksEnabled() ? banditsPick(bandit) : null
              }
              localEventsStatus={localEventsStatus}
              mastheadScrollY={mastheadScrollY}
              mastheadTrailing={
                <MastheadLink
                  label="Library"
                  onPress={() => router.push("/library")}
                  accessibilityLabel="Open library"
                />
              }
              locationCity={readerDisplayCity() ?? null}
              readerLocation={
                (() => {
                  const place = readerDisplayPlace();
                  return place
                    ? { lat: place.lat, lon: place.lon }
                    : null;
                })()
              }
              locationRegion={
                readerDisplayPlace()?.region ??
                intelligence?.discovery?.location?.region ??
                null
              }
              locationState={
                readerDisplayPlace()?.state ??
                intelligence?.discovery?.location?.state ??
                null
              }
              onOpenArticle={(article) => {
                persistHomeScrollNow();
                const companion = companionForArticle(
                  intelligence,
                  article,
                  leadStory
                );
                prestashRelatedArticles(companion, article.id);
                openKindredArticle(router, article, {
                  editionId,
                  companion,
                  backLabel: "← Today’s paper",
                });
              }}
              onOpenEvent={(event) => {
                persistHomeScrollNow();
                openKindredEvent(router, event, {
                  editionId,
                  backLabel: "← Today’s paper",
                });
              }}
              onSeeAllEvents={() => {
                const section = sections.find(
                  (s) => s.section_type === "local_events"
                );
                const allEvents = section?.body
                  ? parseLocalEventsBody(section.body) ?? []
                  : [];
                persistHomeScrollNow();
                stashTodaysEvents(sliceForSeeAll(allEvents));
                router.push("/events");
              }}
              onSeeAllActivities={() => {
                const full = allocateDiscoverySections(
                  intelligence?.discovery,
                  intelligence?.discoveryItems,
                  {
                    readerLocation: activeLocation?.place
                      ? {
                          lat: activeLocation.place.lat,
                          lon: activeLocation.place.lon,
                        }
                      : null,
                  }
                );
                persistHomeScrollNow();
                stashTodaysActivities(sliceForSeeAll(full.activities));
                router.push("/activities");
              }}
              onSeeAllRecommendations={(items) => {
                persistHomeScrollNow();
                stashTodaysRecommendations(
                  items,
                  activeLocation?.place
                    ? {
                        lat: activeLocation.place.lat,
                        lon: activeLocation.place.lon,
                      }
                    : null
                );
                router.push("/recommendations");
              }}
              historyAroundTown={intelligence?.historyAroundTown}
              weatherSummary={intelligence?.weatherSummary ?? null}
              morningWeatherBeat={intelligence?.morning?.beats?.weather ?? null}
              onSeeAllHistoryAroundTown={() => {
                persistHomeScrollNow();
                stashTodaysHistoryPlaces(
                  sliceForSeeAll(intelligence?.historyAroundTown?.places ?? [])
                );
                router.push("/history-around-town");
              }}
              knowledge={intelligence?.knowledge}
              nationalDaily={nationalDaily}
              pairedNationalDaily={pairedNationalDaily}
              clippedSectionIds={clippedIds}
              onToggleClip={handleToggleClip}
              clipPendingId={clipPendingId}
              onOpenClippings={() => {
                persistHomeScrollNow();
                router.push("/clippings");
              }}
              onOpenArchive={() => {
                persistHomeScrollNow();
                router.push("/library");
              }}
            />
            <EditionAdjacentNav
              older={older}
              newer={null}
              onOpen={(edition) => {
                persistHomeScrollNow();
                router.push(`/edition/${edition.id}`);
              }}
            />
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.page,
  },
  pageBackground: {
    backgroundColor: paper.page,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 96,
  },
  travelBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  travelText: {
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkMuted,
    flex: 1,
    paddingRight: 12,
  },
  travelReturn: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  mismatchBanner: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  mismatchText: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 23,
    color: paper.inkMuted,
    marginBottom: 12,
  },
  mismatchButton: {
    alignSelf: "flex-start",
    backgroundColor: paper.ink,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  mismatchButtonText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.cream,
  },
  locationHint: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkFaint,
    marginBottom: 16,
    marginTop: 4,
  },
  linkPressed: {
    opacity: press.opacity,
  },
  emptyState: {
    paddingTop: 48,
  },
  emptyRule: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkMuted,
    opacity: 0.35,
    marginBottom: 22,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    marginBottom: 10,
  },
  emptyKicker: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 14,
  },
  body: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 27,
    color: paper.inkBody,
    marginBottom: 28,
    maxWidth: 420,
  },
  error: {
    color: paper.terracotta,
    marginBottom: 16,
    fontFamily: "Georgia",
    fontSize: 14,
  },
  button: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.terracotta,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  previousLink: {
    marginTop: 28,
    alignSelf: "flex-start",
  },
  previousLinkText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.inkMuted,
    fontStyle: "italic",
  },
});
