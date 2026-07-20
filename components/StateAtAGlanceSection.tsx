import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { StateAtAGlance, StateAtAGlanceSymbol } from "../lib/edition/stateAtAGlance";
import {
  resolveStateSymbolImageUri,
  stateAtAGlanceCellWidth,
  stateAtAGlanceEditorialImageHeight,
  stateAtAGlanceEditorialImageWidth,
  stateAtAGlanceLastRowStart,
  stateAtAGlanceSymbolOrder,
} from "../lib/edition/stateAtAGlance";
import { paper, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  glance: StateAtAGlance;
  contentWidth: number;
  /** Grid for Story of; editorial single-column spread for History Around Town. */
  layout?: "grid" | "editorial";
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

  if (!imageUri || loadFailed) return null;

  return (
    <View style={[styles.cell, { width: cellWidth }]}>
      <Text style={styles.cellHeading} maxFontSizeMultiplier={1.15}>
        {symbol.emoji} {symbol.label}
      </Text>
      <View style={[styles.imageFrame, { width: cellWidth, height: imageHeight }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: cellWidth, height: imageHeight }}
          resizeMode="cover"
          accessibilityLabel={symbol.image.caption}
          onError={() => setLoadFailed(true)}
        />
      </View>
      <Text style={styles.caption} maxFontSizeMultiplier={1.15}>
        {symbol.name}
      </Text>
    </View>
  );
}

function EditorialSymbol({
  symbol,
  imageWidth,
}: {
  symbol: StateAtAGlanceSymbol;
  imageWidth: number;
}) {
  const imageHeight = stateAtAGlanceEditorialImageHeight(imageWidth);
  const imageUri = resolveStateSymbolImageUri(symbol.image);
  const [loadFailed, setLoadFailed] = useState(false);

  if (!imageUri || loadFailed) return null;

  return (
    <View style={styles.editorialSymbol}>
      <Text style={styles.editorialLabel} maxFontSizeMultiplier={1.12}>
        {symbol.emoji} {symbol.label}
      </Text>
      <View style={[styles.editorialImageWrap, { width: imageWidth, height: imageHeight }]}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: imageWidth, height: imageHeight }}
          resizeMode="contain"
          accessibilityLabel={symbol.image.caption}
          onError={() => setLoadFailed(true)}
        />
      </View>
      <Text style={styles.editorialCaption} maxFontSizeMultiplier={1.15}>
        {symbol.name}
      </Text>
    </View>
  );
}

function StateFacts({
  glance,
  factLineLastStyle,
}: {
  glance: StateAtAGlance;
  factLineLastStyle?: object;
}) {
  return (
    <>
      <Text style={styles.factLine} maxFontSizeMultiplier={1.2}>
        <Text style={styles.factLabel}>Statehood: </Text>
        {glance.statehood}
      </Text>
      <Text style={styles.factLine} maxFontSizeMultiplier={1.2}>
        <Text style={styles.factLabel}>State Nickname: </Text>
        {glance.nickname}
      </Text>
      {glance.motto?.trim() ? (
        <Text style={styles.factLine} maxFontSizeMultiplier={1.2}>
          <Text style={styles.factLabel}>State Motto: </Text>
          {glance.motto.trim()}
        </Text>
      ) : null}
      <Text
        style={[styles.factLine, factLineLastStyle]}
        maxFontSizeMultiplier={1.2}
      >
        <Text style={styles.factLabel}>Capital: </Text>
        {glance.capital}
      </Text>
    </>
  );
}

/**
 * Verified state identity — Story of grid or History Around Town editorial spread.
 */
export function StateAtAGlanceSection({
  glance,
  contentWidth,
  layout = "grid",
}: Props) {
  const symbols = stateAtAGlanceSymbolOrder(glance);

  if (layout === "editorial") {
    const imageWidth = stateAtAGlanceEditorialImageWidth(contentWidth);

    return (
      <View style={styles.editorialWrap} accessibilityRole="summary">
        <View style={styles.rule} />
        <Text style={styles.editorialTitle} maxFontSizeMultiplier={1.15}>
          {glance.sectionTitle.toUpperCase()}
        </Text>
        <StateFacts
          glance={glance}
          factLineLastStyle={
            symbols.length > 0 ? styles.editorialFactsLast : styles.factLineLast
          }
        />
        {symbols.length > 0 ? (
          <View style={styles.editorialSymbols}>
            {symbols.map((symbol) => (
              <EditorialSymbol
                key={`${symbol.label}-${symbol.name}`}
                symbol={symbol}
                imageWidth={imageWidth}
              />
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  const cellWidth = stateAtAGlanceCellWidth(contentWidth);
  const lastRowStart = stateAtAGlanceLastRowStart(symbols.length);

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.rule} />
      <Text style={styles.title} maxFontSizeMultiplier={1.15}>
        {glance.sectionTitle}
      </Text>
      <StateFacts glance={glance} factLineLastStyle={styles.factLineLast} />

      {symbols.length > 0 ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 8,
  },
  editorialWrap: {
    marginTop: 28,
    marginBottom: 8,
    alignItems: "center",
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 28,
    alignSelf: "stretch",
  },
  title: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2,
    marginBottom: 16,
  },
  editorialTitle: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.4,
    marginBottom: 18,
    textAlign: "center",
    alignSelf: "stretch",
  },
  factLine: {
    ...reader.body,
    color: paper.inkBody,
    marginBottom: 8,
    alignSelf: "stretch",
  },
  factLineLast: {
    marginBottom: 22,
  },
  editorialFactsLast: {
    marginBottom: 32,
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
    alignSelf: "stretch",
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
  editorialSymbols: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 40,
  },
  editorialSymbol: {
    alignItems: "center",
    width: "100%",
  },
  editorialLabel: {
    ...reader.caption,
    fontStyle: "normal",
    color: paper.inkMuted,
    letterSpacing: 0.6,
    marginBottom: 12,
    textAlign: "center",
  },
  editorialImageWrap: {
    backgroundColor: paper.creamDeep,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  editorialImageUnavailable: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: paper.creamDeep,
    paddingHorizontal: 12,
  },
  editorialCaption: {
    ...reader.body,
    fontSize: 17,
    lineHeight: 26,
    color: paper.ink,
    textAlign: "center",
  },
});
