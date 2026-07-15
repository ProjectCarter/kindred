import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EditorialCardGrid } from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { selectRecommendationCards } from "../lib/edition/recommendations";
import { getTodaysRecommendations } from "../lib/edition/recommendationsListStore";
import { discoveryArticlesById } from "../lib/edition/discoveryArticleCache";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Full published Recommendations list — every qualifying place in today's edition. */
export default function RecommendationsScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.recommendations
  );
  const items = useMemo(() => getTodaysRecommendations(), []);
  const cards = useMemo(() => selectRecommendationCards(items), [items]);
  const articlesById = useMemo(
    () => discoveryArticlesById(items, "recommendation"),
    [items]
  );

  function handleBack() {
    persistNow();
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Recommendations",
    backAccessibilityLabel: "Back to today’s paper",
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

        <Text style={styles.kicker}>Where should I go?</Text>
        <Text style={styles.title}>Recommendations</Text>
        <Text style={styles.subtitle}>
          Places worth discovering nearby — gathered in one place.
        </Text>

        <EditorialCardGrid
          kicker="Recommendations"
          cards={cards}
          initialRenderCount={Math.max(cards.length, 1)}
          fallbackIcon="mappin.and.ellipse"
          fallbackIconIonicon="location-outline"
          emptyCopy="Nothing new to recommend nearby today — check back tomorrow."
          showBanditWhenEmpty
          onOpenCard={(card) => {
            const article = articlesById.get(card.id);
            if (!article) return;
            persistNow();
            openKindredArticle(router, article, {
              editionId: getActiveEditionId(),
              backLabel: "← Recommendations",
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
    backgroundColor: paper.sky,
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
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkBody,
    marginBottom: 32,
    maxWidth: 400,
  },
});
