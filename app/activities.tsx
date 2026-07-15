import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EditorialCardGrid } from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { selectActivityCards } from "../lib/edition/activities";
import { getTodaysActivities } from "../lib/edition/activitiesListStore";
import { discoveryArticlesById } from "../lib/edition/discoveryArticleCache";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Full published Activities list — every qualifying activity in this edition. */
export default function ActivitiesScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.activities
  );
  const items = useMemo(() => getTodaysActivities(), []);
  const cards = useMemo(() => selectActivityCards(items), [items]);
  const articlesById = useMemo(
    () => discoveryArticlesById(items, "activity"),
    [items]
  );

  function handleBack() {
    persistNow();
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Activities",
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

        <Text style={styles.kicker}>What should I go do?</Text>
        <Text style={styles.title}>Activities</Text>
        <Text style={styles.subtitle}>
          Things worth getting out and doing nearby this month.
        </Text>

        <EditorialCardGrid
          kicker="Activities"
          cards={cards}
          initialRenderCount={Math.max(cards.length, 1)}
          fallbackIcon="figure.run"
          fallbackIconIonicon="walk-outline"
          emptyCopy="Nothing new to try nearby this month — check back tomorrow."
          showBanditWhenEmpty
          onOpenCard={(card) => {
            const article = articlesById.get(card.id);
            if (!article) return;
            persistNow();
            openKindredArticle(router, article, {
              editionId: getActiveEditionId(),
              backLabel: "← Activities",
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
