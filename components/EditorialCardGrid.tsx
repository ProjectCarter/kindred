import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import { HOMEPAGE_INITIAL_RENDER_COUNT, sliceForInitialRender } from "../lib/edition/editorialPublishing";
import { BanditCharacter } from "./BanditCharacter";
import { ArticleActionList } from "./ArticleActionList";
import type { ActionBarAction } from "../lib/edition/actionBar";

export type EditorialGridCard = {
  id: string;
  /** Small caps meta line above the title (category, distance, price tier…). */
  overline?: string | null;
  title: string;
  /** Venue-equivalent line (neighborhood, address). */
  subtitle?: string | null;
  /** Kindred's own one-line editorial voice for this card. */
  note?: string | null;
  /** Maps, Official Website, and ticket links when available. */
  actions?: ActionBarAction[];
};

type Props = {
  kicker: string;
  cards: EditorialGridCard[];
  onOpenCard?: (card: EditorialGridCard) => void;
  /** Homepage first paint — rendering only. Omit for the full published list. */
  initialRenderCount?: number;
  /** @deprecated Use initialRenderCount */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more items than fit. */
  onSeeAll?: () => void;
  /** e.g. (n) => `See all ${n} activities` */
  seeAllLabel?: (total: number) => string;
  emptyCopy?: string;
  /**
   * Shows Bandit (resting, no newspaper — "nothing more to deliver") beside
   * the empty message. Reserved for the dedicated "See all" list screens so
   * the busy front page never carries more than one Bandit at a time.
   */
  showBanditWhenEmpty?: boolean;
};

/**
 * Shared editorial grid — equal two-column, typography-first listings for
 * Activities and Recommendations. Same rhythm as Local Events: thin rules,
 * magazine air, no listing photography.
 */
export function EditorialCardGrid({
  kicker,
  cards,
  onOpenCard,
  initialRenderCount,
  limit,
  onSeeAll,
  seeAllLabel,
  emptyCopy = "Nothing new to surface here today — check back tomorrow.",
  showBanditWhenEmpty = false,
}: Props) {
  const { width } = useWindowDimensions();
  const completeCards = cards.filter((card) => Boolean(card.title?.trim()));
  const renderCount =
    initialRenderCount ??
    (typeof limit === "number" ? limit : undefined) ??
    HOMEPAGE_INITIAL_RENDER_COUNT;
  const visible =
    renderCount != null && Number.isFinite(renderCount)
      ? sliceForInitialRender(completeCards, renderCount)
      : completeCards;
  const remainingCount = completeCards.length - visible.length;
  const seeAllTotal = completeCards.length;

  if (visible.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.kicker}>{kicker}</Text>
          <View style={styles.labelRule} />
        </View>
        {showBanditWhenEmpty ? (
          <View style={styles.emptyWithBandit}>
            <BanditCharacter
              pose="standing-no-newspaper"
              size={88}
              accessibilityLabel="Bandit, waiting calmly with nothing more to deliver right now"
            />
            <Text style={[styles.empty, styles.emptyWithBanditText]}>
              {emptyCopy}
            </Text>
          </View>
        ) : (
          <Text style={styles.empty}>{emptyCopy}</Text>
        )}
      </View>
    );
  }

  const rows: EditorialGridCard[][] = [];
  for (let i = 0; i < visible.length; i += 2) {
    rows.push(visible.slice(i, i + 2));
  }

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>{kicker}</Text>
        <View style={styles.labelRule} />
      </View>

      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[
            styles.row,
            rowIndex < rows.length - 1 && styles.rowRule,
          ]}
        >
          {row.map((card, colIndex) => {
            const open = onOpenCard ? () => onOpenCard(card) : undefined;
            const isLeft = colIndex === 0;

            return (
              <View
                key={card.id}
                style={[
                  styles.cell,
                  isLeft ? styles.cellLeft : styles.cellRight,
                ]}
              >
                <Pressable
                  onPress={open}
                  disabled={!open}
                  accessibilityRole={open ? "button" : "text"}
                  accessibilityLabel={[
                    card.overline,
                    card.title,
                    card.subtitle,
                    card.note,
                  ]
                    .filter(Boolean)
                    .join(". ")}
                  style={({ pressed }) => [
                    open && pressed && { opacity: press.opacity },
                  ]}
                >
                  <View style={styles.cardRule} />
                  <View style={styles.copy}>
                    {card.overline ? (
                      <Text style={styles.overline} maxFontSizeMultiplier={1.1}>
                        {card.overline}
                      </Text>
                    ) : null}

                    <Text
                      style={styles.title}
                      numberOfLines={3}
                      maxFontSizeMultiplier={1.15}
                    >
                      {card.title}
                    </Text>

                    {card.subtitle ? (
                      <Text
                        style={styles.venue}
                        numberOfLines={2}
                        maxFontSizeMultiplier={1.1}
                      >
                        {card.subtitle}
                      </Text>
                    ) : null}

                    {card.note ? (
                      <Text
                        style={styles.bandit}
                        numberOfLines={3}
                        maxFontSizeMultiplier={1.15}
                      >
                        {card.note}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {card.actions && card.actions.length > 0 ? (
                  <ArticleActionList
                    actions={card.actions}
                    variant="listing"
                  />
                ) : null}
              </View>
            );
          })}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}

      {onSeeAll && remainingCount > 0 ? (
        <Pressable
          onPress={onSeeAll}
          style={({ pressed }) => [
            styles.seeAllRow,
            pressed && { opacity: press.opacity },
          ]}
          accessibilityRole="button"
          accessibilityLabel={
            seeAllLabel ? seeAllLabel(seeAllTotal) : `See all ${seeAllTotal}`
          }
        >
          <Text style={styles.seeAllText} maxFontSizeMultiplier={1.2}>
            {seeAllLabel ? seeAllLabel(seeAllTotal) : `See all ${seeAllTotal}`}
            {"  "}
            <Text style={styles.seeAllArrow}>→</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 48,
    paddingBottom: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 26,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2.6,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  labelRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
  },
  empty: {
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 30,
    fontStyle: "italic",
    color: paper.inkMuted,
  },
  emptyWithBandit: {
    alignItems: "center",
    paddingVertical: 12,
  },
  emptyWithBanditText: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 320,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowRule: {
    paddingBottom: 28,
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.inkRule,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  cellLeft: {
    paddingRight: 12,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: paper.inkRule,
  },
  cellRight: {
    paddingLeft: 12,
  },
  cardRule: {
    height: 2,
    backgroundColor: paper.terracotta,
    opacity: 0.35,
    marginBottom: 14,
  },
  copy: {
    paddingTop: 0,
  },
  overline: {
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: "600",
    textTransform: "uppercase",
    color: paper.inkFaint,
    marginBottom: 10,
  },
  title: {
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "600",
    letterSpacing: -0.3,
    color: paper.ink,
    marginBottom: 8,
  },
  venue: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.15,
    color: paper.inkMuted,
    marginBottom: 12,
  },
  bandit: {
    fontSize: 13,
    lineHeight: 19,
    color: paper.inkBody,
  },
  seeAllRow: {
    marginTop: 30,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  seeAllText: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "italic",
    letterSpacing: 0.2,
    color: paper.terracotta,
    textAlign: "center",
  },
  seeAllArrow: {
    fontFamily: "Georgia",
    fontSize: 16,
    fontStyle: "normal",
    color: paper.terracotta,
  },
});
