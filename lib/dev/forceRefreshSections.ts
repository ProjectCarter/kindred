/**
 * Developer-only section force refresh — passed to generate-edition when
 * devPreview is active. Normal reload, cache clear, and city selection never set this.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { assertDeveloperMode } from "./developerMode";

const STORAGE_KEY = "@kindred/dev/force-refresh-sections-v1";

let pendingForceRefreshSections: string[] | null = null;

export async function setPendingForceRefreshSections(
  sections: readonly string[] | null
): Promise<void> {
  if (!assertDeveloperMode("setPendingForceRefreshSections")) return;
  pendingForceRefreshSections = sections?.length ? [...sections] : null;
  if (pendingForceRefreshSections) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pendingForceRefreshSections));
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function consumePendingForceRefreshSections(): Promise<string[] | null> {
  if (!assertDeveloperMode("consumePendingForceRefreshSections")) return null;
  if (pendingForceRefreshSections?.length) {
    const consumed = pendingForceRefreshSections;
    pendingForceRefreshSections = null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    return consumed;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return null;
  }
}

/** Request a one-shot full section refresh on the next dev edition build. */
export async function requestDevForceRefreshAllSections(): Promise<void> {
  await setPendingForceRefreshSections(["all"]);
}
