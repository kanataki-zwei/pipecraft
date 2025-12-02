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
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch connections:", res.status, res.statusText);
      return [];
    }

    return (await res.json()) as Connection[];
  } catch (err) {
    console.error("Error fetching connections:", err);
    return [];
  }
}

export default async function ConnectionsPage() {
  const connections = await fetchConnections();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Connections
            </h1>
            <p className="text-xs text-slate-400">
              Manage Postgres and MySQL connections used by PipeCraft syncs.
            </p>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            ← Back to overview
          </a>
        </header>

        {/* Content */}
        {connections.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
            No connections found.
            <br />
            <span className="text-xs text-slate-500">
              Create a connection via the backend API first (e.g.{" "}
              <code className="text-emerald-400">/docs</code>) — next step
              we&apos;ll add a UI form here.
            </span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Database</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3 text-right">Roles</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((conn) => (
                  <tr
                    key={conn.id}
                    className="border-b border-slate-900/60 last:border-b-0 hover:bg-slate-900/80"
                  >
                    <td className="px-4 py-3 text-slate-100">{conn.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono uppercase tracking-wide">
                        {conn.db_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {conn.host}:{conn.port}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <span className="font-mono">{conn.database}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <span className="font-mono">{conn.username}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      {conn.is_source && (
                        <span className="mr-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-emerald-300">
                          source
                        </span>
                      )}
                      {conn.is_destination && (
                        <span className="rounded-full border border-sky-500/40 px-2 py-0.5 text-sky-300">
                          dest
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
