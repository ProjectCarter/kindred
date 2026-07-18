import { supabase } from "../supabase";

export type AdjacentEdition = {
  id: string;
  edition_date: string;
};

export async function fetchAdjacentEditions(
  userId: string,
  editionDate: string,
  metroKey?: string | null
): Promise<{
  older: AdjacentEdition | null;
  newer: AdjacentEdition | null;
}> {
  const metro = metroKey?.trim() || null;

  let olderQuery = supabase
    .from("editions")
    .select("id, edition_date")
    .eq("user_id", userId)
    .eq("status", "ready")
    .lt("edition_date", editionDate)
    .order("edition_date", { ascending: false })
    .limit(1);
  if (metro) olderQuery = olderQuery.eq("metro_key", metro);

  let newerQuery = supabase
    .from("editions")
    .select("id, edition_date")
    .eq("user_id", userId)
    .eq("status", "ready")
    .gt("edition_date", editionDate)
    .order("edition_date", { ascending: true })
    .limit(1);
  if (metro) newerQuery = newerQuery.eq("metro_key", metro);

  const [{ data: older }, { data: newer }] = await Promise.all([
    olderQuery.maybeSingle(),
    newerQuery.maybeSingle(),
  ]);

  return {
    older: older ?? null,
    newer: newer ?? null,
  };
}
