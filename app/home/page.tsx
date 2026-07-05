import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userHasItems } from "@/lib/items/hasItems";
import { ensureInsightForItem } from "@/lib/insights/ensureInsightForItem";

const INSIGHT_FALLBACK =
  "Kindred is still thinking about this item.";

export default async function HomePage() {
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

  const { data: items } = await supabase
    .from("items")
    .select("id, description, photo_path, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const itemsWithDetails = await Promise.all(
    (items ?? []).map(async (item) => {
      let photoUrl: string | null = null;

      if (item.photo_path) {
        const { data } = await supabase.storage
          .from("item-photos")
          .createSignedUrl(item.photo_path, 3600);
        photoUrl = data?.signedUrl ?? null;
      }

      const { body: insightBody } = await ensureInsightForItem(supabase, {
        userId: user.id,
        itemId: item.id,
        description: item.description,
        hasPhoto: !!item.photo_path,
      });

      return { ...item, photoUrl, insightBody };
    })
  );

  const primaryInsight = itemsWithDetails[0]?.insightBody ?? null;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-md space-y-8">
        <header>
          <h1 className="font-serif text-2xl">Kindred</h1>
          <p className="text-sm text-ink/50">{today}</p>
        </header>

        <div className="rounded-xl border border-ink/10 bg-white p-6">
          <p className="text-ink/80">
            {primaryInsight ?? INSIGHT_FALLBACK}
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-ink/50">
            What I know so far
          </h2>
          {itemsWithDetails.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-ink/10 bg-white p-4"
            >
              {item.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.photoUrl}
                  alt=""
                  className="mb-3 h-40 w-full rounded-lg object-cover"
                />
              )}
              <p className="text-ink/80">{item.description}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
