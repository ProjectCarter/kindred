import { Image } from "react-native";
import type { MorningHeroExperience } from "./types";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "../masterpieceDiagnostics";

/** Warm the device image cache — no network on repeat opens. */
export function preloadMorningHeroImage(
  morningHero?: MorningHeroExperience | null
): void {
  const uri = morningHero?.hostedUrl?.trim();
  if (!uri) return;
  masterpieceTraceBegin("image/preload", { artworkId: morningHero?.artworkId });
  void Image.prefetch(uri).finally(() => {
    masterpieceTraceEnd("image/preload", { artworkId: morningHero?.artworkId });
  });
}
