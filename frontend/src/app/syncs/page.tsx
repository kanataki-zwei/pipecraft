import NewSyncForm from "./NewSyncForm";
import RunSyncButton from "./RunSyncButton";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Sync = {
  id: number;
  name: string;
  description: string | null;
  source_connection_id: number;
  source_table: string;
  dest_connection_id: number;
  dest_schema: string | null;
  dest_table: string;
  write_mode: "truncate_insert";
  created_at: string;
  updated_at: string;
};

async function fetchSyncs(): Promise<Sync[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/syncs`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch syncs:", res.status, res.statusText);
      return [];
    }

    return (await res.json()) as Sync[];
  } catch (err) {
    console.error("Error fetching syncs:", err);
    return [];
  }
}

export default async function SyncsPage() {
  const syncs = await fetchSyncs();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Syncs</h1>
            <p className="text-xs text-slate-400">
              Definitions linking source tables to destination tables.
            </p>
          </div>

          <a
            href="/"
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            ← Back to overview
          </a>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
          {/* Left: list of syncs */}
          <div>
            {syncs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
                No syncs defined yet.
                <br />
                <span className="text-xs text-slate-500">
                  Use the form on the right to create your first sync.
                </span>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Destination</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncs.map((sync) => (
                      <tr
                        key={sync.id}
                        className="border-b border-slate-900/60 last:border-b-0 hover:bg-slate-900/80"
                      >
                        <td className="px-4 py-3 text-slate-100">
                          <div className="text-sm font-medium">{sync.name}</div>
                          {sync.description && (
                            <div className="text-xs text-slate-400">
                              {sync.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          <div className="font-mono text-slate-200">
                            {sync.source_table}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            conn id: {sync.source_connection_id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          <div className="font-mono text-slate-200">
                            {sync.dest_schema
                              ? `${sync.dest_schema}.${sync.dest_table}`
                              : sync.dest_table}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            conn id: {sync.dest_connection_id}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 font-mono uppercase tracking-wide">
                            {sync.write_mode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(sync.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          <RunSyncButton syncId={sync.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: creation form */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="mb-2 text-sm font-medium text-slate-100">
              New sync
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Choose a source connection, schema, and table, then a destination
              connection and table. PipeCraft will run a truncate-insert from
              source to destination.
            </p>
            <NewSyncForm />
          </div>
        </div>
      </div>
    </main>
  );
}
