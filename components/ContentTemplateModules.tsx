/**
 * Magazine desk notes — purpose-built sections from the Universal Content System.
 * Story first (body above); these answer natural reader questions in prose.
 * Not a fact sheet, Yelp panel, or database dump.
 */

import { StyleSheet, Text, View } from "react-native";
import type { EditorialModule } from "../lib/edition/contentSystem";
import { paper, reader, type } from "../lib/edition/newspaperTheme";

type Props = {
  modules: EditorialModule[];
};

export function ContentTemplateModules({ modules }: Props) {
  if (!modules.length) return null;

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <View style={styles.rule} />
      {modules.map((mod, index) => (
        <View
          key={mod.id}
          style={[
            styles.module,
            index === modules.length - 1 && styles.moduleLast,
          ]}
        >
          <Text style={styles.label} maxFontSizeMultiplier={1.1}>
            {mod.label}
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={1.25}>
            {mod.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: paper.inkRule,
    marginBottom: 28,
  },
  module: {
    marginBottom: 28,
  },
  moduleLast: {
    marginBottom: 12,
  },
  label: {
    ...type.kicker,
    color: paper.terracotta,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  body: {
    ...reader.body,
    color: paper.inkBody,
  },
});
