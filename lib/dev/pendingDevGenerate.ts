import AsyncStorage from "@react-native-async-storage/async-storage";
import { assertDeveloperMode } from "./developerMode";

const PENDING_KEY = "@kindred/dev/pending-generate-v1";
const TRACE_KEY = "@kindred/dev/pending-generate-trace-v1";

export async function setPendingDevEditionGenerate(
  value: boolean,
  traceId?: string | null
): Promise<void> {
  if (!assertDeveloperMode("setPendingDevEditionGenerate")) return;
  if (value) {
    await AsyncStorage.setItem(PENDING_KEY, "1");
    if (traceId) {
      await AsyncStorage.setItem(TRACE_KEY, traceId);
    } else {
      await AsyncStorage.removeItem(TRACE_KEY);
    }
  } else {
    await AsyncStorage.multiRemove([PENDING_KEY, TRACE_KEY]);
  }
}

/** True while Dev Tools queued a generate — do not paint stale cache first. */
export async function peekPendingDevEditionGenerate(): Promise<boolean> {
  if (!assertDeveloperMode("peekPendingDevEditionGenerate")) return false;
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  return raw === "1";
}

export async function peekPendingDevGenerateTraceId(): Promise<string | null> {
  if (!assertDeveloperMode("peekPendingDevGenerateTraceId")) return null;
  return AsyncStorage.getItem(TRACE_KEY);
}

export async function consumePendingDevEditionGenerate(): Promise<{
  pending: boolean;
  traceId: string | null;
}> {
  if (!assertDeveloperMode("consumePendingDevEditionGenerate")) {
    return { pending: false, traceId: null };
  }
  const [raw, traceId] = await AsyncStorage.multiGet([PENDING_KEY, TRACE_KEY]);
  const pending = raw[1] === "1";
  if (!pending) {
    return { pending: false, traceId: null };
  }
  await AsyncStorage.multiRemove([PENDING_KEY, TRACE_KEY]);
  return { pending: true, traceId: traceId[1] ?? null };
}
