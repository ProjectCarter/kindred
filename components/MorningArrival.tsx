import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { formatEditionDate } from "../lib/edition/types";
import {
  parseLocalEventsBody,
  type LocalEventCard,
} from "../lib/edition/localEvents";
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
import { motion, paper, press, shadow } from "../lib/edition/newspaperTheme";

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
  const lead = events[0] ?? null;

  const fallbackScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = mastheadScrollY ?? fallbackScrollY;
  const collapse = mastheadCollapse(scrollY);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [hero, setHero] = useState<HeroImageAsset | null>(null);
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(8)).current;
  const photoOp = useRef(new Animated.Value(0)).current;
  const storyOp = useRef(new Animated.Value(0)).current;
  const storyY = useRef(new Animated.Value(10)).current;

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
      storyOp.setValue(1);
      storyY.setValue(0);
      photoOp.setValue(1);
      return;
    }
    Animated.stagger(90, [
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
      ]),
      Animated.parallel([
        Animated.timing(storyOp, {
          toValue: 1,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(storyY, {
          toValue: 0,
          duration: 680,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reduceMotion, enterOp, enterY, storyOp, storyY, photoOp]);

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
          ? `Kindred for ${placeLabel}. ${lead?.name ?? weatherLine ?? ""}`
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

      {/* One dominant visual hero — full bleed, magazine cover */}
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

      {/* One Don’t Miss story — the cover feature */}
      <Animated.View
        style={[
          styles.coverStory,
          {
            opacity: storyOp,
            transform: [{ translateY: storyY }],
          },
        ]}
      >
        <Text style={styles.kicker}>Don’t miss today</Text>

        {lead ? (
          <CoverStory event={lead} />
        ) : (
          <Text style={styles.empty} maxFontSizeMultiplier={1.3}>
            A quiet day nearby — perfect for a slow walk and something warm.
          </Text>
        )}
      </Animated.View>

      <View style={styles.endRule} accessibilityElementsHidden />
    </View>
  );
}

function CoverStory({ event }: { event: LocalEventCard }) {
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
      style={({ pressed }) => [open && pressed && styles.pressed]}
    >
      <Text style={styles.coverHeadline} maxFontSizeMultiplier={1.25}>
        {event.name}
      </Text>
      {when ? (
        <Text style={styles.coverMeta} maxFontSizeMultiplier={1.2}>
          {when}
        </Text>
      ) : null}
      {where ? (
        <Text style={styles.coverWhere} maxFontSizeMultiplier={1.2}>
          {where}
        </Text>
      ) : null}
      {open ? (
        <Text style={styles.coverCue} maxFontSizeMultiplier={1.15}>
          See details
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
  coverStory: {
    paddingRight: 8,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.6,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 16,
  },
  coverHeadline: {
    fontFamily: "Georgia",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "600",
    letterSpacing: -0.45,
    color: paper.ink,
    marginBottom: 14,
    maxWidth: 520,
  },
  coverMeta: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 26,
    color: paper.inkMuted,
  },
  coverWhere: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkFaint,
    marginTop: 4,
  },
  coverCue: {
    marginTop: 18,
    fontFamily: "Georgia",
    fontSize: 15,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  empty: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 32,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 400,
  },
  endRule: {
    marginTop: 44,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.border,
  },
  pressed: {
    opacity: press.opacity,
  },
});
