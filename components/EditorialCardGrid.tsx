import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { paper, press } from "../lib/edition/newspaperTheme";
import { HOMEPAGE_INITIAL_RENDER_COUNT, sliceForInitialRender } from "../lib/edition/editorialPublishing";
import { shouldShowEditorialSeeAllFooter } from "../lib/edition/foodDrinksHomepage";
import { trackSectionViewedOnce } from "../lib/analytics";
import type { EventInfoBadgeId } from "../lib/edition/eventBadges";
import { eventInfoBadgeAccessibilitySummary } from "../lib/edition/eventBadges";
import { BanditCharacter } from "./BanditCharacter";
import { EditorialTitle } from "./EditorialTitle";
import { EventInfoBadgeRow } from "./EventInfoBadgeRow";
import { CompactBrickRow, COMPACT_ROW_GAP } from "./CompactBrickRow";

export type EditorialGridCard = {
  id: string;
  /** Small caps meta line above the title (category, distance, price tier…). */
  overline?: string | null;
  /** Single editorial category emoji — shown before title. */
  categoryIcon?: string | null;
  title: string;
  /** City, source, or neighborhood line beneath the headline. */
  subtitle?: string | null;
  /** Kindred's own one-line editorial voice for this card. */
  note?: string | null;
  /** Utility badges — Local Events and future verified listing metadata. */
  badges?: readonly EventInfoBadgeId[];
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
  /** Full desk pool count for See All footer (defaults to cards.length). */
  seeAllTotal?: number;
  emptyCopy?: string;
  /**
   * Shows Bandit (resting, no newspaper — "nothing more to deliver") beside
   * the empty message. Reserved for the dedicated "See all" list screens so
   * the busy front page never carries more than one Bandit at a time.
   */
  showBanditWhenEmpty?: boolean;
  /** Fire section_viewed once per edition when the desk mounts on the homepage. */
  analyticsSectionType?: string;
  /**
   * Homepage floating-card desks — independent tinted tiles on cream.
   * `lavender` → Food & Drinks · `sage` → Activities · `sky` → Local Events.
   */
  floatingCardTint?: "lavender" | "sage" | "sky";
  /**
   * Homepage-only compact presentation — a single vertical stack of fixed-height
   * "brick" rows instead of the two-column grid. See All screens leave this off.
   */
  compact?: boolean;
  /** Accent color for the left rounded square in compact rows (per section). */
  accentColor?: string;
};

/** Fallback accent when a compact caller omits an explicit section color. */
const DEFAULT_COMPACT_ACCENT = "#C2A9EF";

/** Homepage floating-card grid — matches homepage content gutter. */
const FLOATING_HOMEPAGE_GUTTER = 28;
const FLOATING_GRID_GAP = 14;
/** Fixed tile height — ~15% shorter than the original editorial grid. */
const FLOATING_CARD_HEIGHT = 243;

const FLOATING_CARD_TINTS = {
  lavender: "rgba(194, 169, 239, 0.15)",
  /** Activities floating cards — #FFD6A5 at the same opacity as Food & Drinks. */
  sage: "rgba(255, 214, 165, 0.15)",
  /** Local Events floating cards — #FF7770 at the same opacity. */
  sky: "rgba(255, 119, 112, 0.15)",
} as const;

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
  seeAllTotal: seeAllTotalProp,
  emptyCopy = "Nothing new to surface here today — check back tomorrow.",
  showBanditWhenEmpty = false,
  analyticsSectionType,
  floatingCardTint,
  compact = false,
  accentColor,
}: Props) {
  const { width } = useWindowDimensions();
  const hasFloatingCards = floatingCardTint != null;
  const completeCards = cards.filter((card) => Boolean(card.title?.trim()));

  useEffect(() => {
    if (!analyticsSectionType || completeCards.length === 0) return;
    trackSectionViewedOnce(analyticsSectionType);
  }, [analyticsSectionType, completeCards.length]);

  const renderCount =
    initialRenderCount ??
    (typeof limit === "number" ? limit : undefined) ??
    HOMEPAGE_INITIAL_RENDER_COUNT;
  const visible =
    renderCount != null && Number.isFinite(renderCount)
      ? sliceForInitialRender(completeCards, renderCount)
      : completeCards;
  const seeAllTotal = seeAllTotalProp ?? completeCards.length;
  const showSeeAllFooter = shouldShowEditorialSeeAllFooter({
    hasHandler: Boolean(onSeeAll),
    visibleCount: visible.length,
    seeAllTotal: seeAllTotalProp,
    cardCount: completeCards.length,
  });

  const floatingCardWidth = hasFloatingCards
    ? (width - FLOATING_HOMEPAGE_GUTTER * 2 - FLOATING_GRID_GAP) / 2
    : 0;
  const floatingGridWidth = floatingCardWidth * 2 + FLOATING_GRID_GAP;

  const sectionStyle = [styles.section];

  if (visible.length === 0) {
    return (
      <View style={sectionStyle}>
        <View style={styles.labelRow}>
          <Text style={styles.kicker}>{kicker}</Text>
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

  const compactStack = compact ? (
    <View style={styles.compactStack}>
      {visible.map((card) => {
        const open = onOpenCard ? () => onOpenCard(card) : undefined;
        const secondary =
          card.subtitle?.trim() ||
          card.overline?.trim() ||
          card.note?.trim() ||
          null;
        return (
          <CompactBrickRow
            key={card.id}
            title={card.title}
            secondary={secondary}
            icon={card.categoryIcon}
            accentColor={accentColor ?? DEFAULT_COMPACT_ACCENT}
            onPress={open}
            accessibilityLabel={[
              card.overline,
              card.title,
              card.subtitle,
              card.note,
              card.badges?.length
                ? eventInfoBadgeAccessibilitySummary([...card.badges])
                : null,
            ]
              .filter(Boolean)
              .join(". ")}
          />
        );
      })}
    </View>
  ) : null;

  const rows: EditorialGridCard[][] = [];
  for (let i = 0; i < visible.length; i += 2) {
    rows.push(visible.slice(i, i + 2));
  }

  const gridRows = rows.map((row, rowIndex) => (
    <View
      key={`row-${rowIndex}`}
      style={[
        styles.row,
        hasFloatingCards && styles.floatingRow,
        hasFloatingCards && { width: floatingGridWidth },
        !hasFloatingCards &&
          rowIndex < rows.length - 1 &&
          styles.rowRule,
      ]}
    >
      {row.map((card, colIndex) => {
        const open = onOpenCard ? () => onOpenCard(card) : undefined;
        const isLeft = colIndex === 0;

        return (
          <Pressable
            key={card.id}
            onPress={open}
            disabled={!open}
            accessibilityRole={open ? "button" : "text"}
            accessibilityLabel={[
              card.overline,
              card.title,
              card.subtitle,
              card.note,
              card.badges?.length
                ? eventInfoBadgeAccessibilitySummary([...card.badges])
                : null,
            ]
              .filter(Boolean)
              .join(". ")}
            style={({ pressed }) => [
              !hasFloatingCards && styles.cell,
              hasFloatingCards
                ? [
                    styles.floatingTile,
                    {
                      width: floatingCardWidth,
                      height: FLOATING_CARD_HEIGHT,
                      backgroundColor: FLOATING_CARD_TINTS[floatingCardTint!],
                    },
                  ]
                : isLeft
                  ? styles.cellLeft
                  : styles.cellRight,
              open && pressed && { opacity: press.opacity },
            ]}
          >
            <View style={styles.cardRule} />
            <View style={styles.copy}>
              {card.overline ? (
                <Text
                  style={[styles.overline, hasFloatingCards && styles.overlineOnFloating]}
                  maxFontSizeMultiplier={1.1}
                >
                  {card.overline}
                </Text>
              ) : null}

              <EditorialTitle
                icon={card.categoryIcon}
                title={card.title}
                style={styles.title}
                numberOfLines={3}
                maxFontSizeMultiplier={1.15}
              />

              {card.badges?.length ? (
                <EventInfoBadgeRow
                  badges={[...card.badges]}
                  style={styles.badgeRow}
                />
              ) : null}

              {card.subtitle ? (
                <Text
                  style={[styles.venue, hasFloatingCards && styles.venueOnFloating]}
                  numberOfLines={2}
                  maxFontSizeMultiplier={1.1}
                >
                  {card.subtitle}
                </Text>
              ) : null}

              {card.note ? (
                <Text
                  style={[styles.bandit, hasFloatingCards && styles.banditOnFloating]}
                  numberOfLines={3}
                  maxFontSizeMultiplier={1.15}
                >
                  {card.note}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {row.length === 1 ? (
        hasFloatingCards ? (
          <View
            style={{
              width: floatingCardWidth,
              height: FLOATING_CARD_HEIGHT,
            }}
          />
        ) : (
          <View style={styles.cell} />
        )
      ) : null}
    </View>
  ));

  return (
    <View style={sectionStyle} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>{kicker}</Text>
        {showSeeAllFooter && onSeeAll ? (
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              seeAllLabel ? seeAllLabel(seeAllTotal) : `See all ${seeAllTotal}`
            }
            style={({ pressed }) => [pressed && { opacity: press.opacity }]}
          >
            <Text style={styles.seeAllInline} maxFontSizeMultiplier={1.2}>
              {seeAllLabel ? seeAllLabel(seeAllTotal) : `See all ${seeAllTotal}`}
              {"  "}
              <Text style={styles.seeAllInlineArrow}>→</Text>
            </Text>
          </Pressable>
        ) : null}
      </View>

      {compact ? (
        compactStack
      ) : hasFloatingCards ? (
        <View style={styles.floatingGrid}>{gridRows}</View>
      ) : (
        gridRows
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 4,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paper.border,
  },
  /** Compact homepage stack — evenly spaced fixed-height brick rows. */
  compactStack: {
    gap: COMPACT_ROW_GAP,
  },
  /** Centered floating-card grid (Food & Drinks + Activities). */
  floatingGrid: {
    alignItems: "center",
  },
  /** Independent tiles — 2-up with breathing room. */
  floatingRow: {
    gap: FLOATING_GRID_GAP,
    marginBottom: FLOATING_GRID_GAP,
  },
  /** Premium floating tile shell — tint applied per desk. */
  floatingTile: {
    borderRadius: 20,
    padding: 14,
    overflow: "hidden",
  },
  /** Slight contrast lift — readable on tinted tiles. */
  overlineOnFloating: {
    color: "#6B645C",
  },
  venueOnFloating: {
    color: "#5F5852",
  },
  banditOnFloating: {
    color: paper.ink,
  },
  seeAllTextOnFloating: {
    color: "#A35F35",
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 2.4,
    fontWeight: "700",
    textTransform: "uppercase",
    color: paper.terracotta,
  },
  /**
   * Right-aligned "See all X →" — premium editorial navigation. Georgia italic
   * at a light weight so it reads like a magazine cross-reference, not UI text.
   */
  seeAllInline: {
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontSize: 13,
    letterSpacing: 0.2,
    fontWeight: "400",
    color: paper.terracotta,
  },
  seeAllInlineArrow: {
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontSize: 13,
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
    paddingBottom: 16,
    marginBottom: 16,
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
  badgeRow: {
    marginBottom: 10,
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
    marginTop: 18,
    paddingVertical: 10,
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
