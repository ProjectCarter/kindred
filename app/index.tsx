import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { PaperLoading } from "../components/PaperLoading";
import { resolveActivePlace } from "../lib/location/deviceLocation";

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [hasInterests, setHasInterests] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setSignedIn(false);
          setChecking(false);
        }
        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (userError || !user) {
          setSignedIn(false);
          setHasInterests(false);
          setChecking(false);
          return;
        }

        setSignedIn(true);

        // Warm shared location prefs (no silent city default).
        void resolveActivePlace({ refreshIfStale: true });

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("interests")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (profileError && __DEV__) {
          console.error("[index] profiles", profileError.message);
        }

        const interests = profile?.interests;
        let list: unknown[] = [];
        if (Array.isArray(interests)) {
          list = interests;
        } else if (typeof interests === "string" && interests.trim()) {
          try {
            const parsed = JSON.parse(interests);
            if (Array.isArray(parsed)) list = parsed;
          } catch {
            list = [];
          }
        }
        setHasInterests(list.length > 0);
      } catch (err) {
        if (__DEV__) {
          console.error(
            "[index] check failed",
            err instanceof Error ? err.message : String(err)
          );
        }
        if (!cancelled) {
          setSignedIn(false);
          setHasInterests(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return <PaperLoading hint="Your paper is waiting…" />;
  }

  if (!signedIn) {
    return <Redirect href="/login" />;
  }

  return <Redirect href={hasInterests ? "/home" : "/onboarding"} />;
}
