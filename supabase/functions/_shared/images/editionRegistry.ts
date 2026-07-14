/**
 * Edition-wide image ledger for server-side enrichment — prevents duplicate
 * hosted URLs, library IDs, provider image IDs, and visual repetition within
 * one edition (composition, subject, color, hash, photographer).
 */

import type { ImageCategoryTag } from "./taxonomy.ts";

export type VarietyLedger = {
  compositions: Set<string>;
  subjects: Set<string>;
  colors: Set<string>;
  hashes: Set<string>;
  photographers: Set<string>;
};

export class EditionImageRegistry {
  private usedLibraryIds = new Set<string>();
  private usedProviderIds = new Set<string>();
  private usedUrls = new Set<string>();
  private usedContentHashes = new Set<string>();
  private usedPhotographers = new Set<string>();
  private usedCompositionTags = new Set<string>();
  private usedDominantSubjects = new Set<string>();
  private usedDominantColors = new Set<string>();
  private categorySlotIndex = new Map<ImageCategoryTag, number>();

  hasLibraryId(id: string): boolean {
    return this.usedLibraryIds.has(id);
  }

  hasProviderId(source: string, providerImageId: string): boolean {
    return this.usedProviderIds.has(`${source}:${providerImageId}`);
  }

  hasUrl(url: string): boolean {
    return this.usedUrls.has(url);
  }

  hasContentHash(hash: string | null | undefined): boolean {
    return Boolean(hash && this.usedContentHashes.has(hash));
  }

  /** Avoid back-to-back photos from the same photographer in one edition. */
  hasPhotographer(name: string | null | undefined): boolean {
    if (!name?.trim()) return false;
    return this.usedPhotographers.has(name.trim().toLowerCase());
  }

  hasComposition(tag: string | null | undefined): boolean {
    return Boolean(tag && this.usedCompositionTags.has(tag));
  }

  hasDominantSubject(subject: string | null | undefined): boolean {
    return Boolean(subject && this.usedDominantSubjects.has(subject));
  }

  hasDominantColor(color: string | null | undefined): boolean {
    return Boolean(color && this.usedDominantColors.has(color));
  }

  /** Rotate composition slots so same-category items feel visually distinct. */
  nextCompositionSlotIndex(category: ImageCategoryTag): number {
    const current = this.categorySlotIndex.get(category) ?? 0;
    this.categorySlotIndex.set(category, current + 1);
    return current;
  }

  varietyLedger(): VarietyLedger {
    return {
      compositions: new Set(this.usedCompositionTags),
      subjects: new Set(this.usedDominantSubjects),
      colors: new Set(this.usedDominantColors),
      hashes: new Set(this.usedContentHashes),
      photographers: new Set(this.usedPhotographers),
    };
  }

  claim(record: {
    libraryId: string;
    url: string;
    source: string;
    providerImageId: string;
    contentHash?: string | null;
    photographerName?: string | null;
    compositionTag?: string | null;
    dominantSubject?: string | null;
    dominantColor?: string | null;
  }): boolean {
    if (
      this.usedLibraryIds.has(record.libraryId) ||
      this.usedUrls.has(record.url) ||
      this.usedProviderIds.has(`${record.source}:${record.providerImageId}`) ||
      (record.contentHash && this.usedContentHashes.has(record.contentHash)) ||
      (record.compositionTag && this.usedCompositionTags.has(record.compositionTag)) ||
      (record.dominantSubject && this.usedDominantSubjects.has(record.dominantSubject)) ||
      (record.dominantColor && this.usedDominantColors.has(record.dominantColor))
    ) {
      return false;
    }
    this.usedLibraryIds.add(record.libraryId);
    this.usedUrls.add(record.url);
    this.usedProviderIds.add(`${record.source}:${record.providerImageId}`);
    if (record.contentHash) this.usedContentHashes.add(record.contentHash);
    if (record.photographerName?.trim()) {
      this.usedPhotographers.add(record.photographerName.trim().toLowerCase());
    }
    if (record.compositionTag) this.usedCompositionTags.add(record.compositionTag);
    if (record.dominantSubject) this.usedDominantSubjects.add(record.dominantSubject);
    if (record.dominantColor) this.usedDominantColors.add(record.dominantColor);
    return true;
  }

  usedLibraryIdSet(): Set<string> {
    return new Set(this.usedLibraryIds);
  }
}
