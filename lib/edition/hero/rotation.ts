import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "kindred.hero.recentImageIds";
const MAX_RECENT = 12;

/**
 * Remember recently shown heroes so the living library can rotate.
 */
export async function loadRecentHeroImageIds(): Promise<string[]> {
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

export async function rememberHeroImageShown(imageId: string): Promise<void> {
  if (!imageId) return;
  try {
    const existing = await loadRecentHeroImageIds();
    const next = [
      imageId,
      ...existing.filter((id) => id !== imageId),
    ].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Rotation memory is best-effort.
  }
}
