import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import {
  orderEventsForGrid,
  LOCAL_EVENTS_GRID_LIMIT,
  type LocalEventCard,
} from "../lib/edition/localEvents";
import {
  deriveEventBadge,
  eventPlaceLine,
} from "../lib/edition/eventStore";
import { eventInfoBadgesFor, eventInfoBadgeAccessibilitySummary } from "../lib/edition/eventBadges";
import { EventInfoBadgeRow } from "./EventInfoBadgeRow";
import { paper, press } from "../lib/edition/newspaperTheme";

type Props = {
  events: LocalEventCard[];
  onOpenEvent?: (event: LocalEventCard) => void;
  /** Front page caps at LOCAL_EVENTS_GRID_LIMIT; the full Events list passes a larger value. */
  limit?: number;
  /** Present only on the front page — shown below the grid once there are more events than fit. */
  onSeeAll?: () => void;
};

/**
 * Local Events — Monocle-inspired editorial grid.
 * Equal two-column modules, photography-led, thin rules, magazine air.
 * Sharp corners only — no shadows, pills, or button chrome.
 */
export function LocalEventsGrid({
  events,
  onOpenEvent,
  limit = LOCAL_EVENTS_GRID_LIMIT,
  onSeeAll,
}: Props) {
  const { width } = useWindowDimensions();
  /** Page column inside home’s 28px folio padding. */
  const pageW = width - 56;
  const halfGap = 12;
  const colInner = Math.floor((pageW - halfGap * 2 - StyleSheet.hairlineWidth) / 2);
  const photoH = Math.round(colInner * 1.2);
  const visible = orderEventsForGrid(events, limit);
  const remainingCount = events.length - visible.length;

  if (visible.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={styles.kicker}>Local Events</Text>
          <View style={styles.labelRule} />
        </View>
        <Text style={styles.empty}>
          A quiet day nearby — the perfect excuse for a slow walk.
        </Text>
      </View>
    );
  }

  const rows: LocalEventCard[][] = [];
  for (let i = 0; i < visible.length; i += 2) {
    rows.push(visible.slice(i, i + 2));
  }

  return (
    <View style={styles.section} accessibilityRole="summary">
      <View style={styles.labelRow}>
        <Text style={styles.kicker}>Local Events</Text>
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
          {row.map((event, colIndex) => {
            const index = rowIndex * 2 + colIndex;
            const badge = deriveEventBadge(event);
            const infoBadges = eventInfoBadgesFor(event);
            const venue = event.venue?.trim() || eventPlaceLine(event);
            const timeLine =
              event.time && event.time !== "Time TBA"
                ? event.time
                : event.date !== "Date TBA"
                  ? event.date
                  : null;
            const overline = [badge, timeLine].filter(Boolean).join("  ·  ");
            const note = event.banditNote?.trim() || null;
            const open = onOpenEvent ? () => onOpenEvent(event) : undefined;
            const isLeft = colIndex === 0;

            return (
              <Pressable
                key={`${event.name}-${event.date}-${index}`}
                onPress={open}
                disabled={!open}
                accessibilityRole={open ? "button" : "text"}
                accessibilityLabel={[
                  event.name,
                  timeLine,
                  venue,
                  note,
                  badge,
                  infoBadges.length
                    ? eventInfoBadgeAccessibilitySummary(infoBadges)
                    : null,
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
                  {event.imageUrl ? (
                    <Image
                      source={{ uri: event.imageUrl }}
                      style={{ width: "100%", height: photoH }}
                      resizeMode="cover"
                      accessibilityLabel={event.name}
                    />
                  ) : (
                    <View
                      style={[styles.photoFallback, { height: photoH }]}
                    >
                      <SymbolView
                        name="calendar"
                        size={20}
                        weight="light"
                        tintColor={paper.inkFaint}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        fallback={
                          <Ionicons
                            name="calendar-outline"
                            size={20}
                            color={paper.inkFaint}
                          />
                        }
                      />
                    </View>
                  )}
                </View>

                <View style={styles.copy}>
                  {overline ? (
                    <Text style={styles.overline} maxFontSizeMultiplier={1.1}>
                      {overline}
                    </Text>
                  ) : null}

                  <Text
                    style={styles.title}
                    numberOfLines={3}
                    maxFontSizeMultiplier={1.15}
                  >
                    {event.name}
                  </Text>

                  <EventInfoBadgeRow
                    badges={infoBadges}
                    style={styles.badgeRow}
                  />

                  {venue ? (
                    <Text
                      style={styles.venue}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.1}
                    >
                      {venue}
                    </Text>
                  ) : null}

                  {note ? (
                    <Text
                      style={styles.bandit}
                      numberOfLines={2}
                      maxFontSizeMultiplier={1.15}
                    >
                      {note}
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
          accessibilityLabel={`See all ${events.length} events`}
        >
          <Text style={styles.seeAllText} maxFontSizeMultiplier={1.2}>
            See all {events.length} events{"  "}
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
