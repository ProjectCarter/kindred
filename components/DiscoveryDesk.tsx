import { Text, View, Pressable, StyleSheet } from "react-native";
import type { RankedDiscoveryItem } from "../lib/edition/discovery";
import { formatDiscoveryWhy } from "../lib/edition/discovery";
import { FolioReveal } from "./FolioReveal";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type Props = {
  headline?: string;
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
  headline = "Bandit’s Picks",
  editorNote,
  items,
  onOpenItem,
}: Props) {
  if (!items.length) return null;

  return (
    <FolioReveal index={4}>
      <View style={styles.wrap} accessibilityRole="summary">
        <View style={styles.mast}>
          <Text style={styles.kicker}>From Bandit’s desk</Text>
          <Text style={styles.headline} maxFontSizeMultiplier={1.25}>
            {headline}
          </Text>
          {editorNote?.trim() ? (
            <Text style={styles.editorNote} maxFontSizeMultiplier={1.3}>
              {editorNote.trim()}
            </Text>
          ) : (
            <Text style={styles.editorNote} maxFontSizeMultiplier={1.3}>
              A few suggestions from Bandit, your editor — nothing you have to
              finish.
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
                  accessibilityLabel={canOpen ? "Read the story" : undefined}
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
                  accessibilityLabel="Read the story"
                  style={({ pressed }) => [
                    styles.readRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.readLink}>Read the story</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </FolioReveal>
  );
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 40,
    marginTop: 4,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: paper.creamWash,
    borderRadius: 1,
  },
  mast: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  kicker: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 10,
  },
  headline: {
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    marginBottom: 10,
  },
  editorNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    fontStyle: "italic",
    color: paper.inkMuted,
    maxWidth: 520,
  },
  item: {
    marginBottom: 22,
    paddingBottom: 20,
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
    marginBottom: 8,
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
    marginBottom: 6,
  },
  dek: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 24,
    color: paper.inkBody,
    marginBottom: 8,
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
    marginTop: 10,
    paddingVertical: 4,
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
