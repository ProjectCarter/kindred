export default function HomeLoading() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-md space-y-8">
        <header>
          <h1 className="font-serif text-2xl">Kindred</h1>
        </header>

        <div
          className="rounded-xl border border-ink/10 bg-white p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-ink/80">Kindred is thinking…</p>
        </div>
      </div>
    </main>
  );
}
