import type { HeroArtworkAsset } from "./types.ts";

type LicenseCheckInput = Pick<
  HeroArtworkAsset,
  | "license"
  | "publicDomainStatus"
  | "approvalStatus"
  | "verifiedAt"
  | "attributionRequired"
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
  const license = asset.license.trim().toLowerCase().replace(/\s+/g, "_");
  return APPROVED_LICENSES.has(license);
}

export function formatHeroArtworkCredit(asset: HeroArtworkAsset): string {
  if (asset.attributionText?.trim()) return asset.attributionText.trim();
  const year = asset.year?.trim() ? ` (${asset.year.trim()})` : "";
  return `${asset.artworkTitle}${year}, ${asset.artist}. ${asset.sourceInstitution}.`;
}
