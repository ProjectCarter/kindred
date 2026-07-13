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
import { resolveArticleForStoryKey } from "../lib/edition/relatedArticle";
import { stashArticle } from "../lib/edition/articleStore";
import { parseLocalEventsBody } from "../lib/edition/localEvents";
import { stashTodaysEvents } from "../lib/edition/eventsListStore";
import {
  banditMorningLine,
  banditsPick,
  parseBanditPayload,
  type BanditPayload,
} from "../lib/edition/bandit";
import {
  companionForArticle,
  clipSectionIdForArticle,
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

  // Resolve shared location (GPS / home / travel). Never silent city default.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const active = await resolveActivePlace({ refreshIfStale: true });
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

  const loadEdition = useCallback(async (isRefresh = false) => {
    const gen = ++loadGen.current;
    const resetScroll = isRefresh || resetScrollOnLoadRef.current;
    if (resetScroll) {
      resetScrollOnLoadRef.current = false;
      markHomeScrollForReset();
    } else {
      skipScrollRestoreRef.current = false;
    }
    if (isRefresh) setRefreshing(true);
    setError(null);

    // Withhold the previous folio immediately so a reload never flashes a
    // wrong-city or superseded edition while location/edition resolve.
    if (mountedRef.current && resetScroll) {
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (__DEV__) {
      console.log("[home] loadEdition: start", {
        isRefresh,
        userId: user?.id ?? null,
        userError: userError?.message ?? null,
      });
    }

    if (!user) {
      if (__DEV__) console.warn("[home] loadEdition: no user", userError?.message);
      if (mountedRef.current && gen === loadGen.current) {
        const msg = userError?.message ?? "";
        if (/jwt|expired|invalid.*token|refresh token/i.test(msg)) {
          void supabase.auth.signOut();
        } else if (userError) {
          setError("The paper couldn’t be reached. Pull to try again.");
        }
        setLoading(false);
        setRefreshing(false);
      }
      return;
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

    const {
      data: edition,
      error: editionError,
      count: editionCount,
      status: editionStatus,
      statusText: editionStatusText,
    } = await supabase
      .from("editions")
      .select(
        "id, edition_date, status, user_id, lead_story, bandit, discovery, knowledge, memory, morning_edition, editorial_context",
        {
        count: "exact",
      })
      .eq("user_id", user.id)
      .eq("edition_date", todayStr)
      .maybeSingle();

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
      count: editionCount ?? null,
      httpStatus: editionStatus ?? null,
      statusText: editionStatusText ?? null,
    });

    // Only serve finished papers — partial/failed rows must not render as today's edition.
    const editionReady =
      !!edition && (edition as { status?: string }).status === "ready";

    if (!editionReady) {
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
      if (!mountedRef.current || gen !== loadGen.current) return;
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
      setBandit(null);
      setIntelligence(null);
      setClippedIds(new Set());
      setOlder(adjacent.older);
      setBackgroundJob(
        jobResult.data
          ? { status: jobResult.data.status, lastError: jobResult.data.last_error }
          : null
      );
      if (editionError) {
        setError("The paper couldn’t be reached. Pull to try again.");
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [
      {
        data: sectionRows,
        error: sectionsError,
        count: sectionsCount,
        status: sectionsStatus,
      },
      adjacent,
    ] = await Promise.all([
      supabase
        .from("edition_sections")
        .select("id, section_type, position, headline, body, source_note", {
          count: "exact",
        })
        .eq("edition_id", edition.id)
        .order("position", { ascending: true }),
      fetchAdjacentEditions(user.id, todayStr),
    ]);

    const loaded = (sectionRows as EditionSection[] | null) ?? [];

    __DEV__ && console.log("[home] loadEdition: edition_sections query", {
      editionId: edition.id,
      editionDate: edition.edition_date,
      editionStatus: edition.status,
      editionUserId: edition.user_id,
      sectionCount: loaded.length,
      sectionIds: loaded.map((s) => s.id),
      sectionTypes: loaded.map((s) => s.section_type),
      error: sectionsError
        ? {
            message: sectionsError.message,
            code: sectionsError.code,
            details: sectionsError.details,
            hint: sectionsError.hint,
          }
        : null,
      count: sectionsCount ?? null,
      httpStatus: sectionsStatus ?? null,
    });

    __DEV__ && console.log("[home] loadEdition: render decision", {
      willShowEmptyState: loaded.length === 0,
      reason:
        loaded.length === 0
          ? "sections.length === 0 (empty-state branch)"
          : "sections.length > 0 (EditionReader branch)",
    });

    if (!mountedRef.current || gen !== loadGen.current) return;

    // Resolve active location before deciding whether this edition is fresh.
    // Current Location mode always refreshes GPS when stale.
    const active = await resolveActivePlace({ refreshIfStale: true });
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
      markHomeScrollForReset();
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setTopStories([]);
      setBandit(null);
      setIntelligence(null);
      setClippedIds(new Set());
      setOlder(adjacent.older);
      setBackgroundJob(null);
      setLocationMismatch(builtCity ?? "another city");
      setLoading(false);
      setRefreshing(false);

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

    // Resolve the saved scroll offset for this exact edition + location
    // *here*, from the values this function already knows — rather than
    // depending on a separate focus-time effect that can run before
    // editionId has ever been set (e.g. right after the screen remounts
    // on `router.back()`, before this query has resolved). The lookup
    // itself hits an in-memory, module-level cache first (populated
    // synchronously before navigating away), so this resolves instantly
    // in the common case.
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

    setLocationMismatch(null);
    setBackgroundJob(null);
    setSections(loaded);
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
    setOlder(adjacent.older);

    if (loaded.length > 0) {
      const { data: clips, error: clipsError } = await supabase
        .from("clippings")
        .select("section_id")
        .eq("user_id", user.id)
        .in(
          "section_id",
          loaded.map((s) => s.id)
        );

      if (clipsError && __DEV__) {
        console.error("[home] loadEdition: clippings query error", {
          message: clipsError.message,
          code: clipsError.code,
        });
      }

      if (!mountedRef.current || gen !== loadGen.current) return;
      setClippedIds(new Set((clips ?? []).map((c) => c.section_id)));
    } else {
      setClippedIds(new Set());
    }

    if (!mountedRef.current || gen !== loadGen.current) return;
    setLoading(false);
    setRefreshing(false);
    // Do not call restoreHomeScrollIfNeeded() here without a real content
    // height — the ScrollView's layout may still reflect the previous
    // (empty) render at this exact point, and locking in a scroll based
    // on stale bounds would block the accurate onContentSizeChange-driven
    // restore that follows once the new sections actually lay out.
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[home] loadEdition threw",
          err instanceof Error ? err.message : String(err)
        );
      }
      if (mountedRef.current && gen === loadGen.current) {
        setError("The paper couldn’t be reached. Pull to try again.");
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
        void loadEdition(true);
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
      resetScrollOnLoadRef.current = true;
      await loadEdition();
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
  useEffect(() => {
    if (!pendingCityRegen) return;
    if (generating || loading) return;
    setPendingCityRegen(false);
    void handleGenerate();
    // handleGenerate is intentionally stable enough for this one-shot trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCityRegen, generating, loading]);

  async function handleToggleClip(section: EditionSection) {
    if (clipPendingId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setClipError("Sign in again to save passages from your paper.");
      return;
    }

    setClipPendingId(section.id);
    setClipError(null);
    const alreadyClipped = clippedIds.has(section.id);
    const topic = inferTopicFromSection(section.section_type, section.headline);
    const storyKey = `${section.section_type}:${section.headline}`.slice(0, 240);

    try {
      if (alreadyClipped) {
        const { error: deleteError } = await supabase
          .from("clippings")
          .delete()
          .eq("user_id", user.id)
          .eq("section_id", section.id);

        if (!deleteError) {
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
            console.error("[home] unclip failed", deleteError.message);
          }
          setClipError("Couldn’t remove that clipping. Please try again.");
        }
      } else {
        let insertError = (
          await supabase.from("clippings").insert({
            user_id: user.id,
            section_id: section.id,
            section_type: section.section_type,
            story_key: storyKey,
            source: section.source_note,
            headline: section.headline.slice(0, 240),
          })
        ).error;

        // Pre-migration fallback — base columns only.
        if (insertError && insertError.code !== "23505") {
          insertError = (
            await supabase.from("clippings").insert({
              user_id: user.id,
              section_id: section.id,
            })
          ).error;
        }

        const duplicate =
          insertError?.code === "23505" ||
          /duplicate|unique/i.test(insertError?.message ?? "");

        if (!insertError || duplicate) {
          setClippedIds((prev) => new Set(prev).add(section.id));
          if (!duplicate) {
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
            console.error("[home] clip failed", insertError.message);
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
            onRefresh={() => loadEdition(true)}
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
              editionDate={editionDate}
              leadStory={leadStory}
              topStories={topStories}
              banditGreeting={banditMorningLine(bandit)}
              banditAside={intelligence?.banditAside}
              memoryNote={intelligence?.memoryNote}
              morningOpening={intelligence?.morningOpening}
              morningBriefing={intelligence?.morningBriefing}
              leadWhyThisMatters={intelligence?.leadWhyThisMatters}
              leadWhyChosen={intelligence?.leadWhyChosen}
              leadContinuityKicker={intelligence?.leadContinuityKicker}
              discoveryHeadline={intelligence?.discoveryHeadline}
              discoveryEditorNote={intelligence?.discoveryEditorNote}
              discoveryItems={intelligence?.discoveryItems}
              discovery={intelligence?.discovery}
              banditsPick={banditsPick(bandit)}
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
                  clipSectionId: clipSectionIdForArticle(article),
                });
              }}
              onOpenEvent={(event) => {
                persistHomeScrollNow();
                openKindredEvent(router, event, {
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
