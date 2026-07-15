import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { paper, press } from "../lib/edition/newspaperTheme";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import {
  searchCities,
  setHomeCity,
  setTravelCity,
  formatPlaceLabel,
  type KindredPlace,
} from "../lib/location/deviceLocation";

type Purpose = "home" | "travel";

/**
 * Simple city search — no map. Type a city name, pick from results.
 */
export default function LocationSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ purpose?: string }>();
  const purpose: Purpose =
    params.purpose === "travel" ? "travel" : "home";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KindredPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const pullDownNavScreen = usePullDownNavScreen({
    onBack: () => router.back(),
    title:
      purpose === "travel" ? "Travel location" : "Home city",
    backAccessibilityLabel: "Back",
  });

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const places = await searchCities(q);
      setResults(places);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void runSearch("");
  }, [runSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  async function pick(place: KindredPlace) {
    if (saving) return;
    setSaving(true);
    try {
      if (purpose === "travel") {
        await setTravelCity(place);
      } else {
        await setHomeCity(place);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const title =
    purpose === "travel" ? "Travel location" : "Home city";
  const subtitle =
    purpose === "travel"
      ? "Your newspaper will use this city until you return home."
      : "This becomes your default paper when GPS isn’t in use.";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.kicker}>Location</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Phoenix, Seattle, London…"
          placeholderTextColor={paper.inkFaint}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          editable={!saving}
        />
      </View>

      {searching ? (
        <ActivityIndicator
          color={paper.terracotta}
          style={{ marginTop: 24 }}
        />
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item, i) => `${item.city}-${item.lat}-${i}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => void pick(item)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={`Choose ${formatPlaceLabel(item)}`}
          >
            <Text style={styles.rowCity}>{item.city}</Text>
            <Text style={styles.rowMeta}>{formatPlaceLabel(item)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !searching ? (
            <Text style={styles.empty}>
              No cities matched that spelling. Try another.
            </Text>
          ) : null
        }
      />
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.sky,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  back: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    marginBottom: 18,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: paper.inkMuted,
    fontWeight: "600",
    marginBottom: 8,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 28,
    lineHeight: 34,
    color: paper.ink,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginBottom: 18,
  },
  input: {
    fontFamily: "Georgia",
    fontSize: 18,
    color: paper.ink,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
    paddingVertical: 12,
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  row: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  rowCity: {
    fontFamily: "Georgia",
    fontSize: 18,
    color: paper.ink,
    marginBottom: 2,
  },
  rowMeta: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.inkFaint,
  },
  empty: {
    fontFamily: "Georgia",
    fontSize: 15,
    fontStyle: "italic",
    color: paper.inkMuted,
    marginTop: 24,
  },
  pressed: {
    opacity: press.opacity,
  },
});
