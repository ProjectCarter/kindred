import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
  AccessibilityInfo,
  type ImageSourcePropType,
} from "react-native";
import {
  selectHeroImage,
  loadRecentHeroImageIds,
  rememberHeroImageShown,
  type HeroImageContext,
  type HeroImageAsset,
} from "../lib/edition/HeroImageService";
import { motion, paper, shadow } from "../lib/edition/newspaperTheme";

export type MorningHeroImageProps = {
  source?: ImageSourcePropType | null;
  uri?: string | null;
  context?: HeroImageContext;
  accessibilityLabel?: string;
};

/**
 * Full-width morning hero with location-aware editorial photography.
 * Soft settle — photograph arrives like ink on the page.
 */
export function MorningHeroImage({
  source,
  uri,
  context,
  accessibilityLabel,
}: MorningHeroImageProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.max(windowWidth - 32, 280);
  const height = Math.round(width * (3 / 4));

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.01)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);

  const [selected, setSelected] = useState<HeroImageAsset | null>(() => {
    try {
      return selectHeroImage(context ?? {});
    } catch {
      return null;
    }
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function choose() {
      try {
        const recentImageIds = await loadRecentHeroImageIds();
        const next = selectHeroImage({
          ...(context ?? {}),
          recentImageIds,
        });
        if (cancelled) return;
        setSelected(next);
        if (next?.id) {
          await rememberHeroImageShown(next.id);
        }
      } catch {
        if (!cancelled) {
          setSelected(selectHeroImage(context ?? {}));
        }
      }
    }

    if (!uri && !source) {
      choose();
    }

    return () => {
      cancelled = true;
    };
  }, [
    uri,
    source,
    context?.date,
    context?.weatherText,
    context?.weather,
    context?.birthdayMMDD,
    context?.location?.city,
    context?.location?.metro,
    context?.location?.region,
  ]);

  const resolvedSource: ImageSourcePropType | null =
    uri && !remoteFailed
      ? { uri }
      : !uri
        ? source ?? selected?.source ?? null
        : source ?? selected?.source ?? null;

  useEffect(() => {
    setRemoteFailed(false);
  }, [uri]);

  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      scale.setValue(1);
      return;
    }
    fade.setValue(0);
    scale.setValue(1.01);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.photoMs,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: motion.photoMs + 80,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [resolvedSource, fade, scale, reduceMotion]);

  const label =
    accessibilityLabel ??
    (selected ? selected.title : "Morning edition photograph");

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          opacity: fade,
          transform: [{ scale }],
        },
      ]}
    >
      <View
        style={[styles.frame, shadow.photo, { width, height }]}
        accessibilityRole="image"
        accessibilityLabel={label}
      >
        {resolvedSource ? (
          <Image
            source={resolvedSource}
            style={styles.image}
            resizeMode="cover"
            accessible={false}
            onError={() => {
              if (uri) setRemoteFailed(true);
            }}
          />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.placeholderWash} />
            <View style={styles.placeholderRule} />
            <Text style={styles.placeholderTitle}>Today’s photograph</Text>
            <Text style={styles.placeholderCaption}>
              The morning photograph will settle here
            </Text>
            <View
              style={[styles.placeholderRule, styles.placeholderRuleBottom]}
            />
          </View>
        )}
      </View>
      {selected?.title ? (
        <Text style={[styles.caption, { width }]} maxFontSizeMultiplier={1.25}>
          {selected.title}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    marginBottom: 44,
  },
  frame: {
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  image: {
    width: "100%",
    height: "116%",
    marginTop: "-7%",
  },
  caption: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
    color: paper.inkFaint,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: paper.creamDeep,
  },
  placeholderWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: paper.cream,
    opacity: 0.45,
  },
  placeholderRule: {
    width: 40,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkMuted,
    marginBottom: 16,
    opacity: 0.35,
  },
  placeholderRuleBottom: {
    marginTop: 16,
    marginBottom: 0,
  },
  placeholderTitle: {
    fontFamily: "Georgia",
    fontSize: 17,
    fontWeight: "600",
    color: paper.inkMuted,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  placeholderCaption: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.2,
    color: paper.inkFaint,
    textAlign: "center",
    maxWidth: 240,
    fontStyle: "italic",
  },
});
