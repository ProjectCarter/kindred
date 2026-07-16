/**
 * Dev-only fetch wrapper — counts Supabase REST + Edge Function calls during startup.
 */

import { isStartupMetricsProbeActive, recordStartupFetch } from "./startupMetrics";

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();

let installed = false;

export function installStartupFetchProbe(): void {
  if (installed || !__DEV__) return;
  installed = true;

  const host = (() => {
    try {
      return supabaseUrl ? new URL(supabaseUrl).host : "";
    } catch {
      return "";
    }
  })();

  const original = global.fetch.bind(global);
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isStartupMetricsProbeActive()) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      recordStartupFetch(url, host);
    }
    return original(input, init);
  };
}
