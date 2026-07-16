import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MasterpieceReader } from "../../components/MasterpieceReader";
import { getStashedMasterpiece } from "../../lib/edition/masterpieceStore";
import { paper } from "../../lib/edition/newspaperTheme";

export default function MasterpieceDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();

  const artworkId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const morningHero = useMemo(
    () => (artworkId ? getStashedMasterpiece(artworkId) : null),
    [artworkId]
  );

  const back =
    typeof backLabel === "string" && backLabel.trim()
      ? decodeURIComponent(backLabel)
      : "← Today's paper";

  function handleBack() {
    router.back();
  }

  if (!morningHero) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <Pressable onPress={handleBack} style={styles.backRow}>
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <Text style={styles.missing}>
          This masterpiece is no longer available.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <MasterpieceReader
      morningHero={morningHero}
      onBack={handleBack}
      backLabel={back}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: paper.page,
  },
  backRow: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  back: {
    fontSize: 15,
    color: paper.terracotta,
    letterSpacing: 0.2,
  },
  missing: {
    fontFamily: "Georgia",
    fontSize: 22,
    color: paper.inkMuted,
    paddingHorizontal: 24,
    marginTop: 24,
  },
});
