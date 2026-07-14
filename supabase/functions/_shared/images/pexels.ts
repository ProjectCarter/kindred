import type { ImageOrientation, StockSearchCandidate } from "./types.ts";

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  alt?: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    portrait: string;
    landscape: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
  error?: string;
};

function orientationOf(w: number, h: number): ImageOrientation {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function pickDownloadUrl(
  photo: PexelsPhoto,
  preferred: ImageOrientation
): string {
  if (preferred === "portrait" && photo.src.portrait) return photo.src.portrait;
  if (preferred === "landscape" && photo.src.landscape) return photo.src.landscape;
  return photo.src.large || photo.src.medium || photo.src.original;
}

function isAcceptablePhoto(photo: PexelsPhoto): boolean {
  const alt = `${photo.alt ?? ""} ${photo.photographer}`;
  if (/logo|watermark|brand|advertisement|qr code|screenshot/i.test(alt)) {
    return false;
  }
  if (photo.width < 640 || photo.height < 480) return false;
  return true;
}

export async function searchPexels(
  query: string,
  options?: { orientation?: ImageOrientation; perPage?: number }
): Promise<StockSearchCandidate[]> {
  const apiKey = Deno.env.get("PEXELS_API_KEY");
  if (!apiKey) {
    console.log("[images:pexels] skipped — PEXELS_API_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    query,
    per_page: String(options?.perPage ?? 8),
  });
  if (options?.orientation && options.orientation !== "square") {
    params.set("orientation", options.orientation);
  }

  const res = await fetch(`https://api.pexels.com/v1/search?${params}`, {
    headers: { Authorization: apiKey },
  });

  if (res.status === 429) {
    console.warn("[images:pexels] rate limited");
    return [];
  }

  const data = (await res.json()) as PexelsSearchResponse;
  if (!res.ok) {
    console.warn("[images:pexels] search failed", {
      status: res.status,
      error: data.error ?? null,
    });
    return [];
  }

  const preferred = options?.orientation ?? "portrait";
  return (data.photos ?? [])
    .filter(isAcceptablePhoto)
    .map((photo) => ({
      provider: "pexels" as const,
      providerImageId: String(photo.id),
      downloadUrl: pickDownloadUrl(photo, preferred),
      previewUrl: photo.src.medium,
      width: photo.width,
      height: photo.height,
      photographerName: photo.photographer,
      sourcePageUrl: photo.url,
      tags: photo.alt ? photo.alt.toLowerCase().split(/\s+/).slice(0, 12) : [],
      orientation: orientationOf(photo.width, photo.height),
      altDescription: photo.alt ?? null,
    }));
}
