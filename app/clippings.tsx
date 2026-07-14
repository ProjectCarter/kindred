import { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { SECTION_LABELS } from "../lib/edition/types";
import {
  articleFromEditionSection,
  sectionOpensArticleReader,
} from "../lib/edition/article";
import { openKindredArticle } from "../lib/edition/openArticle";
import { clipSectionIdForArticle } from "../lib/edition/surfaceIntelligence";
import { LocalEventsSection } from "../components/LocalEventsSection";
import { PaperLoading } from "../components/PaperLoading";
import { BanditCharacter } from "../components/BanditCharacter";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type ClippingRow = {
  id: string;
  created_at: string;
  section: {
    id: string;
    section_type: string;
    headline: string;
    body: string;
    source_note: string | null;
    edition_id: string;
  } | null;
};

export default function ClippingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clippings, setClippings] = useState<ClippingRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const loadClippings = useCallback(async (isRefresh = false) => {
    const gen = ++loadGen.current;
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (gen === loadGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
        return;
      }

      const { data, error: queryError } = await supabase
        .from("clippings")
        .select(
          "id, created_at, section:edition_sections(id, section_type, headline, body, source_note, edition_id)"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (gen !== loadGen.current) return;

      if (queryError) {
        setError("Your clippings couldn’t load. Try again in a moment.");
        setClippings([]);
      } else {
        const normalized = (data ?? []).map((row) => {
          const section = Array.isArray(row.section)
            ? row.section[0] ?? null
            : row.section;
          return { ...row, section } as ClippingRow;
        });
        setClippings(normalized);
      }
    } catch {
      if (gen === loadGen.current) {
        setError("Your clippings couldn’t load. Try again in a moment.");
        setClippings([]);
      }
    } finally {
      if (gen === loadGen.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadClippings();
  }, [loadClippings]);

  async function handleRemove(clippingId: string) {
    if (removingId) return;
    setRemovingId(clippingId);
    try {
      const { error: deleteError } = await supabase
        .from("clippings")
        .delete()
        .eq("id", clippingId);

      if (!deleteError) {
        setClippings((prev) => prev.filter((c) => c.id !== clippingId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <PaperLoading hint="Gathering what you kept…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClippings(true)}
            tintColor={paper.terracotta}
            colors={[paper.terracotta]}
          />
        }
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to library"
        >
          <Text style={styles.backText}>← Library</Text>
        </Pressable>

        <Text style={styles.kicker}>Saved for later</Text>
        <Text style={styles.title}>Clippings</Text>
        <Text style={styles.subtitle}>
          Passages you set aside from the paper. Tap “Save for later” on any
          section to keep one.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {clippings.length === 0 ? (
          <View
            style={styles.emptyState}
            accessible
            accessibilityLabel="Bandit says: Nothing clipped yet. When a passage is worth keeping, tap Save for later in today's paper — it will wait here for you."
          >
            <BanditCharacter pose="sitting" size={120} decorative />
            <Text style={styles.empty}>
              Nothing clipped yet. When a story, event, recommendation, or
              activity is worth keeping, tap “Save for later” — it will wait
              here for you.
            </Text>
          </View>
        ) : (
          clippings.map((clip) => {
            if (!clip.section) return null;
            const section = clip.section;
            const article = articleFromEditionSection(section);
            function openClipArticle() {
              openKindredArticle(router, article, {
                editionId: section.edition_id,
                backLabel: "← Clippings",
                clipSectionId: clipSectionIdForArticle(article),
              });
            }
            return (
              <View key={clip.id} style={styles.card}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    {SECTION_LABELS[section.section_type] ??
                      section.section_type}
                  </Text>
                  <View style={styles.labelRule} />
                </View>
                {section.section_type === "local_events" ? (
                  <LocalEventsSection
                    headline={section.headline}
                    body={section.body}
                    sourceNote={section.source_note}
                  />
                ) : sectionOpensArticleReader(section.section_type) ? (
                  <>
                    <Pressable
                      onPress={openClipArticle}
                      accessibilityRole="link"
                      accessibilityLabel={`Read: ${section.headline}`}
                      hitSlop={6}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.headline}>{section.headline}</Text>
                    </Pressable>
                    <Pressable
                      onPress={openClipArticle}
                      accessibilityRole="link"
                      accessibilityLabel="Read the story"
                      hitSlop={4}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.body}>{section.body}</Text>
                    </Pressable>
                    {section.source_note ? (
                      <Text style={styles.sourceNote}>
                        {section.source_note}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={openClipArticle}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel="Read the story"
                      style={({ pressed }) => [
                        styles.readLink,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.readLinkText}>Read the story</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.headline}>{section.headline}</Text>
                    <Text style={styles.body}>{section.body}</Text>
                    {section.source_note ? (
                      <Text style={styles.sourceNote}>
                        {section.source_note}
                      </Text>
                    ) : null}
                  </>
                )}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      router.push(`/edition/${section.edition_id}`)
                    }
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                    accessibilityLabel="Open edition"
                  >
                    <Text style={styles.actionText}>Open edition</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemove(clip.id)}
                    disabled={removingId === clip.id}
                    style={({ pressed }) => pressed && styles.pressed}
                    accessibilityRole="button"
                    accessibilityLabel={
                      removingId === clip.id
                        ? "Removing clipping"
                        : "Remove clipping"
                    }
                  >
                    <Text style={styles.actionTextMuted}>
                      {removingId === clip.id ? "Removing…" : "Remove"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.sky,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingHint: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 72,
  },
  backLink: {
    marginBottom: 24,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  backText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 10,
  },
  title: {
    ...type.display,
    fontSize: 32,
    lineHeight: 38,
    color: paper.ink,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkBody,
    marginBottom: 32,
    maxWidth: 400,
  },
  error: {
    fontFamily: "Georgia",
    color: paper.terracotta,
    marginBottom: 16,
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 12,
  },
  empty: {
    marginTop: 20,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkMuted,
    fontStyle: "italic",
    textAlign: "center",
    maxWidth: 340,
  },
  card: {
    marginBottom: 32,
    paddingBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  label: {
    ...type.kicker,
    color: paper.terracotta,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  headline: {
    ...type.sectionHeadline,
    color: paper.ink,
    marginBottom: 8,
  },
  body: {
    ...type.body,
    color: paper.inkBody,
  },
  sourceNote: {
    fontFamily: "Georgia",
    fontSize: 12,
    color: paper.inkFaint,
    marginTop: 10,
    fontStyle: "italic",
  },
  readLink: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingVertical: 4,
  },
  readLinkText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: "row",
    gap: 22,
    marginTop: 16,
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
  },
  actionTextMuted: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.inkMuted,
    fontStyle: "italic",
  },
  pressed: {
    opacity: press.opacity,
  },
});
