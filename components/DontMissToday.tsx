import { useEffect, useRef, useState } from "react";
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
import type { LocalEventCard } from "../lib/edition/localEvents";
import {
  selectHeroImage,
  loadRecentHeroImageIds,
  rememberHeroImageShown,
  type HeroImageContext,
  type HeroImageAsset,
} from "../lib/edition/HeroImageService";
import { motion, paper, press } from "../lib/edition/newspaperTheme";

/** Matches home folio gutter — feature photo bleeds like the cover. */
const FOLIO_GUTTER = 28;

type Props = {
  events: LocalEventCard[];
  heroContext?: HeroImageContext | null;
  excludeHeroIds?: string[];
};

/**
 * Don’t Miss Today — rebuilt from stop-scroll principles:
 * TIME: one story owns the scale.
 * Apple: photograph + restrained type; nothing else competes.
 * Airbnb: the image creates desire; text only names the feeling.
 */
export function DontMissToday({
  events,
  heroContext,
  excludeHeroIds = [],
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  /** Full-bleed monopoly — same width language as the cover hero. */
  const photoWidth = windowWidth;
  const photoHeight = Math.round(Math.min(windowWidth * 1.05, 460));

  const featured = events[0] ?? null;
  const secondary = events.slice(1, 3);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [featureImage, setFeatureImage] = useState<HeroImageAsset | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(6)).current;
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
        const excluded = new Set([...excludeHeroIds, ...recent]);
        const next = selectHeroImage({
          ...(heroContext ?? {}),
          recentImageIds: [...excluded],
        });
        if (cancelled) return;
        setFeatureImage(next);
        if (next?.id && !excluded.has(next.id)) {
          await rememberHeroImageShown(next.id);
        }
      } catch {
        if (!cancelled) {
          setFeatureImage(selectHeroImage(heroContext ?? {}));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    featured?.name,
    heroContext?.date,
    heroContext?.location?.city,
    excludeHeroIds.join("|"),
  ]);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      rise.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 680,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, opacity, rise, featured?.name]);

  useEffect(() => {
    if (!featureImage) return;
    if (reduceMotion) {
      photoOp.setValue(1);
      return;
    }
    photoOp.setValue(0);
    Animated.timing(photoOp, {
      toValue: 1,
      duration: motion.photoMs + 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [featureImage?.id, reduceMotion, photoOp]);

  if (!featured) {
    return (
      <View style={styles.section}>
        <Text style={styles.kicker}>Don’t miss today</Text>
        <Text style={styles.empty} maxFontSizeMultiplier={1.3}>
          A quiet day nearby — perfect for a slow walk and something warm.
        </Text>
      </View>
    );
  }

  const meta = whisperMeta(featured);
  const open = featured.sourceUrl
    ? () => {
        void Linking.openURL(featured.sourceUrl).catch(() => {});
      }
    : undefined;

  return (
    <Animated.View
      style={[
        styles.section,
        { opacity, transform: [{ translateY: rise }] },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`Don’t miss today: ${featured.name}`}
    >
      <Text style={styles.kicker}>Don’t miss today</Text>

      <Pressable
        onPress={open}
        disabled={!open}
        accessibilityRole={open ? "link" : "text"}
        accessibilityLabel={[featured.name, meta].filter(Boolean).join(". ")}
        style={({ pressed }) => [open && pressed && styles.pressed]}
      >
        {/* Scale monopoly — the photograph is the product */}
        {featureImage ? (
          <Animated.View
            style={[
              styles.photoBleed,
              {
                width: photoWidth,
                marginLeft: -FOLIO_GUTTER,
                opacity: photoOp,
              },
            ]}
          >
            <Image
              source={featureImage.source}
              style={{ width: photoWidth, height: photoHeight }}
              resizeMode="cover"
              accessibilityLabel={
                featureImage.title || "A place worth going"
              }
            />
          </Animated.View>
        ) : (
          <View
            style={[
              styles.photoFallback,
              {
                width: photoWidth,
                marginLeft: -FOLIO_GUTTER,
                height: Math.round(photoHeight * 0.45),
              },
            ]}
          />
        )}

        {/* Apple restraint: name the desire, then stop talking */}
        <Text style={styles.headline} maxFontSizeMultiplier={1.2}>
          {featured.name}
        </Text>

        {/* TIME byline energy — logistics last, nearly invisible */}
        {meta ? (
          <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
            {meta}
          </Text>
        ) : null}

        {open ? (
          <Text style={styles.go} maxFontSizeMultiplier={1.15}>
            Go
          </Text>
        ) : null}
      </Pressable>

      {/* Air resolves the feature before anything else appears */}
      {secondary.length > 0 ? (
        <View style={styles.secondaryBlock}>
          <Text style={styles.secondaryKicker}>Also nearby</Text>
          {secondary.map((event, index) => (
            <SecondaryRecommendation
              key={`${event.name}-${event.date}-${index}`}
              event={event}
              isLast={index === secondary.length - 1}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

function SecondaryRecommendation({
  event,
  isLast,
}: {
  event: LocalEventCard;
  isLast: boolean;
}) {
  const meta = whisperMeta(event);
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
      accessibilityLabel={[event.name, meta].filter(Boolean).join(". ")}
      style={({ pressed }) => [
        styles.secondaryRow,
        !isLast && styles.secondaryRule,
        open && pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryHeadline} maxFontSizeMultiplier={1.25}>
        {event.name}
      </Text>
      {meta ? (
        <Text style={styles.secondaryMeta} maxFontSizeMultiplier={1.15}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** One whisper line — never a calendar stack. */
function whisperMeta(event: LocalEventCard): string {
  const when = [event.date, event.time].filter(Boolean).join(" · ");
  const where = [event.venue, event.city].filter(Boolean).join(", ");
  return [when, where].filter(Boolean).join("  ·  ");
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 20,
  },
  photoBleed: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    marginBottom: 32,
  },
  photoFallback: {
    backgroundColor: paper.chrome,
    marginBottom: 32,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "600",
    letterSpacing: -0.55,
    color: paper.ink,
    marginBottom: 16,
    maxWidth: 520,
    paddingRight: 8,
  },
  meta: {
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: paper.inkFaint,
    maxWidth: 400,
  },
  go: {
    marginTop: 28,
    fontFamily: "Georgia",
    fontSize: 17,
    fontStyle: "italic",
    color: paper.terracotta,
    letterSpacing: 0.15,
  },
  empty: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 32,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 400,
  },
  /** Enough air that the featured pick emotionally resolves first. */
  secondaryBlock: {
    marginTop: 72,
    paddingTop: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
  },
  secondaryKicker: {
    fontSize: 10,
    letterSpacing: 2.4,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 20,
  },
  secondaryRow: {
    paddingVertical: 18,
  },
  secondaryRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  secondaryHeadline: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.15,
    color: paper.ink,
    marginBottom: 6,
  },
  secondaryMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkFaint,
  },
  pressed: {
    opacity: press.opacity,
  },
});
