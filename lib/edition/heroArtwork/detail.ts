import type { MorningHeroExperience, MasterpieceDetail } from "./types";
import { homepageMasterpieceSummary } from "./homeSummary";
import {
  isFrozenDetailComplete,
  synthesizeMasterpieceDetail,
} from "./detailTemplate";
import { resolveCleanMasterpieceDetail } from "./articleDetail";
import { morningHeroArticleIsCorrupt } from "./articleValidation";
import {
  masterpieceTraceBegin,
  masterpieceTraceEnd,
} from "../masterpieceDiagnostics";

function splitParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 20);
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphOverlapsTeaser(paragraph: string, teaser: string): boolean {
  const normalizedTeaser = normalizeForCompare(teaser);
  if (!normalizedTeaser) return false;

  const normalizedParagraph = normalizeForCompare(paragraph);
  if (normalizedParagraph === normalizedTeaser) return true;

  const sharedPrefix = normalizedTeaser.slice(0, Math.min(72, normalizedTeaser.length));
  return sharedPrefix.length > 36 && normalizedParagraph.startsWith(sharedPrefix);
}

function renameLegacyHeadings(sections: MasterpieceDetail["sections"]) {
  return sections.map((section) =>
    section.heading === "Editorial Closing"
      ? { ...section, heading: "Editorial Reflection" }
      : section
  );
}

function stripTeaserDuplication(
  detail: MasterpieceDetail,
  teaser: string
): MasterpieceDetail {
  if (!teaser.trim()) {
    return { ...detail, sections: renameLegacyHeadings(detail.sections) };
  }

  const sections = renameLegacyHeadings(detail.sections)
    .map((section) => {
      if (section.heading !== "Introduction") return section;
      const paragraphs = section.paragraphs.filter(
        (paragraph) => !paragraphOverlapsTeaser(paragraph, teaser)
      );
      return { ...section, paragraphs };
    })
    .filter((section) => section.paragraphs.length > 0);

  return { ...detail, sections };
}

function legacySections(detail: MasterpieceDetail): MasterpieceDetail | null {
  const body = detail.longStoryBody?.trim();
  if (!body) return null;

  const paragraphs = detail.longStoryParagraphs?.length
    ? detail.longStoryParagraphs
    : splitParagraphs(body);

  const sections = [
    { heading: "Introduction", paragraphs: paragraphs.slice(0, 1) },
    ...(detail.artistBiography?.trim()
      ? [
          {
            heading: "About the Artist",
            paragraphs: [detail.artistBiography.trim()],
          },
        ]
      : []),
    {
      heading: "The Story Behind the Artwork",
      paragraphs: paragraphs.slice(1, 3),
    },
    {
      heading: "Historical Context",
      paragraphs: paragraphs.slice(3, 4),
    },
    { heading: "Legacy", paragraphs: paragraphs.slice(4, 5) },
    { heading: "Editorial Reflection", paragraphs: paragraphs.slice(5) },
  ].filter((section) => section.paragraphs.length > 0);

  return {
    ...detail,
    sections,
    lookingCloser:
      detail.lookingCloser?.length
        ? detail.lookingCloser
        : detail.lookCloserItems ?? [],
  };
}

function fromStoredDetail(detail: MasterpieceDetail): MasterpieceDetail | null {
  if (detail.sections?.length) {
    return {
      ...detail,
      lookingCloser:
        detail.lookingCloser?.length
          ? detail.lookingCloser
          : detail.lookCloserItems ?? [],
    };
  }
  return legacySections(detail);
}

function teaserDetail(morningHero: MorningHeroExperience): MasterpieceDetail {
  const summary = homepageMasterpieceSummary(morningHero.aboutArtworkBody);
  const institution = morningHero.sourceInstitution?.trim() || "Open collection";

  return {
    sections: summary
      ? [{ heading: "Introduction", paragraphs: [summary] }]
      : [],
    lookingCloser: [],
    didYouKnow: "",
    museumName: institution,
    museumLocation: "",
    officialMuseumUrl: morningHero.sourceUrl?.trim() || null,
    officialArtworkUrl: morningHero.sourceUrl?.trim() || null,
    sourceReferences: morningHero.sourceUrl?.trim()
      ? [morningHero.sourceUrl.trim()]
      : [],
  };
}

export type ResolvedMasterpieceDetail = MasterpieceDetail & {
  /** True when full structured article sections are available. */
  isComplete: boolean;
};

/**
 * Resolve detail for the reader — never blocks on network.
 * Falls back to homepage summary when extended article is not frozen on the edition.
 */
export function resolveMasterpieceDetail(
  morningHero: MorningHeroExperience
): ResolvedMasterpieceDetail {
  masterpieceTraceBegin("renderer/resolveMasterpieceDetail", {
    artworkId: morningHero.artworkId,
  });
  const started = Date.now();

  const teaser = homepageMasterpieceSummary(morningHero.aboutArtworkBody);
  const templateInput = {
    artworkTitle: morningHero.artworkTitle,
    artist: morningHero.artist,
    year: morningHero.year,
    sourceInstitution: morningHero.sourceInstitution,
    sourceUrl: morningHero.sourceUrl,
    aboutArtworkBody: morningHero.aboutArtworkBody,
    collections: morningHero.collections,
  };
  const stored = morningHero.detail ? fromStoredDetail(morningHero.detail) : null;
  const storedIsCorrupt =
    stored &&
    morningHeroArticleIsCorrupt({
      artworkTitle: morningHero.artworkTitle,
      artist: morningHero.artist,
      aboutArtworkBody: morningHero.aboutArtworkBody,
      creditLine: morningHero.creditLine,
      detail: stored,
    });
  let resolved =
    stored && !storedIsCorrupt
      ? stripTeaserDuplication(stored, teaser)
      : null;

  if (!isFrozenDetailComplete(resolved) || storedIsCorrupt) {
    resolved = stripTeaserDuplication(
      resolveCleanMasterpieceDetail(templateInput, stored) ??
        synthesizeMasterpieceDetail(templateInput),
      teaser
    );
  }

  if (
    resolved &&
    resolved.sections.length > 0 &&
    isFrozenDetailComplete(resolved)
  ) {
    masterpieceTraceEnd("renderer/resolveMasterpieceDetail", {
      ms: Date.now() - started,
      isComplete: true,
      sections: resolved.sections.length,
    });
    return { ...resolved, isComplete: true };
  }

  if (resolved && resolved.sections.length > 0) {
    if (__DEV__) {
      console.warn("[masterpiece] partial detail after synthesis", {
        artworkId: morningHero.artworkId,
        sections: resolved.sections.length,
        lookCloser: resolved.lookingCloser.length,
      });
    }
    masterpieceTraceEnd("renderer/resolveMasterpieceDetail", {
      ms: Date.now() - started,
      isComplete: false,
      sections: resolved.sections.length,
    });
    return { ...resolved, isComplete: false };
  }

  if (__DEV__) {
    console.warn("[masterpiece] no detail available", {
      artworkId: morningHero.artworkId,
    });
  }

  masterpieceTraceEnd("renderer/resolveMasterpieceDetail", {
    ms: Date.now() - started,
    isComplete: false,
    sections: 0,
  });
  return { ...teaserDetail(morningHero), isComplete: false };
}

/** @deprecated Use resolveMasterpieceDetail */
export function renderMasterpieceDetail(
  morningHero: Partial<MorningHeroExperience> & {
    detail?: MasterpieceDetail | null;
    aboutArtworkBody?: string;
  }
): MasterpieceDetail | null {
  if (!morningHero.aboutArtworkBody?.trim()) return null;
  const resolved = resolveMasterpieceDetail(morningHero as MorningHeroExperience);
  return resolved.sections.length > 0 ? resolved : null;
}

export function hasMasterpieceDetail(
  morningHero: MorningHeroExperience
): boolean {
  return resolveMasterpieceDetail(morningHero).isComplete;
}
