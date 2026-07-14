import type { ImageOrientation, StockSearchCandidate } from "./types.ts";

type UnsplashPhoto = {
  id: string;
  width: number;
  height: number;
  urls: {
    raw?: string;
    full?: string;
    regular?: string;
    small?: string;
    thumb?: string;
  };
  links: { html?: string };
  user?: { name?: string };
  alt_description?: string | null;
  description?: string | null;
};

type UnsplashSearchResponse = {
  results?: UnsplashPhoto[];
  errors?: string[];
};

function orientationOf(w: number, h: number): ImageOrientation {
  if (w === h) return "square";
  return w > h ? "landscape" : "portrait";
}

function pickDownloadUrl(
  photo: UnsplashPhoto,
  preferred: ImageOrientation
): string {
  if (preferred === "portrait" && photo.urls.regular) return photo.urls.regular;
  if (preferred === "landscape" && photo.urls.regular) return photo.urls.regular;
  return photo.urls.full || photo.urls.regular || photo.urls.small || "";
}

function tagsFromPhoto(photo: UnsplashPhoto): string[] {
  const raw = [photo.alt_description, photo.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!raw.trim()) return [];
  return [...new Set(raw.split(/[\s,]+/).filter((t) => t.length >= 2))].slice(0, 16);
}

function isAcceptablePhoto(photo: UnsplashPhoto): boolean {
  const alt = `${photo.alt_description ?? ""} ${photo.description ?? ""} ${photo.user?.name ?? ""}`;
  if (/logo|watermark|brand|advertisement|qr code|screenshot|vector|illustration/i.test(alt)) {
    return false;
  }
  if (photo.width < 640 || photo.height < 480) return false;
  return Boolean(pickDownloadUrl(photo, "portrait"));
}

export async function searchUnsplash(
  query: string,
  options?: { orientation?: ImageOrientation; perPage?: number }
): Promise<StockSearchCandidate[]> {
  const apiKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!apiKey) {
    console.log("[images:unsplash] skipped — UNSPLASH_ACCESS_KEY not set");
    return [];
  }

  const params = new URLSearchParams({
    query,
    per_page: String(options?.perPage ?? 8),
  });
  if (options?.orientation && options.orientation !== "square") {
    params.set("orientation", options.orientation);
  }

  const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });

  if (res.status === 429) {
    console.warn("[images:unsplash] rate limited");
    return [];
  }

  const data = (await res.json()) as UnsplashSearchResponse;
  if (!res.ok) {
    console.warn("[images:unsplash] search failed", {
      status: res.status,
      errors: data.errors ?? null,
    });
    return [];
  }

  const preferred = options?.orientation ?? "portrait";
  return (data.results ?? [])
    .filter(isAcceptablePhoto)
    .map((photo) => ({
      provider: "unsplash" as const,
      providerImageId: photo.id,
      downloadUrl: pickDownloadUrl(photo, preferred),
      previewUrl: photo.urls.small || photo.urls.thumb || photo.urls.regular || "",
      width: photo.width,
      height: photo.height,
      photographerName: photo.user?.name ?? null,
      sourcePageUrl: photo.links.html ?? "https://unsplash.com",
      tags: tagsFromPhoto(photo),
      orientation: orientationOf(photo.width, photo.height),
      altDescription: photo.alt_description ?? photo.description ?? null,
    }));
}
