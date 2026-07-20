import { useCallback, useEffect, useRef, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { profileHasInterests } from "../lib/auth/hasInterests";
import { setAuthLinkError } from "../lib/auth/authLinkError";
import { PaperLoading } from "../components/PaperLoading";
import { AppErrorBoundary } from "../components/AppErrorBoundary";
import { paper } from "../lib/edition/newspaperTheme";
import { markStartup } from "../lib/perf/startupTiming";
import { beginStartupMetricsProbe, recordAuthGetSession } from "../lib/perf/startupMetrics";
import { installStartupFetchProbe } from "../lib/perf/installStartupFetchProbe";
import {
  invalidateLaunchSession,
  primeLaunchSession,
} from "../lib/auth/launchSession";
import { purgePersistedHomeScrollOffsets } from "../lib/edition/homeSession";

installStartupFetchProbe();
beginStartupMetricsProbe();

function getAuthCodeFromUrl(url: string): string | null {
  try {
    const { queryParams } = Linking.parse(url);
    const code = queryParams?.code;
    if (typeof code === "string" && code.length > 0) return code;
    if (Array.isArray(code) && typeof code[0] === "string") return code[0];

    // Fallback for unusual hosts / custom schemes.
    const normalized = url.replace(/^(kindred|exp):\/\//, "https://kindred.local/");
    const parsed = new URL(normalized);
    const fromQuery = parsed.searchParams.get("code");
    if (fromQuery) return fromQuery;
  } catch {
    // Ignore malformed URLs.
  }
  return null;
}

/** Routes allowed before interests are saved. */
function isOnboardingAllowedRoute(root: string | undefined): boolean {
  return root === "login" || root === "onboarding";
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  /** null = still resolving profile interests for the current session. */
  const [hasInterests, setHasInterests] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const verifyingGate = useRef(false);

  const refreshInterests = useCallback(async (userId: string | undefined) => {
    if (!userId || !isSupabaseConfigured) {
      setHasInterests(null);
      return false;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("interests")
        .eq("id", userId)
        .maybeSingle();

      if (error && __DEV__) {
        console.error("[auth] profiles interests", error.message);
      }

      const ok = profileHasInterests(profile?.interests);
      setHasInterests(ok);
      return ok;
    } catch (err) {
      if (__DEV__) {
        console.error(
          "[auth] interests check failed",
          err instanceof Error ? err.message : String(err)
        );
      }
      // Fail closed — send through onboarding rather than an unpersonalized home.
      setHasInterests(false);
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const exchangedCodes = new Set<string>();

    async function createSessionFromUrl(url: string | null) {
      if (!url || !isSupabaseConfigured) return;

      const code = getAuthCodeFromUrl(url);
      if (!code || exchangedCodes.has(code)) return;
      exchangedCodes.add(code);

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (__DEV__) {
          console.error("[auth] exchangeCodeForSession", error.message);
        }
        // Keep code in exchangedCodes to prevent retry storms on poisoned links.
        setAuthLinkError(
          "That sign-in link has expired or already been used. Request a fresh one below."
        );
        // Ensure the reader lands on login with the message visible.
        router.replace("/login");
      }
    }

    async function boot() {
      markStartup("layout_boot_start");
      void purgePersistedHomeScrollOffsets();
      try {
        const initialUrl = await Linking.getInitialURL();
        await createSessionFromUrl(initialUrl);
        if (cancelled) return;

        const { data, error } = await supabase.auth.getSession();
        recordAuthGetSession();
        primeLaunchSession(data.session ?? null, error ?? null);
        markStartup("layout_session_ready");
        if (cancelled) return;
        if (error && __DEV__) {
          console.error("[auth] getSession", error.message);
        }
        const next = data.session ?? null;
        setSession(next);
        if (next?.user?.id) {
          await refreshInterests(next.user.id);
          markStartup("layout_interests_ready");
        } else {
          setHasInterests(null);
        }
      } catch (err) {
        if (__DEV__) {
          console.error(
            "[auth] boot failed",
            err instanceof Error ? err.message : String(err)
          );
        }
        if (!cancelled) {
          setSession(null);
          setHasInterests(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    boot();

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void createSessionFromUrl(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (cancelled) return;
        primeLaunchSession(newSession);
        setSession(newSession);
        if (newSession?.user?.id) {
          void refreshInterests(newSession.user.id);
        } else {
          setHasInterests(null);
        }
      }
    );

    return () => {
      cancelled = true;
      invalidateLaunchSession();
      linkSub.remove();
      listener.subscription.unsubscribe();
    };
  }, [refreshInterests, router]);

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    const inAuthFlow = root === "login";

    if (!session && !inAuthFlow) {
      router.replace("/login");
      return;
    }

    if (!session) return;

    // Wait until interests are known before routing past the gate.
    if (hasInterests === null) return;

    if (inAuthFlow) {
      router.replace(hasInterests ? "/" : "/onboarding");
      return;
    }

    if (!hasInterests && !isOnboardingAllowedRoute(root)) {
      // Re-check before bouncing — covers the moment after interests are saved
      // and onboarding navigates to /home while layout state is still stale.
      if (verifyingGate.current) return;
      verifyingGate.current = true;
      void (async () => {
        try {
          const ok = await refreshInterests(session.user.id);
          if (!ok) router.replace("/onboarding");
        } finally {
          verifyingGate.current = false;
        }
      })();
      return;
    }

    if (hasInterests && root === "onboarding") {
      router.replace("/home");
    }
  }, [session, loading, segments, router, hasInterests, refreshInterests]);

  if (loading || (session && hasInterests === null)) {
    return (
      <SafeAreaProvider>
        <PaperLoading hint="Your paper is waiting…" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            gestureEnabled: true,
            freezeOnBlur: false,
            contentStyle: { backgroundColor: paper.sky },
          }}
        >
          <Stack.Screen
            name="home"
            options={{ contentStyle: { backgroundColor: paper.page } }}
          />
        </Stack>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
