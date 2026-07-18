import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { kindredGold, paper } from "../lib/edition/newspaperTheme";
import { articleBackRowInsets } from "../lib/navigation/articleBackLayout";

const LOADING_LINES = [
  "Loading today's masterpiece…",
  "Preparing today's story…",
];

export type MasterpieceLoadingProps = {
  backLabel?: string;
  onBack?: () => void;
};

/** Brief premium loading — never indefinite; caller must render article shell. */
export function MasterpieceLoading({
  backLabel = "← Today's paper",
  onBack,
}: MasterpieceLoadingProps) {
  const insets = useSafeAreaInsets();
  const [lineIndex, setLineIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const rotate = setInterval(() => {
      setLineIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 2400);
    const timeout = setTimeout(() => setTimedOut(true), 5000);
    return () => {
      clearInterval(rotate);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={[
            styles.backRow,
            articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true }),
          ]}
        >
          <Text style={styles.back}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <View style={styles.goldRule} />
        {!timedOut ? (
          <ActivityIndicator color={kindredGold.primary} size="small" />
        ) : null}
        <Text style={styles.line} maxFontSizeMultiplier={1.1}>
          {timedOut
            ? "Opening today's masterpiece…"
            : LOADING_LINES[lineIndex]}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: paper.page,
  },
  backRow: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  back: {
    fontSize: 15,
    color: kindredGold.primary,
    letterSpacing: 0.2,
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 18,
  },
  goldRule: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: kindredGold.primary,
    opacity: 0.85,
    marginBottom: 4,
  },
  line: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontStyle: "italic",
    color: paper.inkMuted,
    textAlign: "center",
  },
});
