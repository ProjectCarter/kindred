import type { ImageOrientation, StockSearchCandidate } from "./types.ts";

type PixabayHit = {
  id: number;
  pageURL: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
};

type PixabaySearchResponse = {
  hits?: PixabayHit[];
  error?: string;
};

function orientationOf(w: number, h: number): ImageOrientation {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function isAcceptableHit(hit: PixabayHit): boolean {
  if (/logo|watermark|brand|advertisement|vector|illustration|clipart/i.test(hit.tags)) {
    return false;
  }
  if (hit.imageWidth < 640 || hit.imageHeight < 480) return false;
  return true;
}

export async function searchPixabay(
  query: string,
  options?: { orientation?: ImageOrientation; perPage?: number }
): Promise<StockSearchCandidate[]> {
  const apiKey = Deno.env.get("PIXABAY_API_KEY");
  if (!apiKey) {
    console.log("[images:pixabay] skipped — PIXABAY_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    image_type: "photo",
    safesearch: "true",
    per_page: String(options?.perPage ?? 8),
  });
  if (options?.orientation === "portrait") params.set("orientation", "vertical");
  if (options?.orientation === "landscape") params.set("orientation", "horizontal");

  const res = await fetch(`https://pixabay.com/api/?${params}`);
  if (res.status === 429) {
    console.warn("[images:pixabay] rate limited");
    return [];
  }

  const data = (await res.json()) as PixabaySearchResponse;
  if (!res.ok) {
    console.warn("[images:pixabay] search failed", {
      status: res.status,
      error: data.error ?? null,
    });
    return [];
  }

  return (data.hits ?? [])
    .filter(isAcceptableHit)
    .map((hit) => ({
      provider: "pixabay" as const,
      providerImageId: String(hit.id),
      downloadUrl: hit.largeImageURL || hit.webformatURL,
      previewUrl: hit.previewURL,
      width: hit.imageWidth,
      height: hit.imageHeight,
      photographerName: hit.user,
      sourcePageUrl: hit.pageURL,
      tags: hit.tags.split(",").map((t) => t.trim()).filter(Boolean),
      orientation: orientationOf(hit.imageWidth, hit.imageHeight),
    }));
}
