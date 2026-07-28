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
import { heroFrameHeight } from "../lib/edition/heroArtwork/imageSpec";
import { preloadMorningHeroImage } from "../lib/edition/heroArtwork/preload";
import { MasterpieceFeatureCard } from "./MasterpieceFeatureCard";
import {
  KindredFullMasthead,
  mastheadCollapse,
} from "./KindredMasthead";
import { HomepageWeatherLines } from "./HomepageWeatherLines";
import type { HomepageWeatherDisplay } from "../lib/weather/homepageWeatherDisplay";
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
  homepageWeather?: HomepageWeatherDisplay | null;
  /** Bandit’s morning line — shown under weather/greeting. */
  banditGreeting?: string | null;
  /** Optional AI greeting / welcome line. */
  welcomeMessage?: string | null;
  /** Daily public-domain artwork — Today's Masterpiece when hosted. */
  morningHero?: MorningHeroExperience | null;
  /** Future: open full artwork reader (history, biography, sharing). */
  onOpenMasterpiece?: () => void;
  heroContext?: HeroImageContext | null;
  mastheadTrailing?: ReactNode;
  mastheadScrollY?: Animated.Value;
};

/**
 * Kindred signature opening — TIME density below, Kindred hero first.
 * Masthead → weather / Bandit → Today's Masterpiece. Local Events follows in
 * the folio. (No greeting line — the homepage opens straight into the edition.)
 */
export function MorningArrival({
  editionDate,
  locationCity,
  weatherHeadline,
  weatherBody,
  homepageWeather,
  banditGreeting,
  welcomeMessage,
  morningHero,
  onOpenMasterpiece,
  heroContext,
  mastheadTrailing,
  mastheadScrollY,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const bleedWidth = windowWidth;
  const heroHeight = heroFrameHeight(
    bleedWidth,
    morningHero?.imageWidth,
    morningHero?.imageHeight,
    morningHero?.aspectRatio
  );

  const dateLabel = resolveDisplayDate(editionDate);
  const placeLabel = formatPlace(locationCity);
  const weatherLine = usefulWeather(weatherHeadline, weatherBody);
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

  useEffect(() => {
    preloadMorningHeroImage(morningHero);
  }, [morningHero?.hostedUrl, morningHero?.artworkId]);

  // Editorial photography fallback — only when no hosted artwork hero exists.
  useEffect(() => {
    if (morningHero?.hostedUrl) return;
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
  }, [morningHero?.artworkId, morningHero?.hostedUrl]);

  const artworkUri =
    !artworkFailed && morningHero?.hostedUrl?.trim()
      ? morningHero.hostedUrl.trim()
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
          nameplateText="D.R.O.P."
          meta={[dateLabel, placeLabel].filter(Boolean).join("  ·  ")}
          trailing={mastheadTrailing}
          dense
        />
      </Animated.View>

      {/* Compact weather, then Bandit — front-page morning flow (no greeting). */}
      <View style={styles.morningCopy}>
        {homepageWeather ? (
          <HomepageWeatherLines weather={homepageWeather} />
        ) : null}

        {bandit ? (
          <Text style={styles.bandit} maxFontSizeMultiplier={1.2}>
            {bandit}
            <Text style={styles.banditSign}> — Bandit</Text>
          </Text>
        ) : null}
      </View>

      {/* Today's Masterpiece — premium featured card; photography fallback below */}
      {showArtworkHero && artworkUri && morningHero ? (
        <Animated.View style={[styles.masterpieceCard, { opacity: photoOp }]}>
          <MasterpieceFeatureCard
            morningHero={morningHero}
            imageUri={artworkUri}
            onOpenMasterpiece={onOpenMasterpiece}
            onImageError={() => setArtworkFailed(true)}
          />
        </Animated.View>
      ) : showPhotoHero && hero ? (
        <View style={styles.heroBleed}>
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
        </View>
      ) : (
        <View style={styles.heroBleed}>
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
        </View>
      )}

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
    marginBottom: 10,
  },
  masthead: {
    marginBottom: 4,
    paddingBottom: 2,
  },
  heroBleed: {
    marginHorizontal: -FOLIO_GUTTER,
    marginBottom: 2,
  },
  masterpieceCard: {
    marginTop: 2,
    marginBottom: 6,
  },
  heroFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
  },
  heroFallback: {
    backgroundColor: paper.creamDeep,
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
    marginTop: 0,
    marginBottom: 2,
  },
  weather: {
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.25,
    color: paper.inkMuted,
    marginBottom: 10,
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
    marginTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
});
