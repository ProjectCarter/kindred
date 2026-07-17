import { searchWikimediaCommons } from "../images/wikimedia.ts";
import type { StockSearchCandidate } from "../images/types.ts";
import type { HeroArtworkCollectionId, HeroArtworkRecord } from "./types.ts";
import { getCollection } from "./collections.ts";
import { buildMasterpieceCreditLine } from "./attribution.ts";
import { normalizeLicense } from "./licensing.ts";
import { countWords } from "./editorial.ts";
import { getSeason, parseEditionDate } from "./select.ts";
import type { HeroArtworkProviderDraft } from "./providers.ts";
import {
  parseArtworkYearFromText,
  sanitizeArtworkTitle,
  sanitizeArtistName,
  sanitizeArtworkYear,
  sanitizeEditorialText,
} from "./sanitizeMetadata.ts";

const APPROVED_LICENSES = new Set(["public_domain", "cc0", "government_work"]);

function licenseFromCommons(shortName: string | null): string {
  const lower = (shortName ?? "").toLowerCase();
  if (/public domain|pd-|no restrictions/i.test(lower)) return "public_domain";
  if (/cc0|cc zero/i.test(lower)) return "cc0";
  if (/u\.s\. government|federal government/i.test(lower)) return "government_work";
  return normalizeLicense(shortName ?? "public_domain");
}

function isHeroLicense(license: string): boolean {
  return APPROVED_LICENSES.has(normalizeLicense(license));
}

function parseArtist(
  raw: string | null | undefined,
  filePageTitle?: string | null
): string {
  return sanitizeArtistName(raw, filePageTitle);
}

function parseTitle(candidate: StockSearchCandidate): string {
  return sanitizeArtworkTitle(candidate.altDescription, {
    objectName: candidate.objectName,
    filePageTitle: candidate.filePageTitle,
  });
}

function parseYear(candidate: StockSearchCandidate): string | null {
  return sanitizeArtworkYear(null, {
    title: candidate.altDescription,
    imageDescription: candidate.altDescription,
    filePageTitle: candidate.filePageTitle,
  }) ?? parseArtworkYearFromText(candidate.attributionText ?? "");
}

function inferCollections(
  collectionId: HeroArtworkCollectionId,
  tags: string[]
): HeroArtworkCollectionId[] {
  const blob = tags.join(" ").toLowerCase();
  const out = new Set<HeroArtworkCollectionId>([collectionId]);
  if (/botanical|flower|plant/i.test(blob)) out.add("botanical_illustration");
  if (/map|cartograph/i.test(blob)) out.add("historic_maps");
  if (/poster|travel/i.test(blob)) out.add("vintage_travel_posters");
  if (/nasa|space|hubble/i.test(blob)) out.add("nasa");
  if (/ukiyo|hokusai|hiroshige/i.test(blob)) out.add("ukiyo_e");
  return [...out];
}

export function wikimediaCandidateToDraft(
  candidate: StockSearchCandidate,
  collectionId: HeroArtworkCollectionId,
  aboutArtworkBody: string,
  editionDate: string
): Omit<HeroArtworkRecord, "id" | "lastUsedAt" | "useCount"> {
  const license = licenseFromCommons(candidate.licenseShortName);
  const collection = getCollection(collectionId);
  const date = parseEditionDate(editionDate);
  const season = getSeason(date.getMonth() + 1);
  const artist = parseArtist(candidate.photographerName, candidate.filePageTitle);
  const artworkTitle = parseTitle(candidate);
  const year = parseYear(candidate);
  const providerId = String(candidate.providerImageId);
  const internalId = `kindred:hero:wikimedia:${providerId}`;
  const wordCount = countWords(aboutArtworkBody);

  const collections = inferCollections(collectionId, candidate.tags ?? []);

  return {
    internalId,
    artworkTitle,
    artist,
    year,
    sourceInstitution: "Wikimedia Commons",
    sourceUrl: candidate.sourcePageUrl,
    imageUrl: candidate.downloadUrl,
    hostedUrl: null,
    storagePath: null,
    orientation: candidate.orientation ?? "landscape",
    dominantColors: [],
    collections,
    moodTags: [],
    tags: candidate.tags ?? [],
    seasons: collection.seasonalAffinity.length
      ? collection.seasonalAffinity
      : [season],
    holidays: collection.holidayAffinity,
    license,
    licenseUrl: candidate.licenseUrl,
    publicDomainStatus: "verified",
    verificationSource: "Wikimedia Commons API",
    commercialUseConfirmed: true,
    attributionText: buildMasterpieceCreditLine({
      artist,
      license,
      sourceInstitution: "Wikimedia Commons",
      sourceProvider: "wikimedia",
      mediumHint: sanitizeEditorialText(candidate.altDescription),
      collections,
      tags: candidate.tags ?? [],
    }),
    attributionRequired: true,
    verifiedAt: new Date().toISOString(),
    verifiedBy: "kindred:auto-discovery",
    sourceProvider: "wikimedia",
    sourceProviderArtworkId: providerId,
    aboutArtworkBody,
    aboutWordCount: wordCount,
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
    curatorEditorialStatus: "approved",
    banditMorningNote: null,
    featured: false,
    editorialPriority: collection.editorialPriority,
    approvalStatus: "approved",
  };
}

export function isWikimediaCandidateUsable(
  candidate: StockSearchCandidate
): boolean {
  if (!candidate.downloadUrl?.trim()) return false;
  const license = licenseFromCommons(candidate.licenseShortName);
  return isHeroLicense(license);
}

export async function searchWikimediaHeroCandidates(
  query: string,
  limit = 10
): Promise<StockSearchCandidate[]> {
  const results = await searchWikimediaCommons(query, {
    orientation: "landscape",
    perPage: limit,
  });
  return results.filter(isWikimediaCandidateUsable);
}
