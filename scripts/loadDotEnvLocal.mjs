/** Load .env.local into process.env (audit / ops scripts only). */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function loadDotEnvLocal(cwd = process.cwd()) {
  const path = join(cwd, ".env.local");
  if (!existsSync(path)) return false;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}
