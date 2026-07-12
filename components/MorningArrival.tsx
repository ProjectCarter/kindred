import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatEditionDate } from "../lib/edition/types";
import {
  parseLocalEventsBody,
  type LocalEventCard,
} from "../lib/edition/localEvents";
import { motion, paper, press, type } from "../lib/edition/newspaperTheme";
import { KindredFullMasthead } from "./KindredMasthead";

const DONT_MISS_COUNT = 3;

type Props = {
  editionDate?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationState?: string | null;
  weatherHeadline?: string | null;
  weatherBody?: string | null;
  eventsBody?: string | null;
  mastheadLeading?: ReactNode;
  mastheadTrailing?: ReactNode;
  mastheadScrollY?: Animated.Value;
};

/**
 * Kindred’s arrival — the first screen of the day.
 * Answers, within seconds: Where am I? What’s happening?
 * Can I go? What should I not miss?
 */
export function MorningArrival({
  editionDate,
  locationCity,
  locationRegion,
  locationState,
  weatherHeadline,
  weatherBody,
  eventsBody,
  mastheadLeading,
  mastheadTrailing,
  mastheadScrollY,
}: Props) {
  const dateLabel = resolveDisplayDate(editionDate);
  const placeLabel = formatPlace(
    locationCity,
    locationRegion,
    locationState
  );
  const weatherLine = usefulWeather(weatherHeadline, weatherBody);
  const events = (eventsBody ? parseLocalEventsBody(eventsBody) : null) ?? [];
  const dontMiss = events.slice(0, DONT_MISS_COUNT);

  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(motion.risePx)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setReduceMotion(Boolean(v))
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      rise.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, opacity, rise]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity, transform: [{ translateY: rise }] },
      ]}
      accessibilityRole="header"
      accessibilityLabel={
        placeLabel
          ? `Kindred for ${placeLabel}. ${weatherLine ?? ""}`
          : "Kindred"
      }
    >
      <KindredFullMasthead
        eyebrow={null}
        dateLabel={dateLabel}
        leading={mastheadLeading}
        trailing={mastheadTrailing}
        scrollY={mastheadScrollY}
        compact
        style={styles.masthead}
      />

      {placeLabel ? (
        <Text style={styles.place} maxFontSizeMultiplier={1.25}>
          {placeLabel}
        </Text>
      ) : (
        <Text style={styles.placeMuted} maxFontSizeMultiplier={1.25}>
          Your local day
        </Text>
      )}

      <Text style={styles.promise} maxFontSizeMultiplier={1.3}>
        What you shouldn’t miss today
      </Text>

      <View style={styles.rule} accessibilityElementsHidden />

      {/* Can I actually go? */}
      <View
        style={styles.weatherBlock}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          weatherLine ? `Weather. ${weatherLine}` : "Weather unavailable"
        }
      >
        <Text style={styles.kicker}>Outside</Text>
        <Text style={styles.weatherLine} maxFontSizeMultiplier={1.3}>
          {weatherLine ?? "Weather is on its way."}
        </Text>
      </View>

      <View style={styles.ruleSoft} accessibilityElementsHidden />

      {/* What’s happening / don’t miss */}
      <View style={styles.eventsBlock}>
        <Text style={styles.kicker}>Don’t miss</Text>

        {dontMiss.length > 0 ? (
          dontMiss.map((event, index) => (
            <ArrivalEventRow
              key={`${event.name}-${event.date}-${index}`}
              event={event}
              isLast={index === dontMiss.length - 1}
            />
          ))
        ) : (
          <Text style={styles.emptyEvents} maxFontSizeMultiplier={1.3}>
            A quiet day nearby — a good morning for something small.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

function ArrivalEventRow({
  event,
  isLast,
}: {
  event: LocalEventCard;
  isLast: boolean;
}) {
  const when = [event.date, event.time].filter(Boolean).join(" · ");
  const where = [event.venue, event.city].filter(Boolean).join(", ");
  const open = event.sourceUrl
    ? () => {
        void Linking.openURL(event.sourceUrl).catch(() => {});
      }
    : undefined;

  return (
    <Pressable
      onPress={open}
      disabled={!open}
      accessibilityRole={open ? "link" : "text"}
      accessibilityLabel={[event.name, when, where].filter(Boolean).join(". ")}
      style={({ pressed }) => [
        styles.eventRow,
        !isLast && styles.eventRowRule,
        open && pressed && styles.eventPressed,
      ]}
    >
      <Text style={styles.eventName} maxFontSizeMultiplier={1.35}>
        {event.name}
      </Text>
      {when ? (
        <Text style={styles.eventMeta} maxFontSizeMultiplier={1.25}>
          {when}
        </Text>
      ) : null}
      {where ? (
        <Text style={styles.eventWhere} maxFontSizeMultiplier={1.25}>
          {where}
        </Text>
      ) : null}
    </Pressable>
  );
}

function resolveDisplayDate(editionDate?: string | null): string {
  if (editionDate) return formatEditionDate(editionDate);
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatPlace(
  city?: string | null,
  region?: string | null,
  state?: string | null
): string | null {
  const c = city?.trim();
  if (!c) return null;
  const secondary = region?.trim() || state?.trim();
  if (secondary && secondary.toLowerCase() !== c.toLowerCase()) {
    return `${c} · ${secondary}`;
  }
  return c;
}

/** One calm, useful weather line — never an essay. */
function usefulWeather(
  headline?: string | null,
  body?: string | null
): string | null {
  const head = headline?.trim();
  if (head && head.length <= 88 && !/^weather$/i.test(head)) {
    return head;
  }
  const first = body?.trim().split(/\n/)[0]?.trim();
  if (!first) return head || null;
  if (first.length <= 96) return first;
  return `${first.slice(0, 93).trim()}…`;
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 36,
    paddingBottom: 8,
  },
  masthead: {
    marginBottom: 8,
    paddingBottom: 14,
    borderBottomWidth: 0,
  },
  place: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    textAlign: "center",
    marginBottom: 8,
  },
  placeMuted: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    textAlign: "center",
    marginBottom: 8,
  },
  promise: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
    color: paper.inkMuted,
    textAlign: "center",
    marginBottom: 18,
  },
  rule: {
    alignSelf: "center",
    width: 40,
    height: 1,
    backgroundColor: paper.terracotta,
    opacity: 0.5,
    marginBottom: 22,
  },
  ruleSoft: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginVertical: 20,
  },
  weatherBlock: {
    marginBottom: 4,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2,
    marginBottom: 10,
  },
  weatherLine: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    color: paper.ink,
    maxWidth: 420,
  },
  eventsBlock: {
    marginBottom: 4,
  },
  eventRow: {
    paddingVertical: 14,
  },
  eventRowRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  eventPressed: {
    opacity: press.opacity,
  },
  eventName: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: paper.ink,
    marginBottom: 4,
  },
  eventMeta: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    color: paper.inkMuted,
  },
  eventWhere: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: paper.inkFaint,
    marginTop: 2,
  },
  emptyEvents: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 360,
  },
});
