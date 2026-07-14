import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { EditorialCardGrid } from "../components/EditorialCardGrid";
import { selectActivityCards } from "../lib/edition/activities";
import { getTodaysActivities } from "../lib/edition/activitiesListStore";
import { articleFromDiscoveryItem } from "../lib/edition/article";
import { openKindredArticle } from "../lib/edition/openArticle";
import { paper, press, type } from "../lib/edition/newspaperTheme";
import { SEE_ALL_MAX } from "../lib/edition/seeAllLimit";

/**
 * The full Activities list — reached from the front page's
 * "See all N activities →" call-to-action. Same grid, capped at
 * SEE_ALL_MAX (exploration, not an endless directory — kindred-mission.mdc).
 */
export default function ActivitiesScreen() {
  const router = useRouter();
  const items = useMemo(
    () => getTodaysActivities().slice(0, SEE_ALL_MAX),
    []
  );
  const cards = useMemo(() => selectActivityCards(items), [items]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to today's paper"
        >
          <Text style={styles.backText}>← Today’s paper</Text>
        </Pressable>

        <Text style={styles.kicker}>What should I go do?</Text>
        <Text style={styles.title}>Activities</Text>
        <Text style={styles.subtitle}>
          Real, bookable things to go do nearby — gathered in one place.
        </Text>

        <EditorialCardGrid
          kicker="Activities"
          cards={cards}
          limit={Math.max(cards.length, 1)}
          fallbackIcon="figure.run"
          fallbackIconIonicon="walk-outline"
          emptyCopy="Nothing new to try nearby today — check back tomorrow."
          showBanditWhenEmpty
          onOpenCard={(card) => {
            const item = items.find((i) => i.item.id === card.id);
            if (!item) return;
            openKindredArticle(router, articleFromDiscoveryItem(item), {
              backLabel: "← Activities",
            });
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
  pressed: {
    opacity: press.opacity,
  },
});
