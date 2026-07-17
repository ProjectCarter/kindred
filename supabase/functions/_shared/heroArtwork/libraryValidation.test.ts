import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeHeroArtworkValidationStatus,
  isApprovedMasterpieceLibraryRecord,
} from "./libraryValidation.ts";
import type { HeroArtworkRecord } from "./types.ts";

function baseRecord(
  overrides: Partial<HeroArtworkRecord> = {}
): HeroArtworkRecord {
  return {
    id: "test-id",
    internalId: "test-internal",
    artworkTitle: "The Starry Night",
    artist: "Vincent van Gogh",
    year: "1889",
    sourceInstitution: "Museum of Modern Art",
    sourceUrl: "https://example.org/artwork",
    imageUrl: "https://example.org/image.jpg",
    hostedUrl: "https://cdn.example.org/image.jpg",
    storagePath: "hero/test.jpg",
    imageWidth: 1400,
    imageHeight: 933,
    aspectRatio: 1.5,
    orientation: "landscape",
    dominantColors: [],
    collections: ["european_masters"],
    moodTags: [],
    tags: [],
    seasons: [],
    holidays: [],
    license: "Public Domain",
    licenseUrl: null,
    publicDomainStatus: "verified",
    verificationSource: "museum",
    commercialUseConfirmed: true,
    attributionText: "Courtesy of MoMA",
    attributionRequired: true,
    verifiedAt: new Date().toISOString(),
    verifiedBy: "test",
    sourceProvider: "met",
    sourceProviderArtworkId: "123",
    aboutArtworkBody:
      "Van Gogh painted this night scene from memory and imagination, turning a quiet village into a swirl of light and motion above the sleeping town below.",
    aboutWordCount: 28,
    longStoryBody: null,
    longStoryParagraphCount: null,
    editorialSections: null,
    artistBiography: null,
    lookCloserItems: [],
    didYouKnow: null,
    museumName: null,
    museumLocation: null,
    officialMuseumUrl: null,
    officialArtworkUrl: null,
    sourceReferences: [],
    detailEditorialStatus: "pending",
    curatorEditorialStatus: "pending",
    banditMorningNote: null,
    featured: false,
    editorialPriority: 50,
    lastUsedAt: null,
    lastShownDate: null,
    useCount: 0,
    approvalStatus: "pending",
    validationStatus: "needs_review",
    ...overrides,
  };
}

Deno.test("pending artwork is needs_review not approved", () => {
  const record = baseRecord();
  assertEquals(isApprovedMasterpieceLibraryRecord(record), false);
  assertEquals(computeHeroArtworkValidationStatus(record), "needs_review");
});

Deno.test("rejected approval_status maps to rejected validation", () => {
  const record = baseRecord({ approvalStatus: "rejected" });
  assertEquals(computeHeroArtworkValidationStatus(record), "rejected");
});
