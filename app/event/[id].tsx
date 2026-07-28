import { useMemo } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getStashedEvent } from "../../lib/edition/eventStore";
import { buildEventHighlights } from "../../lib/edition/eventHighlights";
import { ShareIconButton } from "../../components/ShareIconButton";
import {
  resolveListingActionsForEvent,
  resolveListingSecondaryButton,
} from "../../lib/edition/actionBar";
import {
  GOOGLE_MAPS_ACTION_LABEL,
  openGoogleMapsDestination,
} from "../../lib/edition/googleMaps";
import { resolveEventCategoryIcon } from "../../lib/edition/categoryIcon";
import { DetailHeroCard, DetailAboutCard } from "../../components/DetailHeroCard";
import {
  DetailActionButton,
  DetailActionStack,
} from "../../components/DetailActionButton";
import {
  DETAIL_HERO_ACCENTS,
  detailTint,
  toAboutParagraphs,
  toKnownForBlurb,
} from "../../lib/edition/detailHero";
import { PullDownNavHeader } from "../../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../../lib/navigation/usePullDownNavScreen";
import { articleBackRowInsets } from "../../lib/navigation/articleBackLayout";
import { paper, press } from "../../lib/edition/newspaperTheme";

/**
 * Full Local Event page — a Quick Overview decision page. Hero, quick actions,
 * and one overview card with the facts and a verified "Known for" line.
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
      : "← Back to Homepage";

  function handleBack() {
    router.back();
  }

  function shareEvent() {
    if (!event) return;
    const parts = [event.name];
    if (event.venue?.trim()) parts.push(event.venue.trim());
    parts.push("", event.sourceUrl || "From today’s Kindred edition");
    void Share.share({ message: parts.join("\n"), title: event.name }).catch(
      () => {}
    );
  }

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: handleBack,
    backLabel: back,
    itemTitle: event?.name ?? null,
    fallbackTitle: "Local Events",
    backAccessibilityLabel: back.replace(/^←\s*/, "Back to "),
  });

  const listingActions = event ? resolveListingActionsForEvent(event) : [];
  const mapsAction = listingActions.find((a) => a.id === "maps") ?? null;
  const secondaryButton = event
    ? resolveListingSecondaryButton("event", listingActions)
    : null;
  const heroEmoji = event
    ? event.categoryIcon ??
      resolveEventCategoryIcon({
        name: event.name,
        venue: event.venue,
        category: event.category,
      })
    : "🎉";
  // Quick Overview card: a "Name • City" title, date · time, a short factual
  // description, and a verified editorial "Known for" line (why go).
  const overviewTitle = event
    ? [event.name, event.city?.trim()].filter(Boolean).join(" • ")
    : "";
  const whenLine = event
    ? [event.date, event.time].filter(Boolean).join(" · ")
    : "";
  // "Why you'll love it" — an editorial recommendation (why choose this event),
  // sourced only from Kindred's genuine editorial voice, the Bandit's Note. Never
  // a category chip, provider blurb, or listing text, and never invented; omitted
  // entirely when there is no editorial line to stand behind.
  const overviewKnownFor = event
    ? toKnownForBlurb(event.banditNote?.trim() ?? null)
    : null;
  // "Why you'll love it" highlights — 2–4 short, benefit-first lines derived
  // ONLY from verified structured signals (provider badges + inferred category).
  // Never invented, and never the venue, address, or date. Falls back to the
  // editorial "why go" blurb when there aren't enough verified signals.
  const overviewHighlights = event ? buildEventHighlights(event) : [];
  // ABOUT — one or two concise editorial paragraphs (Editorial Constitution V2),
  // from Kindred's own editorial body. Deduped against the "Why you'll love it"
  // line so the card never repeats itself.
  const overviewParagraphs = event
    ? toAboutParagraphs(
        event.editorialBody && event.editorialBody.length > 0
          ? event.editorialBody
          : event.banditNote?.trim() || null,
        { maxParagraphs: 2, maxWordsEach: 55, avoid: overviewKnownFor }
      )
    : [];

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <Pressable onPress={() => router.back()} style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}>
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <Text style={styles.missing}>This event is no longer available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
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

          {/* Like / Share — same row and placement as every detail page. */}
          <View style={styles.iconRow}>
            <ShareIconButton onPress={shareEvent} style={styles.iconButton} />
          </View>

          {/* Google Maps + section action — standardized stacked buttons. */}
          {mapsAction || secondaryButton ? (
            <DetailActionStack style={styles.actions}>
              {mapsAction ? (
                <DetailActionButton
                  label={GOOGLE_MAPS_ACTION_LABEL}
                  variant="secondary"
                  accessibilityRole="link"
                  accessibilityLabel={GOOGLE_MAPS_ACTION_LABEL}
                  onPress={() => {
                    if (mapsAction.mapsDestination) {
                      void openGoogleMapsDestination(mapsAction.mapsDestination);
                    } else if (mapsAction.url) {
                      void Linking.openURL(mapsAction.url).catch(() => {});
                    }
                  }}
                />
              ) : null}
              {secondaryButton ? (
                <DetailActionButton
                  label={secondaryButton.label}
                  variant={secondaryButton.variant}
                  accessibilityRole="link"
                  accessibilityLabel={secondaryButton.label}
                  onPress={() =>
                    void Linking.openURL(secondaryButton.url).catch(() => {})
                  }
                />
              ) : null}
            </DetailActionStack>
          ) : null}

          {/* Quick Overview — name • city, date · time, description, known for */}
          <DetailAboutCard
            label="About this event"
            title={overviewTitle}
            meta={whenLine}
            body={overviewParagraphs.length ? overviewParagraphs : undefined}
            highlights={
              overviewHighlights.length >= 2 ? overviewHighlights : undefined
            }
            knownFor={
              overviewHighlights.length >= 2
                ? undefined
                : overviewKnownFor ?? undefined
            }
            tint={detailTint(DETAIL_HERO_ACCENTS.event)}
            style={styles.aboutCard}
          />

          {/* Footer — Source → Return → one-line disclaimer. Nothing else. */}
          <View style={styles.footer}>
            {event.sourceName?.trim() ? (
              <View style={styles.sourceBlock}>
                <Text style={styles.sourceLabel}>SOURCE</Text>
                <Text style={styles.sourceName} maxFontSizeMultiplier={1.2}>
                  {event.sourceName.trim()}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={handleBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back to Homepage"
              style={({ pressed }) => [pressed && { opacity: press.opacity }]}
            >
              <Text style={styles.returnLink}>← Back to Homepage</Text>
            </Pressable>
            <Text style={styles.disclaimer} maxFontSizeMultiplier={1.25}>
              Kindred summarizes trusted listings for quick local discovery. This
              is not the publisher’s full listing.
            </Text>
          </View>
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
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginBottom: 22,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  actions: {
    marginBottom: 4,
  },
  aboutCard: {
    marginTop: 20,
    marginBottom: 24,
  },
  footer: {
    marginTop: 4,
  },
  sourceBlock: {
    marginBottom: 20,
  },
  sourceLabel: {
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: "700",
    color: paper.inkFaint,
    marginBottom: 6,
  },
  sourceName: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkBody,
  },
  returnLink: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
    paddingVertical: 10,
  },
  disclaimer: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginTop: 8,
    maxWidth: 420,
  },
});
