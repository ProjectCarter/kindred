import test from "node:test";
import assert from "node:assert/strict";
import {
  weatherConditionFromWmoCode,
  weatherAlertCompactDisplay,
} from "./weatherEmojiGuide.ts";

test("weatherConditionFromWmoCode maps WMO codes to Kindred labels", () => {
  assert.deepEqual(weatherConditionFromWmoCode(0), {
    key: "sunny",
    emoji: "☀️",
    label: "Sunny",
  });
  assert.deepEqual(weatherConditionFromWmoCode(2), {
    key: "partly_cloudy",
    emoji: "⛅",
    label: "Partly Cloudy",
  });
  assert.deepEqual(weatherConditionFromWmoCode(61), {
    key: "rain",
    emoji: "🌧️",
    label: "Rain",
  });
});

test("weatherAlertCompactDisplay maps NWS-style events", () => {
  assert.deepEqual(weatherAlertCompactDisplay("Extreme Heat Warning"), {
    emoji: "🔥",
    label: "Extreme Heat Warning",
  });
  assert.deepEqual(weatherAlertCompactDisplay("Tornado Warning"), {
    emoji: "🌪️",
    label: "Tornado Warning",
  });
});
