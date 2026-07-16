export type MediumLabel =
  | "Painting"
  | "Photography"
  | "Photo"
  | "Illustration"
  | "Woodblock print"
  | "Artwork";

export type MasterpieceCreditInput = {
  artist: string;
  license: string;
  sourceInstitution: string;
  sourceProvider?: string | null;
  mediumHint?: string | null;
  collections?: string[];
  tags?: string[];
};
