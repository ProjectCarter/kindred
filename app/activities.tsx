import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EditorialCardGrid } from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNav } from "../lib/navigation/usePullDownNav";
import { selectActivityCards } from "../lib/edition/activities";
import { getTodaysActivities } from "../lib/edition/activitiesListStore";
import { articleFromDiscoveryItem } from "../lib/edition/article";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Full published Activities list — every qualifying activity in today's edition. */
export default function ActivitiesScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.activities
  );
  const pullDownNav = usePullDownNav();
  const items = useMemo(() => getTodaysActivities(), []);
  const cards = useMemo(() => selectActivityCards(items), [items]);

  function handleBack() {
    persistNow();
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <PullDownNavHeader
        title="Activities"
        translateY={pullDownNav.translateY}
        visible={pullDownNav.visible}
        onBack={handleBack}
        backAccessibilityLabel="Back to today’s paper"
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          onScrollOffset(event.nativeEvent.contentOffset.y);
          pullDownNav.onScroll(event);
        }}
      >
        <View style={styles.backRow}>
          <KindredDetailBackButton onPress={handleBack} />
        </View>

        <Text style={styles.kicker}>What should I go do?</Text>
        <Text style={styles.title}>Activities</Text>
        <Text style={styles.subtitle}>
          Real, bookable things to go do nearby — gathered in one place.
        </Text>

        <EditorialCardGrid
          kicker="Activities"
          cards={cards}
          initialRenderCount={Math.max(cards.length, 1)}
          fallbackIcon="figure.run"
          fallbackIconIonicon="walk-outline"
          emptyCopy="Nothing new to try nearby today — check back tomorrow."
          showBanditWhenEmpty
          onOpenCard={(card) => {
            const item = items.find((i) => i.item.id === card.id);
            if (!item) return;
            persistNow();
            openKindredArticle(
              router,
              { ...articleFromDiscoveryItem(item), savedContentType: "activity" },
              {
                editionId: getActiveEditionId(),
                backLabel: "← Activities",
              }
            );
          }}
        />
      </ScrollView>
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
