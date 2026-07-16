import { searchWikimediaCommons } from "../images/wikimedia.ts";
import type { StockSearchCandidate } from "../images/types.ts";
import type { HeroArtworkCollectionId, HeroArtworkRecord } from "./types.ts";
import { getCollection } from "./collections.ts";
import { buildMasterpieceCreditLine } from "./attribution.ts";
import { normalizeLicense } from "./licensing.ts";
import { countWords } from "./editorial.ts";
import { getSeason, parseEditionDate } from "./select.ts";
import type { HeroArtworkProviderDraft } from "./providers.ts";

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

function parseArtist(raw: string | null | undefined): string {
  const text = (raw ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text || /^unknown/i.test(text)) return "Unknown artist";
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function parseTitle(candidate: StockSearchCandidate): string {
  const alt = candidate.altDescription?.trim();
  if (alt && alt.length >= 4 && !/^file:/i.test(alt)) {
    return alt.length > 140 ? `${alt.slice(0, 137)}…` : alt;
  }
  return "Untitled artwork";
}

function parseYear(text: string): string | null {
  const match = text.match(/\b(1[0-9]{3}|20[0-1][0-9])\b/);
  return match?.[1] ?? null;
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
  const artist = parseArtist(candidate.photographerName);
  const artworkTitle = parseTitle(candidate);
  const year =
    parseYear(candidate.altDescription ?? "") ??
    parseYear(candidate.attributionText ?? "");
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
      mediumHint: candidate.altDescription,
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
