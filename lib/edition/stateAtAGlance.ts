/**
 * Verified U.S. state symbols for Story of closing sections.
 *
 * CAPITOL PHOTO STANDARD (permanent):
 * - Authentic photograph of the official state capitol building only.
 * - Never skylines, downtown views, aerial city photos, or generic city images.
 * - Never AI-generated or illustrated stand-ins.
 * - Wikimedia Commons (verified license), official state government, LOC, or equivalent.
 * - If the capitol image cannot be verified, omit the symbol — never substitute.
 *
 * Text facts: official state library / legislature sources (stateAtAGlanceFacts.ts).
 * Image assets: approved editorial library (stateAtAGlanceAssets.ts).
 */

import {
  isVerifiedStateSymbolImageUrl,
  normalizeStateSymbolImageUrl,
} from "./stateAtAGlanceImage.ts";
import {
  US_STATE_TEXT_FACTS,
  hasVerifiedStateTextFacts,
} from "./stateAtAGlanceFacts.ts";
import { STATE_SYMBOL_ASSETS } from "./stateAtAGlanceAssets.ts";

export type StateSymbolImage = {
  url: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  license: string;
};

export type StateAtAGlanceSymbol = {
  emoji: string;
  label: string;
  name: string;
  image: StateSymbolImage;
};

export type StateAtAGlance = {
  stateCode: string;
  stateName: string;
  sectionTitle: string;
  statehood: string;
  nickname: string;
  /** Official state motto when verified — omitted when none is established in law. */
  motto?: string | null;
  capital: string;
  capitol: StateAtAGlanceSymbol | null;
  symbols: {
    flag: StateAtAGlanceSymbol | null;
    bird: StateAtAGlanceSymbol | null;
    tree: StateAtAGlanceSymbol | null;
    flower: StateAtAGlanceSymbol | null;
  };
};

export function symbolHasVerifiedImage(
  symbol: StateAtAGlanceSymbol | null | undefined
): boolean {
  if (!symbol) return false;
  const url = normalizeStateSymbolImageUrl(symbol.image.url);
  return url != null && isVerifiedStateSymbolImageUrl(url);
}

function buildStateAtAGlance(code: string): StateAtAGlance | null {
  const facts = US_STATE_TEXT_FACTS[code];
  if (!hasVerifiedStateTextFacts(facts)) return null;

  const assets = STATE_SYMBOL_ASSETS[code];
  return {
    ...facts,
    capitol: assets?.capitol ?? null,
    symbols: {
      flag: assets?.symbols?.flag ?? null,
      bird: assets?.symbols?.bird ?? null,
      tree: assets?.symbols?.tree ?? null,
      flower: assets?.symbols?.flower ?? null,
    },
  };
}

/** Extract two-letter state code from a Kindred metro key (e.g. gilbert-az → AZ). */
export function stateCodeFromMetroKey(
  metroKey: string | null | undefined
): string | null {
  const key = metroKey?.trim().toLowerCase();
  if (!key) return null;
  const match = key.match(/-([a-z]{2})$/);
  if (!match?.[1]) return null;
  return match[1].toUpperCase();
}

/** Normalize a U.S. state abbreviation from metro keys or place snapshots. */
export function stateCodeFromStateField(
  state: string | null | undefined
): string | null {
  const trimmed = state?.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function resolveStateAtAGlanceByCode(code: string | null): StateAtAGlance | null {
  if (!code) return null;
  return buildStateAtAGlance(code);
}

export function resolveStateAtAGlance(
  metroKey: string | null | undefined
): StateAtAGlance | null {
  return resolveStateAtAGlanceByCode(stateCodeFromMetroKey(metroKey));
}

/** Resolve state glance from metro key or a place snapshot state field. */
export function resolveStateAtAGlanceForPlace(options: {
  metroKey?: string | null;
  state?: string | null;
}): StateAtAGlance | null {
  return (
    resolveStateAtAGlance(options.metroKey) ??
    resolveStateAtAGlanceByCode(stateCodeFromStateField(options.state))
  );
}

/** Verified symbol images only — unapproved or missing assets are omitted. */
export function stateAtAGlanceSymbolOrder(
  glance: StateAtAGlance
): StateAtAGlanceSymbol[] {
  const items: StateAtAGlanceSymbol[] = [];
  if (symbolHasVerifiedImage(glance.capitol)) {
    items.push(glance.capitol!);
  }
  for (const symbol of [
    glance.symbols.flag,
    glance.symbols.bird,
    glance.symbols.tree,
    glance.symbols.flower,
  ]) {
    if (symbolHasVerifiedImage(symbol)) {
      items.push(symbol!);
    }
  }
  return items;
}

const GRID_GAP = 14;

/** Equal cell width for the symbol grid at a given content width. */
export function stateAtAGlanceCellWidth(contentWidth: number): number {
  return Math.floor((contentWidth - GRID_GAP) / 2);
}

/** Large editorial image width for single-column state symbol spreads. */
export function stateAtAGlanceEditorialImageWidth(contentWidth: number): number {
  return Math.min(contentWidth, 520);
}

/** Height for editorial state symbol photographs at a given width. */
export function stateAtAGlanceEditorialImageHeight(imageWidth: number): number {
  return Math.round(imageWidth * 0.62);
}

/** Index at which the final grid row begins (handles partial symbol layouts). */
export function stateAtAGlanceLastRowStart(symbolCount: number): number {
  if (symbolCount <= 0) return 0;
  return symbolCount - (symbolCount % 2 === 0 ? 2 : 1);
}

export function resolveStateSymbolImageUri(
  image: StateSymbolImage
): string | null {
  return normalizeStateSymbolImageUrl(image.url);
}
