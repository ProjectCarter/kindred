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
import { motion, paper, press, shadow } from "../lib/edition/newspaperTheme";

type Props = {
  events: LocalEventCard[];
  /** Prefer a different photograph from the morning cover when possible. */
  heroContext?: HeroImageContext | null;
  /** Image ids already shown above (cover) so we pick a fresh supporting frame. */
  excludeHeroIds?: string[];
};

/**
 * Don’t Miss Today — editorial recommendation, not a calendar.
 * TIME / Monocle / Airbnb craft: desire first, details last.
 */
export function DontMissToday({
  events,
  heroContext,
  excludeHeroIds = [],
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const featureWidth = Math.max(windowWidth - 56, 280);
  const featureHeight = Math.round(featureWidth * 0.72);

  const featured = events[0] ?? null;
  const secondary = events.slice(1, 4);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [featureImage, setFeatureImage] = useState<HeroImageAsset | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
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
        duration: 580,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 620,
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
      duration: motion.photoMs,
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

  const when = formatWhen(featured);
  const where = formatWhere(featured);
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

      {/* Featured recommendation — desire before details */}
      <Pressable
        onPress={open}
        disabled={!open}
        accessibilityRole={open ? "link" : "text"}
        accessibilityLabel={[featured.name, when, where]
          .filter(Boolean)
          .join(". ")}
        style={({ pressed }) => [open && pressed && styles.pressed]}
      >
        {featureImage ? (
          <Animated.View
            style={[
              styles.featurePhoto,
              { width: featureWidth, opacity: photoOp },
              shadow.photo,
            ]}
          >
            <Image
              source={featureImage.source}
              style={{ width: featureWidth, height: featureHeight }}
              resizeMode="cover"
              accessibilityLabel={
                featureImage.title || "A scene from near you"
              }
            />
          </Animated.View>
        ) : null}

        <Text style={styles.featureHeadline} maxFontSizeMultiplier={1.25}>
          {featured.name}
        </Text>

        <Text style={styles.featureInvite} maxFontSizeMultiplier={1.3}>
          {inviteLine(featured)}
        </Text>

        {(when || where) && (
          <Text style={styles.featureMeta} maxFontSizeMultiplier={1.2}>
            {[when, where].filter(Boolean).join("  ·  ")}
          </Text>
        )}

        {open ? (
          <Text style={styles.featureCue} maxFontSizeMultiplier={1.15}>
            Make plans
          </Text>
        ) : null}
      </Pressable>

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
  const when = formatWhen(event);
  const where = formatWhere(event);
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
        styles.secondaryRow,
        !isLast && styles.secondaryRule,
        open && pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryHeadline} maxFontSizeMultiplier={1.3}>
        {event.name}
      </Text>
      <Text style={styles.secondaryMeta} maxFontSizeMultiplier={1.2}>
        {[when, where].filter(Boolean).join("  ·  ")}
      </Text>
    </Pressable>
  );
}

function formatWhen(event: LocalEventCard): string {
  return [event.date, event.time].filter(Boolean).join(" · ");
}

function formatWhere(event: LocalEventCard): string {
  return [event.venue, event.city].filter(Boolean).join(", ");
}

/** Soft magazine dek — invitation, not a calendar row. */
function inviteLine(event: LocalEventCard): string {
  const place = event.venue?.trim() || event.city?.trim();
  if (place) {
    return `Worth crossing town for — ${place}.`;
  }
  return "One local moment worth making room for.";
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 8,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.8,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 22,
  },
  featurePhoto: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    marginBottom: 28,
  },
  featureHeadline: {
    fontFamily: "Georgia",
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: paper.ink,
    marginBottom: 14,
    maxWidth: 480,
  },
  featureInvite: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 28,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginBottom: 20,
    maxWidth: 420,
  },
  featureMeta: {
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.3,
    color: paper.inkFaint,
    marginBottom: 4,
  },
  featureCue: {
    marginTop: 22,
    fontFamily: "Georgia",
    fontSize: 16,
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
  secondaryBlock: {
    marginTop: 48,
    paddingTop: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.border,
  },
  secondaryKicker: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 18,
  },
  secondaryRow: {
    paddingVertical: 16,
  },
  secondaryRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  secondaryHeadline: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: paper.ink,
    marginBottom: 6,
  },
  secondaryMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkMuted,
  },
  pressed: {
    opacity: press.opacity,
  },
});
