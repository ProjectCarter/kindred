import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MasterpieceReader } from "../../components/MasterpieceReader";
import { MasterpieceLoading } from "../../components/MasterpieceLoading";
import { getStashedMasterpiece } from "../../lib/edition/masterpieceStore";
import { kindredGold, paper } from "../../lib/edition/newspaperTheme";
import { articleBackRowInsets } from "../../lib/navigation/articleBackLayout";

export default function MasterpieceDetailScreen() {
  const { id, backLabel } = useLocalSearchParams<{
    id: string;
    backLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const artworkId =
    typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";

  const [stashReady, setStashReady] = useState(false);

  const morningHero = useMemo(() => {
    if (!artworkId || !stashReady) return null;
    return getStashedMasterpiece(artworkId);
  }, [artworkId, stashReady]);

  useEffect(() => {
    const timer = setTimeout(() => setStashReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const back =
    typeof backLabel === "string" && backLabel.trim()
      ? decodeURIComponent(backLabel)
      : "← Today's paper";

  function handleBack() {
    router.back();
  }

  if (!stashReady) {
    return <MasterpieceLoading backLabel={back} onBack={handleBack} />;
  }

  if (!morningHero) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <Pressable
          onPress={handleBack}
          style={[styles.backRow, articleBackRowInsets(insets.top, { safeAreaAlreadyApplied: true })]}
        >
          <Text style={styles.back}>{back}</Text>
        </Pressable>
        <MasterpieceLoading backLabel={back} onBack={handleBack} />
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
    paddingBottom: 14,
  },
  back: {
    fontSize: 15,
    color: kindredGold.primary,
    letterSpacing: 0.2,
  },
});
