import type { ImageOrientation, StockSearchCandidate } from "./types.ts";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "Kindred/1.0 (https://kindred.app; editorial-image-engine)";

type ExtMetaValue = { value?: string; source?: string };
type ImageInfo = {
  url?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: Record<string, ExtMetaValue>;
};
type WikiPage = {
  pageid?: number;
  title?: string;
  imageinfo?: ImageInfo[];
};
type WikiSearchResponse = {
  query?: { pages?: Record<string, WikiPage> };
  error?: { code?: string; info?: string };
};

function orientationOf(w: number, h: number): ImageOrientation {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function metaValue(info: ImageInfo | undefined, key: string): string {
  const raw = info?.extmetadata?.[key]?.value ?? "";
  return stripHtml(raw);
}

/** Commercial-safe licenses only — rejects NC/ND variants. */
function isCommerciallyUsableLicense(licenseName: string): boolean {
  const license = licenseName.trim().toLowerCase();
  if (!license) return false;
  if (/non.?commercial|\bnc\b|no derivatives|\bnd\b|all rights reserved/i.test(license)) {
    return false;
  }
  return (
    /public domain|cc0|cc zero|cc by\b|cc-by\b|cc by-sa|cc-by-sa|free art license/i.test(
      license
    )
  );
}

function fileTitleToId(title: string): string {
  return title.replace(/^File:/i, "").trim();
}

function tagsFromFile(title: string, info: ImageInfo | undefined): string[] {
  const description = metaValue(info, "ImageDescription");
  const categories = metaValue(info, "Categories");
  const objectName = metaValue(info, "ObjectName");
  const blob = [fileTitleToId(title), objectName, description, categories]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return [...new Set(blob.split(/[\s,|]+/).filter((t) => t.length >= 3))].slice(0, 16);
}

function buildAttribution(info: ImageInfo | undefined, sourcePageUrl: string): string {
  const artist = metaValue(info, "Artist") || metaValue(info, "Credit");
  const license = metaValue(info, "LicenseShortName");
  const licenseUrl = metaValue(info, "LicenseUrl");
  const parts = ["Image from Wikimedia Commons"];
  if (artist) parts.push(artist);
  if (license) {
    parts.push(licenseUrl ? `${license} (${licenseUrl})` : license);
  }
  parts.push(sourcePageUrl);
  return parts.filter(Boolean).join(" — ");
}

function isAcceptableMime(mime?: string): boolean {
  if (!mime) return false;
  return /^image\/(jpeg|png|webp)$/i.test(mime);
}

/**
 * Search Wikimedia Commons via the public MediaWiki Action API.
 * No API key or developer account required — only a descriptive User-Agent.
 */
export async function searchWikimediaCommons(
  query: string,
  options?: { orientation?: ImageOrientation | "any"; perPage?: number }
): Promise<StockSearchCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `filetype:bitmap ${trimmed}`,
    gsrlimit: String(options?.perPage ?? 8),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1200",
    iiextmetadatalanguage: "en",
  });

  let res: Response;
  try {
    res = await fetch(`${COMMONS_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    console.warn("[images:wikimedia] network error", err);
    return [];
  }

  if (res.status === 429) {
    console.warn("[images:wikimedia] rate limited");
    return [];
  }

  const data = (await res.json()) as WikiSearchResponse;
  if (!res.ok || data.error) {
    console.warn("[images:wikimedia] search failed", {
      status: res.status,
      error: data.error?.info ?? null,
    });
    return [];
  }

  const pages = Object.values(data.query?.pages ?? {});
  const preferred = options?.orientation ?? "portrait";
  const results: StockSearchCandidate[] = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const width = info?.width ?? 0;
    const height = info?.height ?? 0;
    if (width < 640 || height < 480) continue;
    if (!isAcceptableMime(info?.mime)) continue;

    const licenseShortName = metaValue(info, "LicenseShortName");
    if (!isCommerciallyUsableLicense(licenseShortName)) continue;

    const title = page.title ?? "";
    const sourcePageUrl = title
      ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`
      : "https://commons.wikimedia.org/";

    const artist = metaValue(info, "Artist") || metaValue(info, "Credit") || null;
    const description = metaValue(info, "ImageDescription");
    const orientation = orientationOf(width, height);
    if (
      preferred !== "any" &&
      preferred !== "square" &&
      orientation !== preferred &&
      orientation !== "square"
    ) {
      continue;
    }

    results.push({
      provider: "wikimedia",
      providerImageId: String(page.pageid ?? fileTitleToId(title)),
      downloadUrl: info?.url ?? info?.thumburl ?? "",
      previewUrl: info?.thumburl ?? info?.url ?? "",
      width,
      height,
      photographerName: artist,
      sourcePageUrl,
      tags: tagsFromFile(title, info),
      orientation,
      altDescription: description || fileTitleToId(title),
      licenseShortName: licenseShortName || null,
      licenseUrl: metaValue(info, "LicenseUrl") || null,
      attributionText: buildAttribution(info, sourcePageUrl),
    });
  }

  return results.filter((c) => c.downloadUrl.trim().length > 0);
}
