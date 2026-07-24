import { useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  deriveEventBadge,
  eventPlaceLine,
  getStashedEvent,
} from "../../lib/edition/eventStore";
import { eventInfoBadgesFor } from "../../lib/edition/eventBadges";
import { resolveListingActionsForEvent } from "../../lib/edition/actionBar";
import { resolveEventCategoryIcon } from "../../lib/edition/categoryIcon";
import { EventInfoBadgeRow } from "../../components/EventInfoBadgeRow";
import { ArticleActionList } from "../../components/ArticleActionList";
import { DetailHeroCard, DetailAboutCard } from "../../components/DetailHeroCard";
import { DETAIL_HERO_ACCENTS, detailTint } from "../../lib/edition/detailHero";
import { PullDownNavHeader } from "../../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../../lib/navigation/articleBackLayout";
import { paper, press } from "../../lib/edition/newspaperTheme";

/**
 * Full Local Event page — typography-first listing, logistics clear.
 */
export default function EventDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
  const listingActions = event ? resolveListingActionsForEvent(event) : [];
  const heroEmoji = event
    ? event.categoryIcon ??
      resolveEventCategoryIcon({
        name: event.name,
        venue: event.venue,
        category: event.category,
      })
    : "🎉";
  // "About this event" summary — why someone would want to attend. Prefer the
  // generated editorial summary, then Bandit's invitation. Never the bare
  // venue/location (that already appears in the details below).
  const aboutSummary = event
    ? event.editorialBody?.find((p) => p?.trim())?.trim() ??
      event.banditNote?.trim() ??
      null
    : null;

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <Pressable onPress={() => router.back()} style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}>
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
          style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}
          accessibilityRole="button"
          accessibilityLabel={back.replace(/^←\s*/, "Back to ")}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>

        <View style={styles.body}>
          <DetailHeroCard
            emoji={heroEmoji}
            title={event.name}
            categoryLabel="Event"
            accent={DETAIL_HERO_ACCENTS.event}
            style={styles.hero}
          />

          {badge ? (
            <Text style={styles.badge} maxFontSizeMultiplier={1.2}>
              {badge}
            </Text>
          ) : null}

          <EventInfoBadgeRow badges={infoBadges} style={styles.badgeRow} />

          <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
            {[event.date, event.time].filter(Boolean).join(" · ")}
          </Text>
          <Text style={styles.place} maxFontSizeMultiplier={1.2}>
            {place}
          </Text>

          {aboutSummary ? (
            <DetailAboutCard
              label="About this event"
              body={aboutSummary}
              tint={detailTint(DETAIL_HERO_ACCENTS.event)}
              style={styles.aboutCard}
            />
          ) : null}

          {listingActions.length > 0 ? (
            <ArticleActionList actions={listingActions} />
          ) : null}

          {event.sourceName ? (
            <Text style={styles.source} maxFontSizeMultiplier={1.15}>
              Listed via {event.sourceName}
            </Text>
          ) : null}

          {event.sourceUrl && listingActions.length === 0 ? (
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
    paddingBottom: 14,
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
    paddingTop: 8,
  },
  hero: {
    marginBottom: 20,
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
  aboutCard: {
    marginBottom: 24,
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
