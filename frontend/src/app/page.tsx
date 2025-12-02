export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/40">
              <span className="text-lg font-bold text-emerald-400">PC</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                PipeCraft
              </h1>
              <p className="text-xs text-slate-400">
                Data pipeline builder for syncing between databases.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            v0 • backend-only wiring in progress
          </span>
        </header>

        {/* Content layout */}
        <div className="grid gap-6 md:grid-cols-[2fr,1.3fr]">
          {/* Left: Overview */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="mb-2 text-lg font-medium">Overview</h2>
            <p className="text-sm text-slate-400">
              PipeCraft lets you define connections to Postgres and MySQL,
              configure syncs between source and destination tables, and run
              truncate-insert jobs. This page will soon show live data from the
              backend.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-slate-300">
              <li>• Manage DB connections</li>
              <li>• Discover schemas, tables, and columns</li>
              <li>• Define syncs between source and destination</li>
              <li>• Run syncs and view run status</li>
            </ul>
          </section>

          {/* Right: Connections placeholder */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="mb-2 text-lg font-medium">Connections</h2>
            <p className="text-sm text-slate-400">
              This panel will list your configured connections from the backend.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Next step: wire this to <code className="text-emerald-400">
                GET /connections
              </code>{" "}
              so you can see your Postgres/MySQL configs here.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
