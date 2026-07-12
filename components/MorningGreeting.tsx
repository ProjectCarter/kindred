import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { motion, paper, space, type } from "../lib/edition/newspaperTheme";
import { MorningBriefing as MorningBriefingBlock } from "./MorningBriefing";
import { KindredFullMasthead } from "./KindredMasthead";

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
  /** When false, parent owns the collapsing masthead. */
  showNameplate?: boolean;
  mastheadLeading?: ReactNode;
  mastheadTrailing?: ReactNode;
  /** Drives calm fade as the sticky compact masthead takes over. */
  mastheadScrollY?: Animated.Value;
};

function resolveDisplayDate(editionDate?: string | null): string {
  if (editionDate) return formatEditionDate(editionDate);
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function weatherSummary(weatherText?: string | null): string | null {
  if (!weatherText?.trim()) return null;
  // Keep masthead weather to one calm line.
  const first = weatherText.trim().split(/\n/)[0]?.trim() ?? "";
  if (first.length <= 72) return first;
  return `${first.slice(0, 69).trim()}…`;
}

/**
 * Kindred’s signature opening —
 * nameplate, date, greeting, Bandit the editor, briefing.
 * The morning photograph follows the Lead so the cover story owns the first scroll.
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
  showNameplate = true,
  mastheadLeading,
  mastheadTrailing,
  mastheadScrollY,
}: Props) {
  const dateLabel = resolveDisplayDate(editionDate);
  const weatherLine = weatherSummary(weatherText);
  const welcome = welcomeMessage?.trim() || null;
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
    Animated.stagger(100, [
      Animated.timing(mastheadOp, {
        toValue: 1,
        duration: 480,
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
        Animated.delay(140),
        Animated.parallel([
          Animated.timing(banditOp, {
            toValue: 1,
            duration: 640,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(banditY, {
            toValue: 0,
            duration: 680,
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
      {showNameplate ? (
        <Animated.View style={{ opacity: mastheadOp }}>
          <KindredFullMasthead
            dateLabel={dateLabel}
            weatherLine={weatherLine}
            leading={mastheadLeading}
            trailing={mastheadTrailing}
            scrollY={mastheadScrollY}
          />
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.greetBlock,
          {
            opacity: greetOp,
            transform: [{ translateY: greetY }],
          },
        ]}
      >
        <Text style={styles.goodMorning} maxFontSizeMultiplier={1.35}>
          {salutation}
        </Text>
        {welcome ? (
          <Text style={styles.welcome} maxFontSizeMultiplier={1.35}>
            {welcome}
          </Text>
        ) : null}
      </Animated.View>

      {banditReady ? (
        <Animated.View
          style={[
            styles.banditReserve,
            {
              opacity: banditOp,
              transform: [{ translateY: banditY }],
            },
          ]}
          accessible
          accessibilityLabel={`Bandit, your editor. ${banditLine}`}
        >
          <Text style={styles.banditLabel}>From the editor</Text>
          <Text style={styles.banditText} maxFontSizeMultiplier={1.35}>
            {banditLine}
          </Text>
          <Text style={styles.banditSign} maxFontSizeMultiplier={1.2}>
            — Bandit
          </Text>
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
      ) : null}

      <MorningBriefingBlock
        opening={morningOpening}
        briefing={morningBriefing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  goodMorning: {
    fontFamily: "Georgia",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "600",
    letterSpacing: -0.15,
    color: paper.ink,
    marginBottom: 8,
  },
  welcome: {
    ...type.dek,
    color: paper.inkBody,
    marginBottom: 0,
    maxWidth: 520,
  },
  greetBlock: {
    marginBottom: 18,
  },
  banditReserve: {
    marginTop: 0,
    marginBottom: space.afterBandit,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  banditLabel: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    fontWeight: "600",
    color: paper.terracotta,
    marginBottom: 10,
  },
  banditText: {
    ...type.bandit,
    color: paper.ink,
  },
  banditSign: {
    marginTop: 10,
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkMuted,
    letterSpacing: 0.15,
  },
  banditAside: {
    marginTop: 12,
    fontFamily: "Georgia",
    fontSize: 14,
    lineHeight: 22,
    color: paper.inkMuted,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  memoryBlock: {
    marginTop: 12,
    paddingTop: 12,
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
