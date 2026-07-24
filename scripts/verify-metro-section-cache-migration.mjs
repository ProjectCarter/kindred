#!/usr/bin/env node
/**
 * Verify migration 0061 (kindred_metro_section_cache) on the linked Supabase project.
 * Uses anon REST — table missing returns PGRST205; RLS denial returns different code.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "unknown";

const response = await fetch(
  `${url}/rest/v1/kindred_metro_section_cache?select=id&limit=1`,
  {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  }
);

const body = await response.json().catch(() => ({}));
const tableExists =
  response.ok ||
  (body?.code && body.code !== "PGRST205" && !/not find the table/i.test(String(body.message)));

console.log(
  JSON.stringify(
    {
      projectRef,
      tableExists,
      httpStatus: response.status,
      hint: tableExists
        ? "Table reachable (apply migration if this was false before)"
        : "Apply supabase/migrations/0061_metro_section_cache.sql via Dashboard SQL or: npx supabase db push",
      error: body?.message ?? null,
    },
    null,
    2
  )
);

process.exit(tableExists ? 0 : 1);
