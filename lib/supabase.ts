import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && __DEV__) {
  console.error(
    "[kindred] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Check .env.local."
  );
}

/**
 * Placeholder host only when misconfigured — prevents hard crash on import.
 * Auth and queries will fail until env is set; UI surfaces calm errors.
 */
export const supabase = createClient(
  supabaseUrl || "https://example.supabase.co",
  supabaseAnonKey || "public-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Native apps handle the redirect URL via Expo Linking instead.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  }
);
