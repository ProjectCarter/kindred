import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { paper, press } from "../lib/edition/newspaperTheme";
import { isDeveloperMode } from "../lib/dev/developerMode";
import {
  batchMarketActionBlockedReason,
  fetchMarketBuildLogs,
  invokeBuildUsMarket,
  invokeRefreshUsMarket,
  invokeRetryUsMarket,
  invokeValidateUsMarket,
  listUsMarkets,
  setUsMarketPaused,
} from "../lib/markets/marketManagementClient";
import { summarizeMarketValidation } from "../lib/markets/marketValidation";
import { MARKET_BATCH_ACTIONS_ENABLED } from "../lib/markets/constants";
import type { UsMarketRecord, MarketBuildLogRecord } from "../lib/markets/types";
import { countUsMarketSeeds } from "../lib/markets/usMarketDirectory";

const MARKET_TYPES = [
  { id: "", label: "All types" },
  { id: "major_metro", label: "Major metro" },
  { id: "tourist_destination", label: "Tourist destination" },
  { id: "regional_city", label: "Regional city" },
] as const;

const STATUSES = [
  { id: "", label: "All statuses" },
  { id: "planned", label: "Planned" },
  { id: "building", label: "Building" },
  { id: "ready", label: "Ready" },
  { id: "complete", label: "Complete" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "paused", label: "Paused" },
] as const;

const BATCH_ACTIONS = [
  "Build Top 10",
  "Build Next 25",
  "Build Next 50",
  "Refresh Ready Markets",
] as const;

function formatWhen(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function completenessLabel(market: UsMarketRecord): string {
  const c = market.completeness;
  const summary = summarizeMarketValidation(c);
  if (!c) return "Not assessed";
  if (summary.complete) return `Complete (${summary.passed}/${summary.required})`;
  if (summary.ready) return `Ready (${summary.passed}/${summary.required})`;
  if (c.needsAttention) return `Needs attention (${summary.passed}/${summary.required})`;
  return "Incomplete";
}

export default function DevMarketManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [markets, setMarkets] = useState<UsMarketRecord[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [logs, setLogs] = useState<MarketBuildLogRecord[]>([]);
  const [query, setQuery] = useState("");
  const [marketType, setMarketType] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showRolloutPreview, setShowRolloutPreview] = useState(false);

  const seedCounts = useMemo(() => countUsMarketSeeds(), []);

  const reload = useCallback(async () => {
    const rows = await listUsMarkets({
      query,
      marketType: marketType || null,
      status: status || null,
    });
    setMarkets(rows);
  }, [query, marketType, status]);

  useEffect(() => {
    if (!isDeveloperMode()) {
      router.replace("/home");
      return;
    }
    void reload().finally(() => setLoading(false));
  }, [reload, router]);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      void reload();
    }, 200);
    return () => clearTimeout(t);
  }, [loading, reload]);

  const selected = useMemo(
    () => markets.find((m) => m.slug === selectedSlug) ?? null,
    [markets, selectedSlug]
  );

  useEffect(() => {
    if (!selected?.id) {
      setLogs([]);
      return;
    }
    void fetchMarketBuildLogs(selected.id).then(setLogs).catch(() => setLogs([]));
  }, [selected?.id]);

  async function runBuild(slug: string) {
    setBusySlug(slug);
    setMessage(null);
    try {
      const result = await invokeBuildUsMarket(slug);
      if (!result.success) {
        setMessage(result.error ?? "Build Market failed");
      } else {
        setMessage(`Build Market completed for ${slug}.`);
      }
      await reload();
      if (selectedSlug === slug && selected?.id) {
        await fetchMarketBuildLogs(selected.id).then(setLogs);
      }
    } finally {
      setBusySlug(null);
    }
  }

  async function runRefresh(slug: string) {
    setBusySlug(slug);
    setMessage(null);
    try {
      const result = await invokeRefreshUsMarket(slug);
      if (!result.success) {
        setMessage(result.error ?? "Refresh failed");
      } else {
        setMessage(`Refresh completed for ${slug}.`);
      }
      await reload();
    } finally {
      setBusySlug(null);
    }
  }

  async function runRetry(slug: string) {
    setBusySlug(slug);
    setMessage(null);
    try {
      const result = await invokeRetryUsMarket(slug);
      if (!result.success) {
        setMessage(result.error ?? "Retry failed");
      } else {
        setMessage(`Retry completed for ${slug}.`);
      }
      await reload();
      if (selectedSlug === slug && selected?.id) {
        await fetchMarketBuildLogs(selected.id).then(setLogs);
      }
    } finally {
      setBusySlug(null);
    }
  }

  async function togglePause(market: UsMarketRecord) {
    setBusySlug(market.slug);
    try {
      const paused = market.status !== "paused";
      await setUsMarketPaused(market.slug, paused);
      setMessage(paused ? `${market.market_name} paused.` : `${market.market_name} enabled.`);
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusySlug(null);
    }
  }

  async function runValidate(slug: string) {
    setBusySlug(slug);
    setMessage(null);
    try {
      const result = await invokeValidateUsMarket(slug);
      if (!result.success) {
        setMessage(result.error ?? "Validation failed");
      } else {
        setMessage(`Validation completed for ${slug}.`);
      }
      await reload();
    } finally {
      setBusySlug(null);
    }
  }

  function onBatchAction(action: string) {
    if (!MARKET_BATCH_ACTIONS_ENABLED) {
      Alert.alert("Batch action disabled", batchMarketActionBlockedReason(action));
      return;
    }
    Alert.alert(
      action,
      "Batch market actions require explicit approval and are disabled during V1 rollout."
    );
  }

  if (!isDeveloperMode()) return null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={paper.terracotta} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.kicker}>United States Rollout</Text>
        <Text style={styles.title}>Market Management</Text>
        <Text style={styles.subtitle}>
          Ranked US market directory — build one market at a time. Mass generation remains
          disabled.
        </Text>

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Directory seed</Text>
          <Text style={styles.bannerMeta}>
            {seedCounts.majorMetro} major metros · {seedCounts.touristDestination} tourist
            destinations · {seedCounts.total} total ranked markets
          </Text>
          <Text style={styles.bannerMeta}>country_code = US only · batch actions disabled</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search & filters</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search US markets…"
            placeholderTextColor={paper.inkFaint}
          />
          <View style={styles.chipRow}>
            {MARKET_TYPES.map((opt) => (
              <Pressable
                key={opt.id || "all-types"}
                style={[styles.chip, marketType === opt.id && styles.chipActive]}
                onPress={() => setMarketType(opt.id)}
              >
                <Text style={[styles.chipText, marketType === opt.id && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipRow}>
            {STATUSES.map((opt) => (
              <Pressable
                key={opt.id || "all-status"}
                style={[styles.chip, status === opt.id && styles.chipActive]}
                onPress={() => setStatus(opt.id)}
              >
                <Text style={[styles.chipText, status === opt.id && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setShowRolloutPreview((v) => !v)}
          >
            <Text style={styles.secondaryBtnText}>
              {showRolloutPreview ? "Hide rollout preview" : "Preview ranked US rollout list"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batch controls (protected)</Text>
          {BATCH_ACTIONS.map((action) => (
            <Pressable
              key={action}
              style={[styles.batchBtn, styles.disabledBtn]}
              disabled={!MARKET_BATCH_ACTIONS_ENABLED}
              onPress={() => onBatchAction(action)}
            >
              <Text style={styles.batchBtnText}>{action}</Text>
              <Text style={styles.batchHint}>Disabled until approved</Text>
            </Pressable>
          ))}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            United States markets ({markets.length} shown)
          </Text>
          {(showRolloutPreview ? markets.slice(0, 25) : markets).map((market) => {
            const active = selectedSlug === market.slug;
            const busy = busySlug === market.slug;
            return (
              <Pressable
                key={market.slug}
                style={({ pressed }) => [
                  styles.marketCard,
                  active && styles.marketCardActive,
                  pressed && { opacity: press.opacity },
                ]}
                onPress={() => setSelectedSlug(market.slug)}
              >
                <View style={styles.marketHeader}>
                  <Text style={styles.rank}>#{market.overall_rank}</Text>
                  <View style={styles.marketTitleBlock}>
                    <Text style={styles.marketName}>
                      {market.display_name ?? market.market_name}
                    </Text>
                    <Text style={styles.marketMeta}>
                      {market.state_code} · {market.population_tier?.replace(/_/g, " ") ?? market.market_type.replace(/_/g, " ")}
                      {market.population
                        ? ` · pop ${(market.population / 1_000_000).toFixed(1)}M`
                        : ""}
                    </Text>
                  </View>
                  <Text style={styles.statusBadge}>{market.status}</Text>
                </View>
                <Text style={styles.marketDetail}>
                  Last success: {formatWhen(market.last_success_at)} · Build:{" "}
                  {formatDuration(market.last_build_duration_ms)} ·{" "}
                  {completenessLabel(market)}
                </Text>
                {market.last_error ? (
                  <Text style={styles.errorText} numberOfLines={2}>
                    {market.last_error}
                  </Text>
                ) : null}
                {active ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      style={[styles.actionBtn, busy && styles.disabledBtn]}
                      disabled={busy || market.status === "paused"}
                      onPress={() => void runBuild(market.slug)}
                    >
                      <Text style={styles.actionBtnText}>
                        {busy ? "Working…" : "Build Market"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, busy && styles.disabledBtn]}
                      disabled={busy || market.status === "paused"}
                      onPress={() => void runRefresh(market.slug)}
                    >
                      <Text style={styles.actionBtnText}>Refresh</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, busy && styles.disabledBtn]}
                      disabled={busy}
                      onPress={() => void runValidate(market.slug)}
                    >
                      <Text style={styles.actionBtnText}>Validate</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionBtn, busy && styles.disabledBtn]}
                      disabled={busy}
                      onPress={() => void runRetry(market.slug)}
                    >
                      <Text style={styles.actionBtnText}>Retry</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionBtn}
                      disabled={busy}
                      onPress={() => void togglePause(market)}
                    >
                      <Text style={styles.actionBtnText}>
                        {market.status === "paused" ? "Enable" : "Pause"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {showRolloutPreview && markets.length > 25 ? (
            <Text style={styles.hint}>Showing top 25 of {markets.length} — refine search for more.</Text>
          ) : null}
        </View>

        {selected ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Selected: {selected.market_name}</Text>
            <Text style={styles.meta}>Slug: {selected.slug}</Text>
            <Text style={styles.meta}>Metro key: {selected.metro_key}</Text>
            <Text style={styles.meta}>
              Cities: {(selected.metro_cities ?? []).join(", ")}
            </Text>
            <Text style={styles.meta}>
              Radii: {selected.default_radius_miles} mi default ·{" "}
              {selected.fallback_radius_miles} mi fallback
            </Text>
            <Text style={styles.meta}>
              Supported: {selected.is_supported ? "yes" : "no"} · Daily refresh:{" "}
              {selected.is_daily_refresh_enabled ? "on" : "off"}
            </Text>
            {selected.completeness?.sections?.length ? (
              <>
                <Text style={styles.fieldLabel}>Validation checklist</Text>
                {selected.completeness.sections.map((s) => (
                  <Text key={s.id} style={styles.hint}>
                    {s.complete ? "✓" : "✗"} {s.label}
                    {s.detail ? ` — ${s.detail}` : ""}
                  </Text>
                ))}
              </>
            ) : null}
            {selected.completeness?.deficiencies?.length ? (
              <>
                <Text style={styles.fieldLabel}>Deficiencies</Text>
                {selected.completeness.deficiencies.map((d) => (
                  <Text key={d} style={styles.hint}>
                    · {d}
                  </Text>
                ))}
              </>
            ) : null}
            {logs.length > 0 ? (
              <>
                <Text style={styles.fieldLabel}>Recent build logs</Text>
                {logs.map((log) => (
                  <View key={log.id} style={styles.logRow}>
                    <Text style={styles.resultTitle}>
                      {log.job_type} · {log.status}
                    </Text>
                    <Text style={styles.resultMeta}>
                      {formatWhen(log.started_at)} · {formatDuration(log.duration_ms)}
                      {log.cost_available && log.estimated_cost_usd != null
                        ? ` · $${log.estimated_cost_usd.toFixed(4)}`
                        : " · cost unavailable"}
                    </Text>
                    {log.error_details ? (
                      <Text style={styles.errorText}>{log.error_details}</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : (
              <Text style={styles.hint}>No build logs yet for this market.</Text>
            )}
          </View>
        ) : null}

        <Pressable style={styles.secondaryBtn} onPress={() => router.push("/dev-tools")}>
          <Text style={styles.secondaryBtnText}>Edition Override (Developer Tools)</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: paper.page },
  content: { padding: 24, paddingBottom: 64 },
  back: { fontFamily: "Georgia", fontSize: 15, color: paper.terracotta, marginBottom: 20 },
  kicker: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  title: { fontFamily: "Georgia", fontSize: 32, color: paper.ink, marginTop: 8, marginBottom: 8 },
  subtitle: { fontFamily: "Georgia", fontSize: 16, lineHeight: 24, color: paper.inkBody, marginBottom: 20 },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: paper.sky,
    marginBottom: 20,
  },
  bannerTitle: { fontFamily: "Georgia", fontSize: 16, color: paper.ink },
  bannerMeta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginTop: 4 },
  section: { marginBottom: 28 },
  sectionTitle: { fontFamily: "Georgia", fontSize: 20, color: paper.ink, marginBottom: 8 },
  hint: { fontFamily: "Georgia", fontSize: 14, lineHeight: 21, color: paper.inkBody, marginBottom: 8 },
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
  batchBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: paper.sky,
  },
  batchBtnText: { fontFamily: "Georgia", fontSize: 15, color: paper.inkMuted },
  batchHint: { fontFamily: "Georgia", fontSize: 12, color: paper.inkFaint, marginTop: 2 },
  disabledBtn: { opacity: 0.45 },
  message: { fontFamily: "Georgia", fontSize: 14, color: paper.terracotta, marginBottom: 16 },
  marketCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: paper.page,
  },
  marketCardActive: { borderColor: paper.terracotta, backgroundColor: paper.sky },
  marketHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  rank: { fontFamily: "Georgia", fontSize: 14, color: paper.terracotta, width: 36 },
  marketTitleBlock: { flex: 1 },
  marketName: { fontFamily: "Georgia", fontSize: 16, color: paper.ink },
  marketMeta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginTop: 2 },
  statusBadge: { fontFamily: "Georgia", fontSize: 12, color: paper.inkBody },
  marketDetail: { fontFamily: "Georgia", fontSize: 12, color: paper.inkMuted, marginTop: 6 },
  errorText: { fontFamily: "Georgia", fontSize: 12, color: paper.terracotta, marginTop: 4 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { fontFamily: "Georgia", fontSize: 13, color: paper.ink },
  meta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginBottom: 4 },
  logRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
    paddingVertical: 8,
  },
  resultTitle: { fontFamily: "Georgia", fontSize: 15, color: paper.ink },
  resultMeta: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginTop: 2 },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryBtnText: { fontFamily: "Georgia", fontSize: 15, color: paper.ink },
});
