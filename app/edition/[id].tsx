import { useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
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
import {
  banditMorningLine,
  banditsPick,
  parseBanditPayload,
  type BanditPayload,
} from "../../lib/edition/bandit";
import {
  companionForArticle,
  clipSectionIdForArticle,
  parseEditionIntelligence,
  type EditionIntelligence,
} from "../../lib/edition/surfaceIntelligence";
import {
  inferTopicFromSection,
  trackReadingSignal,
} from "../../lib/personalization";
import { EditionReader } from "../../components/EditionReader";
import { EditionAdjacentNav } from "../../components/EditionAdjacentNav";
import { PaperLoading } from "../../components/PaperLoading";
import { paper } from "../../lib/edition/newspaperTheme";

export default function EditionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editionDate, setEditionDate] = useState<string | null>(null);
  const [sections, setSections] = useState<EditionSection[]>([]);
  const [leadStory, setLeadStory] = useState<LeadStory | null>(null);
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
            "id, edition_date, status, lead_story, bandit, discovery, knowledge, memory, morning_edition"
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
          setBandit(null);
          setIntelligence(null);
          setOlder(null);
          setNewer(null);
          setLoading(false);
          return;
        }

        setEditionDate(edition.edition_date);
        const lead = parseLeadStory(
          (edition as { lead_story?: unknown }).lead_story
        );
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
      <ScrollView
        key={id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel="Back to library"
        >
          <Text style={styles.backText}>← Library</Text>
        </Pressable>

        {error ? (
          <Text style={styles.error}>{error}</Text>
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
              leadContinuityKicker={intelligence?.leadContinuityKicker}
              discoveryHeadline={intelligence?.discoveryHeadline}
              discoveryEditorNote={intelligence?.discoveryEditorNote}
              discoveryItems={intelligence?.discoveryItems}
              banditsPick={banditsPick(bandit)}
              locationCity={intelligence?.discovery?.location?.city ?? null}
              locationRegion={intelligence?.discovery?.location?.region ?? null}
              locationState={intelligence?.discovery?.location?.state ?? null}
              onOpenArticle={(article) => {
                const companion = companionForArticle(
                  intelligence,
                  article,
                  leadStory
                );
                openKindredArticle(router, article, {
                  editionId: typeof id === "string" ? id : null,
                  companion,
                  backLabel: "← The paper",
                  clipSectionId: clipSectionIdForArticle(article),
                });
              }}
              knowledge={intelligence?.knowledge}
              clippedSectionIds={clippedIds}
              onToggleClip={handleToggleClip}
              clipPendingId={clipPendingId}
              onOpenClippings={() => router.push("/clippings")}
              onOpenArchive={() => router.push("/library")}
            />
            <EditionAdjacentNav
              older={older}
              newer={newer}
              onOpen={openAdjacent}
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
    paddingTop: 16,
    paddingBottom: 72,
  },
  backLink: {
    marginBottom: 18,
  },
  backText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  error: {
    color: paper.terracotta,
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
  },
});
