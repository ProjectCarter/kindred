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

  const detail = [weather.highLow, weather.condition.label]
    .filter((part) => part && part.trim())
    .join(" · ");

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.row}>
        <Text style={styles.current} maxFontSizeMultiplier={1.2}>
          {weather.condition.emoji} {weather.current}
        </Text>
        {detail ? (
          <Text style={styles.detail} maxFontSizeMultiplier={1.15} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {weather.alert ? (
        <Text style={styles.alert} maxFontSizeMultiplier={1.15}>
          {weather.alert.emoji} {weather.alert.label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  current: {
    fontFamily: "Georgia",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.2,
    color: paper.ink,
  },
  detail: {
    flexShrink: 1,
    marginLeft: 12,
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: "#555555",
  },
  alert: {
    fontFamily: "Georgia",
    fontSize: 15,
    lineHeight: 22,
    color: paper.inkBody,
    marginTop: 6,
  },
});
