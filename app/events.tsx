import { useMemo } from "react";
import { Text, StyleSheet, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LocalEventsGrid } from "../components/LocalEventsGrid";
import { KindredDetailBackButton } from "../components/KindredDetailBackButton";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { getTodaysEvents } from "../lib/edition/eventsListStore";
import { articleFromLocalEvent } from "../lib/edition/article";
import { localEditionDate } from "../lib/edition/dates";
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
  const events = useMemo(() => getTodaysEvents(), []);
  const eventArticlesById = useMemo(() => {
    const editionDate = localEditionDate();
    const map = new Map<string, ReturnType<typeof articleFromLocalEvent>>();
    for (const event of events) {
      const key = `${event.name}:${event.date}`;
      map.set(key, articleFromLocalEvent(event, { editionDate }));
    }
    return map;
  }, [events]);

  function handleBack() {
    persistNow();
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    title: "Local Events",
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

        <Text style={styles.kicker}>Around town</Text>
        <Text style={styles.title}>Local Events</Text>
        <Text style={styles.subtitle}>
          Concerts, festivals, markets, and community happenings — today through the coming month.
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
    marginBottom: 32,
    maxWidth: 400,
  },
});
