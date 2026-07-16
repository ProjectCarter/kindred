import type { HeroArtworkAsset } from "./types";
import { validateAboutArtworkBody } from "./editorial";

type LicenseCheckInput = Pick<
  HeroArtworkAsset,
  | "license"
  | "publicDomainStatus"
  | "approvalStatus"
  | "verifiedAt"
  | "attributionRequired"
  | "licenseUrl"
  | "verificationSource"
  | "commercialUseConfirmed"
  | "curatorEditorialStatus"
  | "aboutArtworkBody"
>;

const APPROVED_LICENSES = new Set([
  "public_domain",
  "cc0",
  "museum_open_access",
  "government_work",
]);

export function isHeroArtworkAssetSelectable(asset: LicenseCheckInput): boolean {
  if (asset.publicDomainStatus !== "verified") return false;
  if (asset.approvalStatus !== "approved") return false;
  if (!asset.verifiedAt) return false;
  if (!asset.commercialUseConfirmed) return false;
  if (asset.curatorEditorialStatus !== "approved") return false;

  const license = asset.license.trim().toLowerCase().replace(/\s+/g, "_");
  if (!APPROVED_LICENSES.has(license)) return false;

  const trusted =
    Boolean(asset.licenseUrl?.trim()) ||
    Boolean(asset.verificationSource?.trim());
  if (!trusted) return false;

  const about = validateAboutArtworkBody(asset.aboutArtworkBody);
  return about.valid;
}

export function formatLicenseLabel(license: string): string {
  const key = license.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "public_domain" || key === "museum_open_access") return "Public Domain";
  if (key === "cc0") return "CC0";
  if (key === "government_work") return "U.S. Government Work";
  return "Open License";
}

/** @deprecated Use renderMasterpieceCreditLine — credit lines are stored at ingest. */
export function formatMasterpieceAttribution(input: {
  license: string;
  sourceInstitution: string;
}): string {
  const institution = input.sourceInstitution?.trim() || "Open collection";
  return `${formatLicenseLabel(input.license)} • ${institution}`;
}

/** Returns pre-stored credit only — never composes at runtime. */
export function formatHeroCreditLine(input: {
  creditLine?: string | null;
  attributionText?: string | null;
}): string {
  return input.creditLine?.trim() || input.attributionText?.trim() || "";
}

/** Returns pre-stored credit only — never composes at runtime. */
export function formatHeroArtworkCredit(asset: HeroArtworkAsset): string {
  return asset.attributionText?.trim() || "";
}
