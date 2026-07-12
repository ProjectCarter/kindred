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
import {
  splitFeaturedEvents,
  type LocalEventCard,
} from "../lib/edition/localEvents";
import { motion, paper, press } from "../lib/edition/newspaperTheme";

/** Matches home folio gutter — feature photo bleeds like the cover. */
const FOLIO_GUTTER = 28;

type Props = {
  events: LocalEventCard[];
};

/**
 * Don’t Miss Today — event photography only from edition data.
 * Never invents imagery via HeroImageService or weather stock.
 */
export function DontMissToday({ events }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const photoWidth = windowWidth;
  const photoHeight = Math.round(Math.min(windowWidth * 1.05, 460));

  const { featured, secondary } = splitFeaturedEvents(events);
  const eventPhotoUri = featured?.imageUrl?.trim() || null;

  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(6)).current;
  const photoOp = useRef(new Animated.Value(0)).current;

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
    opacity.setValue(0);
    rise.setValue(6);
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
    if (!eventPhotoUri) return;
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
  }, [eventPhotoUri, reduceMotion, photoOp]);

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
        accessibilityLabel={[featured.name, meta, open ? "See details" : null]
          .filter(Boolean)
          .join(". ")}
        style={({ pressed }) => [open && pressed && styles.pressed]}
      >
        {eventPhotoUri ? (
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
              source={{ uri: eventPhotoUri }}
              style={{ width: photoWidth, height: photoHeight }}
              resizeMode="cover"
              accessibilityLabel={featured.name}
            />
          </Animated.View>
        ) : null}

        <Text
          style={[styles.headline, !eventPhotoUri && styles.headlineNoPhoto]}
          maxFontSizeMultiplier={1.2}
        >
          {featured.name}
        </Text>

        {meta ? (
          <Text style={styles.meta} maxFontSizeMultiplier={1.15}>
            {meta}
          </Text>
        ) : null}

        {open ? (
          <Text style={styles.seeDetails} maxFontSizeMultiplier={1.15}>
            See details
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
  const meta = whisperMeta(event);
  const thumb = event.imageUrl?.trim() || null;
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
      accessibilityLabel={[event.name, meta, open ? "See details" : null]
        .filter(Boolean)
        .join(". ")}
      style={({ pressed }) => [
        styles.secondaryRow,
        !isLast && styles.secondaryRule,
        open && pressed && styles.pressed,
      ]}
    >
      <View style={styles.secondaryInner}>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.secondaryThumb}
            resizeMode="cover"
            accessibilityLabel={event.name}
          />
        ) : null}
        <View style={styles.secondaryCopy}>
          <Text style={styles.secondaryHeadline} maxFontSizeMultiplier={1.25}>
            {event.name}
          </Text>
          {meta ? (
            <Text style={styles.secondaryMeta} maxFontSizeMultiplier={1.15}>
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
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
  headlineNoPhoto: {
    marginTop: 4,
  },
  meta: {
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0.2,
    color: paper.inkFaint,
    maxWidth: 400,
  },
  seeDetails: {
    marginTop: 22,
    fontSize: 13,
    letterSpacing: 0.35,
    fontWeight: "500",
    color: paper.terracotta,
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
  secondaryInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  secondaryThumb: {
    width: 72,
    height: 72,
    backgroundColor: paper.creamDeep,
  },
  secondaryCopy: {
    flex: 1,
    minWidth: 0,
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
