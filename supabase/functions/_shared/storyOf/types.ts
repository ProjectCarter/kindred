export type CityArticleRow = {
  id: string;
  metro_key: string;
  city_name: string;
  state: string | null;
  region: string | null;
  headline: string;
  subtitle: string | null;
  body: string;
  image_url: string;
  image_caption: string;
  image_credit: string;
  image_source_url: string;
  image_license: string;
  sources: string[] | null;
  verification_notes: string | null;
  word_count: number;
  approval_status: "pending" | "approved" | "rejected";
  published_at: string | null;
};

export type CityArticleSnapshot = {
  metroKey: string;
  cityName: string;
  headline: string;
  subtitle: string;
  body: string;
  furtherReading: string[];
  image: {
    url: string;
    caption: string;
    credit: string;
    sourceUrl: string;
    license: string;
  };
};

export function storyOfHeadline(cityName: string): string {
  const name = cityName.trim();
  return name ? `The Story of ${name}` : "The Story of…";
}
