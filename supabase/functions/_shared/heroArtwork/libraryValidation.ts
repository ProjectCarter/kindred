/**
 * Masterpiece Library validation — compute edition eligibility at ingest only.
 * Edition build and client must never promote needs_review → approved.
 */

import type { HeroArtworkRecord } from "./types.ts";
import { isHeroArtworkLicenseSafe } from "./licensing.ts";
import { hasLibraryAboutArtworkBody } from "./editorial.ts";
import {
  isMasterpieceDetailComplete,
  type MasterpieceDetailFields,
} from "./detailEditorial.ts";

export type HeroArtworkValidationStatus =
  | "needs_review"
  | "approved"
  | "rejected";

export function masterpieceDetailFieldsFromRecord(
  artwork: HeroArtworkRecord
): MasterpieceDetailFields {
  return {
    longStoryBody: artwork.longStoryBody,
    artistBiography: artwork.artistBiography,
    lookCloserItems: artwork.lookCloserItems,
    didYouKnow: artwork.didYouKnow,
    museumName: artwork.museumName,
    museumLocation: artwork.museumLocation,
    officialMuseumUrl: artwork.officialMuseumUrl,
    officialArtworkUrl: artwork.officialArtworkUrl,
    sourceReferences: artwork.sourceReferences,
    detailEditorialStatus: artwork.detailEditorialStatus,
  };
}

/** True when every ingest gate passes — eligible for daily selection. */
export function isApprovedMasterpieceLibraryRecord(
  artwork: HeroArtworkRecord
): boolean {
  if (artwork.validationStatus === "rejected") return false;
  if (artwork.approvalStatus === "rejected") return false;
  if (artwork.detailEditorialStatus === "rejected") return false;
  if (artwork.publicDomainStatus === "rejected") return false;

  if (!artwork.hostedUrl?.trim() || !artwork.storagePath?.trim()) return false;
  if (!artwork.artworkTitle?.trim() || !artwork.artist?.trim()) return false;
  if (!artwork.sourceInstitution?.trim() || !artwork.sourceUrl?.trim()) {
    return false;
  }
  if (!artwork.license?.trim() || !artwork.attributionText?.trim()) {
    return false;
  }
  if (!hasLibraryAboutArtworkBody(artwork.aboutArtworkBody)) return false;

  if (artwork.approvalStatus !== "approved") return false;
  if (artwork.detailEditorialStatus !== "approved") return false;
  if (artwork.curatorEditorialStatus !== "approved") return false;
  if (artwork.publicDomainStatus !== "verified") return false;

  if (!isHeroArtworkLicenseSafe(artwork)) return false;

  return isMasterpieceDetailComplete(masterpieceDetailFieldsFromRecord(artwork));
}

/** Compute validation_status for DB write at ingest time. */
export function computeHeroArtworkValidationStatus(
  artwork: HeroArtworkRecord
): HeroArtworkValidationStatus {
  if (
    artwork.approvalStatus === "rejected" ||
    artwork.detailEditorialStatus === "rejected" ||
    artwork.publicDomainStatus === "rejected" ||
    artwork.curatorEditorialStatus === "rejected"
  ) {
    return "rejected";
  }

  return isApprovedMasterpieceLibraryRecord(artwork)
    ? "approved"
    : "needs_review";
}
