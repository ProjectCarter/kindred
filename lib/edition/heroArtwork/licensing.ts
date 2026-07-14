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

export function formatHeroArtworkCredit(asset: HeroArtworkAsset): string {
  if (asset.attributionText?.trim()) return asset.attributionText.trim();
  const year = asset.year?.trim() ? ` (${asset.year.trim()})` : "";
  return `${asset.artworkTitle}${year}, ${asset.artist}. ${asset.sourceInstitution}.`;
}
