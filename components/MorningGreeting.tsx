import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
} from "react-native";
import { formatEditionDate } from "../lib/edition/types";
import {
  BANDIT_GREETING_PLACEHOLDER,
  resolveBanditGreeting,
  type BanditGreetingContext,
} from "../lib/edition/bandit";
import { morningSalutation } from "../lib/edition/morningRitual";
import type { MorningBriefing } from "../lib/edition/morningEdition";
import type { HeroRegionId } from "../lib/edition/HeroImageService";
import { motion, paper, space, type } from "../lib/edition/newspaperTheme";
import {
  MorningHeroImage,
  type MorningHeroImageProps,
} from "./MorningHeroImage";
import { MorningBriefing as MorningBriefingBlock } from "./MorningBriefing";

type Props = {
  editionDate?: string | null;
  welcomeMessage?: string | null;
  banditGreeting?: string | null;
  banditContext?: BanditGreetingContext | null;
  banditAside?: string | null;
  memoryNote?: string | null;
  morningOpening?: MorningBriefing | null;
  morningBriefing?: MorningBriefing | null;
  weatherText?: string | null;
  locationCity?: string | null;
  locationMetro?: string | null;
  locationRegion?: HeroRegionId | null;
  locationState?: string | null;
  birthdayMMDD?: string | null;
  heroImageUri?: string | null;
  heroImageSource?: MorningHeroImageProps["source"];
};

const DEFAULT_WELCOME =
  "The desk is quiet. Your edition is ready when you are.";

function resolveDisplayDate(editionDate?: string | null): string {
  if (editionDate) return formatEditionDate(editionDate);
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Kindred’s signature morning opening —
 * masthead, greeting, Bandit, Morning Edition briefing, editorial photograph.
 */
export function MorningGreeting({
  editionDate,
  welcomeMessage,
  banditGreeting,
  banditContext,
  banditAside,
  memoryNote,
  morningOpening,
  morningBriefing,
  weatherText,
  locationCity,
  locationMetro,
  locationRegion,
  locationState,
  birthdayMMDD,
  heroImageUri,
  heroImageSource,
}: Props) {
  const dateLabel = resolveDisplayDate(editionDate);
  const welcome = welcomeMessage?.trim() || DEFAULT_WELCOME;
  const salutation = morningSalutation();

  const [banditLine, setBanditLine] = useState(
    banditGreeting?.trim() || BANDIT_GREETING_PLACEHOLDER
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  const mastheadOp = useRef(new Animated.Value(0)).current;
  const greetOp = useRef(new Animated.Value(0)).current;
  const greetY = useRef(new Animated.Value(motion.risePx)).current;
  const banditOp = useRef(new Animated.Value(0)).current;
  const banditY = useRef(new Animated.Value(motion.risePx)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) =>
      setReduceMotion(Boolean(v))
    );
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      mastheadOp.setValue(1);
      greetOp.setValue(1);
      greetY.setValue(0);
      return;
    }
    Animated.stagger(120, [
      Animated.timing(mastheadOp, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(greetOp, {
          toValue: 1,
          duration: motion.enterMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(greetY, {
          toValue: 0,
          duration: motion.enterMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [reduceMotion, mastheadOp, greetOp, greetY]);

  useEffect(() => {
    let cancelled = false;
    resolveBanditGreeting(banditGreeting, {
      editionDate,
      weatherText,
      ...banditContext,
    }).then((line) => {
      if (cancelled) return;
      setBanditLine(line);
      if (reduceMotion) {
        banditOp.setValue(1);
        banditY.setValue(0);
        return;
      }
      banditOp.setValue(0);
      banditY.setValue(motion.risePx);
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(banditOp, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(banditY, {
            toValue: 0,
            duration: 740,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
    return () => {
      cancelled = true;
    };
  }, [
    banditGreeting,
    banditContext?.firstName,
    banditContext?.hasLocalEvents,
    editionDate,
    weatherText,
    reduceMotion,
    banditOp,
    banditY,
  ]);

  const banditReady =
    Boolean(banditGreeting?.trim()) ||
    banditLine !== BANDIT_GREETING_PLACEHOLDER;

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Animated.Text
        style={[styles.masthead, { opacity: mastheadOp }]}
        maxFontSizeMultiplier={1.2}
      >
        Kindred
      </Animated.Text>

      <Animated.View
        style={{
          opacity: greetOp,
          transform: [{ translateY: greetY }],
        }}
      >
        <Text style={styles.goodMorning} maxFontSizeMultiplier={1.35}>
          {salutation}
        </Text>
        <Text style={styles.date} maxFontSizeMultiplier={1.3}>
          {dateLabel}
        </Text>
        <Text style={styles.welcome} maxFontSizeMultiplier={1.35}>
          {welcome}
        </Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.banditReserve,
          {
            opacity: banditOp,
            transform: [{ translateY: banditY }],
          },
        ]}
        accessible
        accessibilityLabel={
          banditReady
            ? `A note from Bandit, your editor. ${banditLine}`
            : "A note from Bandit, your editor"
        }
      >
        <Text style={styles.banditLabel}>A note from Bandit, your editor</Text>
        <Text
          style={[
            styles.banditText,
            !banditReady && styles.banditTextPlaceholder,
          ]}
          maxFontSizeMultiplier={1.35}
        >
          {banditLine}
        </Text>
        {banditReady ? (
          <Text style={styles.banditSign} maxFontSizeMultiplier={1.2}>
            — Bandit
          </Text>
        ) : null}
        {banditAside?.trim() ? (
          <Text style={styles.banditAside} maxFontSizeMultiplier={1.3}>
            {banditAside.trim()}
          </Text>
        ) : null}
        {memoryNote?.trim() ? (
          <View style={styles.memoryBlock} accessibilityRole="text">
            <Text style={styles.memoryKicker}>Since you last read</Text>
            <Text style={styles.memoryNote} maxFontSizeMultiplier={1.3}>
              {memoryNote.trim()}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <MorningBriefingBlock
        opening={morningOpening}
        briefing={morningBriefing}
      />

      <MorningHeroImage
        uri={heroImageUri}
        source={heroImageSource}
        context={{
          date: editionDate,
          weatherText,
          birthdayMMDD,
          location: {
            city: locationCity,
            metro: locationMetro,
            region: locationRegion,
            state: locationState,
          },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  masthead: {
    ...type.masthead,
    color: paper.ink,
    textAlign: "center",
    marginBottom: space.afterMasthead,
    textTransform: "uppercase",
  },
  goodMorning: {
    ...type.display,
    color: paper.ink,
    marginBottom: 8,
  },
  date: {
    fontFamily: "Georgia",
    fontSize: 14,
    letterSpacing: 0.35,
    color: paper.inkMuted,
    marginBottom: 18,
  },
  welcome: {
    ...type.dek,
    color: paper.inkBody,
    marginBottom: 28,
    maxWidth: 520,
  },
  banditReserve: {
    marginBottom: space.afterBandit,
    paddingTop: 24,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  banditLabel: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 12,
  },
  banditText: {
    ...type.bandit,
    color: paper.ink,
  },
  banditTextPlaceholder: {
    color: paper.inkFaint,
  },
  banditSign: {
    marginTop: 14,
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkMuted,
    letterSpacing: 0.15,
  },
  banditAside: {
    marginTop: 16,
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkMuted,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  memoryBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  memoryKicker: {
    ...type.kicker,
    color: paper.inkFaint,
    marginBottom: 8,
    letterSpacing: 1.6,
  },
  memoryNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
});
