import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  AppState,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { type EditionSection } from "../lib/edition/types";
import {
  fetchAdjacentEditions,
  type AdjacentEdition,
} from "../lib/edition/adjacent";
import { parseLeadStory, type LeadStory } from "../lib/edition/LeadStory";
import { openKindredArticle } from "../lib/edition/openArticle";
import {
  banditMorningLine,
  parseBanditPayload,
  type BanditPayload,
} from "../lib/edition/bandit";
import {
  companionForLead,
  parseEditionIntelligence,
  type EditionIntelligence,
} from "../lib/edition/surfaceIntelligence";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../lib/personalization";
import {
  morningSalutation,
  waitingCopy,
} from "../lib/edition/morningRitual";
import { localEditionDate } from "../lib/edition/dates";
import { paper, press } from "../lib/edition/newspaperTheme";
import { PaperLoading } from "../components/PaperLoading";
import { EditionReader } from "../components/EditionReader";
import { EditionAdjacentNav } from "../components/EditionAdjacentNav";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<EditionSection[]>([]);
  const [editionDate, setEditionDate] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [leadStory, setLeadStory] = useState<LeadStory | null>(null);
  const [bandit, setBandit] = useState<BanditPayload | null>(null);
  const [intelligence, setIntelligence] =
    useState<EditionIntelligence | null>(null);
  const [clippedIds, setClippedIds] = useState<Set<string>>(new Set());
  const [clipPendingId, setClipPendingId] = useState<string | null>(null);
  const [older, setOlder] = useState<AdjacentEdition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);


  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const loadEdition = useCallback(async (isRefresh = false) => {
    const gen = ++loadGen.current;
    if (isRefresh) setRefreshing(true);
    setError(null);

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
        "id, edition_date, status, user_id, lead_story, bandit, discovery, knowledge, memory, morning_edition",
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
      const adjacent = await fetchAdjacentEditions(user.id, todayStr);
      if (!mountedRef.current || gen !== loadGen.current) return;
      setSections([]);
      setEditionDate(null);
      setEditionId(null);
      setLeadStory(null);
      setBandit(null);
      setIntelligence(null);
      setClippedIds(new Set());
      setOlder(adjacent.older);
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

    setSections(loaded);
    setEditionDate(edition.edition_date);
    setEditionId(edition.id);
    const lead = parseLeadStory((edition as { lead_story?: unknown }).lead_story);
    setLeadStory(lead);
    setBandit(parseBanditPayload((edition as { bandit?: unknown }).bandit));
    setIntelligence(
      parseEditionIntelligence({
        bandit: (edition as { bandit?: unknown }).bandit,
        discovery: (edition as { discovery?: unknown }).discovery,
        knowledge: (edition as { knowledge?: unknown }).knowledge,
        memory: (edition as { memory?: unknown }).memory,
        morning_edition: (edition as { morning_edition?: unknown })
          .morning_edition,
        leadStory: lead,
      })
    );
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

  useEffect(() => {
    loadEdition();
  }, [loadEdition]);

  // Resume: quietly refresh if the paper may have aged while backgrounded.
  useEffect(() => {
    const lastActive = { at: Date.now() };
    const onChange = (state: AppStateStatus) => {
      if (state !== "active") return;
      const now = Date.now();
      if (now - lastActive.at < 45_000) return;
      lastActive.at = now;
      void loadEdition(true);
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [loadEdition]);

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    setError(null);

    __DEV__ && console.log("[home] generate-edition: start");

    try {
      const INVOKE_TIMEOUT_MS = 90_000;
      const { data, error: invokeError } = await Promise.race([
        supabase.functions.invoke("generate-edition"),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error("generate-edition timed out")),
            INVOKE_TIMEOUT_MS
          );
        }),
      ]);

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

      await loadEdition();
      __DEV__ && console.log("[home] generate-edition: loadEdition finished");
    } catch (err) {
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
      setGenerating(false);
    }
  }

  async function handleToggleClip(section: EditionSection) {
    if (clipPendingId) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setClipPendingId(section.id);
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
        }
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadEdition(true)}
            tintColor={paper.terracotta}
            colors={[paper.terracotta]}
          />
        }
      >
        <View style={styles.headerRow}>
          {sections.length === 0 ? (
            <Text style={styles.date}>{today}</Text>
          ) : (
            <Text style={styles.mastQuiet}>Today’s paper</Text>
          )}
          <Pressable
            onPress={() => router.push("/library")}
            accessibilityRole="button"
            accessibilityLabel="Open library"
            style={({ pressed }) => pressed && styles.linkPressed}
          >
            <Text style={styles.libraryLink}>Library</Text>
          </Pressable>
        </View>

        {sections.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.title}>{morningSalutation()}</Text>
            <Text style={styles.emptyKicker}>{waitingCopy.emptyTitle}</Text>
            <Text style={styles.body}>{waitingCopy.emptyBody}</Text>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              style={({ pressed }) => [
                styles.button,
                generating && styles.buttonDisabled,
                pressed && !generating && styles.linkPressed,
              ]}
              onPress={handleGenerate}
              disabled={generating}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>
                {generating
                  ? waitingCopy.preparing
                  : waitingCopy.openAction}
              </Text>
            </Pressable>
            {older ? (
              <Pressable
                style={styles.previousLink}
                onPress={() => router.push(`/edition/${older.id}`)}
                accessibilityRole="button"
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
              banditGreeting={banditMorningLine(bandit)}
              banditAside={intelligence?.banditAside}
              memoryNote={intelligence?.memoryNote}
              morningOpening={intelligence?.morningOpening}
              morningBriefing={intelligence?.morningBriefing}
              leadWhyThisMatters={intelligence?.leadWhyThisMatters}
              leadWhyChosen={intelligence?.leadWhyChosen}
              discoveryHeadline={intelligence?.discoveryHeadline}
              discoveryEditorNote={intelligence?.discoveryEditorNote}
              discoveryItems={intelligence?.discoveryItems}
              onOpenArticle={(article) => {
                const companion =
                  leadStory &&
                  article.id === leadStory.id &&
                  intelligence
                    ? companionForLead(intelligence, leadStory)
                    : null;
                openKindredArticle(router, article, {
                  editionId,
                  companion,
                });
              }}
              knowledge={intelligence?.knowledge}
              clippedSectionIds={clippedIds}
              onToggleClip={handleToggleClip}
              clipPendingId={clipPendingId}
            />
            <EditionAdjacentNav
              older={older}
              newer={null}
              onOpen={(edition) => router.push(`/edition/${edition.id}`)}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.cream,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 80,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  date: {
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: paper.inkMuted,
    flex: 1,
    paddingRight: 12,
    fontWeight: "600",
  },
  mastQuiet: {
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkFaint,
    flex: 1,
    paddingRight: 12,
    letterSpacing: 0.2,
  },
  libraryLink: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  linkPressed: {
    opacity: press.opacity,
  },
  emptyState: {
    paddingTop: 48,
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
