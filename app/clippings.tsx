import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { SECTION_LABELS } from "../lib/edition/types";
import { LocalEventsSection } from "../components/LocalEventsSection";

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

  const loadClippings = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("clippings")
      .select(
        "id, created_at, section:edition_sections(id, section_type, headline, body, source_note, edition_id)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError("Couldn't load your clippings. Try again.");
      setClippings([]);
    } else {
      // Supabase may return the nested relation as an object or a one-item array.
      const normalized = (data ?? []).map((row) => {
        const section = Array.isArray(row.section)
          ? row.section[0] ?? null
          : row.section;
        return { ...row, section } as ClippingRow;
      });
      setClippings(normalized);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadClippings();
  }, [loadClippings]);

  async function handleRemove(clippingId: string) {
    setRemovingId(clippingId);
    const { error: deleteError } = await supabase
      .from("clippings")
      .delete()
      .eq("id", clippingId);

    if (!deleteError) {
      setClippings((prev) => prev.filter((c) => c.id !== clippingId));
    }
    setRemovingId(null);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadClippings(true)}
          />
        }
      >
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.title}>Clippings</Text>
        <Text style={styles.subtitle}>
          Sections you chose to keep — a small collection, not a feed.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {clippings.length === 0 ? (
          <Text style={styles.empty}>
            Nothing saved yet. While reading an edition, tap “Save clipping”
            on a section you want to keep.
          </Text>
        ) : (
          clippings.map((clip) => {
            if (!clip.section) return null;
            const section = clip.section;
            return (
              <View key={clip.id} style={styles.card}>
                <Text style={styles.label}>
                  {SECTION_LABELS[section.section_type] ?? section.section_type}
                </Text>
                {section.section_type === "local_events" ? (
                  <LocalEventsSection
                    headline={section.headline}
                    body={section.body}
                    sourceNote={section.source_note}
                  />
                ) : (
                  <>
                    <Text style={styles.headline}>{section.headline}</Text>
                    <Text style={styles.body}>{section.body}</Text>
                    {section.source_note ? (
                      <Text style={styles.sourceNote}>{section.source_note}</Text>
                    ) : null}
                  </>
                )}
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => router.push(`/edition/${section.edition_id}`)}
                  >
                    <Text style={styles.actionText}>Open edition</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemove(clip.id)}
                    disabled={removingId === clip.id}
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
    backgroundColor: "#FAF6EF",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 60,
  },
  backLink: {
    marginBottom: 20,
  },
  backText: {
    fontSize: 15,
    color: "#2B262099",
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    color: "#2B2620",
    marginBottom: 8,
    fontFamily: "Georgia",
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2620CC",
    marginBottom: 28,
  },
  error: {
    color: "#C1622D",
    marginBottom: 16,
  },
  empty: {
    fontSize: 15,
    lineHeight: 22,
    color: "#2B262099",
  },
  card: {
    marginBottom: 28,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#2B26201A",
  },
  label: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#C1622D",
    marginBottom: 8,
    fontWeight: "600",
  },
  headline: {
    fontSize: 19,
    fontWeight: "600",
    color: "#2B2620",
    marginBottom: 6,
    fontFamily: "Georgia",
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: "#2B2620DD",
  },
  sourceNote: {
    fontSize: 12,
    color: "#2B262066",
    marginTop: 8,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    gap: 20,
    marginTop: 14,
  },
  actionText: {
    fontSize: 13,
    color: "#2B2620",
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  actionTextMuted: {
    fontSize: 13,
    color: "#2B262099",
  },
});
