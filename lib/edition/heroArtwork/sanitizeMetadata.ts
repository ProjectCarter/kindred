/**
 * Strip Wikimedia Commons / Wikidata machine syntax from editorial fields.
 * Human-readable values only — never QS:, P####, label metadata, or API fragments.
 */

const WIKIDATA_BLOCK_SPLIT =
  /\s+(?:title|label|description|aliases?)\s+QS:/i;
const WIKIDATA_QS_SPLIT = /\bQS:/i;
const TRUNCATED_METADATA_TAIL = /\blabe[….…]+\s*/gi;

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect Wikidata / Commons extmetadata machine syntax. */
export function containsWikidataSyntax(
  text: string | null | undefined
): boolean {
  if (!text?.trim()) return false;
  const t = text;
  return (
    /\bQS:/i.test(t) ||
    /\blabel\s+QS:/i.test(t) ||
    /\btitle\s+QS:/i.test(t) ||
    /,\s*en:"/i.test(t) ||
    /,\s*[a-z]{2,3}:"/i.test(t) ||
    (/\bP\d{3,}\b/.test(t) && /\bQS:/i.test(t))
  );
}

function extractQuotedEnglishLabel(raw: string): string | null {
  const en = raw.match(/,\s*en:"([^"]+)"/i);
  if (en?.[1]?.trim()) return en[1].trim();
  const label = raw.match(/(?:title|label)\s+QS:P\d+[^"]*"([^"]+)"/i);
  if (label?.[1]?.trim()) return label[1].trim();
  return null;
}

/** Remove Wikidata qualifier blocks; prefer quoted English labels when present. */
export function stripWikidataMarkup(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  let text = stripHtml(raw);
  const quoted = extractQuotedEnglishLabel(text);
  if (quoted) return quoted.replace(TRUNCATED_METADATA_TAIL, " ").trim();

  text = text.split(WIKIDATA_BLOCK_SPLIT)[0] ?? text;
  text = text.split(WIKIDATA_QS_SPLIT)[0] ?? text;
  text = text.replace(TRUNCATED_METADATA_TAIL, "").trim();
  return text.replace(/\s+/g, " ").trim();
}

function truncateEditorial(text: string, max = 140): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** Parse artwork title from a Commons File: page title (Artist - Title - …). */
export function parseTitleFromFilePageTitle(
  filePageTitle: string | null | undefined
): string | null {
  if (!filePageTitle?.trim()) return null;
  let name = filePageTitle.replace(/^File:/i, "").trim();
  name = name.replace(/\.(jpe?g|png|webp|gif)$/i, "").trim();
  const parts = name.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const titlePart = stripWikidataMarkup(parts[1]);
    if (titlePart.length >= 4 && !containsWikidataSyntax(titlePart)) {
      return titlePart;
    }
  }
  const whole = stripWikidataMarkup(name.replace(/_/g, " "));
  if (whole.length >= 4 && !containsWikidataSyntax(whole)) return whole;
  return null;
}

/** Parse artist name from a Commons File: page title (Artist - Title - …). */
export function parseArtistFromFilePageTitle(
  filePageTitle: string | null | undefined
): string | null {
  if (!filePageTitle?.trim()) return null;
  let name = filePageTitle.replace(/^File:/i, "").trim();
  name = name.replace(/\.(jpe?g|png|webp|gif)$/i, "").trim();
  const parts = name.split(/\s*[-–—]\s*/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const artist = stripWikidataMarkup(parts[0].replace(/_/g, " "));
  if (artist.length >= 2 && !containsWikidataSyntax(artist)) return artist;
  return null;
}

export type WikimediaTitleHints = {
  objectName?: string | null;
  filePageTitle?: string | null;
};

/** Resolve a human-readable artwork title from Commons metadata. */
export function sanitizeArtworkTitle(
  raw: string | null | undefined,
  hints: WikimediaTitleHints = {}
): string {
  const objectName = hints.objectName?.trim();
  if (objectName) {
    const fromObject = stripWikidataMarkup(objectName);
    if (fromObject.length >= 4 && !containsWikidataSyntax(fromObject)) {
      return truncateEditorial(fromObject);
    }
  }

  if (raw?.trim()) {
    const quoted = extractQuotedEnglishLabel(raw);
    if (quoted && quoted.length >= 4) {
      return truncateEditorial(quoted);
    }
    const stripped = stripWikidataMarkup(raw);
    if (stripped.length >= 4 && !containsWikidataSyntax(stripped)) {
      return truncateEditorial(stripped);
    }
  }

  const fromFile = parseTitleFromFilePageTitle(hints.filePageTitle);
  if (fromFile) return truncateEditorial(fromFile);

  return "Untitled artwork";
}

/** Resolve a human-readable artist name from Commons metadata. */
export function sanitizeArtistName(
  raw: string | null | undefined,
  filePageTitle?: string | null
): string {
  const text = stripWikidataMarkup(stripHtml(raw ?? ""));
  if (text.length >= 2 && !/^unknown/i.test(text) && !containsWikidataSyntax(text)) {
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  }

  const fromFile = parseArtistFromFilePageTitle(filePageTitle);
  if (fromFile) {
    return fromFile.length > 120 ? `${fromFile.slice(0, 117)}…` : fromFile;
  }

  return "Unknown artist";
}

/** Parse a plausible artwork year — never from Wikidata property IDs (e.g. P1476). */
export function parseArtworkYearFromText(
  text: string | null | undefined
): string | null {
  const clean = stripWikidataMarkup(text ?? "");
  if (!clean.trim()) return null;

  const range = clean.match(
    /(?:^|[^\d])(1[0-9]{3}|20[0-1][0-9])\s*[–-]\s*(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/
  );
  if (range) return `${range[1]}–${range[2]}`;

  const paren = clean.match(
    /\(\s*((?:1[0-9]{3}|20[0-1][0-9])(?:\s*[–-]\s*(?:1[0-9]{3}|20[0-1][0-9]))?)\s*\)/
  );
  if (paren) return paren[1].replace(/\s*[–-]\s*/g, "–");

  const circa = clean.match(
    /(?:^|[^\d])c\.?\s*(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/i
  );
  if (circa) return circa[1];

  const single = clean.match(/(?:^|[^\d])(1[0-9]{3}|20[0-1][0-9])(?:[^\d]|$)/);
  return single?.[1] ?? null;
}

export function sanitizeArtworkYear(
  year: string | null | undefined,
  context: {
    title?: string | null;
    imageDescription?: string | null;
    filePageTitle?: string | null;
  } = {}
): string | null {
  const stored = year?.trim();
  const rawContext = [context.title, context.imageDescription, context.filePageTitle]
    .filter(Boolean)
    .join(" ");

  if (stored) {
    const prop = rawContext.match(/QS:P(\d+)/i);
    if (prop && prop[1] === stored) {
      return parseArtworkYearFromText(
        [context.imageDescription, context.filePageTitle].filter(Boolean).join(" ")
      );
    }
    if (!containsWikidataSyntax(stored)) return stored;
  }

  return parseArtworkYearFromText(
    [context.imageDescription, context.filePageTitle, context.title]
      .filter(Boolean)
      .join(" ")
  );
}

/** Sanitize long-form editorial copy; strips Wikidata blocks from embedded text. */
export function sanitizeEditorialText(
  raw: string | null | undefined
): string {
  if (!raw?.trim()) return "";
  let text = stripHtml(raw);
  text = text.replace(
    /\s+(?:title|label|description|aliases?)\s+QS:\w+(?:,\s*[a-z]{2,3}:"[^"]*")?(?:,\s*"[^"]*")?/gi,
    ""
  );
  text = text.replace(/,\s*[a-z]{2,3}:"[^"]*"/gi, "");
  text = text.split(WIKIDATA_QS_SPLIT)[0] ?? text;
  text = text.replace(TRUNCATED_METADATA_TAIL, "").trim();
  if (containsWikidataSyntax(text)) {
    const quoted = extractQuotedEnglishLabel(text);
    if (quoted) {
      const prefix = text.split(WIKIDATA_BLOCK_SPLIT)[0]?.trim();
      text = prefix && prefix.length >= 4 ? prefix : quoted;
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

/** Validate and clean a field before persistence. Logs when syntax survives cleaning. */
export function assertCleanEditorialField(
  fieldName: string,
  value: string | null | undefined,
  sanitizer: (v: string | null | undefined) => string = sanitizeEditorialText
): string {
  const cleaned = sanitizer(value);
  if (cleaned && containsWikidataSyntax(cleaned)) {
    console.warn(
      `[heroArtwork:sanitize] ${fieldName} still contains Wikidata syntax after cleaning`
    );
  }
  return cleaned;
}

export function sanitizeStringList(values: string[] | null | undefined): string[] {
  return (values ?? [])
    .map((v) => sanitizeEditorialText(v))
    .filter((v) => v.length > 0 && !containsWikidataSyntax(v));
}
