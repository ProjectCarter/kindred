import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { PaperLoading } from "../components/PaperLoading";

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

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

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
      }
    }

    async function boot() {
      try {
        const initialUrl = await Linking.getInitialURL();
        await createSessionFromUrl(initialUrl);
        if (cancelled) return;

        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error && __DEV__) {
          console.error("[auth] getSession", error.message);
        }
        setSession(data.session ?? null);
      } catch (err) {
        if (__DEV__) {
          console.error(
            "[auth] boot failed",
            err instanceof Error ? err.message : String(err)
          );
        }
        if (!cancelled) setSession(null);
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
        if (!cancelled) setSession(newSession);
      }
    );

    return () => {
      cancelled = true;
      linkSub.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    const inAuthFlow = root === "login";

    if (!session && !inAuthFlow) {
      router.replace("/login");
    } else if (session && inAuthFlow) {
      router.replace("/");
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <SafeAreaProvider>
        <PaperLoading hint="Your paper is waiting…" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
