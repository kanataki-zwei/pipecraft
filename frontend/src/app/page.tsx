import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        {/* Top Header / Brand */}
        <header className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Pipecraft
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300 md:text-base">
              A lightweight data ingestion tool for syncing data between your
              sources and destinations with simple, opinionated workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/connections"
              className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              View Connections
            </Link>
            <Link
              href="/syncs"
              className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              View Syncs
            </Link>
          </div>
        </header>

        {/* Main Grid */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Card 1: Connections */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-50">
              Manage Connections
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Configure database connections once, and reuse them across
              multiple syncs. Keep credentials and roles organized in one place.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Source &amp; destination databases</span>
              <Link
                href="/connections"
                className="font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Open →
              </Link>
            </div>
          </div>

          {/* Card 2: Syncs */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-50">
              Configure Syncs
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Define how data should flow between connections: tables, modes,
              and destinations. Pipecraft keeps your sync definitions clear.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Source → Destination pipelines</span>
              <Link
                href="/syncs"
                className="font-semibold text-emerald-400 hover:text-emerald-300"
              >
                Open →
              </Link>
            </div>
          </div>

          {/* Card 3: Observability / Status */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-50">
              Monitor Runs
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              (Coming soon) Track recent sync runs, statuses, and row counts so
              you always know what&apos;s flowing through your pipelines.
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Run history &amp; logs</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                Roadmap
              </span>
            </div>
          </div>
        </section>

        {/* Footer / Tagline */}
        <footer className="mt-12 border-t border-slate-900 pt-6 text-xs text-slate-500">
          <p>
            Pipecraft v0 · Data ingestion without the bloat. v1 is focused on
            better UX for connections and syncs.
          </p>
        </footer>
      </div>
    </main>
  );
}
