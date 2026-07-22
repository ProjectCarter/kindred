import { StyleSheet, Text, View } from "react-native";
import { paper } from "../lib/edition/newspaperTheme";
import type { WeatherDisplayDiagnostic } from "../lib/weather/weatherDiagnostics";

type Props = {
  diagnostic: WeatherDisplayDiagnostic | null;
};

/** Development-only weather pipeline visibility for production debugging. */
export function WeatherDiagnosticPanel({ diagnostic }: Props) {
  if (!__DEV__ || !diagnostic) return null;

  return (
    <View style={styles.panel} accessibilityRole="summary">
      <Text style={styles.title}>Weather diagnostic (dev)</Text>
      <Text style={styles.line}>Source: {diagnostic.selectedSource ?? "none"}</Text>
      <Text style={styles.line}>
        Live request: {diagnostic.liveRequestStatus}
      </Text>
      <Text style={styles.line}>
        Coordinates:{" "}
        {diagnostic.coordinates
          ? `${diagnostic.coordinates.lat.toFixed(4)}, ${diagnostic.coordinates.lon.toFixed(4)} (${diagnostic.coordinates.city ?? "?"})`
          : "—"}
      </Text>
      <Text style={styles.line}>Fetched: {diagnostic.fetchedAt ?? "—"}</Text>
      <Text style={styles.line}>
        Cache age:{" "}
        {diagnostic.cacheAgeMs != null ? `${diagnostic.cacheAgeMs}ms` : "—"}
      </Text>
      <Text style={styles.line}>Current: {diagnostic.current ?? "—"}</Text>
      <Text style={styles.line}>High/Low: {diagnostic.highLow ?? "—"}</Text>
      <Text style={styles.line}>
        Condition: {diagnostic.condition?.label ?? "—"}
      </Text>
      {diagnostic.fallbackReason ? (
        <Text style={styles.warn}>Fallback: {diagnostic.fallbackReason}</Text>
      ) : null}
      {diagnostic.lastRefresh?.error ? (
        <Text style={styles.warn}>Error: {diagnostic.lastRefresh.error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginBottom: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
    backgroundColor: paper.page,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 12,
    fontWeight: "600",
    color: paper.ink,
    marginBottom: 6,
  },
  line: {
    fontFamily: "Menlo",
    fontSize: 10,
    lineHeight: 14,
    color: paper.inkMuted,
  },
  warn: {
    fontFamily: "Menlo",
    fontSize: 10,
    lineHeight: 14,
    color: paper.terracotta,
    marginTop: 4,
  },
});
