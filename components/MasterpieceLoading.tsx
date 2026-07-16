import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { kindredGold, paper } from "../lib/edition/newspaperTheme";

const LOADING_LINES = [
  "Loading today's masterpiece…",
  "Preparing today's story…",
];

export type MasterpieceLoadingProps = {
  backLabel?: string;
  onBack?: () => void;
};

/** Premium loading — never implies the story is unavailable. */
export function MasterpieceLoading({
  backLabel = "← Today's paper",
}: MasterpieceLoadingProps) {
  const [lineIndex, setLineIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLineIndex((current) => (current + 1) % LOADING_LINES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        <View style={styles.goldRule} />
        <ActivityIndicator color={kindredGold.primary} size="small" />
        <Text style={styles.line} maxFontSizeMultiplier={1.1}>
          {LOADING_LINES[lineIndex]}
        </Text>
        <Text style={styles.backHint} maxFontSizeMultiplier={1.05}>
          {backLabel}
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
  backHint: {
    marginTop: 8,
    fontSize: 13,
    color: paper.inkFaint,
    letterSpacing: 0.2,
  },
});
