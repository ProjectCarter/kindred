import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { StateAtAGlance, StateAtAGlanceSymbol } from "../lib/edition/stateAtAGlance";
import {
  resolveStateSymbolImageUri,
  stateAtAGlanceCellWidth,
  stateAtAGlanceLastRowStart,
  stateAtAGlanceSymbolOrder,
} from "../lib/edition/stateAtAGlance";
import { paper, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  glance: StateAtAGlance;
  contentWidth: number;
};

const GRID_GAP = 14;

function SymbolCell({
  symbol,
  cellWidth,
}: {
  symbol: StateAtAGlanceSymbol;
  cellWidth: number;
}) {
  const imageHeight = cellWidth;
  const imageUri = resolveStateSymbolImageUri(symbol.image);
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <View style={[styles.cell, { width: cellWidth }]}>
      <Text style={styles.cellHeading} maxFontSizeMultiplier={1.15}>
        {symbol.emoji} {symbol.label}
      </Text>
      <View style={[styles.imageFrame, { width: cellWidth, height: imageHeight }]}>
        {imageUri && !loadFailed ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: cellWidth, height: imageHeight }}
            resizeMode="cover"
            accessibilityLabel={symbol.image.caption}
            onError={() => setLoadFailed(true)}
          />
        ) : (
          <View
            style={[styles.imageUnavailable, { width: cellWidth, height: imageHeight }]}
            accessibilityRole="text"
            accessibilityLabel={`${symbol.name} photograph unavailable`}
          >
            <Text style={styles.imageUnavailableText} maxFontSizeMultiplier={1.1}>
              Photograph unavailable
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.caption} maxFontSizeMultiplier={1.15}>
        {symbol.name}
      </Text>
    </View>
  );
}

/**
 * Closing Story of module — verified state identity in an illustrated grid.
 * Capitol building photograph leads the grid when verified; reader-only.
 */
export function StateAtAGlanceSection({ glance, contentWidth }: Props) {
  const symbols = stateAtAGlanceSymbolOrder(glance);
  const cellWidth = stateAtAGlanceCellWidth(contentWidth);
  const lastRowStart = stateAtAGlanceLastRowStart(symbols.length);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.rule} />
      <Text style={styles.title} maxFontSizeMultiplier={1.15}>
        {glance.sectionTitle}
      </Text>
      <Text style={styles.factLine} maxFontSizeMultiplier={1.2}>
        <Text style={styles.factLabel}>Statehood: </Text>
        {glance.statehood}
      </Text>
      <Text style={styles.factLine} maxFontSizeMultiplier={1.2}>
        <Text style={styles.factLabel}>State Nickname: </Text>
        {glance.nickname}
      </Text>
      <Text style={[styles.factLine, styles.factLineLast]} maxFontSizeMultiplier={1.2}>
        <Text style={styles.factLabel}>Capital: </Text>
        {glance.capital}
      </Text>

      <View style={styles.grid}>
        {symbols.map((symbol, index) => (
          <View
            key={`${symbol.label}-${symbol.name}`}
            style={[
              styles.gridItem,
              index % 2 === 0 ? styles.gridItemLeft : styles.gridItemRight,
              index >= lastRowStart ? styles.gridItemBottom : styles.gridItemTop,
            ]}
          >
            <SymbolCell symbol={symbol} cellWidth={cellWidth} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 28,
  },
  title: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2,
    marginBottom: 16,
  },
  factLine: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 8,
  },
  factLineLast: {
    marginBottom: 22,
  },
  factLabel: {
    fontFamily: reader.body.fontFamily,
    fontSize: reader.body.fontSize,
    lineHeight: reader.body.lineHeight,
    fontWeight: "600",
    color: paper.ink,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -GRID_GAP / 2,
  },
  gridItem: {
    marginBottom: GRID_GAP,
  },
  gridItemLeft: {
    paddingRight: GRID_GAP / 2,
  },
  gridItemRight: {
    paddingLeft: GRID_GAP / 2,
  },
  gridItemTop: {
    marginBottom: GRID_GAP,
  },
  gridItemBottom: {
    marginBottom: 0,
  },
  cell: {
    alignItems: "stretch",
  },
  cellHeading: {
    ...reader.caption,
    fontStyle: "normal",
    color: paper.inkMuted,
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  imageFrame: {
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: paper.creamDeep,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: paper.inkRule,
  },
  imageUnavailable: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: paper.creamDeep,
    paddingHorizontal: 8,
  },
  imageUnavailableText: {
    ...reader.caption,
    fontStyle: "normal",
    color: paper.inkMuted,
    textAlign: "center",
  },
  caption: {
    ...reader.caption,
    fontStyle: "normal",
    color: paper.ink,
    marginTop: 8,
    textAlign: "center",
  },
});
