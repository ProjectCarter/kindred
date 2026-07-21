#!/usr/bin/env node
/**
 * Greeting + Weather editorial audit — planning note beneath verified forecast.
 * Usage: npx --yes tsx scripts/audit-gilbert-greeting-weather-today.mjs [edition_id]
 */
import { createClient } from "@supabase/supabase-js";
import { allocateDiscoverySections } from "../lib/edition/sectionAllocator.ts";
import { resolveFoodDrinksHomepageItems } from "../lib/edition/foodDrinksSection.ts";
import { resolveHomepageWeatherDisplay } from "../lib/weather/homepageWeatherDisplay.ts";
import {
  analyzeEditionDeskAvailability,
  resolveWeatherPlanningNote,
} from "../lib/weather/weatherPlanningNote.ts";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const EDITION_ID =
  process.argv[2] ?? "caf63870-2525-480a-833c-818c572391cd";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: edition, error } = await admin
  .from("editions")
  .select("discovery, edition_date, morning_edition, editorial_context")
  .eq("id", EDITION_ID)
  .maybeSingle();

if (error || !edition) {
  console.error("Failed to load edition", error?.message ?? "missing");
  process.exit(1);
}

const { data: sections } = await admin
  .from("edition_sections")
  .select("section_type, headline, body")
  .eq("edition_id", EDITION_ID);

const weatherSection = sections?.find((s) => s.section_type === "weather");
const greetingSection = sections?.find((s) => s.section_type === "greeting");
const localEventsSection = sections?.find((s) => s.section_type === "local_events");

let localEventsCount = 0;
if (localEventsSection?.body) {
  try {
    const parsed = JSON.parse(localEventsSection.body);
    localEventsCount = parsed.events?.length ?? parsed.items?.length ?? 0;
  } catch {
    localEventsCount = 0;
  }
}

const allocation = allocateDiscoverySections(edition.discovery);
const foodDrinksItems = resolveFoodDrinksHomepageItems({
  sections: sections ?? [],
  discovery: edition.discovery,
  fallbackItems: allocation.recommendations,
});

const weatherSummary =
  edition.editorial_context?.weatherSummary ??
  edition.morning_edition?.beats?.weather ??
  null;

const homepageWeather = resolveHomepageWeatherDisplay({
  editorialContext: weatherSummary ? { weatherSummary } : null,
  weatherSectionHeadline: weatherSection?.headline ?? null,
  weatherSectionBody: weatherSection?.body ?? null,
  morningWeatherBeat: edition.morning_edition?.beats?.weather ?? null,
});

const planningNote = homepageWeather
  ? resolveWeatherPlanningNote({
      weatherSummary,
      weatherSectionHeadline: weatherSection?.headline ?? null,
      weatherSectionBody: weatherSection?.body ?? null,
      morningWeatherBeat: edition.morning_edition?.beats?.weather ?? null,
      condition: homepageWeather.condition,
      editionDesks: analyzeEditionDeskAvailability({
        activities: allocation.activities,
        foodDrinks: foodDrinksItems,
        localEventsCount,
      }),
    })
  : null;

const issues = [];
const warnings = [];

console.log(`Greeting + Weather audit — edition ${EDITION_ID}`);
console.log(`Weather headline: ${weatherSection?.headline ?? "(none)"}`);
console.log(`Weather body: ${weatherSection?.body ?? "(none)"}`);
console.log(`Greeting: ${greetingSection?.body?.trim()?.split("\n")[0] ?? "(none)"}`);
console.log("");

if (homepageWeather) {
  console.log(`Display: ${homepageWeather.current} · ${homepageWeather.highLow ?? "no range"}`);
  console.log(`Condition: ${homepageWeather.condition.label}`);
} else {
  issues.push("homepage weather display unresolved");
}

console.log(`Planning note: ${planningNote ?? "(none)"}`);
console.log("");

if (!planningNote?.trim()) {
  issues.push("missing weather planning note beneath forecast");
} else {
  const sentenceCount = planningNote.split(/[.!?]+/).filter((s) => s.trim()).length;
  if (sentenceCount > 2) {
    issues.push("planning note longer than two sentences");
  }
  if (!/\d+°|Cool morning|Rain|storm|clear|cloud|overcast/i.test(planningNote)) {
    issues.push("planning note missing verified weather anchor");
  }
  if (/storm/i.test(planningNote) && !/storm/i.test(weatherSection?.body ?? "")) {
    issues.push("planning note invents storm conditions");
  }
  if (/rain/i.test(planningNote) && !/rain|shower|drizzle|storm|thunder/i.test(weatherSection?.body ?? "")) {
    issues.push("planning note invents rain conditions");
  }
}

if (!greetingSection?.body?.trim() && !edition.morning_edition?.opening?.text?.trim()) {
  warnings.push("no persisted greeting copy beyond salutation");
}

console.log("Critical:", issues.length ? issues : "none");
console.log("Warnings:", warnings.length ? warnings : "none");
console.log(
  "Editorial status:",
  issues.length === 0 ? "PASS (greeting + weather planning note)" : "FAIL"
);

process.exit(issues.length ? 1 : 0);
