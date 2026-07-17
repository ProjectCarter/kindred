import type {
  HeroArtworkApprovalStatus,
  HeroArtworkLicense,
  HeroArtworkPublicDomainStatus,
  HeroArtworkRecord,
} from "./types.ts";
import { hasLibraryAboutArtworkBody, validateAboutArtworkBody } from "./editorial.ts";

export type HeroArtworkLicenseInput = {
  license: HeroArtworkLicense | string;
  publicDomainStatus: HeroArtworkPublicDomainStatus;
  approvalStatus: HeroArtworkApprovalStatus;
  verifiedAt?: string | null;
  sourceInstitution?: string | null;
  attributionRequired?: boolean;
  licenseUrl?: string | null;
  verificationSource?: string | null;
  commercialUseConfirmed?: boolean;
  curatorEditorialStatus?: HeroArtworkRecord["curatorEditorialStatus"];
  aboutArtworkBody?: string | null;
};

const APPROVED_LICENSES = new Set<HeroArtworkLicense>([
  "public_domain",
  "cc0",
  "museum_open_access",
  "government_work",
]);

const TRUSTED_OPEN_ACCESS_SOURCES = [
  /metropolitan museum/i,
  /national gallery of art/i,
  /rijksmuseum/i,
  /smithsonian/i,
  /library of congress/i,
  /wikimedia/i,
  /nasa/i,
  /national archives/i,
  /art institute of chicago/i,
];

/**
 * Only verified, commercially safe artwork may enter the hero masthead.
 * Commercial safety outweighs library size — if uncertain, reject.
 */
export function isHeroArtworkLicenseSafe(input: HeroArtworkLicenseInput): boolean {
  if (input.approvalStatus === "rejected") return false;
  if (input.publicDomainStatus === "rejected") return false;
  if (input.publicDomainStatus !== "verified") return false;
  if (input.approvalStatus !== "approved") return false;
  if (!input.verifiedAt) return false;
  if (!input.commercialUseConfirmed) return false;

  const license = normalizeLicense(input.license);
  if (!APPROVED_LICENSES.has(license)) return false;

  const trusted =
    isTrustedOpenAccessInstitution(input.sourceInstitution) ||
    Boolean(input.verificationSource?.trim()) ||
    Boolean(input.licenseUrl?.trim());

  if (!trusted) return false;

  if (input.curatorEditorialStatus && input.curatorEditorialStatus !== "approved") {
    return false;
  }

  if (input.aboutArtworkBody !== undefined) {
    const about = validateAboutArtworkBody(input.aboutArtworkBody);
    if (!about.valid) return false;
  }

  return true;
}

export function normalizeLicense(license: string): HeroArtworkLicense {
  const key = license.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "public-domain" || key === "pd") return "public_domain";
  if (key === "open_access" || key === "museum_open_access") {
    return "museum_open_access";
  }
  if (key === "cc_0") return "cc0";
  if (key === "government" || key === "us_government_work") {
    return "government_work";
  }
  return key as HeroArtworkLicense;
}

export function isTrustedOpenAccessInstitution(
  institution: string | null | undefined
): boolean {
  if (!institution?.trim()) return false;
  return TRUSTED_OPEN_ACCESS_SOURCES.some((pattern) => pattern.test(institution));
}

export function buildAttributionText(input: {
  artworkTitle: string;
  artist: string;
  year?: string | null;
  sourceInstitution: string;
  sourceUrl?: string | null;
}): string {
  const year = input.year?.trim() ? ` (${input.year.trim()})` : "";
  const base = `${input.artworkTitle}${year}, ${input.artist}. ${input.sourceInstitution}.`;
  if (input.sourceUrl?.trim()) {
    return `${base} Source: ${input.sourceUrl.trim()}`;
  }
  return base;
}

export function assertHeroArtworkSelectable(artwork: HeroArtworkRecord): void {
  if (!isHeroArtworkRecordSelectable(artwork)) {
    throw new Error(
      `[heroArtwork] artwork not licensed for hero use: ${artwork.internalId}`
    );
  }
}

export function isHeroArtworkRecordSelectable(artwork: HeroArtworkRecord): boolean {
  if (!artwork.hostedUrl?.trim() || !artwork.storagePath?.trim()) return false;
  if (!artwork.attributionText?.trim()) return false;
  if (!hasLibraryAboutArtworkBody(artwork.aboutArtworkBody)) return false;
  return isHeroArtworkLicenseSafe({
    license: artwork.license,
    publicDomainStatus: artwork.publicDomainStatus,
    approvalStatus: artwork.approvalStatus,
    verifiedAt: artwork.verifiedAt,
    sourceInstitution: artwork.sourceInstitution,
    attributionRequired: artwork.attributionRequired,
    licenseUrl: artwork.licenseUrl,
    verificationSource: artwork.verificationSource,
    commercialUseConfirmed: artwork.commercialUseConfirmed,
    curatorEditorialStatus: artwork.curatorEditorialStatus,
  });
}
