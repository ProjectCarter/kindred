import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <h1 className="font-serif text-3xl">Hi. I&apos;m Kindred.</h1>
        <p className="text-ink/80">
          Before I can help, I need to get to know a few things you own.
        </p>
        <p className="text-ink/80">
          Tell me about something in your garage, closet, or storage that you
          don&apos;t use much.
        </p>
        <OnboardingForm />
      </div>
    </main>
  );
}
