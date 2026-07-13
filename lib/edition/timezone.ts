import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";

/**
 * Overnight generation used to assume one shared UTC instant for every
 * user's "morning" — wrong for anyone outside that one timezone. This
 * reports the device's real IANA timezone so process-edition-jobs can
 * compute each user's own local date/hour instead.
 */

const LAST_SYNCED_KEY = "@kindred/timezone/last-synced";

let memoryLastSynced: string | null = null;

export function deviceTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : null;
  } catch {
    return null;
  }
}

/**
 * Persists the device's timezone to `profiles.timezone` if it differs from
 * the last value this device reported. Cheap on the common case — checks
 * an in-memory value, then AsyncStorage, before ever touching the network.
 * Fire-and-forget; never blocks edition loading.
 */
export async function syncDeviceTimezone(userId: string): Promise<void> {
  const tz = deviceTimezone();
  if (!tz || !userId) return;

  if (memoryLastSynced === tz) return;

  try {
    const cached = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    if (cached === tz) {
      memoryLastSynced = tz;
      return;
    }
  } catch {
    // Storage read failed — fall through and write anyway.
  }

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", userId);

    if (!error) {
      memoryLastSynced = tz;
      void AsyncStorage.setItem(LAST_SYNCED_KEY, tz).catch(() => {});
    }
  } catch {
    // Best-effort — a missed sync just means process-edition-jobs falls
    // back to its default timezone for this user until the next attempt.
  }
}
