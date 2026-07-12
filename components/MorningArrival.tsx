import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { formatEditionDate } from "../lib/edition/types";
import { parseLocalEventsBody } from "../lib/edition/localEvents";
import {
  selectHeroImage,
  loadRecentHeroImageIds,
  rememberHeroImageShown,
  type HeroImageContext,
  type HeroImageAsset,
} from "../lib/edition/HeroImageService";
import {
  KindredFullMasthead,
  mastheadCollapse,
} from "./KindredMasthead";
import { DontMissToday } from "./DontMissToday";
import { paper, shadow } from "../lib/edition/newspaperTheme";

/** Side inset used by home folio — arrival bleeds past it for a cover photo. */
const FOLIO_GUTTER = 28;

type Props = {
  editionDate?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationState?: string | null;
  weatherHeadline?: string | null;
  weatherBody?: string | null;
  eventsBody?: string | null;
  heroContext?: HeroImageContext | null;
  mastheadTrailing?: ReactNode;
  mastheadScrollY?: Animated.Value;
};

/**
 * Kindred home arrival — complete reconstruction.
 * Sunday magazine cover: collapsing masthead, one hero, one Don’t Miss.
 * Nothing else competes.
 */
export function MorningArrival({
  editionDate,
  locationCity,
  locationRegion,
  locationState,
  weatherHeadline,
  weatherBody,
  eventsBody,
  heroContext,
  mastheadTrailing,
  mastheadScrollY,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const bleedWidth = windowWidth;
  const heroHeight = Math.round(Math.min(windowWidth * 0.92, 420));

  const dateLabel = resolveDisplayDate(editionDate);
  const placeLabel = formatPlace(locationCity);
  const weatherLine = usefulWeather(weatherHeadline, weatherBody);
  const events = (eventsBody ? parseLocalEventsBody(eventsBody) : null) ?? [];

  const fallbackScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = mastheadScrollY ?? fallbackScrollY;
  const collapse = mastheadCollapse(scrollY);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [hero, setHero] = useState<HeroImageAsset | null>(null);
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(8)).current;
  const photoOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setReduceMotion(Boolean(v))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recent = await loadRecentHeroImageIds();
        const next = selectHeroImage({
          ...(heroContext ?? {}),
          recentImageIds: recent,
        });
        if (cancelled) return;
        setHero(next);
        if (next?.id) await rememberHeroImageShown(next.id);
      } catch {
        if (!cancelled) setHero(selectHeroImage(heroContext ?? {}));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    heroContext?.date,
    heroContext?.weatherText,
    heroContext?.location?.city,
    heroContext?.birthdayMMDD,
  ]);

  useEffect(() => {
    if (reduceMotion) {
      enterOp.setValue(1);
      enterY.setValue(0);
      photoOp.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(enterOp, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, enterOp, enterY, photoOp]);

  useEffect(() => {
    if (!hero) return;
    if (reduceMotion) {
      photoOp.setValue(1);
      return;
    }
    photoOp.setValue(0);
    Animated.timing(photoOp, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hero?.id, reduceMotion, photoOp]);

  const placeWeather = [placeLabel, weatherLine].filter(Boolean).join("  ·  ");

  return (
    <View
      style={styles.wrap}
      accessibilityRole="header"
      accessibilityLabel={
        placeLabel
          ? `Kindred for ${placeLabel}. ${events[0]?.name ?? weatherLine ?? ""}`
          : "Kindred"
      }
    >
      {/* TIME / NYT confidence — full masthead collapses into sticky chrome */}
      <Animated.View
        style={{
          opacity: Animated.multiply(enterOp, collapse.fullOpacity),
          transform: [
            { translateY: Animated.add(enterY, collapse.fullTranslateY) },
          ],
        }}
      >
        <KindredFullMasthead
          eyebrow={null}
          dateLabel={dateLabel}
          meta={placeLabel}
          trailing={mastheadTrailing}
          style={styles.masthead}
        />
      </Animated.View>

      {/* Cover photograph */}
      <Animated.View
        style={[
          styles.heroBleed,
          {
            width: bleedWidth,
            marginLeft: -FOLIO_GUTTER,
            opacity: photoOp,
          },
        ]}
      >
        {hero ? (
          <View style={[styles.heroFrame, shadow.photo]}>
            <Image
              source={hero.source}
              style={{ width: bleedWidth, height: heroHeight }}
              resizeMode="cover"
              accessibilityLabel={
                placeLabel
                  ? `This morning in ${placeLabel}`
                  : "This morning near you"
              }
            />
            {placeWeather ? (
              <View style={styles.heroCaption} pointerEvents="none">
                <Text style={styles.heroCaptionText} numberOfLines={2}>
                  {placeWeather}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={[
              styles.heroFallback,
              { width: bleedWidth, height: Math.round(heroHeight * 0.55) },
            ]}
          >
            {placeWeather ? (
              <Text style={styles.heroFallbackText}>{placeWeather}</Text>
            ) : null}
          </View>
        )}
      </Animated.View>

      {/* Editorial recommendation — not a calendar */}
      <DontMissToday
        events={events}
        heroContext={heroContext}
        excludeHeroIds={hero?.id ? [hero.id] : []}
      />

      <View style={styles.endRule} accessibilityElementsHidden />
    </View>
  );
}

function resolveDisplayDate(editionDate?: string | null): string {
  if (editionDate) return formatEditionDate(editionDate);
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatPlace(city?: string | null): string | null {
  const c = city?.trim();
  return c || null;
}

function usefulWeather(
  headline?: string | null,
  body?: string | null
): string | null {
  const head = headline?.trim();
  if (head && head.length <= 72 && !/^weather$/i.test(head)) return head;
  const first = body?.trim().split(/\n/)[0]?.trim();
  if (!first) return head || null;
  if (first.length <= 72) return first;
  return `${first.slice(0, 69).trim()}…`;
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 56,
  },
  masthead: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 0,
  },
  heroBleed: {
    marginBottom: 36,
  },
  heroFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  heroCaption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: FOLIO_GUTTER,
    paddingVertical: 16,
    backgroundColor: "rgba(45, 41, 38, 0.28)",
  },
  heroCaptionText: {
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
    color: paper.page,
    letterSpacing: 0.15,
  },
  heroFallback: {
    backgroundColor: paper.chrome,
    justifyContent: "flex-end",
    paddingHorizontal: FOLIO_GUTTER,
    paddingBottom: 20,
  },
  heroFallbackText: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  endRule: {
    marginTop: 52,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.border,
  },
});
