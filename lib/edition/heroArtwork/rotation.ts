import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "kindred.heroArtwork.recentIds";
const MAX_RECENT = 14;

/** Separate rotation memory from legacy hero photography (`kindred.hero.recentImageIds`). */
export async function loadRecentHeroArtworkIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function rememberHeroArtworkShown(artworkId: string): Promise<void> {
  if (!artworkId) return;
  try {
    const existing = await loadRecentHeroArtworkIds();
    const next = [artworkId, ...existing.filter((id) => id !== artworkId)].slice(
      0,
      MAX_RECENT
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Rotation memory is best-effort.
  }
}
