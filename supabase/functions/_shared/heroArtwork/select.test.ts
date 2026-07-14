import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectDailyHeroArtwork } from "./select.ts";
import type { HeroArtworkRecord } from "./types.ts";
import { INITIAL_HERO_ARTWORK_PLAN_COUNT } from "./initialLibraryPlan.ts";

function sampleArtwork(overrides: Partial<HeroArtworkRecord>): HeroArtworkRecord {
  return {
    id: overrides.id ?? "id-1",
    internalId: overrides.internalId ?? "kindred:hero:sample:1",
    artworkTitle: overrides.artworkTitle ?? "Sample Art",
    artist: overrides.artist ?? "Sample Artist",
    year: overrides.year ?? "1900",
    sourceInstitution: overrides.sourceInstitution ?? "Metropolitan Museum of Art",
    sourceUrl: overrides.sourceUrl ?? "https://example.com",
    imageUrl: null,
    hostedUrl: null,
    storagePath: null,
    orientation: overrides.orientation ?? "landscape",
    dominantColors: overrides.dominantColors ?? ["blue"],
    tags: overrides.tags ?? ["sample"],
    seasons: overrides.seasons ?? ["summer"],
    holidays: overrides.holidays ?? [],
    license: overrides.license ?? "public_domain",
    publicDomainStatus: overrides.publicDomainStatus ?? "verified",
    attributionText: overrides.attributionText ?? null,
    attributionRequired: overrides.attributionRequired ?? true,
    verifiedAt: overrides.verifiedAt ?? "2026-07-14T00:00:00.000Z",
    verifiedBy: overrides.verifiedBy ?? "curator",
    sourceProvider: overrides.sourceProvider ?? "met",
    sourceProviderArtworkId: overrides.sourceProviderArtworkId ?? "1",
    featured: overrides.featured ?? false,
    editorialPriority: overrides.editorialPriority ?? 60,
    lastUsedAt: overrides.lastUsedAt ?? null,
    useCount: overrides.useCount ?? 0,
    approvalStatus: overrides.approvalStatus ?? "approved",
  };
}

Deno.test("initial library plan targets ~50 artworks", () => {
  assertEquals(INITIAL_HERO_ARTWORK_PLAN_COUNT >= 48, true);
  assertEquals(INITIAL_HERO_ARTWORK_PLAN_COUNT <= 55, true);
});

Deno.test("selectDailyHeroArtwork prefers seasonal match", () => {
  const summer = sampleArtwork({
    id: "summer-id",
    internalId: "summer",
    seasons: ["summer"],
    featured: true,
  });
  const winter = sampleArtwork({
    id: "winter-id",
    internalId: "winter",
    seasons: ["winter"],
    featured: false,
  });

  const picked = selectDailyHeroArtwork([winter, summer], {
    date: "2026-07-14",
    season: "summer",
    recentArtworkIds: [],
  });

  assertEquals(picked?.id, "summer-id");
});

Deno.test("selectDailyHeroArtwork is stable for the same edition date", () => {
  const catalog = [
    sampleArtwork({ id: "a", internalId: "a", editorialPriority: 70 }),
    sampleArtwork({ id: "b", internalId: "b", editorialPriority: 69 }),
    sampleArtwork({ id: "c", internalId: "c", editorialPriority: 68 }),
  ];

  const first = selectDailyHeroArtwork(catalog, { date: "2026-07-14" });
  const second = selectDailyHeroArtwork(catalog, { date: "2026-07-14" });
  assertEquals(first?.id, second?.id);
});

Deno.test("recent artwork receives rotation penalty", () => {
  const recent = sampleArtwork({
    id: "recent",
    internalId: "recent",
    featured: false,
    editorialPriority: 90,
  });
  const fresh = sampleArtwork({
    id: "fresh",
    internalId: "fresh",
    featured: false,
    editorialPriority: 70,
  });

  const picked = selectDailyHeroArtwork([recent, fresh], {
    date: "2026-07-14",
    season: "summer",
    recentArtworkIds: ["recent"],
  });

  assertEquals(picked?.id, "fresh");
});
