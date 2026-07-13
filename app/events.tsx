import { useMemo } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LocalEventsGrid } from "../components/LocalEventsGrid";
import { getTodaysEvents } from "../lib/edition/eventsListStore";
import { openKindredEvent } from "../lib/edition/openEvent";
import { paper, press, type } from "../lib/edition/newspaperTheme";

/**
 * The full Local Events list — reached from the front page's
 * "See all N events →" call-to-action. Same two-column grid, no cap.
 */
export default function EventsScreen() {
  const router = useRouter();
  const events = useMemo(() => getTodaysEvents(), []);

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

        <Text style={styles.kicker}>Around town today</Text>
        <Text style={styles.title}>Local Events</Text>
        <Text style={styles.subtitle}>
          Everything happening nearby, gathered in one place.
        </Text>

        <LocalEventsGrid
          events={events}
          limit={Math.max(events.length, 1)}
          onOpenEvent={(event) =>
            openKindredEvent(router, event, { backLabel: "← Local Events" })
          }
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
