import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/requireUser";
import { userHasItems } from "@/lib/items/hasItems";
import { getItemPhotoUrl } from "@/lib/items/getItemPhotoUrl";
import { ensureInsightForItem } from "@/lib/insights/ensureInsightForItem";
import { INSIGHT_FALLBACK, PHOTO_UPLOAD_WARNING } from "@/lib/insights/constants";
import { getEnv } from "@/lib/env";
import SignOutButton from "@/app/components/SignOutButton";
import InsightStatus from "./InsightStatus";

type HomePageProps = {
  searchParams: { photoWarning?: string };
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { supabase, user } = await requireUser();
  const env = getEnv();

  if (!(await userHasItems(supabase, user.id))) {
    redirect("/onboarding");
  }

  const { data: items } = await supabase
    .from("items")
    .select("id, description, photo_path, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const itemsWithDetails = await Promise.all(
    (items ?? []).map(async (item) => {
      const photoUrl = await getItemPhotoUrl(supabase, item.photo_path);

      const { body: insightBody, pending: insightPending } =
        await ensureInsightForItem(supabase, {
          userId: user.id,
          itemId: item.id,
        });

      return { ...item, photoUrl, insightBody, insightPending };
    })
  );

  const primaryItem = itemsWithDetails[0];
  const primaryInsight = primaryItem?.insightBody ?? null;
  const insightPending = primaryItem?.insightPending ?? false;
  const showPhotoWarning = searchParams.photoWarning === "1";

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen px-6 py-12">
      <InsightStatus
        pending={insightPending && !primaryInsight}
        pollIntervalMs={env.INSIGHT_POLL_INTERVAL_MS}
        pollMaxAttempts={env.INSIGHT_POLL_MAX_ATTEMPTS}
        pollTimeoutMs={env.INSIGHT_POLL_TIMEOUT_MS}
      />

      <div className="mx-auto max-w-md space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl">Kindred</h1>
            <p className="text-sm text-ink/50">{today}</p>
          </div>
          <SignOutButton />
        </header>

        {showPhotoWarning && (
          <p className="text-sm text-ink/70" role="status">
            {PHOTO_UPLOAD_WARNING}
          </p>
        )}

        <section
          className="rounded-xl border border-ink/10 bg-white p-6"
          aria-label="Kindred's reflection"
        >
          <p className="text-ink/80">
            {primaryInsight ?? INSIGHT_FALLBACK}
          </p>
        </section>

        <section className="space-y-4" aria-labelledby="items-heading">
          <h2
            id="items-heading"
            className="text-sm font-medium uppercase tracking-wide text-ink/50"
          >
            What I know so far
          </h2>
          {itemsWithDetails.map((item) => (
            <article
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
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
