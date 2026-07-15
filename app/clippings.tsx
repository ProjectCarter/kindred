import { useCallback, useMemo, useRef, useState } from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { openKindredArticle } from "../lib/edition/openArticle";
import {
  listClippings,
  clippingTypeLabel,
  sweepExpiredEventClippings,
  type ClippingListRow,
} from "../lib/edition/clippings";
import { isPastEvent } from "../lib/edition/eventExpiry";
import type { ClippingContentType } from "../lib/edition/clippingTypes";
import { PaperLoading } from "../components/PaperLoading";
import { BanditCharacter } from "../components/BanditCharacter";
import { paper, press, type } from "../lib/edition/newspaperTheme";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNav } from "../lib/navigation/usePullDownNav";
import { pullDownNavScrollProps } from "../lib/navigation/pullDownNavScrollProps";

type Filter = "all" | ClippingContentType;

/**
 * "Saved from • Monday, July 13" — the day the reader originally pinned
 * this item, not today's date and never the word "Edition". Comes straight
 * from the clipping row's own `created_at`, which is set once at insert
 * time and never touched again — even if the same item is later re-pinned
 * after being removed, that simply creates a new row with a fresh date.
 */
function formatSavedDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "article", label: "Articles" },
  { id: "event", label: "Events" },
  { id: "activity", label: "Activities" },
  { id: "recommendation", label: "Recommendations" },
];

export default function ClippingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clippings, setClippings] = useState<ClippingListRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  // Tapping the filled pin here doesn't delete right away — it only marks
  // the clipping for removal. The row stays visible (pin flips to outline)
  // so a second tap can undo it. The mark is only made permanent once the
  // reader actually leaves this screen (see the focus-effect cleanup below).
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(
    new Set()
  );
  const pendingRemovalRef = useRef<Set<string>>(new Set());
  pendingRemovalRef.current = pendingRemovalIds;
  const pullDownNav = usePullDownNav();

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

      // Quietly remove any event whose 30-day grace period has fully
      // elapsed before the list is even fetched — Articles, Activities,
      // and Recommendations are never touched by this.
      try {
        await sweepExpiredEventClippings(user.id);
      } catch {
        /* Best effort — an unswept expired event just shows up next load. */
      }

      const rows = await listClippings(user.id);
      if (gen !== loadGen.current) return;
      setClippings(rows);
      setPendingRemovalIds(new Set());
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

  const commitPendingRemovals = useCallback(async () => {
    const ids = Array.from(pendingRemovalRef.current);
    if (ids.length === 0) return;
    pendingRemovalRef.current = new Set();
    setPendingRemovalIds(new Set());
    try {
      await supabase.from("clippings").delete().in("id", ids);
    } catch {
      /* Best effort — the item simply reappears next time the list loads. */
    }
  }, []);

  // Refresh whenever Clippings gains focus; commit any pending removals
  // the moment the reader navigates away (this is the only place a pin
  // tap here actually becomes permanent).
  useFocusEffect(
    useCallback(() => {
      void loadClippings();
      return () => {
        void commitPendingRemovals();
      };
    }, [loadClippings, commitPendingRemovals])
  );

  function handleTogglePin(clip: ClippingListRow) {
    setPendingRemovalIds((prev) => {
      const next = new Set(prev);
      if (next.has(clip.id)) {
        next.delete(clip.id);
      } else {
        next.add(clip.id);
      }
      return next;
    });
  }

  function openClip(clip: ClippingListRow) {
    if (!clip.article) return;
    openKindredArticle(router, clip.article, { backLabel: "← Clippings" });
  }

  const counts = useMemo(() => {
    const byType: Record<Filter, number> = {
      all: clippings.length,
      article: 0,
      event: 0,
      activity: 0,
      recommendation: 0,
    };
    for (const clip of clippings) byType[clip.contentType] += 1;
    return byType;
  }, [clippings]);

  const visible = useMemo(() => {
    if (filter === "all") return clippings;
    return clippings.filter((c) => c.contentType === filter);
  }, [clippings, filter]);

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
        {...pullDownNavScrollProps(pullDownNav)}
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
          Stories, events, activities, and recommendations you set aside —
          your own personal collection from Kindred.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {clippings.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.filter((f) => f.id === "all" || counts[f.id] > 0).map(
              (f) => {
                const active = filter === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFilter(f.id)}
                    style={({ pressed }) => [
                      styles.filterPill,
                      active && styles.filterPillActive,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter: ${f.label}`}
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        active && styles.filterTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        ) : null}

        {clippings.length === 0 ? (
          <View
            style={styles.emptyState}
            accessible
            accessibilityLabel="Bandit says: Nothing clipped yet. Save stories, events, activities, and recommendations to find them here later."
          >
            <BanditCharacter pose="sitting" size={120} decorative />
            <Text style={styles.empty}>
              Nothing clipped yet. Save stories, events, activities, and
              recommendations to find them here later.
            </Text>
          </View>
        ) : visible.length === 0 ? (
          <Text style={styles.emptyFilter}>
            Nothing saved in this category yet.
          </Text>
        ) : (
          visible.map((clip) => (
            <ClippingCard
              key={clip.id}
              clip={clip}
              pinned={!pendingRemovalIds.has(clip.id)}
              onOpen={() => openClip(clip)}
              onTogglePin={() => handleTogglePin(clip)}
            />
          ))
        )}
      </ScrollView>
      <PullDownNavHeader
        title="Clippings"
        translateY={pullDownNav.translateY}
        onBack={() => router.back()}
        backAccessibilityLabel="Back to library"
      />
    </SafeAreaView>
  );
}

function ClippingCard({
  clip,
  pinned,
  onOpen,
  onTogglePin,
}: {
  clip: ClippingListRow;
  pinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  const metaLine = [
    clip.eventTime,
    clip.location,
    clip.contentType !== "event" ? clip.source : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const savedDate = formatSavedDate(clip.createdAt);
  const showPastEvent =
    clip.contentType === "event" && isPastEvent(clip.eventEndsAt);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpen}
        disabled={!clip.article}
        accessibilityRole="button"
        accessibilityLabel={`Open: ${clip.headline}`}
        style={({ pressed }) => [
          styles.cardBody,
          pressed && clip.article && styles.pressed,
        ]}
      >
        <View style={styles.thumbFrame}>
          {clip.imageUrl || clip.imageSource ? (
            <Image
              source={clip.imageUrl ? { uri: clip.imageUrl } : clip.imageSource!}
              style={styles.thumb}
              resizeMode="cover"
              accessibilityLabel={clip.headline}
            />
          ) : (
            <View style={styles.thumbFallback}>
              <SymbolView
                name="newspaper"
                size={18}
                weight="light"
                tintColor={paper.inkFaint}
                accessibilityElementsHidden
                importantForAccessibility="no"
                fallback={
                  <Ionicons
                    name="newspaper-outline"
                    size={18}
                    color={paper.inkFaint}
                  />
                }
              />
            </View>
          )}
        </View>

        <View style={styles.cardCopy}>
          <View style={styles.typeLabelRow}>
            <Text style={styles.typeLabel}>
              {clippingTypeLabel(clip.contentType)}
            </Text>
            {showPastEvent ? (
              <Text style={styles.pastEventBadge}>Past Event</Text>
            ) : null}
          </View>
          <Text style={styles.headline} numberOfLines={2}>
            {clip.headline}
          </Text>
          {clip.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {clip.summary}
            </Text>
          ) : null}
          {metaLine ? (
            <Text style={styles.metaLine} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
          {savedDate ? (
            <Text style={styles.savedLine} numberOfLines={1}>
              Saved from • {savedDate}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        onPress={onTogglePin}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          pinned ? "Saved. Tap to remove from Clippings." : "Removed — tap to keep in Clippings."
        }
        style={({ pressed }) => [styles.pinButton, pressed && styles.pressed]}
      >
        <SymbolView
          name={pinned ? "pin.fill" : "pin"}
          size={18}
          weight="regular"
          tintColor={pinned ? paper.terracotta : paper.inkFaint}
          accessibilityElementsHidden
          importantForAccessibility="no"
          fallback={
            <Ionicons
              name={pinned ? "pin" : "pin-outline"}
              size={18}
              color={pinned ? paper.terracotta : paper.inkFaint}
            />
          }
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.sky,
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
    marginBottom: 28,
    maxWidth: 400,
  },
  error: {
    fontFamily: "Georgia",
    color: paper.terracotta,
    marginBottom: 16,
    fontStyle: "italic",
  },
  filterScroll: {
    marginBottom: 28,
  },
  filterRow: {
    flexDirection: "row",
    gap: 22,
    paddingRight: 8,
  },
  filterPill: {
    paddingVertical: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterPillActive: {
    borderBottomColor: paper.terracotta,
  },
  filterText: {
    fontFamily: "Georgia",
    fontSize: 14,
    letterSpacing: 0.2,
    color: paper.inkMuted,
  },
  filterTextActive: {
    color: paper.terracotta,
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
  emptyFilter: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    color: paper.inkMuted,
    fontStyle: "italic",
    paddingVertical: 24,
  },
  card: {
    marginBottom: 28,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    position: "relative",
  },
  cardBody: {
    flexDirection: "row",
    gap: 16,
    paddingRight: 36,
  },
  pinButton: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFrame: {
    width: 84,
    height: 84,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  typeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  pastEventBadge: {
    fontSize: 10,
    letterSpacing: 0.2,
    fontStyle: "italic",
    color: paper.inkFaint,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    marginBottom: 4,
  },
  summary: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkBody,
    marginBottom: 4,
  },
  metaLine: {
    fontSize: 12,
    lineHeight: 17,
    color: paper.inkFaint,
    fontStyle: "italic",
  },
  savedLine: {
    fontSize: 11,
    lineHeight: 16,
    color: paper.inkFaint,
    fontStyle: "italic",
    marginTop: 2,
  },
  pressed: {
    opacity: press.opacity,
  },
});
