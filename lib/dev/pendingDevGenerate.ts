import AsyncStorage from "@react-native-async-storage/async-storage";
import { assertDeveloperMode } from "./developerMode";

const PENDING_KEY = "@kindred/dev/pending-generate-v1";

export async function setPendingDevEditionGenerate(value: boolean): Promise<void> {
  if (!assertDeveloperMode("setPendingDevEditionGenerate")) return;
  if (value) {
    await AsyncStorage.setItem(PENDING_KEY, "1");
  } else {
    await AsyncStorage.removeItem(PENDING_KEY);
  }
}

export async function consumePendingDevEditionGenerate(): Promise<boolean> {
  if (!assertDeveloperMode("consumePendingDevEditionGenerate")) return false;
  const raw = await AsyncStorage.getItem(PENDING_KEY);
  if (raw !== "1") return false;
  await AsyncStorage.removeItem(PENDING_KEY);
  return true;
}
