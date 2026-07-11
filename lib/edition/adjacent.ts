import { supabase } from "../supabase";

export type AdjacentEdition = {
  id: string;
  edition_date: string;
};

export async function fetchAdjacentEditions(
  userId: string,
  editionDate: string
): Promise<{
  older: AdjacentEdition | null;
  newer: AdjacentEdition | null;
}> {
  const [{ data: older }, { data: newer }] = await Promise.all([
    supabase
      .from("editions")
      .select("id, edition_date")
      .eq("user_id", userId)
      .eq("status", "ready")
      .lt("edition_date", editionDate)
      .order("edition_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("editions")
      .select("id, edition_date")
      .eq("user_id", userId)
      .eq("status", "ready")
      .gt("edition_date", editionDate)
      .order("edition_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    older: older ?? null,
    newer: newer ?? null,
  };
}
