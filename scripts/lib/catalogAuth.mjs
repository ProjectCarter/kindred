/**
 * Auth headers for catalog / market build Edge Functions.
 * Gateway requires a Supabase JWT (service role preferred); function auth uses CRON_SECRET.
 */

const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzgzNTAsImV4cCI6MjA5ODg1NDM1MH0.TRk_okPkSXp17MUej4-XUY4oq0FIrX1cMlcoIsnk_zE";

export function catalogAuthHeaders() {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    throw new Error(
      "CRON_SECRET required — set in .env.local or export before running catalog build scripts."
    );
  }
  const gatewayJwt =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    FALLBACK_ANON_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${gatewayJwt}`,
    "x-cron-secret": cronSecret,
  };
}

export function supabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    "https://zdqjeocdsbdzecawumdp.supabase.co"
  );
}

export function serviceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (key) return key;
  const fallback =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";
  if (process.env.KINDRED_ALLOW_FALLBACK_SERVICE_KEY === "1") return fallback;
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY required for direct database scripts (or set KINDRED_ALLOW_FALLBACK_SERVICE_KEY=1 for ops scripts)."
  );
}
