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
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator";
import {
  banditMorningLine,
  banditsPick,
  parseBanditPayload,
  type BanditPayload,
} from "../lib/edition/bandit";
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
  inferTopicFromSection,
  trackReadingSignal,
} from "../lib/personalization";
import {
  morningSalutation,
  waitingCopy,
  PREPARING_LINES,
} from "../lib/edition/morningRitual";
import { localEditionDate } from "../lib/edition/dates";
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
import { citiesMatch, locationKey } from "../lib/location/locationKey";
import {
  getTemperatureUnitPreference,
} from "../lib/weather/units";
import { resolveEditionBuiltCity, cityFromEditionSections } from "../lib/edition/editionLocation";
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
  const [bandit, setBandit] = useState<BanditPayload | null>(null);
  const [intelligence, setIntelligence] =
    useState<EditionIntelligence | null>(null);
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
  }, [editionId]);

  function currentHomeScrollKey(): string | null {
    const id = editionIdRef.current;
    if (!id) return null;
    return homeScrollSessionKey(id, activeLocationKey(activeLocationRef.current));
  }

  function markHomeScrollForReset(): void {
    const key = currentHomeScrollKey();
    if (key) clearHomeScroll(key);
    skipScrollRestoreRef.current = true;
    pendingScrollRestoreY.current = 0;
    restoredScrollRef.current = true;
    homeScrollYRef.current = 0;
    mastheadScrollY.setValue(0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
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
   * Re-entrant on purpose: content height can arrive in more than one
   * layout pass (fonts, images, section counts) while the screen is
   * remounting. Keep nudging toward the saved offset on every
   * onContentSizeChange call and only stop once the content is tall
   * enough to fully satisfy it — otherwise an early, too-short layout
   * pass would permanently lock in an under-scrolled position.
   */
  const restoreHomeScrollIfNeeded = useCallback((contentHeight?: number) => {
    if (skipScrollRestoreRef.current || restoredScrollRef.current) return;
    const target = pendingScrollRestoreY.current;
    if (target <= 0) return;

    const y =
      contentHeight != null
        ? Math.max(0, Math.min(target, contentHeight - 1))
        : target;
    if (y <= 0) return;

    // Only called without a contentHeight when the screen never lost its
    // existing layout (focus-time direct restore) — trust it as final.
    if (contentHeight == null || contentHeight >= target) {
      restoredScrollRef.current = true;
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
      mastheadScrollY.setValue(y);
      homeScrollYRef.current = y;
    });
  }, [mastheadScrollY]);

  const onHomeContentSizeChange = useCallback(
    (_w: number, h: number) => {
      restoreHomeScrollIfNeeded(h);
    },
    [restoreHomeScrollIfNeeded]
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

    const cached = cachedBundleRef.current;
    if (!cached || (editionId && cached.editionId !== editionId)) return null;

    return (
      cached.morningHero ??
      cached.intelligence?.morningHero ??
      null
    );
  }, [morningHeroFromIntel, editionId]);

  function logFirstPaintIfNeeded(
    context: string,
    editionComplete?: boolean
  ): void {
    if (startupSummaryLoggedRef.current) return;
    startupSummaryLoggedRef.current = true;
    logStartupSummary(context, { editionComplete });
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
    setBandit(merged.bandit);
    setIntelligence(merged.intelligence);
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
    return merged;
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
  }> {
    const result = await recoverTodayInHistory({
      userId: params.userId,
      editionId: params.editionId,
      editionDate: params.editionDate,
      currentSections: params.sections,
      intelligence: params.intelligence,
      cachedBundle: cachedBundleRef.current,
    });

    if (!result.recovered) return params;

    if (__DEV__) {
      console.log("[home] todayInHistory recovery applied", {
        source: result.source,
        headline: result.headline,
      });
    }

    if (cachedBundleRef.current) {
      persistBundleToCache({
        ...cachedBundleRef.current,
        sections: result.sections,
        intelligence: result.intelligence,
        cachedAt: Date.now(),
      });
    }

    return {
      sections: result.sections,
      intelligence: result.intelligence,
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
    if (mountedRef.current && resetScroll) {
      editionFrozenRef.current = false;
      clearEditionFreeze();
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
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
      if (!quiet && !generatingRef.current) setLoading(true);
      return;
    }

    devGenerateTrace(traceId ?? devGenerateTraceIdRef.current, "load_edition_start", {
      isRefresh,
      quiet,
      eventsOnly,
      afterGenerate,
    });
    if (
      !eventsOnly &&
      !pendingDevGenerate &&
      (await tryApplyDevEditionPreview((bundle) => {
        if (mountedRef.current && gen === loadGen.current) {
          applyCachedBundle(bundle);
          setLoading(false);
          setRefreshing(false);
        }
      }))
    ) {
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
      "id, edition_date, status, user_id, metro_key, lead_story, bandit, discovery, knowledge, memory, morning_edition, history_around_town, editorial_context";

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
    const [cached, editionResult] = await Promise.all([
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

    // Only serve finished papers — partial/failed rows must not render as today's edition.
    const statusReady =
      !!edition && (edition as { status?: string }).status === "ready";

    if (!statusReady) {
      if (__DEV__) {
        console.warn("[home] loadEdition: no ready edition", {
          reason: editionError
            ? "query error"
            : edition
              ? `status=${(edition as { status?: string }).status ?? "unknown"}`
              : "zero rows for user_id + edition_date + metro_key",
          message: editionError?.message ?? null,
        });
      }
      const [adjacent, jobResult] = await Promise.all([
        fetchAdjacentEditions(user.id, todayStr, scopedMetroKey),
        supabase
          .from("generation_jobs")
          .select("status, last_error")
          .eq("user_id", user.id)
          .eq("edition_date", todayStr)
          .maybeSingle(),
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
        setError("The paper couldn’t be reached. Pull to try again.");
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
    const cityMismatch = Boolean(
      activeCity &&
        (builtCity
          ? !citiesMatch(activeCity, builtCity)
          : // Unknown build city + Current Location → do not trust the cache
            active.mode === "current")
    );
    const sectionCityMismatch = Boolean(
      activeCity && sectionCity && !citiesMatch(activeCity, sectionCity)
    );
    const contentCityMismatch = cityMismatch || sectionCityMismatch;

    if (__DEV__) {
      console.log("[home] loadEdition: location check", {
        mode: active.mode,
        activeCity,
        builtCity,
        sectionCity,
        cityMismatch,
        sectionCityMismatch,
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
          leadStory: lead,
        },
        { deferKnowledgeMemory }
      ),
      (edition as { morning_edition?: unknown }).morning_edition,
      (edition as { history_around_town?: unknown }).history_around_town
    );

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
      setTopStories(
        topStoriesFromEditorialContext(
          (edition as { editorial_context?: unknown }).editorial_context
        )
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
        topStories: topStoriesFromEditorialContext(
          (edition as { editorial_context?: unknown }).editorial_context
        ),
        bandit: parseBanditPayload((edition as { bandit?: unknown }).bandit),
        intelligence: intel,
        heroImageId: cachedBundleRef.current?.heroImageId ?? null,
        morningHero: intel.morningHero ?? cachedBundleRef.current?.morningHero ?? null,
      };
      cachedBundleRef.current = bundle;
      scheduleCachedEditionSave(bundle);
    } else {
      setSections(loaded);
      nextSections = loaded;
      setEditionDate(edition.edition_date);
      setEditionId(edition.id);
      setLeadStory(lead);
      setTopStories(
        topStoriesFromEditorialContext(
          (edition as { editorial_context?: unknown }).editorial_context
        )
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

      if (!resetScroll) {
        const targetKey = homeScrollSessionKey(
          edition.id,
          activeLocationKey(active)
        );
        const savedScroll = await loadHomeScroll(targetKey);
        if (
          mountedRef.current &&
          gen === loadGen.current &&
          savedScroll > 0 &&
          !skipScrollRestoreRef.current
        ) {
          pendingScrollRestoreY.current = savedScroll;
          restoredScrollRef.current = false;
          homeScrollYRef.current = savedScroll;
          mastheadScrollY.setValue(savedScroll);
          if (__DEV__) {
            console.log("[home] scroll: resolved restore target", {
              editionId: edition.id,
              savedScroll,
            });
          }
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
          topStories: topStoriesFromEditorialContext(
            (edition as { editorial_context?: unknown }).editorial_context
          ),
          bandit: parseBanditPayload((edition as { bandit?: unknown }).bandit),
          intelligence: bgIntel,
          heroImageId: cachedBundleRef.current?.heroImageId ?? null,
          morningHero:
            bgIntel?.morningHero ?? cachedBundleRef.current?.morningHero ?? null,
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
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const pollBackgroundJobProgress = useCallback(async () => {
    if (!isSupabaseConfigured || generatingRef.current) return;

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
            .select("status")
            .eq("user_id", user.id)
            .eq("edition_date", todayStr)
            .eq("metro_key", pollMetroKey)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("generation_jobs")
        .select("status, last_error")
        .eq("user_id", user.id)
        .eq("edition_date", todayStr)
        .maybeSingle(),
    ]);

    if (!mountedRef.current) return;

    if (editionResult.data?.status === "ready") {
      void loadEdition({ quiet: true });
      return;
    }

    if (jobResult.data) {
      setBackgroundJob({
        status: jobResult.data.status,
        lastError: jobResult.data.last_error,
      });
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
      let cancelled = false;

      void (async () => {
        if (skipScrollRestoreRef.current) {
          skipScrollRestoreRef.current = false;
          return;
        }

        const id = editionIdRef.current;
        if (!id) return;

        const focusEditionId = id;
        const focusLocationKey = activeLocationKey(activeLocationRef.current);
        const key = homeScrollSessionKey(focusEditionId, focusLocationKey);
        const saved = await loadHomeScroll(key);
        if (
          cancelled ||
          saved <= 0 ||
          editionIdRef.current !== focusEditionId ||
          activeLocationKey(activeLocationRef.current) !== focusLocationKey
        ) {
          return;
        }

        pendingScrollRestoreY.current = saved;
        restoredScrollRef.current = false;
        homeScrollYRef.current = saved;
        mastheadScrollY.setValue(saved);
        restoreHomeScrollIfNeeded();
      })();

      return () => {
        cancelled = true;
        persistHomeScrollNow();
      };
    }, [mastheadScrollY, restoreHomeScrollIfNeeded])
  );

  useEffect(() => {
    loadEdition();
  }, [loadEdition]);

  // Never leave the reader on a spinner for minutes on cold start.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (
        mountedRef.current &&
        !editionIdRef.current &&
        !cachedBundleRef.current
      ) {
        if (__DEV__) {
          console.warn("[home] initial load exceeded 30s without a paper");
        }
        setError("The paper is taking longer than usual. Pull to try again.");
        setLoading(false);
      }
    }, 30_000);
    return () => clearTimeout(timer);
  }, []);

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
    }, 15_000);
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
    // Keep the printed paper visible — sync quietly under the refresh spinner.
    if (editionIdRef.current && sections.length > 0) {
      setRefreshing(true);
      void loadEdition({ isRefresh: true, quiet: true });
      return;
    }
    void loadEdition(true);
  }

  async function handleGenerate(continuedTraceId?: string) {
    const traceId = continuedTraceId ?? createDevGenerateTraceId();
    devGenerateTraceIdRef.current = traceId;
    devGenerateTrace(traceId, "handle_generate_enter");
    console.log("[generate] ENTER handleGenerate", { traceId });
    if (generatingRef.current) {
      console.log("[generate] EXIT handleGenerate (already running)", { traceId });
      return;
    }
    generatingRef.current = true;
    setGenerating(true);
    setLoading(false);
    setError(null);

    // Supersede any prior in-flight invoke (should be none when the guard holds).
    generateAbortRef.current?.abort();
    const abort = new AbortController();
    generateAbortRef.current = abort;
    const INVOKE_TIMEOUT_MS = 90_000;
    const timeoutId = setTimeout(() => abort.abort(), INVOKE_TIMEOUT_MS);

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
        // Resolving location (e.g. a slow GPS fix) ate the whole timeout budget
        // before we ever reached the invoke — surface it instead of bouncing
        // back to the empty state with no explanation.
        setError(
          "That took longer than expected. Try again in a moment — only one paper at a time."
        );
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
      const invokeStarted = Date.now();
      const generationStarted = Date.now();
      let invokeTimer: ReturnType<typeof setTimeout> | undefined;
      const invokeTimeout = new Promise<never>((_, reject) => {
        invokeTimer = setTimeout(
          () =>
            reject(
              new Error(
                `generate-edition invoke timed out after ${INVOKE_TIMEOUT_MS}ms`
              )
            ),
          INVOKE_TIMEOUT_MS
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

      // Some failures arrive as JSON in data with no invokeError.
      if (
        responseBody &&
        typeof responseBody === "object" &&
        "error" in responseBody &&
        (responseBody as { error?: unknown }).error
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

      // Release generating UI before loading the saved edition — otherwise
      // loadEdition's in-flight guard returns early and leaves loading stuck.
      generatingRef.current = false;
      if (mountedRef.current) setGenerating(false);
      devGenerateTrace(traceId, "generating_cleared");

      const generated =
        responseBody && typeof responseBody === "object"
          ? (responseBody as {
              editionId?: string;
              metroKey?: string;
            })
          : null;
      const generatedEditionId = generated?.editionId?.trim() || null;
      const generatedMetroKey = generated?.metroKey?.trim() || null;

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
          editionDate,
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
        setError(
          "That took longer than expected. Try again in a moment — only one paper at a time."
        );
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
      clearTimeout(timeoutId);
      if (generateAbortRef.current === abort) {
        generateAbortRef.current = null;
      }
      generatingRef.current = false;
      if (mountedRef.current) {
        setGenerating(false);
        if (!editionIdRef.current) {
          setLoading(false);
        }
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
          articleFromEditionSectionWithKnowledge(section, intelligence?.knowledge)
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
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: mastheadScrollY } } }],
          {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              homeScrollYRef.current = event.nativeEvent.contentOffset.y;
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
            {!locationMismatch && !backgroundJobActive ? (
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
            {!locationMismatch && backgroundJobActive ? (
              <Pressable
                style={styles.previousLink}
                onPress={() => void handleGenerate()}
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
              banditsPick={banditsPick(bandit)}
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
                stashTodaysEvents(allEvents);
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
                stashTodaysActivities(full.activities);
                router.push("/activities");
              }}
              onSeeAllRecommendations={(items) => {
                persistHomeScrollNow();
                stashTodaysRecommendations(items);
                router.push("/recommendations");
              }}
              historyAroundTown={intelligence?.historyAroundTown}
              onSeeAllHistoryAroundTown={() => {
                persistHomeScrollNow();
                stashTodaysHistoryPlaces(
                  intelligence?.historyAroundTown?.places ?? []
                );
                router.push("/history-around-town");
              }}
              knowledge={intelligence?.knowledge}
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
    backgroundColor: paper.sky,
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
