import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasItems } from "@/lib/items/hasItems";

export default async function RootPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!(await userHasItems(supabase, user.id))) {
    redirect("/onboarding");
  }

  redirect("/home");
}
