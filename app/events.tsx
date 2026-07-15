import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LocalEventsGrid } from "../components/LocalEventsGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNav } from "../lib/navigation/usePullDownNav";
import { pullDownNavScrollProps } from "../lib/navigation/pullDownNavScrollProps";
import { getTodaysEvents } from "../lib/edition/eventsListStore";
import { articleFromLocalEvent } from "../lib/edition/article";
import { getActiveEditionId } from "../lib/edition/editionContext";
import { openKindredArticle } from "../lib/edition/openArticle";
import { LIST_SCROLL_KEYS } from "../lib/edition/listScrollSession";
import { useListScrollRestoration } from "../lib/edition/useListScrollRestoration";
import { paper, type } from "../lib/edition/newspaperTheme";

/** Full published Local Events list — every qualifying event in today's edition. */
export default function EventsScreen() {
  const router = useRouter();
  const { scrollRef, onScrollOffset, persistNow } = useListScrollRestoration(
    LIST_SCROLL_KEYS.events
  );
  const pullDownNav = usePullDownNav();
  const events = useMemo(() => getTodaysEvents(), []);
  const eventArticlesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof articleFromLocalEvent>>();
    for (const event of events) {
      const key = `${event.name}:${event.date}`;
      map.set(key, articleFromLocalEvent(event));
    }
    return map;
  }, [events]);

  function handleBack() {
    persistNow();
    router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScrollProps(pullDownNav, onScrollOffset)}
      >
        <View style={styles.backRow}>
          <KindredDetailBackButton onPress={handleBack} />
        </View>

        <Text style={styles.kicker}>Around town today</Text>
        <Text style={styles.title}>Local Events</Text>
        <Text style={styles.subtitle}>
          Everything happening nearby, gathered in one place.
        </Text>

        <LocalEventsGrid
          events={events}
          initialRenderCount={Math.max(events.length, 1)}
          showBanditWhenEmpty
          onOpenEvent={(event) => {
            const article = eventArticlesById.get(`${event.name}:${event.date}`);
            if (!article) return;
            persistNow();
            openKindredArticle(router, article, {
              editionId: getActiveEditionId(),
              backLabel: "← Local Events",
            });
          }}
        />
      </ScrollView>
      <PullDownNavHeader
        title="Local Events"
        translateY={pullDownNav.translateY}
        onBack={handleBack}
        backAccessibilityLabel="Back to today’s paper"
      />
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
