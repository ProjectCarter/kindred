import { Image } from "react-native";
import type { MorningHeroExperience } from "./types";

/** Warm the device image cache — no network on repeat opens. */
export function preloadMorningHeroImage(
  morningHero?: MorningHeroExperience | null
): void {
  const uri = morningHero?.hostedUrl?.trim();
  if (!uri) return;
  void Image.prefetch(uri);
}
