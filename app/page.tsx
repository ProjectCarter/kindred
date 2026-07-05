import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: items } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", user!.id)
    .limit(1);

  if (!items || items.length === 0) {
    redirect("/onboarding");
  }

  redirect("/home");
}
