import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { PaperLoading } from "../components/PaperLoading";
import { resolveActivePlace } from "../lib/location/deviceLocation";
import { profileHasInterests } from "../lib/auth/hasInterests";

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

        setHasInterests(profileHasInterests(profile?.interests));
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

  // Root layout also enforces this gate for deep links to /home etc.
  return <Redirect href={hasInterests ? "/home" : "/onboarding"} />;
}
