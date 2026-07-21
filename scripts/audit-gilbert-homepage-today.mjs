#!/usr/bin/env node
/**
 * Gilbert homepage section audit — persisted Supabase edition, pure Node (no RN imports).
 * Usage: node scripts/audit-gilbert-homepage-today.mjs [edition_date]
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://zdqjeocdsbdzecawumdp.supabase.co";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcWplb2Nkc2JkemVjYXd1bWRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzI3ODM1MCwiZXhwIjoyMDk4ODU0MzUwfQ.FwAqKj2kD7OOfYrePX2ahBSt3UFO4n2YjpFgPU-VUWk";

const USER_ID = process.env.AUDIT_USER_ID ?? "24bbe9e7-8455-4c3c-87eb-8424ba27ab81";
const METRO_KEY = "phoenix-az";
const EDITION_DATE = process.argv[2] ?? "2026-07-21";

const PLACEHOLDER_RES = [
  /lorem ipsum/i,
  /placeholder/i,
  /No major local updates today/,
  /Insufficient verified source material/i,
  /editorial quality worthy of a magazine desk/i,
];

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function discoveryItemCount(discovery) {
  if (!discovery?.surfaces) return 0;
  let n = 0;
  for (const s of Object.values(discovery.surfaces)) n += s?.items?.length ?? 0;
  return n;
}

function parseEventsBody(body) {
  if (!body?.trim()) return [];
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed?.events)) return parsed.events;
    if (Array.isArray(parsed?.items)) return parsed.items;
    return [];
  } catch {
    return null;
  }
}

function topStoriesFromContext(editorialContext) {
  if (!editorialContext?.sections) return [];
  const section = editorialContext.sections.find((s) => s.sectionType === "top_stories");
  if (!section?.items?.length) return [];
  return section.items.filter((item) => item.title?.trim() && (item.summary?.trim() || item.dek?.trim()));
}

function resolveLocalNewsPackage(leadStory, topStories) {
  const localTop = topStories.filter((s) => /local/i.test(s.role ?? ""));
  const localLead = leadStory && /local/i.test(leadStory.role ?? "") ? leadStory : null;
  let slate = localTop;
  if (slate.length === 0 && topStories.length > 0 && (localLead || !leadStory)) {
    slate = topStories;
  }
  if (localLead) {
    return {
      hasStories: true,
      lead: localLead,
      feature: null,
      sides: slate.filter((s) => s.id !== localLead.id).slice(0, 2),
    };
  }
  const feature = slate[0] ?? null;
  return {
    hasStories: Boolean(feature),
    lead: null,
    feature,
    sides: feature ? slate.slice(1, 3) : [],
  };
}

function weatherSummaryFromContext(editorialContext) {
  if (!editorialContext?.sections) return null;
  const section = editorialContext.sections.find((s) => s.sectionType === "weather");
  const note = section?.notes?.find((n) => n.code === "weather_summary");
  return note?.label?.trim() || null;
}

function looksLikePlaceholder(text) {
  if (!text?.trim()) return true;
  if (text.trim().length < 12) return true;
  return PLACEHOLDER_RES.some((re) => re.test(text));
}

function normVenue(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function headOk(url) {
  if (!url?.trim()) return { ok: false, reason: "missing_url" };
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.ok) return { ok: true, status: res.status };
    const getRes = await fetch(url, { method: "GET", redirect: "follow" });
    return { ok: getRes.ok, status: getRes.status, method: "GET" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function statusFrom(critical, warnings) {
  if (critical.length) return "red";
  if (warnings.length) return "yellow";
  return "green";
}

function auditSection(id, label, critical, warnings, renders, itemCount, checks) {
  return {
    id,
    label,
    status: statusFrom(critical, warnings),
    renders,
    itemCount,
    checks,
    issues: [...critical, ...warnings],
  };
}

async function main() {
  const { data: edition, error } = await admin
    .from("editions")
    .select(
      "id, status, edition_date, metro_key, lead_story, national_news, bandit, discovery, morning_edition, history_around_town, editorial_context, created_at"
    )
    .eq("user_id", USER_ID)
    .eq("edition_date", EDITION_DATE)
    .eq("metro_key", METRO_KEY)
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  }
  if (!edition?.id) {
    console.error(JSON.stringify({ error: "no_edition", editionDate: EDITION_DATE, metroKey: METRO_KEY }, null, 2));
    process.exit(1);
  }

  const { data: sections } = await admin
    .from("edition_sections")
    .select("id, section_type, position, headline, body, source_note")
    .eq("edition_id", edition.id)
    .order("position");

  const sectionList = sections ?? [];
  const sectionTypes = sectionList.map((s) => s.section_type);
  const weatherSection = sectionList.find((s) => s.section_type === "weather");
  const localEventsSection = sectionList.find((s) => s.section_type === "local_events");
  const historySection = sectionList.find((s) => s.section_type === "today_in_history");
  const storyOfSection = sectionList.find(
    (s) => s.section_type === "story_of" || s.section_type === "your_city"
  );

  const eventsRaw = parseEventsBody(localEventsSection?.body);
  const events = Array.isArray(eventsRaw) ? eventsRaw : [];
  const eventsParseFailed = eventsRaw === null && Boolean(localEventsSection?.body?.trim());

  const topStories = topStoriesFromContext(edition.editorial_context);
  const localNews = resolveLocalNewsPackage(edition.lead_story, topStories);
  const morningHero = edition.morning_edition?.morningHero ?? null;
  const nationalNews = edition.national_news;
  const historyPlaces = edition.history_around_town?.places ?? [];
  const historyCarousel = edition.history_around_town?.carousel ?? [];
  const weatherSummary =
    weatherSummaryFromContext(edition.editorial_context) ??
    edition.morning_edition?.beats?.weather ??
    null;

  const discoveryCount = discoveryItemCount(edition.discovery);
  const discoverySurfaces = edition.discovery?.surfaces ?? {};
  const activityItems = [
    ...(discoverySurfaces.activities?.items ?? []),
    ...(discoverySurfaces.hiking?.items ?? []),
    ...(discoverySurfaces.museums?.items ?? []),
    ...(discoverySurfaces.parks?.items ?? []),
  ];
  const foodItems = [
    ...(discoverySurfaces.restaurants?.items ?? []),
    ...(discoverySurfaces.coffee?.items ?? []),
    ...(discoverySurfaces.bakeries?.items ?? []),
  ];

  const storyOfImage = (() => {
    try {
      const note = storyOfSection?.source_note ? JSON.parse(storyOfSection.source_note) : null;
      return note?.cityImage?.url ?? note?.imageUrl ?? note?.image?.url ?? null;
    } catch {
      return null;
    }
  })();

  const sectionAudits = [];

  sectionAudits.push(
    auditSection(
      "masterpiece",
      "Today's Masterpiece",
      !morningHero?.artworkTitle?.trim() ? ["missing artwork title"] : [],
      !morningHero?.aboutArtworkBody?.trim() ? ["missing about artwork body"] : [],
      Boolean(morningHero?.artworkTitle && morningHero?.hostedUrl),
      morningHero ? 1 : 0,
      {
        title: morningHero?.artworkTitle ?? null,
        hostedUrl: morningHero?.hostedUrl ?? null,
        artist: morningHero?.artist ?? null,
      }
    )
  );

  sectionAudits.push(
    auditSection(
      "weather",
      "Weather",
      !weatherSummary && !weatherSection?.body?.trim() ? ["no weather summary or section body"] : [],
      !weatherSection ? ["missing weather section row"] : [],
      Boolean(weatherSummary || weatherSection?.body?.trim()),
      weatherSummary || weatherSection?.body ? 1 : 0,
      { summary: weatherSummary, sectionHeadline: weatherSection?.headline ?? null }
    )
  );

  sectionAudits.push(
    auditSection(
      "local_events",
      "Local Events",
      [
        ...(eventsParseFailed ? ["local_events body failed JSON parse"] : []),
        ...(!localEventsSection ? ["missing local_events section"] : []),
        ...(events.length === 0 && !eventsParseFailed ? ["zero events in section body"] : []),
      ],
      [
        ...(events.length > 0 && events.length < 4
          ? [`thin calendar — only ${events.length} event(s) persisted (homepage cap is 8)`]
          : []),
        ...(events.filter((e) => !e.ticketUrl && !e.websiteUrl && !e.url).length >
        events.length / 2
          ? [
              `${events.filter((e) => !e.ticketUrl && !e.websiteUrl && !e.url).length}/${events.length} events lack outbound link`,
            ]
          : []),
      ],
      events.length > 0,
      Math.min(events.length, 8),
      { rawEvents: events.length, parseFailed: eventsParseFailed }
    )
  );

  sectionAudits.push(
    auditSection(
      "activities",
      "Activities",
      activityItems.length === 0 ? ["zero activities in discovery surfaces"] : [],
      [],
      activityItems.length > 0,
      activityItems.length,
      { discoveryCount: activityItems.length }
    )
  );

  sectionAudits.push(
    auditSection(
      "food_drinks",
      "Food & Drinks",
      foodItems.length === 0 ? ["zero food & drink items in discovery surfaces"] : [],
      [],
      foodItems.length > 0,
      foodItems.length,
      { discoveryCount: foodItems.length }
    )
  );

  const localNewsBody =
    localNews.lead?.summary ?? localNews.feature?.summary ?? localNews.feature?.dek;
  sectionAudits.push(
    auditSection(
      "local_news",
      "Local News",
      [
        ...(!localNews.hasStories ? ["no local news stories resolved"] : []),
        ...(looksLikePlaceholder(localNewsBody) && localNews.hasStories
          ? ["placeholder or thin local news copy"]
          : []),
      ],
      edition.lead_story && !/local/i.test(edition.lead_story.role ?? "")
        ? ["national lead — local desk relies on editorial_context top_stories"]
        : [],
      localNews.hasStories,
      (localNews.lead ? 1 : 0) + localNews.sides.length,
      {
        topStories: topStories.length,
        localRoleStories: topStories.filter((s) => /local/i.test(s.role ?? "")).length,
        leadRole: edition.lead_story?.role ?? null,
      }
    )
  );

  sectionAudits.push(
    auditSection(
      "today_in_history",
      "Today in History",
      [
        ...(!historySection ? ["missing today_in_history section"] : []),
        ...(!historySection?.body?.trim() ? ["empty history body"] : []),
      ],
      looksLikePlaceholder(historySection?.body) ? ["placeholder history copy"] : [],
      Boolean(historySection?.body?.trim()),
      historySection ? 1 : 0,
      { headline: historySection?.headline ?? null }
    )
  );

  sectionAudits.push(
    auditSection(
      "national_news",
      "National News",
      !(nationalNews?.stories?.length > 0) ? ["no national_news stories column"] : [],
      (nationalNews?.stories ?? []).filter((s) => !s.sourceUrl?.trim()).length
        ? [`${(nationalNews.stories ?? []).filter((s) => !s.sourceUrl?.trim()).length} stories missing source URL`]
        : [],
      Boolean(nationalNews?.stories?.length),
      nationalNews?.stories?.length ?? 0,
      { packageId: nationalNews?.packageId ?? null }
    )
  );

  sectionAudits.push(
    auditSection(
      "story_of",
      "Story of Your City",
      [
        ...(!storyOfSection ? ["missing story_of section for Gilbert"] : []),
        ...(storyOfSection && !storyOfSection.body?.trim() ? ["empty story_of body"] : []),
      ],
      !storyOfImage ? ["missing story_of image in source_note"] : [],
      Boolean(storyOfSection?.headline?.trim() && storyOfSection?.body?.trim()),
      storyOfSection ? 1 : 0,
      { headline: storyOfSection?.headline ?? null, image: storyOfImage }
    )
  );

  sectionAudits.push(
    auditSection(
      "historical_places",
      "Historical Places Around You",
      historyPlaces.length === 0 ? ["no history_around_town places on edition row"] : [],
      historyCarousel.length === 0 && historyPlaces.length > 0
        ? ["carousel ids empty despite places payload"]
        : [],
      historyCarousel.length > 0 || historyPlaces.length > 0,
      historyCarousel.length || historyPlaces.length,
      { places: historyPlaces.length, carousel: historyCarousel.length }
    )
  );

  const venueKeys = new Set();
  const duplicates = [];
  for (const e of events.slice(0, 8)) {
    const key = normVenue(e.venue || e.name);
    if (key && venueKeys.has(key)) duplicates.push(`local_events:${e.name}`);
    if (key) venueKeys.add(key);
  }
  for (const a of activityItems.slice(0, 8)) {
    const key = normVenue(a.item?.title);
    if (key && venueKeys.has(key)) duplicates.push(`activities:${a.item?.title}`);
    if (key) venueKeys.add(key);
  }
  for (const f of foodItems.slice(0, 8)) {
    const key = normVenue(f.item?.title);
    if (key && venueKeys.has(key)) duplicates.push(`food:${f.item?.title}`);
    if (key) venueKeys.add(key);
  }

  const imageCandidates = [];
  const pushImg = (url, section, label) => {
    if (url?.trim()) imageCandidates.push({ url: url.trim(), section, label });
  };
  pushImg(morningHero?.hostedUrl, "masterpiece", morningHero?.artworkTitle);
  for (const e of events.slice(0, 8)) pushImg(e.imageUrl ?? e.image?.uri, "local_events", e.name);
  for (const a of activityItems.slice(0, 8)) pushImg(a.item?.editorialImage?.url, "activities", a.item?.title);
  for (const f of foodItems.slice(0, 8)) pushImg(f.item?.editorialImage?.url, "food_drinks", f.item?.title);
  for (const s of nationalNews?.stories ?? []) pushImg(s.image?.url, "national_news", s.headline);
  pushImg(storyOfImage, "story_of", storyOfSection?.headline);
  for (const p of historyPlaces.slice(0, 6)) pushImg(p.imageUrl, "historical_places", p.name);

  const imageChecks = [];
  for (const c of imageCandidates.slice(0, 30)) {
    imageChecks.push({ ...c, ...(await headOk(c.url)) });
  }

  const summary = {
    green: sectionAudits.filter((s) => s.status === "green").map((s) => s.label),
    yellow: sectionAudits.filter((s) => s.status === "yellow").map((s) => s.label),
    broken: sectionAudits.filter((s) => s.status === "red").map((s) => s.label),
  };

  const report = {
    meta: {
      editionDate: EDITION_DATE,
      metroKey: METRO_KEY,
      editionId: edition.id,
      status: edition.status,
      city: edition.discovery?.location?.city ?? null,
      createdAt: edition.created_at,
      analyzedAt: new Date().toISOString(),
    },
    sections: sectionAudits,
    crossChecks: {
      editionStatus: edition.status,
      discoveryItemCount: discoveryCount,
      discoveryCity: edition.discovery?.location?.city ?? null,
      sectionTypes,
      crossSectionDuplicates: duplicates,
      cacheNote:
        "Persisted row audit only — warm-cache merge verified separately via 75a5f71 fix.",
    },
    imageChecks: {
      total: imageCandidates.length,
      sampled: imageChecks.length,
      ok: imageChecks.filter((c) => c.ok).length,
      failed: imageChecks.filter((c) => !c.ok),
    },
    summary,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(summary.broken.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
