import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { HistoryAroundTownDirectory } from "../components/HistoryAroundTownDirectory";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { selectHistoryAroundTownGridCards } from "../lib/edition/historyAroundTown/cards";
import { articleFromHistoryPlace } from "../lib/edition/historyAroundTown/article";
import { getTodaysHistoryPlaces } from "../lib/edition/historyAroundTownListStore";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { sliceForSeeAll } from "../lib/edition/editorialPublishing";
import { paper, type } from "../lib/edition/newspaperTheme";
import { HISTORY_AROUND_TOWN_SUBTITLE } from "../lib/edition/historyAroundTown/types";

/** History Around Town — up to 20 curated historic places in this edition. */
export default function HistoryAroundTownScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.historyAroundTown
  );
  const places = useMemo(() => sliceForSeeAll(getTodaysHistoryPlaces()), []);
  const cards = useMemo(() => selectHistoryAroundTownGridCards(places), [places]);
  const articlesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof articleFromHistoryPlace>>();
    for (const place of places) {
      map.set(place.id, articleFromHistoryPlace(place));
    }
    return map;
  }, [places]);

  function handleBack() {
    persistNow();
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "History Around Town",
    backAccessibilityLabel: "Back to Homepage",
    onScrollOffset,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <View style={styles.backRow}>
          <KindredDetailBackButton onPress={handleBack} />
        </View>

        <Text style={styles.kicker}>Around town</Text>
        <Text style={styles.title}>History Around Town</Text>
        <Text style={styles.subtitle}>{HISTORY_AROUND_TOWN_SUBTITLE}</Text>
        <Text style={styles.count}>
          {cards.length} {cards.length === 1 ? "place" : "places"}
        </Text>

        <HistoryAroundTownDirectory
          cards={cards}
          onOpenCard={(card) => {
            const article = articlesById.get(card.id);
            if (!article) return;
            persistNow();
            openKindredArticle(router, article, {
              editionId: getActiveEditionId(),
              backLabel: "← Back to Homepage",
            });
          }}
        />
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.page,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 72,
  },
  backRow: {
    marginBottom: 24,
    alignSelf: "flex-start",
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
    fontSize: 17,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 10,
    maxWidth: 340,
  },
  count: {
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 24,
  },
});
