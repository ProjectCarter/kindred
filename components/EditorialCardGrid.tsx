import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { paper, press } from "../lib/edition/newspaperTheme";
import { SEE_ALL_MAX } from "../lib/edition/seeAllLimit";
import { BanditCharacter } from "./BanditCharacter";

export type EditorialGridCard = {
  id: string;
  /** Bundled category photography — Activities/Recommendations never carry a provider photo. */
  image?: ImageSourcePropType | null;
  /** Small caps meta line above the title (category, distance, price tier…). */
  overline?: string | null;
  title: string;
  /** Venue-equivalent line (neighborhood, address). */
  subtitle?: string | null;
  /** Kindred's own one-line editorial voice for this card. */
  note?: string | null;
};

type Props = {
  kicker: string;
  cards: EditorialGridCard[];
  onOpenCard?: (card: EditorialGridCard) => void;
  /** Front page caps at `limit`; the full list screen passes a larger value. */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more items than fit. */
  onSeeAll?: () => void;
  /** e.g. (n) => `See all ${n} activities` */
  seeAllLabel?: (total: number) => string;
  emptyCopy?: string;
  fallbackIcon?: SFSymbol;
  fallbackIconIonicon?: keyof typeof Ionicons.glyphMap;
  /**
   * Shows Bandit (resting, no newspaper — "nothing more to deliver") beside
   * the empty message. Reserved for the dedicated "See all" list screens so
   * the busy front page never carries more than one Bandit at a time.
   */
  showBanditWhenEmpty?: boolean;
};

/**
 * Shared editorial grid — the same equal two-column, photography-led
 * module as Local Events, generalized so Activities and Recommendations
 * share its exact layout, spacing, and "See More" rhythm. Local Events
 * itself keeps its own component (event-specific badges/venue parsing);
 * this is the pattern the other two desks reuse, kept visually identical
 * on purpose so the front page reads as one paper, not three feeds.
 */
export function EditorialCardGrid({
  kicker,
  cards,
  onOpenCard,
  limit,
  onSeeAll,
  seeAllLabel,
  emptyCopy = "Nothing new to surface here today — check back tomorrow.",
  fallbackIcon = "square.grid.2x2",
  fallbackIconIonicon = "grid-outline",
  showBanditWhenEmpty = false,
}: Props) {
  const { width } = useWindowDimensions();
  /** Page column inside home’s 28px folio padding. */
  const pageW = width - 56;
  const halfGap = 12;
  const colInner = Math.floor((pageW - halfGap * 2 - StyleSheet.hairlineWidth) / 2);
  const photoH = Math.round(colInner * 1.2);
  const completeCards = cards.filter(
    (card) => Boolean(card.title?.trim()) && Boolean(card.image)
  );
  const visible =
    typeof limit === "number" ? completeCards.slice(0, limit) : completeCards;
  const remainingCount = completeCards.length - visible.length;
  // The "See all" destination page caps at SEE_ALL_MAX (kindred-mission.mdc)
  // — never promise a bigger number here than what that page will show.
  const seeAllTotal = Math.min(completeCards.length, SEE_ALL_MAX);

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
                ]
                  .filter(Boolean)
                  .join(". ")}
                style={({ pressed }) => [
                  styles.cell,
                  isLeft ? styles.cellLeft : styles.cellRight,
                  open && pressed && { opacity: press.opacity },
                ]}
              >
                <View style={styles.photoFrame}>
                  {card.image ? (
                    <Image
                      source={card.image}
                      style={{ width: "100%", height: photoH }}
                      resizeMode="cover"
                      accessibilityLabel={card.title}
                    />
                  ) : (
                    <View style={[styles.photoFallback, { height: photoH }]}>
                      <SymbolView
                        name={fallbackIcon}
                        size={20}
                        weight="light"
                        tintColor={paper.inkFaint}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        fallback={
                          <Ionicons
                            name={fallbackIconIonicon}
                            size={20}
                            color={paper.inkFaint}
                          />
                        }
                      />
                    </View>
                  )}
                </View>

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
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.1}
                    >
                      {card.subtitle}
                    </Text>
                  ) : null}

                  {card.note ? (
                    <Text
                      style={styles.bandit}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.15}
                    >
                      {card.note}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
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
  photoFrame: {
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    width: "100%",
  },
  photoFallback: {
    width: "100%",
    backgroundColor: paper.creamDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    paddingTop: 16,
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
