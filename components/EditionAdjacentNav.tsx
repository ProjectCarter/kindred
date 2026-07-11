import { Text, View, Pressable, StyleSheet } from "react-native";
import { formatEditionDate } from "../lib/edition/types";
import type { AdjacentEdition } from "../lib/edition/adjacent";
import { paper, press, type } from "../lib/edition/newspaperTheme";

type Props = {
  older: AdjacentEdition | null;
  newer: AdjacentEdition | null;
  onOpen: (edition: AdjacentEdition) => void;
};

export function EditionAdjacentNav({ older, newer, onOpen }: Props) {
  if (!older && !newer) return null;

  return (
    <View style={styles.wrap}>
      {older ? (
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => onOpen(older)}
          accessibilityRole="button"
          accessibilityLabel={`Earlier edition, ${formatEditionDate(older.edition_date)}`}
        >
          <Text style={styles.direction}>Earlier</Text>
          <Text style={styles.date}>{formatEditionDate(older.edition_date)}</Text>
        </Pressable>
      ) : (
        <View style={styles.rowPlaceholder} />
      )}

      {newer ? (
        <Pressable
          style={({ pressed }) => [
            styles.row,
            styles.rowEnd,
            pressed && styles.pressed,
          ]}
          onPress={() => onOpen(newer)}
          accessibilityRole="button"
          accessibilityLabel={`A later edition, ${formatEditionDate(newer.edition_date)}`}
        >
          <Text style={[styles.direction, styles.directionEnd]}>Later</Text>
          <Text style={[styles.date, styles.dateEnd]}>
            {formatEditionDate(newer.edition_date)}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.rowPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: paper.inkRule,
  },
  row: {
    flex: 1,
  },
  rowEnd: {
    alignItems: "flex-end",
  },
  rowPlaceholder: {
    flex: 1,
  },
  direction: {
    ...type.kicker,
    color: paper.terracotta,
    marginBottom: 6,
  },
  directionEnd: {
    textAlign: "right",
  },
  date: {
    fontFamily: "Georgia",
    fontSize: 15,
    color: paper.ink,
    lineHeight: 22,
  },
  dateEnd: {
    textAlign: "right",
  },
  pressed: {
    opacity: press.opacity,
  },
});
