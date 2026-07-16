import { useCallback, useEffect, useRef, useState } from "react";
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
  saveCachedEdition,
  type CachedEditionBundle,
} from "../lib/edition/editionCache";
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
  resolveActivePlace,
  locationPayload,
  returnToHomeCity,
  type ActiveLocation,
  type KindredPlace,
} from "../lib/location/deviceLocation";
import { citiesMatch, locationKey } from "../lib/location/locationKey";
import {
  getTemperatureUnitPreference,
} from "../lib/weather/units";
import { resolveEditionBuiltCity } from "../lib/edition/editionLocation";
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
import { recordAuthGetSession } from "../lib/perf/startupMetrics";
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
  /** Abort in-flight generate-edition fetch on timeout / unmount / supersede. */
  const generateAbortRef = useRef<AbortController | null>(null);
  /** Collapsing editorial masthead — scroll position drives compact sticky chrome. */
  const mastheadScrollY = useRef(new Animated.Value(0)).current;
  /** One auto-regen per edition id + active city. */
  const autoRegenKey = useRef<string | null>(null);
  /** True once today's ready edition has been painted — blocks disruptive reloads. */
  const editionFrozenRef = useRef(false);
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

  editionIdRef.current = editionId;
  activeLocationRef.current = activeLocation;

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
      const active = await resolveActivePlace({ refreshIfStale: false });
      if (!cancelled && mountedRef.current) {
        setActiveLocation(active);
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

  function applyCachedBundle(bundle: CachedEditionBundle): void {
    cachedBundleRef.current = bundle;
    setSections(bundle.sections);
    setEditionDate(bundle.editionDate);
    setEditionId(bundle.editionId);
    setLeadStory(bundle.leadStory);
    setTopStories(bundle.topStories);
    setBandit(bundle.bandit);
    setIntelligence(bundle.intelligence);
    freezeEdition({
      editionId: bundle.editionId,
      editionDate: bundle.editionDate,
      discovery: bundle.intelligence?.discovery ?? null,
      discoveryItems: bundle.intelligence?.discoveryItems ?? null,
      heroImageId: bundle.heroImageId ?? null,
    });
    if (bundle.heroImageId) setFrozenHeroImageId(bundle.heroImageId);
    editionFrozenRef.current = true;
    preloadMorningHeroImage(
      bundle.morningHero ?? bundle.intelligence?.morningHero ?? null
    );
    const cachedEventCount = countValidEventsInSections(bundle.sections);
    setLocalEventsStatus(cachedEventCount > 0 ? "ready" : "loading");
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
    void saveCachedEdition(next);
  }

  function persistBundleToCache(bundle: CachedEditionBundle): void {
    cachedBundleRef.current = bundle;
    void saveCachedEdition(bundle);
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

  async function maybeRecoverLocalEvents(params: {
    editionId: string;
    editionDate: string;
    place: KindredPlace | null;
    sections: EditionSection[];
  }): Promise<EditionSection[]> {
    const { editionId, editionDate, place, sections } = params;
    if (!place || !needsLocalEventsRecovery(sections)) {
      const count = countValidEventsInSections(sections);
      setLocalEventsStatus(count > 0 ? "ready" : "quiet_day");
      return sections;
    }

    setLocalEventsStatus("recovering");
    const result = await recoverLocalEvents({
      editionId,
      editionDate,
      place,
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
  };

  function parseLoadOptions(
    input?: boolean | LoadEditionOptions
  ): LoadEditionOptions {
    if (typeof input === "boolean") return { isRefresh: input };
    return input ?? {};
  }

  const loadEdition = useCallback(async (input?: boolean | LoadEditionOptions) => {
    const { isRefresh = false, quiet = false, eventsOnly = false } =
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
    } = await supabase.auth.getSession();
    recordAuthGetSession();
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

    const todayStr = localEditionDate();

    if (__DEV__) {
      console.log("[home] loadEdition: date filters", {
        localEditionDate: todayStr,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      });
    }

    // Overlap cache read with the editions network query on cold start.
    const shouldHydrateCache =
      !quiet && !isRefresh && !editionIdRef.current;

    const editionQuery = supabase
      .from("editions")
      .select(
        "id, edition_date, status, user_id, lead_story, bandit, discovery, knowledge, memory, morning_edition, editorial_context"
      )
      .eq("user_id", user.id)
      .eq("edition_date", todayStr)
      .maybeSingle();

    const [cached, editionResult] = await Promise.all([
      shouldHydrateCache
        ? loadCachedEdition(user.id, todayStr)
        : Promise.resolve(null),
      editionQuery,
    ]);

    if (cached && mountedRef.current && gen === loadGen.current) {
      applyCachedBundle(cached);
      setLoading(false);
      markStartup("home_cache_paint");
      void maybeRecoverTodayInHistory({
        userId: user.id,
        editionId: cached.editionId,
        editionDate: cached.editionDate,
        sections: cached.sections,
        intelligence: cached.intelligence,
      }).then((recovered) => {
        if (!mountedRef.current || gen !== loadGen.current) return;
        if (
          recovered.sections !== cached.sections ||
          recovered.intelligence !== cached.intelligence
        ) {
          setSections(recovered.sections);
          setIntelligence(recovered.intelligence);
        }
      });
      if (__DEV__) {
        console.log("[home] loadEdition: hydrated from cache", {
          editionId: cached.editionId,
          sectionCount: cached.sections.length,
        });
      }
    }

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
              : "zero rows for user_id + edition_date",
          message: editionError?.message ?? null,
        });
      }
      const [adjacent, jobResult] = await Promise.all([
        fetchAdjacentEditions(user.id, todayStr),
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
      };
    }

    const {
      data: sectionRows,
      error: sectionsError,
      status: sectionsStatus,
    } = await supabase
      .from("edition_sections")
      .select("id, section_type, position, headline, body, source_note")
      .eq("edition_id", edition.id)
      .order("position", { ascending: true });

    if (sectionsError) {
      throw new Error(sectionsError.message);
    }

    const loaded = (sectionRows as EditionSection[] | null) ?? [];

    markStartup("home_sections_query_done");

    traceSupabaseEditionRow(edition);
    traceSupabaseEditionSections(loaded);

    let discoveryRaw = (edition as { discovery?: unknown }).discovery;
    const persistedComplete = isPersistedEditionComplete(
      { ...edition, discovery: discoveryRaw },
      loaded
    );

    if (!persistedComplete.complete) {
      console.warn("[coldLaunch:trace] ready edition incomplete in Supabase", {
        editionId: edition.id,
        editionDate: edition.edition_date,
        sectionCount: loaded.length,
        sectionTypes: loaded.map((s) => s.section_type),
        reasons: persistedComplete.reasons,
        discoveryParsed: Boolean(parseDiscoveryPayload(discoveryRaw)),
      });
      const [adjacent, jobResult] = await Promise.all([
        fetchAdjacentEditions(user.id, todayStr),
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
        editionError: null,
        incompleteReady: true,
        incompleteReasons: persistedComplete.reasons,
      };
    }

    __DEV__ && console.log("[home] loadEdition: edition_sections query", {
      editionId: edition.id,
      editionDate: edition.edition_date,
      editionStatus: edition.status,
      editionUserId: edition.user_id,
      sectionCount: loaded.length,
      sectionIds: loaded.map((s) => s.id),
      sectionTypes: loaded.map((s) => s.section_type),
      discoveryPresent: Boolean(parseDiscoveryPayload(discoveryRaw)),
      httpStatus: sectionsStatus ?? null,
    });

    return {
      kind: "ready" as const,
      user,
      edition: { ...edition, discovery: discoveryRaw },
      loaded,
    };
    };

    const result = await loadWithRetry(fetchEdition, {
      label: "loadEdition",
      timeoutMs: 10_000,
      maxAttempts: 2,
      onAttempt: (attempt, error) => {
        if (__DEV__) {
          console.log("[home] loadEdition: attempt", {
            attempt,
            error: error?.message ?? null,
            hasCache: Boolean(cachedBundleRef.current),
          });
        }
      },
    });

    if (!mountedRef.current || gen !== loadGen.current) return;

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
          cachedBundleRef.current?.editionDate ?? localEditionDate();
        const active = activeLocationRef.current?.place ?? null;
        if (id && date && active && needsLocalEventsRecovery(cachedBundleRef.current?.sections ?? [])) {
          void maybeRecoverLocalEvents({
            editionId: id,
            editionDate: date,
            place: active,
            sections: cachedBundleRef.current?.sections ?? [],
          }).then((recovered) => {
            if (mountedRef.current && recovered.length > 0) {
              setSections(recovered);
              persistSectionsToCache(recovered);
            }
          });
        } else if (!needsLocalEventsRecovery(cachedBundleRef.current?.sections ?? [])) {
          setLocalEventsStatus("ready");
        } else {
          setLocalEventsStatus("failed");
        }
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

    const { user, edition, loaded } = payload;

    // Use cached prefs for city check — never block first paint on GPS refresh.
    const active = await resolveActivePlace({ refreshIfStale: false });
    if (mountedRef.current) setActiveLocation(active);

    const lead = parseLeadStory((edition as { lead_story?: unknown }).lead_story);
    const intel = parseEditionIntelligence({
      bandit: (edition as { bandit?: unknown }).bandit,
      discovery: (edition as { discovery?: unknown }).discovery,
      knowledge: (edition as { knowledge?: unknown }).knowledge,
      memory: (edition as { memory?: unknown }).memory,
      morning_edition: (edition as { morning_edition?: unknown })
        .morning_edition,
      leadStory: lead,
    });

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
    const cityMismatch = Boolean(
      activeCity &&
        (builtCity
          ? !citiesMatch(activeCity, builtCity)
          : // Unknown build city + Current Location → do not trust the cache
            active.mode === "current")
    );

    if (__DEV__) {
      console.log("[home] loadEdition: location check", {
        mode: active.mode,
        activeCity,
        builtCity,
        cityMismatch,
        editionId: edition.id,
      });
    }

    // Never silently reuse an edition generated for another city.
    if (cityMismatch && activeCity) {
      if (__DEV__) {
        console.warn("[home] loadEdition: withholding wrong-city edition", {
          mode: active.mode,
          activeCity,
          builtCity,
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

      void fetchAdjacentEditions(user.id, edition.edition_date).then((adjacent) => {
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

    const frozenNow = isEditionFrozen({
      editionId: edition.id,
      editionDate: edition.edition_date,
    });
    const narrativeFrozen = frozenNow && editionFrozenRef.current;
    const patchEventsOnly = eventsOnly || (quiet && narrativeFrozen);
    const syncAfterCache = narrativeFrozen && !isRefresh && !eventsOnly;

    let nextSections = loaded;

    if (patchEventsOnly && editionFrozenRef.current) {
      nextSections = mergeFrozenSections(
        cachedBundleRef.current?.sections ?? loaded,
        loaded
      );
      setSections(nextSections);
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
      void saveCachedEdition(bundle);
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
    });
    logEditionCompleteness(
      cachedBundleRef.current ? "repeat_launch" : "cold_launch",
      completeness
    );

    setLoading(false);
    setRefreshing(false);
    markStartup("home_first_paint");
    logStartupSummary(
      cachedBundleRef.current ? "repeat_launch" : "cold_launch",
      { editionComplete: completeness.complete }
    );

    void (async () => {
      if (!mountedRef.current || gen !== loadGen.current) return;

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

      void fetchAdjacentEditions(user.id, edition.edition_date).then((adjacent) => {
        if (mountedRef.current && gen === loadGen.current) {
          setOlder(adjacent.older);
        }
      });

      const refreshed = await resolveActivePlace({ refreshIfStale: true });
      if (mountedRef.current && gen === loadGen.current) {
        setActiveLocation(refreshed);
      }

      let bgSections = nextSections;
      let bgIntel: EditionIntelligence | null = intel;

      const recoveredSections = await maybeRecoverLocalEvents({
        editionId: edition.id,
        editionDate: edition.edition_date,
        place: refreshed.place,
        sections: bgSections,
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
        void saveCachedEdition(bundle);
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

      void maybeTriggerLiveRefresh({
        editionId: edition.id,
        editionDate: edition.edition_date,
        place: refreshed.place,
        onEventsChanged: () => {
          if (mountedRef.current) {
            void loadEdition({ quiet: true, eventsOnly: true });
          }
        },
      });
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

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const active = await resolveActivePlace({ refreshIfStale: false });
        if (!mountedRef.current) return;
        setActiveLocation(active);
        const nextKey = activeLocationKey(active);
        const prevKey = focusedLocationKeyRef.current;
        focusedLocationKeyRef.current = nextKey;
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
        void loadEdition();
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [backgroundJob, loadEdition]);

  // Resume: quietly refresh paper + stale GPS when mode is current.
  useEffect(() => {
    const lastActive = { at: Date.now() };
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      const now = Date.now();
      if (now - lastActive.at < 45_000) return;
      lastActive.at = now;
      void (async () => {
        const active = await resolveActivePlace({ refreshIfStale: true });
        if (mountedRef.current) {
          setActiveLocation(active);
          focusedLocationKeyRef.current = activeLocationKey(active);
        }
        void loadEdition({ quiet: true });
      })();
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [loadEdition]);

  async function handleGenerate() {
    if (generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);

    // Supersede any prior in-flight invoke (should be none when the guard holds).
    generateAbortRef.current?.abort();
    const abort = new AbortController();
    generateAbortRef.current = abort;
    const INVOKE_TIMEOUT_MS = 90_000;
    const timeoutId = setTimeout(() => abort.abort(), INVOKE_TIMEOUT_MS);

    __DEV__ && console.log("[home] generate-edition: start");

    try {
      // Always re-resolve — never trust a stale in-memory place for generation.
      const active = await resolveActivePlace({ refreshIfStale: true });
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
      setActiveLocation(active);

      if (!active.place) {
        setError(
          "Choose a home city or enable current location so Kindred knows where your paper belongs."
        );
        setShowFirstRun(true);
        return;
      }

      const loc: KindredPlace = active.place;
      const tempUnit = await getTemperatureUnitPreference();
      const editionDate = localEditionDate();

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

      const { data, error: invokeError } = await supabase.functions.invoke(
        "generate-edition",
        {
          body: {
            location: locationPayload(loc),
            editionDate,
            temperatureUnit: tempUnit,
          },
          signal: abort.signal,
        }
      );

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

        const friendly =
          "The presses stumbled. Give it another moment.";
        setError(
          __DEV__
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
        const friendly =
          "The presses stumbled. Give it another moment.";
        setError(
          __DEV__
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
      await loadEdition(true);
      __DEV__ && console.log("[home] generate-edition: loadEdition finished");
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
      clearTimeout(timeoutId);
      if (generateAbortRef.current === abort) {
        generateAbortRef.current = null;
      }
      generatingRef.current = false;
      if (mountedRef.current) setGenerating(false);
    }
  }

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
        subtitle={
          activeLocation?.place?.city ??
          intelligence?.discovery?.location?.city ??
          undefined
        }
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
            onRefresh={() =>
              loadEdition(
                editionFrozenRef.current
                  ? { quiet: true, eventsOnly: true }
                  : true
              )
            }
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
              onPress={handleGenerate}
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
                onPress={handleGenerate}
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
                onPress={handleGenerate}
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
              morningHero={intelligence?.morningHero}
              onOpenMasterpiece={() => {
                const hero = intelligence?.morningHero;
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
              locationCity={
                activeLocation?.place?.city ??
                intelligence?.discovery?.location?.city ??
                null
              }
              readerLocation={
                activeLocation?.place
                  ? {
                      lat: activeLocation.place.lat,
                      lon: activeLocation.place.lon,
                    }
                  : null
              }
              locationRegion={
                activeLocation?.place?.region ??
                intelligence?.discovery?.location?.region ??
                null
              }
              locationState={
                activeLocation?.place?.state ??
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
              onSeeAllRecommendations={() => {
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
                stashTodaysRecommendations(full.recommendations);
                router.push("/recommendations");
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
