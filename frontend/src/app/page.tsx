const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Connection = {
  id: number;
  name: string;
  db_type: "postgres" | "mysql";
  host: string;
  port: number;
  database: string;
  username: string;
  is_source: boolean;
  is_destination: boolean;
};

async function fetchConnections(): Promise<Connection[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/connections`, {
      // always hit live backend in dev
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch connections:", res.status, res.statusText);
      return [];
    }

    const data = (await res.json()) as Connection[];
    return data;
  } catch (err) {
    console.error("Error fetching connections:", err);
    return [];
  }
}

export default async function Home() {
  // Server-side fetch from backend
  const connections = await fetchConnections();

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
            v0 • backend wiring
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
              truncate-insert jobs.
            </p>
            <ul className="mt-4 space-y-1 text-sm text-slate-300">
              <li>• Manage DB connections</li>
              <li>• Discover schemas, tables, and columns</li>
              <li>• Define syncs between source and destination</li>
              <li>• Run syncs and view run status</li>
            </ul>
          </section>

          {/* Right: Connections (live from backend) */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="mb-3 text-lg font-medium">Connections</h2>

            {connections.length === 0 ? (
              <p className="text-sm text-slate-500">
                No connections found. Make sure your backend is running on{" "}
                <code className="text-emerald-400">http://localhost:8000</code>{" "}
                and create a connection via the API (e.g. Swagger) to see it
                here.
              </p>
            ) : (
              <ul className="space-y-2">
                {connections.map((conn) => (
                  <li
                    key={conn.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-100">
                        {conn.name}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        {conn.db_type} • {conn.host}:{conn.port}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        DB:{" "}
                        <span className="font-mono text-slate-200">
                          {conn.database}
                        </span>
                      </span>
                      <span>
                        {conn.is_source && (
                          <span className="mr-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] text-emerald-300">
                            source
                          </span>
                        )}
                        {conn.is_destination && (
                          <span className="rounded-full border border-sky-500/40 px-2 py-0.5 text-[10px] text-sky-300">
                            dest
                          </span>
                        )}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
