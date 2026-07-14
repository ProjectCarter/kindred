import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { listCollections, collectionMatchesSeason } from "./collections.ts";
import { selectDailyHeroArtwork } from "./select.ts";
import type { HeroArtworkRecord } from "./types.ts";

const SAMPLE_ABOUT =
  "Claude Monet painted this scene during a prolific period of study along the Seine, " +
  "when Impressionism was still a young and controversial movement in Paris. The work matters " +
  "because it helped redefine how painters could capture light, atmosphere, and the passing " +
  "moment rather than polished illusion. It became famous as audiences recognized a new way " +
  "of seeing everyday beauty in modern life. Monet's brushwork here invites the viewer to " +
  "linger in color and reflection rather than narrative detail, offering calm at daybreak.";

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
    collections: overrides.collections ?? ["impressionism"],
    moodTags: overrides.moodTags ?? ["calm"],
    tags: overrides.tags ?? ["sample"],
    seasons: overrides.seasons ?? ["summer"],
    holidays: overrides.holidays ?? [],
    license: overrides.license ?? "public_domain",
    licenseUrl: overrides.licenseUrl ?? "https://example.com/license",
    publicDomainStatus: overrides.publicDomainStatus ?? "verified",
    verificationSource: overrides.verificationSource ?? "Met Open Access",
    commercialUseConfirmed: overrides.commercialUseConfirmed ?? true,
    attributionText: overrides.attributionText ?? null,
    attributionRequired: overrides.attributionRequired ?? true,
    verifiedAt: overrides.verifiedAt ?? "2026-07-14T00:00:00.000Z",
    verifiedBy: overrides.verifiedBy ?? "curator",
    sourceProvider: overrides.sourceProvider ?? "met",
    sourceProviderArtworkId: overrides.sourceProviderArtworkId ?? "1",
    aboutArtworkBody: overrides.aboutArtworkBody ?? SAMPLE_ABOUT,
    aboutWordCount: overrides.aboutWordCount ?? 82,
    curatorEditorialStatus: overrides.curatorEditorialStatus ?? "approved",
    banditMorningNote: overrides.banditMorningNote ?? null,
    featured: overrides.featured ?? false,
    editorialPriority: overrides.editorialPriority ?? 60,
    lastUsedAt: overrides.lastUsedAt ?? null,
    useCount: overrides.useCount ?? 0,
    approvalStatus: overrides.approvalStatus ?? "approved",
  };
}

Deno.test("collections registry is expandable without fixed artwork counts", () => {
  const collections = listCollections();
  assertEquals(collections.length >= 20, true);
  assertEquals(collectionMatchesSeason("impressionism", "summer"), true);
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

Deno.test("recent collection receives collection rotation penalty", () => {
  const impressionism = sampleArtwork({
    id: "imp",
    internalId: "imp",
    collections: ["impressionism"],
    seasons: ["winter"],
    editorialPriority: 60,
  });
  const dutch = sampleArtwork({
    id: "dutch",
    internalId: "dutch",
    collections: ["dutch_masters"],
    seasons: ["summer"],
    editorialPriority: 75,
  });

  const picked = selectDailyHeroArtwork([impressionism, dutch], {
    date: "2026-07-14",
    season: "summer",
    recentCollectionIds: ["impressionism"],
  });

  assertEquals(picked?.id, "dutch");
});
