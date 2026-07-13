import { Text, View, Pressable, StyleSheet } from "react-native";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import { formatDiscoveryWhy } from "../lib/edition/discovery";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type Props = {
  headline?: string;
  /** Kicker above the headline — defaults to the shared editorial signature. */
  kicker?: string;
  editorNote?: string | null;
  items: RankedDiscoveryItem[];
  /** Opens the native Kindred article reader for a pick. */
  onOpenItem?: (item: RankedDiscoveryItem) => void;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/**
 * Discovery desk — quiet recommendations, not a feed.
 * Numbered like a magazine desk list.
 * Title, dek, and “Read the story” open the shared native reader.
 */
export function DiscoveryDesk({
  headline = "Worth your time",
  kicker = "From the desk",
  editorNote,
  items,
  onOpenItem,
}: Props) {
  if (!items.length) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
        <View style={styles.mast}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
            {headline}
          </Text>
          {editorNote?.trim() ? (
            <Text style={styles.editorNote} maxFontSizeMultiplier={1.3}>
              {editorNote.trim()}
            </Text>
          ) : (
            <Text style={styles.editorNote} maxFontSizeMultiplier={1.3}>
              A few quiet recommendations for today.
            </Text>
          )}
        </View>

        {items.map((ranked, index) => {
          const why = formatDiscoveryWhy(ranked);
          const canOpen = Boolean(onOpenItem);
          function open() {
            onOpenItem?.(ranked);
          }

          return (
            <View
              key={ranked.item.id}
              style={[
                styles.item,
                index === items.length - 1 && styles.itemLast,
              ]}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.numeral}>
                  {ROMAN[index] ?? String(index + 1)}
                </Text>
                <Text style={styles.category}>
                  {formatCategory(ranked.item.category)}
                </Text>
              </View>

              <Pressable
                onPress={canOpen ? open : undefined}
                disabled={!canOpen}
                accessibilityRole={canOpen ? "link" : undefined}
                accessibilityLabel={
                  canOpen ? `Read: ${ranked.item.title}` : undefined
                }
                hitSlop={6}
                style={({ pressed }) => [canOpen && pressed && styles.pressed]}
              >
                <Text style={styles.title} maxFontSizeMultiplier={1.3}>
                  {ranked.item.title}
                </Text>
              </Pressable>

              {ranked.item.dek ? (
                <Pressable
                  onPress={canOpen ? open : undefined}
                  disabled={!canOpen}
                  accessibilityRole={canOpen ? "link" : undefined}
                  accessibilityLabel={canOpen ? "Continue reading" : undefined}
                  hitSlop={4}
                  style={({ pressed }) => [
                    canOpen && pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.dek} maxFontSizeMultiplier={1.3}>
                    {ranked.item.dek}
                  </Text>
                </Pressable>
              ) : null}

              {why ? (
                <Pressable
                  onPress={canOpen ? open : undefined}
                  disabled={!canOpen}
                  accessibilityRole={canOpen ? "link" : undefined}
                  hitSlop={4}
                  style={({ pressed }) => [
                    canOpen && pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.why} maxFontSizeMultiplier={1.25}>
                    {why}
                  </Text>
                </Pressable>
              ) : null}

              {canOpen ? (
                <Pressable
                  onPress={open}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Continue reading"
                  style={({ pressed }) => [
                    styles.readRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.readLink}>Continue reading</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
    </View>
  );
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 52,
    marginTop: 4,
    paddingVertical: 36,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  mast: {
    marginBottom: 32,
    paddingBottom: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 12,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    marginBottom: 12,
  },
  editorNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 480,
  },
  item: {
    marginBottom: 28,
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  itemLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  numeral: {
    fontFamily: "Georgia",
    fontSize: 12,
    letterSpacing: 1,
    color: paper.terracotta,
    fontWeight: "600",
    minWidth: 18,
  },
  category: {
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: paper.inkFaint,
    fontWeight: "600",
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.1,
    color: paper.ink,
    marginBottom: 8,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    color: paper.inkBody,
    marginBottom: 10,
  },
  why: {
    fontFamily: "Georgia",
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  readRow: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  readLink: {
    fontFamily: "Georgia",
    fontSize: 14,
    color: paper.terracotta,
    fontStyle: "italic",
    letterSpacing: 0.2,
  },
  pressed: {
    opacity: press.opacity,
  },
});
