import { useEffect, useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EditorialCardGrid } from "../components/EditorialCardGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import {
  countRenderedFoodDrinkGuideCards,
  logFoodDrinkCountDebug,
  resolveFoodDrinkSeeAllPool,
} from "../lib/edition/foodDrinkSeeAll";
import {
  FOOD_DRINK_SECTION_INTRO,
  FOOD_DRINK_SECTION_KICKER,
  FOOD_DRINK_SECTION_QUESTION,
  FOOD_DRINK_SECTION_TITLE,
} from "../lib/edition/recommendations";
import {
  foodDrinkGuidePlaceCount,
  organizeFoodDrinkGuide,
} from "../lib/edition/foodDrinkGuide";
import {
  getTodaysRecommendations,
  getTodaysRecommendationsReaderLocation,
} from "../lib/edition/recommendationsListStore";
import { discoveryArticlesById } from "../lib/edition/discoveryArticleCache";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Complete Food & Drink guide — up to 20 curated places within ~25 miles. */
export default function RecommendationsScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.recommendations
  );
  const handoffItems = useMemo(() => getTodaysRecommendations(), []);
  const readerLocation = useMemo(
    () => getTodaysRecommendationsReaderLocation(),
    []
  );
  const items = useMemo(
    () => resolveFoodDrinkSeeAllPool(handoffItems, readerLocation),
    [handoffItems, readerLocation]
  );
  const sections = useMemo(
    () => organizeFoodDrinkGuide(items, { readerLocation }),
    [items, readerLocation]
  );
  const placeCount = useMemo(
    () => foodDrinkGuidePlaceCount(items, { readerLocation }),
    [items, readerLocation]
  );
  const renderedCount = useMemo(
    () => countRenderedFoodDrinkGuideCards(sections),
    [sections]
  );

  useEffect(() => {
    logFoodDrinkCountDebug({
      stage: "full_list_screen",
      cacheCount: handoffItems.length,
      uniqueBeforeFilter: handoffItems.length,
      uniqueAfterFilter: items.length,
      fullListHandoffCount: handoffItems.length,
      homepageCount: null,
      renderedCount,
      paginationLimit: null,
    });
  }, [handoffItems.length, items.length, renderedCount]);
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
    title: FOOD_DRINK_SECTION_TITLE,
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

        <Text style={styles.kicker}>{FOOD_DRINK_SECTION_QUESTION}</Text>
        <Text style={styles.title}>{FOOD_DRINK_SECTION_TITLE}</Text>
        <Text style={styles.subtitle}>{FOOD_DRINK_SECTION_INTRO}</Text>
        {placeCount > 0 ? (
          <Text style={styles.countLine}>
            {placeCount} {placeCount === 1 ? "place" : "places"} within 25 miles
          </Text>
        ) : null}

        {sections.length === 0 ? (
          <Text style={styles.emptyCopy}>
            Nothing on the Food & Drinks desk this month — check back tomorrow.
          </Text>
        ) : (
          sections.map((section) => (
            <View key={section.id} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {section.icon} {section.label}
              </Text>
              <EditorialCardGrid
                kicker={FOOD_DRINK_SECTION_KICKER}
                cards={section.cards}
                initialRenderCount={Math.max(section.cards.length, 1)}
                onOpenCard={(card) => {
                  const article = articlesById.get(card.id);
                  if (!article) return;
                  persistNow();
                  openKindredArticle(router, article, {
                    editionId: getActiveEditionId(),
                    backLabel: `← ${FOOD_DRINK_SECTION_TITLE}`,
                  });
                }}
              />
            </View>
          ))
        )}
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
    fontSize: 16,
    lineHeight: 25,
    color: paper.inkBody,
    marginBottom: 12,
    maxWidth: 400,
  },
  countLine: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    color: paper.inkFaint,
    marginBottom: 28,
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    ...type.sectionHeadline,
    fontSize: 20,
    lineHeight: 26,
    color: paper.ink,
    marginBottom: 14,
  },
  emptyCopy: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkFaint,
  },
});
