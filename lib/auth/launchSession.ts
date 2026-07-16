/**
 * Coalesce auth session reads during cold launch — layout primes once, home reuses.
 */

import type { Session, AuthError } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import {
  recordAuthGetSession,
  recordLaunchSessionCacheHit,
} from "../perf/startupMetrics";

type LaunchSessionSnapshot = {
  session: Session | null;
  error: AuthError | null;
  at: number;
};

/** Long enough to cover layout boot → home first paint; invalidated on auth change. */
const LAUNCH_SESSION_TTL_MS = 60_000;

let launchSession: LaunchSessionSnapshot | null = null;

export function primeLaunchSession(
  session: Session | null,
  error: AuthError | null = null
): void {
  launchSession = { session, error, at: Date.now() };
}

export function invalidateLaunchSession(): void {
  launchSession = null;
}

export async function getLaunchSessionOrFetch(): Promise<{
  data: { session: Session | null };
  error: AuthError | null;
}> {
  const now = Date.now();
  if (launchSession && now - launchSession.at < LAUNCH_SESSION_TTL_MS) {
    recordLaunchSessionCacheHit();
    return {
      data: { session: launchSession.session },
      error: launchSession.error,
    };
  }

  const { data, error } = await supabase.auth.getSession();
  recordAuthGetSession();
  primeLaunchSession(data.session ?? null, error ?? null);
  return { data, error: error ?? null };
}
