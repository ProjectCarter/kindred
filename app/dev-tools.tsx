import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { paper, press } from "../lib/edition/newspaperTheme";
import { formatPlaceLabel } from "../lib/location/cities";
import type { KindredPlace } from "../lib/location/types";
import { localEditionDate } from "../lib/edition/dates";
import { isDeveloperMode } from "../lib/dev/developerMode";
import {
  disableDevEditionOverride,
  getDevEditionOverrideStateSync,
  hydrateDevEditionOverrideState,
  resolveDevEditionDate,
  setDevActivePreviewId,
  setDevCompareSlot,
  setDevEditionDateMode,
  setDevEditionOverride,
  toggleDevFavoritePlace,
} from "../lib/dev/editionOverrideStore";
import { DEV_QA_CITY_PRESETS, searchDevEditionCities } from "../lib/dev/devCitySearch";
import { setPendingDevEditionGenerate } from "../lib/dev/pendingDevGenerate";
import { setDeveloperPreviewContext } from "../lib/dev/developerPreviewContext";
import { editionMetroKeyFromPlace } from "../lib/markets/editionIdentity";
import { devGenerateTrace, createDevGenerateTraceId } from "../lib/dev/devGenerateTrace";
import type { DevEditionHistoryEntry, EditionDateMode } from "../lib/dev/editionOverrideTypes";
import { DevEditionHealthDashboard } from "../components/DevEditionHealthDashboard";
import { healthScoreEmoji } from "../lib/dev/editionHealthReport";
import { resolveEditionHealth } from "../lib/dev/resolveEditionHealth";
import { isUsKindredPlace } from "../lib/markets/usOnly";
import { SUPPORTED_REGION_MESSAGE } from "../lib/markets/constants";

function tomorrowEditionDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localEditionDate(d);
}

export default function DevToolsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const citySectionY = useRef(0);
  const dateSectionY = useRef(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [results, setResults] = useState<KindredPlace[]>(DEV_QA_CITY_PRESETS);
  const [selected, setSelected] = useState<KindredPlace | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [dateMode, setDateMode] = useState<EditionDateMode>("today");
  const [customDate, setCustomDate] = useState(localEditionDate());
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComparison, setShowComparison] = useState(false);

  const state = getDevEditionOverrideStateSync();

  const reload = useCallback(async () => {
    await hydrateDevEditionOverrideState();
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isDeveloperMode()) {
      router.replace("/home");
      return;
    }
    void reload().finally(() => setLoading(false));
  }, [reload, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      void searchDevEditionCities(query, {
        state: stateFilter || undefined,
      }).then(setResults);
    }, 220);
    return () => clearTimeout(t);
  }, [query, stateFilter]);

  const effectiveState = useMemo(() => {
    void refreshKey;
    return getDevEditionOverrideStateSync();
  }, [refreshKey]);

  const activeEntry = useMemo(() => {
    const previewId = effectiveState.activePreviewId;
    if (previewId) {
      return effectiveState.history.find((row) => row.id === previewId) ?? null;
    }
    return effectiveState.history[0] ?? null;
  }, [effectiveState]);

  const previousEntry = useMemo(() => {
    if (!activeEntry) return null;
    const index = effectiveState.history.findIndex((row) => row.id === activeEntry.id);
    if (index < 0 || index + 1 >= effectiveState.history.length) return null;
    return effectiveState.history[index + 1] ?? null;
  }, [activeEntry, effectiveState.history]);

  const activeHealthScore = useMemo(() => {
    if (!activeEntry) return null;
    return resolveEditionHealth(activeEntry).overallScore;
  }, [activeEntry]);

  if (!isDeveloperMode()) return null;

  async function pickPlace(place: KindredPlace) {
    setSelected(place);
    setManualCity(place.city);
    setManualLat(String(place.lat));
    setManualLon(String(place.lon));
  }

  function buildSelectedPlace(): KindredPlace | null {
    if (selected) return selected;
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    const city = manualCity.trim();
    if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      city,
      region: stateFilter.trim() || null,
      state: stateFilter.trim() || null,
      lat,
      lon,
    };
  }

  async function generateEdition() {
    const place = buildSelectedPlace();
    if (!place) {
      setMessage("Choose a city or enter city + latitude + longitude.");
      return;
    }
    if (!isUsKindredPlace(place)) {
      setMessage(SUPPORTED_REGION_MESSAGE);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const traceId = createDevGenerateTraceId();
      devGenerateTrace(traceId, "tap_queued", {
        city: place.city,
        state: place.state,
      });
      await setDevEditionOverride({ place, dateMode, customEditionDate: customDate });
      await setDevEditionDateMode(dateMode, customDate);
      const editionDate = resolveDevEditionDate(
        getDevEditionOverrideStateSync().override
      );
      const metroKey = editionMetroKeyFromPlace(place);
      if (metroKey) {
        await setDeveloperPreviewContext({
          editionId: null,
          metroKey,
          city: place.city,
          state: place.state ?? null,
          region: place.region ?? null,
          lat: place.lat,
          lon: place.lon,
          editionDate,
          traceId,
        });
      }
      await setPendingDevEditionGenerate(true, traceId);
      router.push("/home");
    } finally {
      setBusy(false);
    }
  }

  async function previewHistoryEntry(entry: DevEditionHistoryEntry) {
    setBusy(true);
    try {
      await setDevActivePreviewId(entry.id);
      setShowComparison(false);
      router.push("/home");
    } finally {
      setBusy(false);
    }
  }

  function scrollToCitySection() {
    scrollRef.current?.scrollTo({ y: citySectionY.current, animated: true });
    setMessage("Adjust the city search or presets above.");
  }

  function scrollToDateSection() {
    scrollRef.current?.scrollTo({ y: dateSectionY.current, animated: true });
    setMessage("Adjust the edition date override above.");
  }

  const compareA = effectiveState.history.find((h) => h.id === effectiveState.compare.slotAId) ?? null;
  const compareB = effectiveState.history.find((h) => h.id === effectiveState.compare.slotBId) ?? null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={paper.terracotta} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.kicker}>Internal QA</Text>
        <Text style={styles.title}>Developer Tools</Text>
        <Text style={styles.subtitle}>
          Generate and browse Kindred editions in the United States — production pipeline
          only, dev builds only.
        </Text>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.push("/dev-market-management")}
        >
          <Text style={styles.secondaryBtnText}>Market Management (US Rollout)</Text>
        </Pressable>

        {activeEntry && activeHealthScore != null ? (
          <View style={styles.healthBanner}>
            <Text style={styles.healthBannerText}>
              {healthScoreEmoji(activeHealthScore)} Latest edition health: {activeHealthScore}/100
            </Text>
            <Text style={styles.healthBannerMeta}>{activeEntry.label}</Text>
          </View>
        ) : null}

        <View
          style={styles.section}
          onLayout={(event) => {
            citySectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>Edition Override</Text>
          <Text style={styles.hint}>
            Override injects location and date into the same generate-edition pipeline a real reader
            uses. Profile location is not updated during dev preview.
          </Text>

          <Text style={styles.fieldLabel}>Search city</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Gilbert, Seattle, San Diego…"
            placeholderTextColor={paper.inkFaint}
          />

          <Text style={styles.fieldLabel}>Filter by state</Text>
          <TextInput
            style={styles.input}
            value={stateFilter}
            onChangeText={setStateFilter}
            placeholder="Arizona, California, Washington…"
            placeholderTextColor={paper.inkFaint}
          />

          <Text style={styles.fieldLabel}>Quick presets (United States)</Text>
          <View style={styles.chipRow}>
            {DEV_QA_CITY_PRESETS.map((place) => (
              <Pressable
                key={`${place.city}-${place.lat}`}
                style={[styles.chip, selected?.city === place.city && styles.chipActive]}
                onPress={() => void pickPlace(place)}
              >
                <Text style={[styles.chipText, selected?.city === place.city && styles.chipTextActive]}>
                  {place.city}
                </Text>
              </Pressable>
            ))}
          </View>

          {results.map((place) => (
            <Pressable
              key={`${place.city}-${place.lat}-${place.lon}`}
              style={({ pressed }) => [styles.resultRow, pressed && { opacity: press.opacity }]}
              onPress={() => void pickPlace(place)}
            >
              <Text style={styles.resultTitle}>{formatPlaceLabel(place)}</Text>
              <Text style={styles.resultMeta}>
                {place.lat.toFixed(4)}, {place.lon.toFixed(4)}
              </Text>
            </Pressable>
          ))}

          <Text style={styles.fieldLabel}>Manual coordinates</Text>
          <TextInput
            style={styles.input}
            value={manualCity}
            onChangeText={setManualCity}
            placeholder="City name"
            placeholderTextColor={paper.inkFaint}
          />
          <View style={styles.coordRow}>
            <TextInput
              style={[styles.input, styles.coordInput]}
              value={manualLat}
              onChangeText={setManualLat}
              placeholder="Latitude"
              keyboardType="numeric"
              placeholderTextColor={paper.inkFaint}
            />
            <TextInput
              style={[styles.input, styles.coordInput]}
              value={manualLon}
              onChangeText={setManualLon}
              placeholder="Longitude"
              keyboardType="numeric"
              placeholderTextColor={paper.inkFaint}
            />
          </View>

          {effectiveState.recentPlaces.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Recently tested</Text>
              {effectiveState.recentPlaces.map((place) => (
                <Pressable
                  key={`recent-${place.city}-${place.lat}`}
                  style={styles.linkRow}
                  onPress={() => void pickPlace(place)}
                >
                  <Text style={styles.linkText}>{formatPlaceLabel(place)}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {effectiveState.favorites.length > 0 ? (
            <>
              <Text style={styles.fieldLabel}>Favorites</Text>
              {effectiveState.favorites.map((place) => (
                <Pressable
                  key={`fav-${place.city}-${place.lat}`}
                  style={styles.linkRow}
                  onPress={() => void pickPlace(place)}
                >
                  <Text style={styles.linkText}>★ {formatPlaceLabel(place)}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {selected ? (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => void toggleDevFavoritePlace(selected).then(() => reload())}
            >
              <Text style={styles.secondaryBtnText}>
                {effectiveState.favorites.some((f) => f.city === selected.city)
                  ? "Remove favorite"
                  : "Add to favorites"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={styles.section}
          onLayout={(event) => {
            dateSectionY.current = event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>Edition Date Override</Text>
          <View style={styles.chipRow}>
            {(
              [
                ["today", `Today (${localEditionDate()})`],
                ["tomorrow", `Tomorrow (${tomorrowEditionDate()})`],
                ["custom", "Specific date"],
              ] as const
            ).map(([mode, label]) => (
              <Pressable
                key={mode}
                style={[styles.chip, dateMode === mode && styles.chipActive]}
                onPress={() => {
                  setDateMode(mode);
                  void setDevEditionDateMode(mode, customDate);
                }}
              >
                <Text style={[styles.chipText, dateMode === mode && styles.chipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {dateMode === "custom" ? (
            <TextInput
              style={styles.input}
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              placeholderTextColor={paper.inkFaint}
            />
          ) : null}
          <Text style={styles.meta}>
            Effective date:{" "}
            {resolveDevEditionDate({
              enabled: true,
              place: selected,
              dateMode,
              customEditionDate: customDate,
            })}
          </Text>
        </View>

        <Pressable
          style={[styles.primaryBtn, busy && styles.disabled]}
          disabled={busy}
          onPress={() => void generateEdition()}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? "Starting…" : "Generate Edition"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => void disableDevEditionOverride().then(() => reload())}
        >
          <Text style={styles.secondaryBtnText}>Disable override</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compare Editions</Text>
          <Text style={styles.hint}>
            Assign two generated editions, then preview either instantly without changing GPS.
          </Text>
          <Text style={styles.meta}>Slot A: {compareA?.label ?? "Not set"}</Text>
          <Text style={styles.meta}>Slot B: {compareB?.label ?? "Not set"}</Text>
          <View style={styles.compareRow}>
            <Pressable
              style={styles.secondaryBtn}
              disabled={!compareA}
              onPress={() => compareA && void previewHistoryEntry(compareA)}
            >
              <Text style={styles.secondaryBtnText}>Preview A</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              disabled={!compareB}
              onPress={() => compareB && void previewHistoryEntry(compareB)}
            >
              <Text style={styles.secondaryBtnText}>Preview B</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Generated Editions</Text>
          {effectiveState.history.length === 0 ? (
            <Text style={styles.hint}>Generate an edition to build history.</Text>
          ) : (
            effectiveState.history.map((entry) => (
              <View key={entry.id} style={styles.historyCard}>
                <Text style={styles.resultTitle}>{entry.label}</Text>
                <Text style={styles.resultMeta}>
                  {entry.generatedAt}
                  {entry.generationTimeMs != null ? ` · ${entry.generationTimeMs} ms` : ""}
                  {` · ${healthScoreEmoji(resolveEditionHealth(entry).overallScore)} ${resolveEditionHealth(entry).overallScore}`}
                </Text>
                <View style={styles.historyActions}>
                  <Pressable style={styles.linkBtn} onPress={() => void previewHistoryEntry(entry)}>
                    <Text style={styles.linkBtnText}>Preview</Text>
                  </Pressable>
                  <Pressable
                    style={styles.linkBtn}
                    onPress={() => void setDevCompareSlot("A", entry.id).then(() => reload())}
                  >
                    <Text style={styles.linkBtnText}>Set A</Text>
                  </Pressable>
                  <Pressable
                    style={styles.linkBtn}
                    onPress={() => void setDevCompareSlot("B", entry.id).then(() => reload())}
                  >
                    <Text style={styles.linkBtnText}>Set B</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {activeEntry ? (
          <DevEditionHealthDashboard
            entry={activeEntry}
            previousEntry={showComparison ? previousEntry : null}
            onRegenerate={() => void generateEdition()}
            onChangeCity={scrollToCitySection}
            onChangeDate={scrollToDateSection}
            onComparePrevious={
              previousEntry
                ? () => setShowComparison((value) => !value)
                : undefined
            }
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: paper.page },
  content: { padding: 24, paddingBottom: 64 },
  back: { fontFamily: "Georgia", fontSize: 15, color: paper.terracotta, marginBottom: 20 },
  kicker: { fontFamily: "Georgia", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: paper.terracotta },
  title: { fontFamily: "Georgia", fontSize: 32, color: paper.ink, marginTop: 8, marginBottom: 8 },
  subtitle: { fontFamily: "Georgia", fontSize: 16, lineHeight: 24, color: paper.inkBody, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: { fontFamily: "Georgia", fontSize: 20, color: paper.ink, marginBottom: 8 },
  hint: { fontFamily: "Georgia", fontSize: 14, lineHeight: 21, color: paper.inkBody, marginBottom: 12 },
  fieldLabel: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.ink,
    backgroundColor: paper.page,
    marginBottom: 8,
  },
  coordRow: { flexDirection: "row", gap: 8 },
  coordInput: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: paper.terracotta, borderColor: paper.terracotta },
  chipText: { fontFamily: "Georgia", fontSize: 13, color: paper.ink },
  chipTextActive: { color: paper.page },
  resultRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: paper.border },
  resultTitle: { fontFamily: "Georgia", fontSize: 16, color: paper.ink },
  resultMeta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginTop: 2 },
  linkRow: { paddingVertical: 8 },
  linkText: { fontFamily: "Georgia", fontSize: 15, color: paper.terracotta },
  primaryBtn: {
    backgroundColor: paper.ink,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { fontFamily: "Georgia", fontSize: 16, color: paper.page },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryBtnText: { fontFamily: "Georgia", fontSize: 15, color: paper.ink },
  disabled: { opacity: 0.5 },
  message: { fontFamily: "Georgia", fontSize: 14, color: paper.terracotta, marginBottom: 16 },
  meta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginBottom: 4 },
  compareRow: { flexDirection: "row", gap: 8 },
  historyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: paper.sky,
  },
  historyActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: { fontFamily: "Georgia", fontSize: 14, color: paper.terracotta },
  healthBanner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: paper.sky,
    marginBottom: 20,
  },
  healthBannerText: { fontFamily: "Georgia", fontSize: 16, color: paper.ink },
  healthBannerMeta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginTop: 4 },
});
