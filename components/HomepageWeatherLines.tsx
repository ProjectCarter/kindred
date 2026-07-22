import { StyleSheet, Text, View } from "react-native";
import type { HomepageWeatherDisplay } from "../lib/weather/homepageWeatherDisplay";
import { paper } from "../lib/edition/newspaperTheme";

type Props = {
  weather: HomepageWeatherDisplay;
};

export function HomepageWeatherLines({ weather }: Props) {
  if (weather.isUnavailable) {
    return (
      <View style={styles.wrap} accessibilityRole="text">
        <Text style={styles.current} maxFontSizeMultiplier={1.2}>
          {weather.condition.emoji} {weather.condition.label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.current} maxFontSizeMultiplier={1.2}>
        {weather.condition.emoji} {weather.current}
      </Text>
      {weather.highLow ? (
        <Text style={styles.highLow} maxFontSizeMultiplier={1.15}>
          {weather.highLow}
        </Text>
      ) : null}
      <Text style={styles.condition} maxFontSizeMultiplier={1.15}>
        {weather.condition.label}
      </Text>
      {weather.alert ? (
        <Text style={styles.alert} maxFontSizeMultiplier={1.15}>
          {weather.alert.emoji} {weather.alert.label}
        </Text>
      ) : null}
      {weather.planningNote?.trim() ? (
        <Text style={styles.planningNote} maxFontSizeMultiplier={1.15}>
          {weather.planningNote.trim()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  current: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
    marginBottom: 4,
  },
  highLow: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginBottom: 2,
  },
  condition: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkBody,
  },
  alert: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkBody,
    marginTop: 6,
  },
  planningNote: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkMuted,
    marginTop: 8,
    maxWidth: 520,
  },
});
