import { useEffect, useRef, useState, useMemo } from "react";
import {
  Text,
  View,
  StyleSheet,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { type EditionSection } from "../../lib/edition/types";
import {
  fetchAdjacentEditions,
  type AdjacentEdition,
} from "../../lib/edition/adjacent";
import { parseLeadStory, type LeadStory } from "../../lib/edition/LeadStory";
import { openKindredArticle } from "../../lib/edition/openArticle";
import { openKindredEvent } from "../../lib/edition/openEvent";
import { articleFromEditionSectionWithKnowledge } from "../../lib/edition/article";
import { saveClipping, removeClipping } from "../../lib/edition/clippings";
import {
  banditMorningLine,
  banditsPick,
  parseBanditPayload,
  type BanditPayload,
} from "../../lib/edition/bandit";
import {
  companionForArticle,
  parseEditionIntelligence,
  type EditionIntelligence,
} from "../../lib/edition/surfaceIntelligence";
import {
  topStoriesFromEditorialContext,
  type TopStoryItem,
} from "../../lib/edition/topStories";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../../lib/personalization";
import { stashTodaysHistoryPlaces } from "../../lib/edition/historyAroundTownListStore";
import { EditionReader } from "../../components/EditionReader";
import { EditionAdjacentNav } from "../../components/EditionAdjacentNav";
import {
  KindredStickyMasthead,
  MastheadLink,
} from "../../components/KindredMasthead";
import { PaperLoading } from "../../components/PaperLoading";
import { paper } from "../../lib/edition/newspaperTheme";
import { setActiveEditionId } from "../../lib/edition/editionContext";
import { LIST_SCROLL_KEYS } from "../../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../../lib/edition/useListScrollRestoration";

export default function EditionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const editionKey = useMemo(
    () =>
      typeof id === "string"
        ? LIST_SCROLL_KEYS.edition(id)
        : "edition:unknown",
    [id]
  );
  const mastheadScrollY = useRef(new Animated.Value(0)).current;
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    editionKey,
    {
      onRestore: (y) => mastheadScrollY.setValue(y),
    }
  );
  const [loading, setLoading] = useState(true);
  const [editionDate, setEditionDate] = useState<string | null>(null);
  const [sections, setSections] = useState<EditionSection[]>([]);
  const [leadStory, setLeadStory] = useState<LeadStory | null>(null);
  const [topStories, setTopStories] = useState<TopStoryItem[]>([]);
  const [bandit, setBandit] = useState<BanditPayload | null>(null);
  const [intelligence, setIntelligence] =
    useState<EditionIntelligence | null>(null);
  const [clippedIds, setClippedIds] = useState<Set<string>>(new Set());
  const [clipPendingId, setClipPendingId] = useState<string | null>(null);
  const [older, setOlder] = useState<AdjacentEdition | null>(null);
  const [newer, setNewer] = useState<AdjacentEdition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const editionId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : null;
      if (!editionId) {
        if (!cancelled) {
          setError("This morning isn’t on the shelf.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: edition, error: editionError } = await supabase
          .from("editions")
          .select(
            "id, edition_date, status, lead_story, bandit, discovery, knowledge, memory, morning_edition, history_around_town, editorial_context"
          )
          .eq("id", editionId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (
          editionError ||
          !edition ||
          (edition as { status?: string }).status !== "ready"
        ) {
          setError("This morning isn’t on the shelf.");
          setSections([]);
          setLeadStory(null);
          setTopStories([]);
          setBandit(null);
          setIntelligence(null);
          setOlder(null);
          setNewer(null);
          setLoading(false);
          return;
        }

        setEditionDate(edition.edition_date);
        setActiveEditionId(edition.id);
        const lead = parseLeadStory(
          (edition as { lead_story?: unknown }).lead_story
        );
        setLeadStory(lead);
        setTopStories(
          topStoriesFromEditorialContext(
            (edition as { editorial_context?: unknown }).editorial_context
          )
        );
        setBandit(parseBanditPayload((edition as { bandit?: unknown }).bandit));
        setIntelligence(
          parseEditionIntelligence({
            bandit: (edition as { bandit?: unknown }).bandit,
            discovery: (edition as { discovery?: unknown }).discovery,
            knowledge: (edition as { knowledge?: unknown }).knowledge,
            memory: (edition as { memory?: unknown }).memory,
            morning_edition: (edition as { morning_edition?: unknown })
              .morning_edition,
            history_around_town: (edition as { history_around_town?: unknown })
              .history_around_town,
            leadStory: lead,
          })
        );

        const [{ data: sectionRows }, adjacent] = await Promise.all([
          supabase
            .from("edition_sections")
            .select("id, section_type, position, headline, body, source_note")
            .eq("edition_id", edition.id)
            .order("position", { ascending: true }),
          fetchAdjacentEditions(user.id, edition.edition_date),
        ]);

        if (cancelled) return;

        const loaded = (sectionRows as EditionSection[] | null) ?? [];
        setSections(loaded);
        setOlder(adjacent.older);
        setNewer(adjacent.newer);

        if (loaded.length > 0) {
          const { data: clips } = await supabase
            .from("clippings")
            .select("section_id")
            .eq("user_id", user.id)
            .in(
              "section_id",
              loaded.map((s) => s.id)
            );

          if (cancelled) return;
          setClippedIds(new Set((clips ?? []).map((c) => c.section_id)));
        } else {
          setClippedIds(new Set());
        }

        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("This morning isn’t on the shelf.");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
    const editionId = typeof id === "string" ? id : null;
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
        }
      }
    } finally {
      setClipPendingId(null);
    }
  }

  function openAdjacent(edition: AdjacentEdition) {
    router.replace(`/edition/${edition.id}`);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaperLoading hint="Turning to that morning…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KindredStickyMasthead
        scrollY={mastheadScrollY}
        leading={
          <MastheadLink
            label="← Library"
            onPress={() => router.back()}
            accessibilityLabel="Back to library"
          />
        }
      />
      <Animated.ScrollView
        ref={scrollRef}
        key={id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: mastheadScrollY } } }],
          {
            useNativeDriver: true,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              onScrollOffset(event.nativeEvent.contentOffset.y);
            },
          }
        )}
      >
        {error ? (
          <Text style={styles.error}>{error}</Text>
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
              mastheadLeading={
                <MastheadLink
                  label="← Library"
                  onPress={() => router.back()}
                  accessibilityLabel="Back to library"
                />
              }
              locationCity={intelligence?.discovery?.location?.city ?? null}
              locationRegion={intelligence?.discovery?.location?.region ?? null}
              locationState={intelligence?.discovery?.location?.state ?? null}
              onOpenArticle={(article) => {
                persistNow();
                const companion = companionForArticle(
                  intelligence,
                  article,
                  leadStory
                );
                openKindredArticle(router, article, {
                  editionId: typeof id === "string" ? id : null,
                  companion,
                  backLabel: "← The paper",
                });
              }}
              onOpenEvent={(event) => {
                persistNow();
                openKindredEvent(router, event, {
                  editionId: typeof id === "string" ? id : null,
                  backLabel: "← The paper",
                });
              }}
              knowledge={intelligence?.knowledge}
              clippedSectionIds={clippedIds}
              onToggleClip={handleToggleClip}
              clipPendingId={clipPendingId}
              onOpenClippings={() => router.push("/clippings")}
              onOpenArchive={() => router.push("/library")}
              historyAroundTown={intelligence?.historyAroundTown}
              onSeeAllHistoryAroundTown={() => {
                persistNow();
                stashTodaysHistoryPlaces(
                  intelligence?.historyAroundTown?.places ?? []
                );
                router.push("/history-around-town");
              }}
            />
            <EditionAdjacentNav
              older={older}
              newer={newer}
              onOpen={openAdjacent}
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
  content: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 96,
  },
  error: {
    color: paper.terracotta,
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
  },
});
