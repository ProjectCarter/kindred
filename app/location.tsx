import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { clearAppCachesForColdLaunch } from "../lib/perf/clearAppCachesForColdLaunch";
import { trackCacheCleared } from "../lib/analytics";
import { friendlyCacheKeyLabel } from "../lib/storage/kindredAsyncStorageKeys";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { PullDownNavHeader } from "../components/PullDownNavHeader";
import { usePullDownNavScreen } from "../lib/navigation/usePullDownNavScreen";
import { paper, press } from "../lib/edition/newspaperTheme";
import {
  getActiveLocation,
  getLocationPrefs,
  setModeCurrent,
  clearTravelLocation,
  returnToHomeCity,
  formatPlaceLabel,
  type ActiveLocation,
  type LocationPrefs,
} from "../lib/location/deviceLocation";
import {
  getTemperatureUnitPreference,
  setTemperatureUnitPreference,
  preferenceLabel,
  resolveTemperatureUnit,
  type TemperatureUnitPreference,
} from "../lib/weather/units";

/**
 * Location Settings — calm editorial screen.
 * Current Location · Home City · Travel Edition · Temperature
 */
export default function LocationSettingsScreen() {
  const router = useRouter();
  const [active, setActive] = useState<ActiveLocation | null>(null);
  const [prefs, setPrefs] = useState<LocationPrefs | null>(null);
  const [tempPref, setTempPref] =
    useState<TemperatureUnitPreference>("auto");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [a, p, t] = await Promise.all([
      getActiveLocation(),
      getLocationPrefs(),
      getTemperatureUnitPreference(),
    ]);
    setActive(a);
    setPrefs(p);
    setTempPref(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function withBusy(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  }

  const cityLine = active?.place
    ? formatPlaceLabel(active.place)
    : "No city chosen yet";

  const pullDownNavScreen = usePullDownNavScreen({
    onBack: () => router.back(),
    title: "Location",
    backAccessibilityLabel: "Back",
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        {...pullDownNavScreen.scrollProps}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={paper.terracotta}
          />
        }
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.kicker}>Your paper</Text>
        <Text style={styles.title}>Location</Text>
        <Text style={styles.lede}>
          Kindred uses location for local news, events, weather, and
          recommendations — only while the app is open.
        </Text>

        <View style={styles.statusBlock}>
          <Text style={styles.statusLabel}>Current mode</Text>
          <Text style={styles.statusValue}>
            {active?.isTravel
              ? "Travel Edition"
              : active?.mode === "current"
                ? "Current Location"
                : "Home City"}
          </Text>
          <Text style={styles.statusLabel}>City</Text>
          <Text style={styles.statusValue}>{cityLine}</Text>
          {prefs?.home ? (
            <>
              <Text style={styles.statusLabel}>Home city</Text>
              <Text style={styles.statusMeta}>
                {formatPlaceLabel(prefs.home)}
              </Text>
            </>
          ) : null}
          {prefs?.travel ? (
            <>
              <Text style={styles.statusLabel}>Travel</Text>
              <Text style={styles.statusMeta}>
                {formatPlaceLabel(prefs.travel)}
              </Text>
            </>
          ) : null}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.action,
            busy && styles.disabled,
            pressed && !busy && styles.pressed,
          ]}
          disabled={busy}
          onPress={() =>
            void withBusy(async () => {
              const next = await setModeCurrent({ forceRefresh: true });
              if (!next.place) {
                setMessage(
                  "Location permission is off. Choose a home city instead, or enable location in Settings."
                );
              } else {
                setMessage(`Using ${next.place.city}`);
              }
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Use current location"
        >
          <Text style={styles.actionText}>Use Current Location</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionOutline,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/location-search?purpose=home")}
          accessibilityRole="button"
          accessibilityLabel="Choose home city"
        >
          <Text style={styles.actionOutlineText}>Choose Home City</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionOutline,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/location-search?purpose=travel")}
          accessibilityRole="button"
          accessibilityLabel="Choose travel location"
        >
          <Text style={styles.actionOutlineText}>Choose Travel Location</Text>
        </Pressable>

        {prefs?.travel || active?.isTravel ? (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.actionOutline,
                pressed && styles.pressed,
              ]}
              disabled={busy}
              onPress={() =>
                void withBusy(async () => {
                  await returnToHomeCity();
                  setMessage("Returned to home city");
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Return to home city"
            >
              <Text style={styles.actionOutlineText}>Return to Home City</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => pressed && styles.pressed}
              disabled={busy}
              onPress={() =>
                void withBusy(async () => {
                  await clearTravelLocation();
                  setMessage("Travel location cleared");
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Clear travel location"
            >
              <Text style={styles.clearText}>Clear Travel Location</Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.tempBlock}>
          <Text style={styles.statusLabel}>Temperature</Text>
          <Text style={styles.statusMeta}>
            {preferenceLabel(tempPref)}
            {tempPref === "auto" && active?.place
              ? ` · ${
                  resolveTemperatureUnit("auto", active.place) === "fahrenheit"
                    ? "°F"
                    : "°C"
                } here`
              : ""}
          </Text>
          {(
            [
              ["auto", "Automatic"],
              ["fahrenheit", "Fahrenheit"],
              ["celsius", "Celsius"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              style={({ pressed }) => [
                styles.tempOption,
                tempPref === value && styles.tempOptionActive,
                pressed && styles.pressed,
              ]}
              onPress={() =>
                void withBusy(async () => {
                  await setTemperatureUnitPreference(value);
                  setTempPref(value);
                  setMessage(
                    value === "auto"
                      ? "Temperature follows your city"
                      : `Using ${label}`
                  );
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Temperature unit: ${label}`}
              accessibilityState={{ selected: tempPref === value }}
            >
              <Text
                style={[
                  styles.tempOptionText,
                  tempPref === value && styles.tempOptionTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
          <Text style={styles.tempHint}>
            Applies to newly generated editions. Regenerate today’s paper after
            changing units.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutLink,
            pressed && styles.pressed,
          ]}
          onPress={async () => {
            try {
              await supabase.auth.signOut();
            } catch {
              /* Still leave the session UI even if network sign-out fails. */
            }
            router.replace("/login");
          }}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        {/* TEMP(Phase One perf): remove before release — simulates a true cold launch. */}
        {__DEV__ ? (
          <View style={styles.devBlock}>
            <Text style={styles.statusLabel}>Developer</Text>
            <Text style={styles.devHint}>
              Clears the local newspaper cache and temporary scroll/recovery
              state only — home city, location mode, and temperature stay.
              You stay signed in. Force-quit and reopen to measure a cold
              network launch of today’s already-generated edition.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.devAction,
                busy && styles.disabled,
                pressed && !busy && styles.pressed,
              ]}
              disabled={busy}
              onPress={() => router.push("/dev-tools")}
              accessibilityRole="button"
              accessibilityLabel="Open developer tools"
            >
              <Text style={styles.devActionText}>🛠 Developer Tools</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.devAction,
                busy && styles.disabled,
                pressed && !busy && styles.pressed,
              ]}
              disabled={busy}
              onPress={() =>
                void withBusy(async () => {
                  const result = await clearAppCachesForColdLaunch();
                  trackCacheCleared({
                    removed_keys: result.removedKeyCount,
                    memory_caches: result.memoryCachesCleared.length,
                  });
                  const labels = [
                    ...new Set(
                      result.removedKeys.map((key) => friendlyCacheKeyLabel(key))
                    ),
                    ...result.memoryCachesCleared,
                  ];
                  const keyList =
                    labels.length > 0
                      ? `\n\n${labels.map((label) => `• ${label}`).join("\n")}`
                      : "";
                  setMessage(
                    `Cleared ${result.removedKeyCount} AsyncStorage key(s) and ${result.memoryCachesCleared.length} in-memory cache(s).${keyList}\n\nForce-quit Kindred, then reopen to test a cold launch.`
                  );
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Clear local cache"
            >
              <Text style={styles.devActionText}>🧹 Clear Local Cache</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
      <PullDownNavHeader {...pullDownNavScreen.headerProps} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: paper.sky,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 64,
  },
  back: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.terracotta,
    fontStyle: "italic",
    marginBottom: 20,
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
    fontSize: 32,
    lineHeight: 38,
    color: paper.ink,
    marginBottom: 12,
  },
  lede: {
    fontFamily: "Georgia",
    fontSize: 16,
    lineHeight: 24,
    color: paper.inkMuted,
    marginBottom: 28,
  },
  statusBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    paddingVertical: 20,
    marginBottom: 28,
  },
  statusLabel: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: paper.inkFaint,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 4,
  },
  statusValue: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 28,
    color: paper.ink,
  },
  statusMeta: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.inkMuted,
  },
  message: {
    fontFamily: "Georgia",
    fontSize: 14,
    fontStyle: "italic",
    color: paper.terracotta,
    marginBottom: 16,
  },
  action: {
    backgroundColor: paper.ink,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  actionText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.cream,
  },
  actionOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 10,
  },
  actionOutlineText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.ink,
  },
  clearText: {
    fontFamily: "Georgia",
    fontSize: 15,
    fontStyle: "italic",
    color: paper.terracotta,
    textAlign: "center",
    marginTop: 12,
    paddingVertical: 8,
  },
  tempBlock: {
    marginTop: 36,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  tempOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  tempOptionActive: {
    borderColor: paper.ink,
    backgroundColor: paper.ink,
  },
  tempOptionText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.ink,
  },
  tempOptionTextActive: {
    color: paper.cream,
  },
  tempHint: {
    fontFamily: "Georgia",
    fontSize: 13,
    fontStyle: "italic",
    color: paper.inkFaint,
    marginTop: 14,
    lineHeight: 20,
  },
  signOutLink: {
    marginTop: 36,
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  signOutText: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.inkFaint,
    fontStyle: "italic",
  },
  devBlock: {
    marginTop: 36,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  devHint: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 20,
    color: paper.inkFaint,
    marginBottom: 12,
  },
  devAction: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.terracotta,
    paddingVertical: 13,
    alignItems: "center",
  },
  devActionText: {
    fontFamily: "Georgia",
    fontSize: 16,
    color: paper.terracotta,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: press.opacity,
  },
});
