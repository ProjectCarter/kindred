import { useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  deriveEventBadge,
  eventPlaceLine,
  getStashedEvent,
} from "../../lib/edition/eventStore";
import { eventFallbackImage } from "../../lib/edition/localEvents";
import { eventInfoBadgesFor } from "../../lib/edition/eventBadges";
import { EventInfoBadgeRow } from "../../components/EventInfoBadgeRow";
import { PullDownNavHeader } from "../../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../../lib/navigation/usePullDownNavScreen";
import { paper, press } from "../../lib/edition/newspaperTheme";

/**
 * Full Local Event page — photography first, logistics clear, external listing available.
 */
export default function EventDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const eventId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
  const event = useMemo(
    () => (eventId ? getStashedEvent(decodeURIComponent(eventId)) : null),
    [eventId]
  );

  const back =
    typeof backLabel === "string" && backLabel.trim()
      ? decodeURIComponent(backLabel)
      : "← Today’s paper";

  function handleBack() {
    router.back();
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    backLabel: back,
    itemTitle: event?.name ?? null,
    fallbackTitle: "Local Events",
    backAccessibilityLabel: back.replace(/^←\s*/, "Back to "),
  });

  const badge = event ? deriveEventBadge(event) : null;
  const infoBadges = event ? eventInfoBadgesFor(event) : [];
  const place = event ? eventPlaceLine(event) : "";
  const photoH = Math.round(Math.min(width * 0.85, 420));

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <Text style={styles.missing}>This event is no longer available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
      >
        <Pressable
          onPress={handleBack}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel={back.replace(/^←\s*/, "Back to ")}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>

        <Image
          source={
            event.imageUrl
              ? { uri: event.imageUrl }
              : eventFallbackImage(event.category)
          }
          style={{ width, height: photoH, marginLeft: -24 }}
          resizeMode="cover"
          accessibilityLabel={event.name}
        />

        <View style={styles.body}>
          {badge ? (
            <Text style={styles.badge} maxFontSizeMultiplier={1.2}>
              {badge}
            </Text>
          ) : null}

          <Text style={styles.title} maxFontSizeMultiplier={1.25}>
            {event.name}
          </Text>

          <EventInfoBadgeRow badges={infoBadges} style={styles.badgeRow} />

          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {[event.date, event.time].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.place} maxFontSizeMultiplier={1.2}>
            {place}
          </Text>

          {event.banditNote?.trim() ? (
            <Text style={styles.bandit} maxFontSizeMultiplier={1.2}>
              {event.banditNote.trim()}
              <Text style={styles.banditSign}> — Bandit</Text>
            </Text>
          ) : null}

          {event.sourceName ? (
            <Text style={styles.source} maxFontSizeMultiplier={1.15}>
              Listed via {event.sourceName}
            </Text>
          ) : null}

          {event.sourceUrl ? (
            <Pressable
              onPress={() => {
                void Linking.openURL(event.sourceUrl).catch(() => {});
              }}
              style={({ pressed }) => [
                styles.cta,
                pressed && { opacity: press.opacity },
              ]}
              accessibilityRole="link"
              accessibilityLabel="View listing"
            >
              <Text style={styles.ctaText}>View listing</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: paper.page,
  },
  scroll: {
    paddingBottom: 64,
  },
  backRow: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  back: {
    fontSize: 15,
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  missing: {
    fontFamily: "Georgia",
    fontSize: 22,
    color: paper.inkMuted,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 14,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: paper.ink,
    marginBottom: 12,
  },
  badgeRow: {
    marginBottom: 14,
  },
  meta: {
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkBody,
    marginBottom: 6,
  },
  place: {
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginBottom: 20,
  },
  bandit: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 28,
    fontStyle: "italic",
    color: paper.inkBody,
    marginBottom: 24,
    maxWidth: 480,
  },
  banditSign: {
    fontStyle: "italic",
    color: paper.inkFaint,
  },
  source: {
    fontSize: 12,
    letterSpacing: 0.3,
    color: paper.inkFaint,
    marginBottom: 28,
  },
  cta: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.terracotta,
  },
  ctaText: {
    fontSize: 14,
    letterSpacing: 0.4,
    fontWeight: "600",
    color: paper.terracotta,
  },
});
