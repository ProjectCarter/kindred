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
import {
  selectHeroImage,
  loadRecentHeroImageIds,
  rememberHeroImageShown,
  getHeroCatalog,
  type HeroImageContext,
  type HeroImageAsset,
} from "../lib/edition/HeroImageService";
import {
  getFrozenHeroImageId,
  setFrozenHeroImageId,
} from "../lib/edition/editionFreeze";
import type { MorningHeroExperience } from "../lib/edition/heroArtwork/types";
import { morningSalutation } from "../lib/edition/morningRitual";
import {
  KindredFullMasthead,
  mastheadCollapse,
} from "./KindredMasthead";
import { motion, paper, shadow } from "../lib/edition/newspaperTheme";

/** Side inset used by home folio — arrival bleeds past it for a cover photo. */
const FOLIO_GUTTER = 28;

type Props = {
  editionDate?: string | null;
  locationCity?: string | null;
  locationRegion?: string | null;
  locationState?: string | null;
  weatherHeadline?: string | null;
  weatherBody?: string | null;
  /** Bandit’s morning line — shown under weather/greeting. */
  banditGreeting?: string | null;
  /** Optional AI greeting / welcome line. */
  welcomeMessage?: string | null;
  /** Daily public-domain artwork hero — preferred over editorial photography. */
  morningHero?: MorningHeroExperience | null;
  heroContext?: HeroImageContext | null;
  mastheadTrailing?: ReactNode;
  mastheadScrollY?: Animated.Value;
};

/**
 * Kindred signature opening — TIME density below, Kindred hero first.
 * Hero → weather / greeting / Bandit. Local Events follows in the folio.
 */
export function MorningArrival({
  editionDate,
  locationCity,
  weatherHeadline,
  weatherBody,
  banditGreeting,
  welcomeMessage,
  morningHero,
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
  const salutation = morningSalutation();
  const welcome = welcomeMessage?.trim() || null;
  const bandit = banditGreeting?.trim() || null;

  const fallbackScrollY = useRef(new Animated.Value(0)).current;
  const scrollY = mastheadScrollY ?? fallbackScrollY;
  const collapse = mastheadCollapse(scrollY);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [hero, setHero] = useState<HeroImageAsset | null>(null);
  const [artworkFailed, setArtworkFailed] = useState(false);
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(8)).current;
  const photoOp = useRef(new Animated.Value(0)).current;
  const markOp = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setReduceMotion(Boolean(v))
    );
  }, []);

  // Editorial photography fallback — only when no artwork hero is available.
  useEffect(() => {
    if (morningHero?.imageUrl || morningHero?.hostedUrl) return;
    let cancelled = false;
    const editionKey = heroContext?.date ?? editionDate ?? null;

    (async () => {
      const frozenId = getFrozenHeroImageId();
      if (frozenId) {
        const hit = getHeroCatalog().find((asset) => asset.id === frozenId);
        if (hit && !cancelled) {
          setHero(hit);
          return;
        }
      }

      try {
        const recent = await loadRecentHeroImageIds();
        const next = selectHeroImage({
          ...(heroContext ?? {}),
          recentImageIds: recent,
        });
        if (cancelled) return;
        setHero(next);
        if (next?.id) {
          setFrozenHeroImageId(next.id);
          await rememberHeroImageShown(next.id);
        }
      } catch {
        if (!cancelled) {
          const fallback = selectHeroImage(heroContext ?? {});
          setHero(fallback);
          if (fallback?.id) setFrozenHeroImageId(fallback.id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- freeze hero per edition only
  }, [editionDate, heroContext?.date, morningHero?.artworkId]);

  useEffect(() => {
    setArtworkFailed(false);
  }, [morningHero?.artworkId, morningHero?.imageUrl, morningHero?.hostedUrl]);

  const artworkUri =
    !artworkFailed && (morningHero?.hostedUrl?.trim() || morningHero?.imageUrl?.trim())
      ? (morningHero.hostedUrl?.trim() || morningHero.imageUrl?.trim() || null)
      : null;
  const showArtworkHero = Boolean(artworkUri && morningHero);
  const showPhotoHero = !showArtworkHero && Boolean(hero);

  useEffect(() => {
    if (reduceMotion) {
      enterOp.setValue(1);
      enterY.setValue(0);
      return;
    }
    enterOp.setValue(0);
    enterY.setValue(8);
    Animated.parallel([
      Animated.timing(enterOp, {
        toValue: 1,
        duration: 720,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 780,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, enterOp, enterY, dateLabel]);

  useEffect(() => {
    if (reduceMotion) {
      markOp.setValue(0.7);
      return;
    }
    if (showArtworkHero || showPhotoHero) return;
    markOp.setValue(0.45);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(markOp, {
          toValue: 0.75,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(markOp, {
          toValue: 0.45,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [showArtworkHero, showPhotoHero, reduceMotion, markOp]);

  useEffect(() => {
    if (!showArtworkHero && !showPhotoHero) return;
    if (reduceMotion) {
      photoOp.setValue(1);
      return;
    }
    photoOp.setValue(0);
    Animated.timing(photoOp, {
      toValue: 1,
      duration: motion.photoMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [
    morningHero?.artworkId,
    hero?.id,
    showArtworkHero,
    showPhotoHero,
    reduceMotion,
    photoOp,
  ]);

  const artworkMeta = morningHero
    ? [
        morningHero.artworkTitle,
        morningHero.artist,
        morningHero.year,
        morningHero.sourceInstitution,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const placeWeather = [placeLabel, weatherLine].filter(Boolean).join("  ·  ");

  return (
    <Animated.View
      style={[
        styles.wrap,
        { opacity: enterOp, transform: [{ translateY: enterY }] },
      ]}
    >
      <Animated.View
        style={[
          styles.masthead,
          {
            opacity: Animated.multiply(enterOp, collapse.fullOpacity),
            transform: [
              { translateY: Animated.add(enterY, collapse.fullTranslateY) },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <KindredFullMasthead
          eyebrow={null}
          meta={[dateLabel, placeLabel].filter(Boolean).join("  ·  ")}
          trailing={mastheadTrailing}
        />
      </Animated.View>

      {/* Signature Kindred hero — artwork preferred; photography as fallback */}
      <View style={styles.heroBleed}>
        {showArtworkHero && artworkUri ? (
          <Animated.View style={{ opacity: photoOp }}>
            <View style={[styles.heroFrame, shadow.photo]}>
              <Image
                source={{ uri: artworkUri }}
                style={{ width: bleedWidth, height: heroHeight }}
                resizeMode="cover"
                accessibilityLabel={
                  morningHero?.artworkTitle
                    ? `${morningHero.artworkTitle} by ${morningHero.artist}`
                    : "Today's artwork"
                }
                onError={() => setArtworkFailed(true)}
              />
            </View>
            {artworkMeta ? (
              <Text style={styles.artworkMeta} maxFontSizeMultiplier={1.15}>
                {artworkMeta}
              </Text>
            ) : null}
            {morningHero?.aboutArtworkBody ? (
              <Text style={styles.artworkAbout} maxFontSizeMultiplier={1.2}>
                {morningHero.aboutArtworkBody}
              </Text>
            ) : null}
          </Animated.View>
        ) : showPhotoHero && hero ? (
          <Animated.View style={{ opacity: photoOp }}>
            <View style={[styles.heroFrame, shadow.photo]}>
              <Image
                source={hero.source}
                style={{ width: bleedWidth, height: heroHeight }}
                resizeMode="cover"
                accessibilityLabel={
                  hero.title?.trim()
                    ? hero.title
                    : placeWeather
                      ? placeWeather
                      : "This morning near you"
                }
              />
            </View>
          </Animated.View>
        ) : (
          <View
            style={[
              styles.heroFallback,
              { width: bleedWidth, height: Math.round(heroHeight * 0.55) },
            ]}
          >
            <Animated.Text style={[styles.heroMark, { opacity: markOp }]}>
              ◆
            </Animated.Text>
          </View>
        )}
      </View>

      {/* Immediately under hero: weather, greeting, Bandit */}
      <View style={styles.morningCopy}>
        {weatherLine ? (
          <Text style={styles.weather} maxFontSizeMultiplier={1.2}>
            {placeLabel ? `${placeLabel} · ${weatherLine}` : weatherLine}
          </Text>
        ) : placeLabel ? (
          <Text style={styles.weather} maxFontSizeMultiplier={1.2}>
            {placeLabel}
          </Text>
        ) : null}

        <Text style={styles.greeting} maxFontSizeMultiplier={1.25}>
          {welcome || salutation}
        </Text>

        {bandit ? (
          <Text style={styles.bandit} maxFontSizeMultiplier={1.2}>
            {bandit}
            <Text style={styles.banditSign}> — Bandit</Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.endRule} accessibilityElementsHidden />
    </Animated.View>
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
    marginBottom: 28,
  },
  masthead: {
    marginBottom: 16,
    paddingBottom: 12,
  },
  heroBleed: {
    marginHorizontal: -FOLIO_GUTTER,
    marginBottom: 22,
  },
  heroFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  artworkMeta: {
    marginTop: 14,
    paddingHorizontal: FOLIO_GUTTER,
    fontFamily: "Georgia",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
    color: paper.inkFaint,
    fontStyle: "italic",
  },
  artworkAbout: {
    marginTop: 12,
    paddingHorizontal: FOLIO_GUTTER,
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 26,
    color: paper.inkBody,
    maxWidth: 560,
  },
  heroFallback: {
    backgroundColor: paper.chrome,
    alignItems: "center",
    justifyContent: "center",
  },
  heroMark: {
    fontSize: 11,
    color: paper.terracotta,
    letterSpacing: 0,
  },
  morningCopy: {
    paddingRight: 8,
    marginBottom: 8,
  },
  weather: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.25,
    color: paper.inkMuted,
    marginBottom: 14,
  },
  greeting: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "600",
    letterSpacing: -0.35,
    color: paper.ink,
    marginBottom: 14,
    maxWidth: 520,
  },
  bandit: {
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkBody,
    maxWidth: 480,
  },
  banditSign: {
    fontStyle: "italic",
    color: paper.inkFaint,
  },
  endRule: {
    marginTop: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
});
