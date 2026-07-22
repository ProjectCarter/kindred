import { View, Text, StyleSheet, Pressable, Share } from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import type { DevEditionHistoryEntry } from "../lib/dev/editionOverrideTypes";
import {
  compareEditionHealthReports,
  healthApiStatusLabel,
  healthScoreEmoji,
  serializeEditionHealthExport,
  type EditionHealthReport,
  type EditionHealthSectionReport,
  type EditionHealthWarning,
} from "../lib/dev/editionHealthReport";
import { resolveEditionHealth } from "../lib/dev/resolveEditionHealth";

type Props = {
  entry: DevEditionHistoryEntry;
  previousEntry?: DevEditionHistoryEntry | null;
  onRegenerate?: () => void;
  onChangeCity?: () => void;
  onChangeDate?: () => void;
  onComparePrevious?: () => void;
};

function warningIcon(severity: EditionHealthWarning["severity"]): string {
  if (severity === "critical") return "⛔";
  if (severity === "warning") return "⚠";
  return "ℹ";
}

function SectionCard({ section }: { section: EditionHealthSectionReport }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.label}</Text>
        <Text style={styles.sectionScore}>
          {healthScoreEmoji(section.qualityScore)} {section.qualityScore}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Items: {section.itemCount}</Text>
        <Text style={styles.metaText}>API: {healthApiStatusLabel(section.apiStatus)}</Text>
        <Text style={styles.metaText}>Cache: {section.cacheStatus}</Text>
      </View>
      {section.warnings.length > 0 ? (
        <View style={styles.warningList}>
          {section.warnings.map((w, index) => (
            <Text key={`${section.id}-${w.id}-${index}`} style={styles.warningLine}>
              {warningIcon(w.severity)} {w.message}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.okLine}>No section warnings</Text>
      )}
    </View>
  );
}

function ComparisonPanel({
  current,
  previous,
}: {
  current: EditionHealthReport;
  previous: EditionHealthReport;
}) {
  const comparison = compareEditionHealthReports(current, previous);
  const deltaPrefix = comparison.overallDelta >= 0 ? "+" : "";

  return (
    <View style={styles.compareBlock}>
      <Text style={styles.compareTitle}>Compare With Previous Edition</Text>
      <Text style={styles.compareOverall}>
        Overall {deltaPrefix}
        {comparison.overallDelta} ({previous.overallScore} → {current.overallScore})
      </Text>
      {comparison.sectionDeltas.map((row) => (
        <Text key={row.id} style={styles.compareRow}>
          {row.label}: {row.delta >= 0 ? "+" : ""}
          {row.delta}
        </Text>
      ))}
      {comparison.newWarnings.length > 0 ? (
        <>
          <Text style={styles.compareSubtitle}>New warnings</Text>
          {comparison.newWarnings.map((message) => (
            <Text key={`new-${message}`} style={styles.warningLine}>
              ⚠ {message}
            </Text>
          ))}
        </>
      ) : null}
      {comparison.resolvedWarnings.length > 0 ? (
        <>
          <Text style={styles.compareSubtitle}>Resolved</Text>
          {comparison.resolvedWarnings.map((message) => (
            <Text key={`resolved-${message}`} style={styles.okLine}>
              ✓ {message}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

export function DevEditionHealthDashboard({
  entry,
  previousEntry,
  onRegenerate,
  onChangeCity,
  onChangeDate,
  onComparePrevious,
}: Props) {
  const health = resolveEditionHealth(entry);
  const previousHealth = previousEntry ? resolveEditionHealth(previousEntry) : null;
  const showComparison = Boolean(previousHealth);

  async function exportDiagnostics() {
    const payload = serializeEditionHealthExport({
      label: entry.label,
      place: entry.place,
      editionDate: entry.editionDate,
      diagnostics: entry.diagnostics,
      health,
    });
    await Share.share({ message: payload, title: `Kindred Edition Health — ${entry.label}` }).catch(
      () => {}
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Edition Health</Text>
      <View style={styles.overallRow}>
        <Text style={styles.overallScore}>
          {healthScoreEmoji(health.overallScore)} Overall Edition Score
        </Text>
        <Text style={styles.overallValue}>{health.overallScore}/100</Text>
      </View>
      <Text style={styles.grade}>Grade: {health.overallGrade}</Text>
      <Text style={styles.analyzedAt}>Analyzed {health.analyzedAt}</Text>

      <Text style={styles.blockTitle}>Section Scores</Text>
      {health.sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}

      {health.warnings.length > 0 ? (
        <>
          <Text style={styles.blockTitle}>Content Warnings</Text>
          <View style={styles.globalWarnings}>
            {health.warnings.map((w) => (
              <Text key={w.id} style={styles.warningLine}>
                {warningIcon(w.severity)} {w.message}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      <Text style={styles.blockTitle}>Generation Statistics</Text>
      <View style={styles.statsBlock}>
        <StatRow label="Generation time" value={formatMs(health.stats.generationTimeMs)} />
        <StatRow label="Cache" value={health.stats.cacheStatus} />
        <StatRow label="Imported" value={formatCount(health.stats.importedCount)} />
        <StatRow label="Filtered" value={formatCount(health.stats.filteredCount)} />
        <StatRow label="Published" value={formatCount(health.stats.publishedCount)} />
        <StatRow label="Rejected" value={formatCount(health.stats.rejectedCount)} />
        <StatRow label="Duplicate merges" value={formatCount(health.stats.duplicateMerges)} />
        <StatRow label="Radius" value={`${health.stats.radiusMiles} mi`} />
        <StatRow label="Local timezone" value={health.stats.localTimeZone} />
        <StatRow label="Edition date" value={health.stats.editionDate} />
        <StatRow label="Local date" value={health.stats.localDate} />
        <StatRow label="Generated at" value={health.stats.editionGeneratedAt ?? "—"} />
        <Text style={styles.statsSubtitle}>API status by provider</Text>
        {Object.entries(health.stats.apiCallsByProvider).map(([provider, status]) => (
          <StatRow key={provider} label={provider} value={healthApiStatusLabel(status)} />
        ))}
      </View>

      {showComparison && previousHealth ? (
        <ComparisonPanel current={health} previous={previousHealth} />
      ) : null}

      <Text style={styles.blockTitle}>Quick Actions</Text>
      <View style={styles.actions}>
        {onRegenerate ? (
          <ActionButton label="Regenerate Edition" onPress={onRegenerate} primary />
        ) : null}
        {onChangeCity ? <ActionButton label="Change City" onPress={onChangeCity} /> : null}
        {onChangeDate ? <ActionButton label="Change Date" onPress={onChangeDate} /> : null}
        {onComparePrevious && previousEntry ? (
          <ActionButton label="Compare With Previous Edition" onPress={onComparePrevious} />
        ) : null}
        <ActionButton label="Export Diagnostics" onPress={() => void exportDiagnostics()} />
      </View>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        primary ? styles.primaryBtn : styles.secondaryBtn,
        pressed && { opacity: press.opacity },
      ]}
      onPress={onPress}
    >
      <Text style={primary ? styles.primaryBtnText : styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  return `${ms} ms (${(ms / 1000).toFixed(1)}s)`;
}

function formatCount(value: number | null): string {
  return value == null ? "—" : String(value);
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 14,
    backgroundColor: paper.sky,
    marginBottom: 24,
  },
  kicker: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: paper.terracotta,
    marginBottom: 8,
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  overallScore: { fontFamily: "Georgia", fontSize: 20, color: paper.ink, flex: 1 },
  overallValue: { fontFamily: "Georgia", fontSize: 28, color: paper.ink },
  grade: { fontFamily: "Georgia", fontSize: 14, color: paper.inkBody, marginTop: 4 },
  analyzedAt: { fontFamily: "Georgia", fontSize: 12, color: paper.inkMuted, marginBottom: 16 },
  blockTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    color: paper.ink,
    marginTop: 12,
    marginBottom: 8,
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: paper.page,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontFamily: "Georgia", fontSize: 15, color: paper.ink, flex: 1 },
  sectionScore: { fontFamily: "Georgia", fontSize: 14, color: paper.inkBody },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  metaText: { fontFamily: "Georgia", fontSize: 12, color: paper.inkMuted },
  warningList: { gap: 4 },
  warningLine: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 19,
    color: paper.terracotta,
    marginBottom: 2,
  },
  okLine: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted },
  globalWarnings: { marginBottom: 8 },
  statsBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: paper.page,
    marginBottom: 8,
  },
  statsSubtitle: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.inkMuted,
    marginTop: 8,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 3,
  },
  statLabel: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, flex: 1 },
  statValue: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.ink,
    flex: 1,
    textAlign: "right",
  },
  compareBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    padding: 10,
    backgroundColor: paper.page,
    marginBottom: 8,
  },
  compareTitle: { fontFamily: "Georgia", fontSize: 16, color: paper.ink, marginBottom: 6 },
  compareOverall: { fontFamily: "Georgia", fontSize: 14, color: paper.inkBody, marginBottom: 6 },
  compareRow: { fontFamily: "Georgia", fontSize: 13, color: paper.inkMuted, marginBottom: 2 },
  compareSubtitle: {
    fontFamily: "Georgia",
    fontSize: 13,
    color: paper.ink,
    marginTop: 8,
    marginBottom: 4,
  },
  actions: { gap: 8, marginTop: 4 },
  primaryBtn: {
    backgroundColor: paper.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { fontFamily: "Georgia", fontSize: 15, color: paper.page },
  secondaryBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: paper.page,
  },
  secondaryBtnText: { fontFamily: "Georgia", fontSize: 15, color: paper.ink },
});
