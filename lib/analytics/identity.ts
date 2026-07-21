import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const ANONYMOUS_USER_ID_KEY = "@kindred/analytics/anonymous-user-id";

let sessionId: string | null = null;
let anonymousUserIdCache: string | null = null;

function randomId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? "1.0.0";
}

export function getAnalyticsPlatform(): string {
  return Platform.OS;
}

/** New session on each cold app launch / root layout boot. */
export function startAnalyticsSession(): string {
  sessionId = randomId();
  return sessionId;
}

export function getAnalyticsSessionId(): string {
  if (!sessionId) {
    sessionId = randomId();
  }
  return sessionId;
}

/** Device-local anonymous id — never derived from email or auth uid. */
export async function getAnonymousUserId(): Promise<string> {
  if (anonymousUserIdCache) return anonymousUserIdCache;
  try {
    const stored = await AsyncStorage.getItem(ANONYMOUS_USER_ID_KEY);
    if (stored?.trim()) {
      anonymousUserIdCache = stored.trim();
      return anonymousUserIdCache;
    }
  } catch {
    /* fall through */
  }
  const next = randomId();
  anonymousUserIdCache = next;
  void AsyncStorage.setItem(ANONYMOUS_USER_ID_KEY, next).catch(() => {});
  return next;
}
