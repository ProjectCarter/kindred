import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { userHasItems } from "@/lib/items/hasItems";

export default async function RootPage() {
  const { supabase, user } = await requireUser();

  if (!(await userHasItems(supabase, user.id))) {
    redirect("/onboarding");
  }

  redirect("/home");
}
