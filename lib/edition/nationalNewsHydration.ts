/**
 * National News client hydration — diagnostics + merge helpers.
 */

import type { NationalNewsPackage } from "./nationalNewsTypes.ts";
import {
  nationalNewsFromEdition,
  parseNationalNewsPackage,
  resolveNationalNewsFromEditionColumn,
} from "./nationalNewsTypes.ts";

export type NationalNewsHydrationSource =
  | "cache"
  | "network"
  | "merge"
  | "network_backfill"
  | "resume"
  | "refresh"
  | "sync_after_cache"
  | "patch_refresh"
  | "ensure_edition"
  | "fallback"
  | "preserved_ref";

export type NationalNewsHydrationDiagnostic = {
  editionId: string | null;
  editionDate: string | null;
  source: NationalNewsHydrationSource;
  cacheHasNationalNews: boolean;
  networkHasNationalNews: boolean;
  storyCount: number;
  packageId: string | null;
  preventedNullOverwrite: boolean;
  accepted: boolean;
  blockedReason: string | null;
  at: string;
};

export function logNationalNewsHydration(
  diagnostic: NationalNewsHydrationDiagnostic
): void {
  if (!__DEV__) return;
  console.log("[home:nationalNews:hydration]", diagnostic);
}

export function mergeNationalNewsHydration(
  existing: NationalNewsPackage | null | undefined,
  incoming: NationalNewsPackage | null | undefined
): { value: NationalNewsPackage | null; preventedNullOverwrite: boolean } {
  if (incoming) {
    return { value: incoming, preventedNullOverwrite: false };
  }
  if (existing) {
    return { value: existing, preventedNullOverwrite: true };
  }
  return { value: null, preventedNullOverwrite: false };
}

export function parseNationalNewsFromEditionRow(
  edition: { national_news?: unknown } | null | undefined
): NationalNewsPackage | null {
  return nationalNewsFromEdition(edition ?? null);
}

export function nationalNewsStoryCount(
  pkg: NationalNewsPackage | null | undefined
): number {
  return pkg?.stories?.length ?? 0;
}

export function isValidNationalNewsPackage(
  raw: unknown
): raw is NationalNewsPackage {
  return parseNationalNewsPackage(raw) != null;
}

export function resolveNationalNewsPackageForEdition(
  edition: { national_news?: unknown; edition_date?: string | null } | null | undefined
): NationalNewsPackage | null {
  return resolveNationalNewsFromEditionColumn(edition ?? null);
}
