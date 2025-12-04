"use client";

import { useEffect, useState, FormEvent } from "react";

type Sync = {
  id: number;
  name: string;
  description?: string | null;
  source_connection_id: number;
  source_table: string;
  dest_connection_id: number;
  dest_schema?: string | null;
  dest_table: string;
  write_mode: string;
  created_at: string;
  updated_at: string;
};

type ConnectionOption = {
  id: number;
  name: string;
  host: string;
  database: string;
};

type ModalMode = "create" | "edit";

type SyncRun = {
  id: number;
  sync_id: number;
  status: string;
  started_at: string;
  ended_at?: string | null;
  row_count?: number | null;
  error_message?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function SyncsPage() {
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run button state
  const [runningSyncId, setRunningSyncId] = useState<number | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runSuccess, setRunSuccess] = useState<string | null>(null);

  // Connections for the modal
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);

  // Source schema/table options
  const [sourceSchemas, setSourceSchemas] = useState<string[]>([]);
  const [sourceSchemasLoading, setSourceSchemasLoading] = useState(false);
  const [sourceSchemasError, setSourceSchemasError] = useState<string | null>(
    null,
  );

  const [sourceTables, setSourceTables] = useState<string[]>([]);
  const [sourceTablesLoading, setSourceTablesLoading] = useState(false);
  const [sourceTablesError, setSourceTablesError] = useState<string | null>(
    null,
  );

  // Destination schema options
  const [destSchemas, setDestSchemas] = useState<string[]>([]);
  const [destSchemasLoading, setDestSchemasLoading] = useState(false);
  const [destSchemasError, setDestSchemasError] = useState<string | null>(null);

  // Last run per sync (for table) – undefined = not loaded yet, null = no runs
  const [lastRuns, setLastRuns] = useState<Record<number, SyncRun | null>>({});

  // Run history for the currently edited sync (for modal)
  const [runHistory, setRunHistory] = useState<SyncRun[]>([]);
  const [runHistoryLoading, setRunHistoryLoading] = useState(false);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);

  // Modal (create / edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingSyncId, setEditingSyncId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    sourceConnectionId: "",
    sourceSchema: "",
    sourceTable: "",
    destConnectionId: "",
    destSchema: "",
    destTable: "",
    writeMode: "truncate_insert",
  });

  // ---------- helpers ----------

  const findConnectionById = (idStr: string): ConnectionOption | undefined => {
    const id = Number(idStr);
    if (!id) return undefined;
    return connections.find((c) => c.id === id);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500/10 text-emerald-300";
      case "failed":
        return "bg-red-500/10 text-red-300";
      case "running":
        return "bg-sky-500/10 text-sky-300";
      default:
        return "bg-slate-600/20 text-slate-200";
    }
  };

  const formatSource = (sync: Sync) =>
    `${sync.source_connection_id}.${sync.source_table}`;

  const formatDestination = (sync: Sync) => {
    const schemaPart = sync.dest_schema ? `${sync.dest_schema}.` : "";
    return `${sync.dest_connection_id}.${schemaPart}${sync.dest_table}`;
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const renderLastRun = (run: SyncRun | null | undefined) => {
    if (run === undefined) {
      return <span className="text-xs text-slate-500">Loading…</span>;
    }
    if (run === null) {
      return <span className="text-xs text-slate-400">Never run</span>;
    }

    return (
      <div className="flex flex-col">
        <span
          className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeClass(
            run.status,
          )}`}
        >
          {run.status}
        </span>
        <span className="mt-0.5 text-[10px] text-slate-400">
          {formatDateTime(run.started_at)}
        </span>
      </div>
    );
  };

  // ---------- API calls for runs ----------

  const fetchLastRuns = async (syncList: Sync[]) => {
    if (!syncList.length) {
      setLastRuns({});
      return;
    }

    const result: Record<number, SyncRun | null> = {};

    await Promise.all(
      syncList.map(async (sync) => {
        try {
          const res = await fetch(
            `${API_BASE_URL}/syncs/${sync.id}/runs?limit=1`,
          );
          if (!res.ok) {
            throw new Error(`status ${res.status}`);
          }
          const runs: SyncRun[] = await res.json();
          result[sync.id] =
            Array.isArray(runs) && runs.length > 0 ? runs[0] : null;
        } catch (err) {
          console.error("Failed to load last run for sync", sync.id, err);
          result[sync.id] = null;
        }
      }),
    );

    setLastRuns(result);
  };

  const fetchRunHistory = async (syncId: number) => {
    try {
      setRunHistoryLoading(true);
      setRunHistoryError(null);
      setRunHistory([]);

      const res = await fetch(
        `${API_BASE_URL}/syncs/${syncId}/runs?limit=10`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load run history (status ${res.status}): ${text}`,
        );
      }

      const runs: SyncRun[] = await res.json();
      setRunHistory(Array.isArray(runs) ? runs : []);
    } catch (err: any) {
      console.error(err);
      setRunHistoryError(err.message || "Failed to load run history");
      setRunHistory([]);
    } finally {
      setRunHistoryLoading(false);
    }
  };

  // ---------- existing API calls ----------

  const fetchSyncs = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/syncs`);
      if (!res.ok) {
        throw new Error(`Failed to load syncs (status ${res.status})`);
      }

      const data = await res.json();
      const list: Sync[] = Array.isArray(data) ? data : data.syncs ?? [];
      setSyncs(list);
      // Load last-run info for each sync
      fetchLastRuns(list);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load syncs");
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      setConnectionsLoading(true);
      setConnectionsError(null);

      const res = await fetch(`${API_BASE_URL}/connections`);
      if (!res.ok) {
        throw new Error(
          `Failed to load connections (status ${res.status})`,
        );
      }

      const data = await res.json();
      const arr: any[] = Array.isArray(data) ? data : data.connections ?? [];

      const list: ConnectionOption[] = arr.map((c) => ({
        id: c.id,
        name: c.name,
        host: c.host,
        database: c.database,
      }));

      setConnections(list);
    } catch (err: any) {
      console.error(err);
      setConnectionsError(err.message || "Failed to load connections");
    } finally {
      setConnectionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncs();
    fetchConnections();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      description: "",
      sourceConnectionId: "",
      sourceSchema: "",
      sourceTable: "",
      destConnectionId: "",
      destSchema: "",
      destTable: "",
      writeMode: "truncate_insert",
    });
    setModalError(null);
    setSourceSchemas([]);
    setSourceTables([]);
    setDestSchemas([]);
    setSourceSchemasError(null);
    setSourceTablesError(null);
    setDestSchemasError(null);
    setEditingSyncId(null);
    setRunHistory([]);
    setRunHistoryError(null);
    setRunHistoryLoading(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setIsModalOpen(true);
  };

  const parseSourceTable = (
    sourceTable: string,
  ): { schema: string; table: string } => {
    if (!sourceTable) return { schema: "", table: "" };
    const parts = sourceTable.split(".");
    if (parts.length >= 2) {
      return { schema: parts[0], table: parts.slice(1).join(".") };
    }
    return { schema: "", table: sourceTable };
  };

  const openEditModal = async (sync: Sync) => {
    resetForm();
    setModalMode("edit");
    setEditingSyncId(sync.id);

    const parsed = parseSourceTable(sync.source_table);

    // prefill form
    setForm({
      name: sync.name,
      description: sync.description ?? "",
      sourceConnectionId: String(sync.source_connection_id),
      sourceSchema: parsed.schema,
      sourceTable: parsed.table,
      destConnectionId: String(sync.dest_connection_id),
      destSchema: sync.dest_schema ?? "",
      destTable: sync.dest_table,
      writeMode: sync.write_mode,
    });

    setIsModalOpen(true);

    // Load dropdown options for existing values
    const srcConnIdStr = String(sync.source_connection_id);
    const destConnIdStr = String(sync.dest_connection_id);

    if (srcConnIdStr) {
      await loadSourceSchemas(srcConnIdStr);
      if (parsed.schema) {
        await loadSourceTables(srcConnIdStr, parsed.schema);
      }
    }
    if (destConnIdStr) {
      await loadDestSchemas(destConnIdStr);
    }

    // Load run history for this sync
    fetchRunHistory(sync.id);
  };

  // ---------- schema/table loading ----------

  const loadSourceSchemas = async (connectionIdStr: string) => {
    const conn = findConnectionById(connectionIdStr);
    if (!conn?.name) {
      setSourceSchemas([]);
      return;
    }

    try {
      setSourceSchemasLoading(true);
      setSourceSchemasError(null);

      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(
          conn.name,
        )}/schemas`,
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load source schemas (status ${res.status}): ${text}`,
        );
      }

      const data = await res.json();
      const list: string[] = Array.isArray(data)
        ? data
        : data.schemas ?? [];
      setSourceSchemas(list);
    } catch (err: any) {
      console.error(err);
      setSourceSchemasError(
        err.message || "Failed to load source schemas",
      );
      setSourceSchemas([]);
    } finally {
      setSourceSchemasLoading(false);
    }
  };

  const loadSourceTables = async (
    connectionIdStr: string,
    schema: string,
  ) => {
    const conn = findConnectionById(connectionIdStr);
    if (!conn?.name || !schema) {
      setSourceTables([]);
      return;
    }

    try {
      setSourceTablesLoading(true);
      setSourceTablesError(null);

      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(
          conn.name,
        )}/tables?schema=${encodeURIComponent(schema)}`,
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load source tables (status ${res.status}): ${text}`,
        );
      }

      const data = await res.json();
      // backend shape: {connection, schema, tables: [{schema, table}, ...]}
      const tables: { schema: string; table: string }[] =
        data.tables ?? [];
      setSourceTables(tables.map((t) => t.table));
    } catch (err: any) {
      console.error(err);
      setSourceTablesError(
        err.message || "Failed to load source tables",
      );
      setSourceTables([]);
    } finally {
      setSourceTablesLoading(false);
    }
  };

  const loadDestSchemas = async (connectionIdStr: string) => {
    const conn = findConnectionById(connectionIdStr);
    if (!conn?.name) {
      setDestSchemas([]);
      return;
    }

    try {
      setDestSchemasLoading(true);
      setDestSchemasError(null);

      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(
          conn.name,
        )}/schemas`,
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to load destination schemas (status ${res.status}): ${text}`,
        );
      }

      const data = await res.json();
      const list: string[] = Array.isArray(data)
        ? data
        : data.schemas ?? [];
      setDestSchemas(list);
    } catch (err: any) {
      console.error(err);
      setDestSchemasError(
        err.message || "Failed to load destination schemas",
      );
      setDestSchemas([]);
    } finally {
      setDestSchemasLoading(false);
    }
  };

  // ---------- run sync ----------

  const handleRunSync = async (sync: Sync) => {
    try {
      setRunError(null);
      setRunSuccess(null);
      setRunningSyncId(sync.id);

      const res = await fetch(
        `${API_BASE_URL}/syncs/${encodeURIComponent(sync.id)}/run`,
        {
          method: "POST",
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to run sync (status ${res.status}): ${text}`,
        );
      }

      // run_sync returns the created SyncRun
      const run: SyncRun = await res.json();

      // Update last run for this sync
      setLastRuns((prev) => ({ ...prev, [sync.id]: run }));

      // Nice success message
      setRunSuccess(
        `Sync "${sync.name}" completed with status ${run.status} (${run.row_count ?? 0} rows).`,
      );

      // If we're currently editing this sync, refresh its run history
      if (editingSyncId === sync.id) {
        fetchRunHistory(sync.id);
      }
    } catch (err: any) {
      console.error(err);
      setRunError(err.message || "Failed to run sync");
    } finally {
      setRunningSyncId(null);
    }
  };

  // ---------- create / update sync ----------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setModalError(null);

      const payload = {
        name: form.name,
        description: form.description || null,
        source_connection_id: Number(form.sourceConnectionId),
        source_table: form.sourceTable,
        dest_connection_id: Number(form.destConnectionId),
        dest_schema: form.destSchema || null,
        dest_table: form.destTable,
        write_mode: form.writeMode,
      };

      let url = `${API_BASE_URL}/syncs`;
      let method: "POST" | "PUT" = "POST";

      if (modalMode === "edit" && editingSyncId !== null) {
        url = `${API_BASE_URL}/syncs/${editingSyncId}`;
        method = "PUT";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to ${
            modalMode === "create" ? "create" : "update"
          } sync (status ${res.status}): ${text}`,
        );
      }

      await fetchSyncs();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(
        err.message ||
          `Failed to ${
            modalMode === "create" ? "create" : "update"
          } sync`,
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete sync ----------

  const handleDelete = async () => {
    if (editingSyncId === null) return;
    if (
      !window.confirm(
        "Delete this sync and its run history? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      const res = await fetch(
        `${API_BASE_URL}/syncs/${editingSyncId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to delete sync (status ${res.status}): ${text}`,
        );
      }

      await fetchSyncs();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || "Failed to delete sync");
    } finally {
      setSaving(false);
    }
  };

  // ---------- render ----------

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Syncs
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-sm">
              Configure how data moves between your source and destination
              connections.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              + Add New Sync
            </button>
            <div className="text-xs text-slate-400">
              Total syncs:{" "}
              <span className="font-semibold text-slate-100">
                {loading ? "…" : syncs.length}
              </span>
            </div>
          </div>
        </header>

        {/* Card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm md:p-6">
          {/* Run status messages */}
          {runError && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              {runError}
            </div>
          )}
          {runSuccess && (
            <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
              {runSuccess}
            </div>
          )}

          {loading && (
            <div className="py-8 text-center text-sm text-slate-300">
              Loading syncs…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <p className="font-medium">Failed to load syncs.</p>
              <p className="mt-1 text-xs text-red-200">{error}</p>
            </div>
          )}

          {!loading && !error && syncs.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-300">
              No syncs configured yet.
              <br />
              <span className="text-slate-400">
                Use{" "}
                <span className="font-semibold text-emerald-400">
                  “Add New Sync”
                </span>{" "}
                to define your first sync.
              </span>
            </div>
          )}

          {!loading && !error && syncs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Source</th>
                    <th className="px-4 py-2 text-left">Destination</th>
                    <th className="px-4 py-2 text-left">Mode</th>
                    <th className="px-4 py-2 text-left">Last run</th>
                    <th className="px-4 py-2 text-left">Rows</th>
                    <th className="px-4 py-2 text-left">Created</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {syncs.map((sync) => {
                    const lastRun = lastRuns[sync.id];

                    return (
                      <tr
                        key={sync.id}
                        className="cursor-pointer hover:bg-slate-900/80"
                        onClick={() => openEditModal(sync)}
                      >
                        <td className="py-2 pr-4 align-top text-xs text-slate-400">
                          <code className="rounded bg-slate-900/80 px-1.5 py-0.5">
                            {sync.id}
                          </code>
                        </td>
                        <td className="px-4 py-2 align-top text-sm">
                          <div className="font-medium text-slate-50">
                            {sync.name}
                          </div>
                          {sync.description && (
                            <div className="mt-0.5 text-xs text-slate-400">
                              {sync.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-sm text-slate-200">
                          {formatSource(sync)}
                        </td>
                        <td className="px-4 py-2 align-top text-sm text-slate-200">
                          {formatDestination(sync)}
                        </td>
                        <td className="px-4 py-2 align-top text-xs uppercase tracking-wide text-emerald-300">
                          {sync.write_mode}
                        </td>
                        <td className="px-4 py-2 align-top">
                          {renderLastRun(lastRun)}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-300">
                          {lastRun === undefined
                            ? "…"
                            : lastRun?.row_count ?? "—"}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-300">
                          {formatDateTime(sync.created_at)}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRunSync(sync);
                            }}
                            disabled={runningSyncId === sync.id}
                            className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                          >
                            {runningSyncId === sync.id ? "Running…" : "Run"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Sync Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xl max-h-[90vh] rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl flex flex-col">
            <h2 className="text-lg font-semibold text-slate-50">
              {modalMode === "create" ? "Add New Sync" : "Edit Sync"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {modalMode === "create"
                ? "Define how data should move between your source and destination connections."
                : "Update this sync. Changes will affect future runs."}
            </p>

            {modalError && (
              <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {modalError}
              </div>
            )}

            {connectionsError && (
              <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {connectionsError}
              </div>
            )}

            <form
              className="mt-4 flex-1 flex flex-col overflow-hidden"
              onSubmit={handleSubmit}
            >
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Name *
                    </label>
                    <input
                      required
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="daily_warehouse_sync"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Write mode
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      value={form.writeMode}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, writeMode: e.target.value }))
                      }
                    >
                      <option value="truncate_insert">truncate_insert</option>
                      {/* future: append, upsert, etc. */}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-200">
                      Description
                    </label>
                    <textarea
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      rows={2}
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Optional description for this sync"
                    />
                  </div>
                </div>

                {/* Source section */}
                <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Source connection *
                    </label>
                    <select
                      required
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      value={form.sourceConnectionId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({
                          ...f,
                          sourceConnectionId: value,
                          sourceSchema: "",
                          sourceTable: "",
                        }));
                        setSourceSchemas([]);
                        setSourceTables([]);
                        if (value) {
                          loadSourceSchemas(value);
                        }
                      }}
                    >
                      <option value="">
                        {connectionsLoading
                          ? "Loading connections..."
                          : "Select connection"}
                      </option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.host}/{c.database})
                        </option>
                      ))}
                    </select>
                    {sourceSchemasError && (
                      <p className="mt-1 text-[10px] text-red-300">
                        {sourceSchemasError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Source schema *
                    </label>
                    <select
                      required
                      disabled={!form.sourceConnectionId || sourceSchemasLoading}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 disabled:opacity-60"
                      value={form.sourceSchema}
                      onChange={(e) => {
                        const schema = e.target.value;
                        setForm((f) => ({
                          ...f,
                          sourceSchema: schema,
                          sourceTable: "",
                        }));
                        setSourceTables([]);
                        if (schema && form.sourceConnectionId) {
                          loadSourceTables(form.sourceConnectionId, schema);
                        }
                      }}
                    >
                      <option value="">
                        {form.sourceConnectionId
                          ? sourceSchemasLoading
                            ? "Loading schemas..."
                            : "Select schema"
                          : "Select source connection first"}
                      </option>
                      {sourceSchemas.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-200">
                      Source table *
                    </label>
                    <select
                      required
                      disabled={
                        !form.sourceSchema ||
                        sourceTablesLoading ||
                        !sourceTables.length
                      }
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 disabled:opacity-60"
                      value={form.sourceTable}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sourceTable: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {!form.sourceSchema
                          ? "Select schema first"
                          : sourceTablesLoading
                            ? "Loading tables..."
                            : sourceTables.length === 0
                              ? "No tables found"
                              : "Select table"}
                      </option>
                      {sourceTables.map((t) => (
                        <option key={t} value={t}>
                          {form.sourceSchema}.{t}
                        </option>
                      ))}
                    </select>
                    {sourceTablesError && (
                      <p className="mt-1 text-[10px] text-red-300">
                        {sourceTablesError}
                      </p>
                    )}
                  </div>
                </div>

                {/* Destination section */}
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Destination connection *
                    </label>
                    <select
                      required
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      value={form.destConnectionId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({
                          ...f,
                          destConnectionId: value,
                          destSchema: "",
                        }));
                        setDestSchemas([]);
                        if (value) {
                          loadDestSchemas(value);
                        }
                      }}
                    >
                      <option value="">
                        {connectionsLoading
                          ? "Loading connections..."
                          : "Select connection"}
                      </option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.host}/{c.database})
                        </option>
                      ))}
                    </select>
                    {destSchemasError && (
                      <p className="mt-1 text-[10px] text-red-300">
                        {destSchemasError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-200">
                      Destination schema *
                    </label>
                    <select
                      required
                      disabled={!form.destConnectionId || destSchemasLoading}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 disabled:opacity-60"
                      value={form.destSchema}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          destSchema: e.target.value,
                        }))
                      }
                    >
                      <option value="">
                        {form.destConnectionId
                          ? destSchemasLoading
                            ? "Loading schemas..."
                            : "Select schema"
                          : "Select destination connection first"}
                      </option>
                      {destSchemas.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-200">
                      Destination table *
                    </label>
                    <input
                      required
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                      value={form.destTable}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          destTable: e.target.value,
                        }))
                      }
                      placeholder="fact_events"
                    />
                  </div>
                </div>

                {/* Run history */}
                {modalMode === "edit" && (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                        Run history
                      </h3>
                      {runHistoryLoading && (
                        <span className="text-[10px] text-slate-400">
                          Loading…
                        </span>
                      )}
                    </div>

                    {runHistoryError && (
                      <p className="mt-2 text-[11px] text-red-300">
                        {runHistoryError}
                      </p>
                    )}

                    {!runHistoryLoading &&
                      !runHistoryError &&
                      runHistory.length === 0 && (
                        <p className="mt-2 text-[11px] text-slate-400">
                          No runs yet for this sync.
                        </p>
                      )}

                    {runHistory.length > 0 && (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                        {runHistory.map((run) => (
                          <li
                            key={run.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-slate-950/60 px-2 py-1"
                          >
                            <div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeClass(
                                  run.status,
                                )}`}
                              >
                                {run.status}
                              </span>
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                {formatDateTime(run.started_at)}
                              </div>
                            </div>
                            <div className="text-right text-[11px] text-slate-300">
                              <div>{run.row_count ?? "—"} rows</div>
                              {run.error_message && (
                                <div
                                  className="mt-0.5 max-w-[180px] truncate text-[10px] text-red-300"
                                  title={run.error_message}
                                >
                                  {run.error_message}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed footer with buttons */}
              <div className="mt-4 flex items-center justify-between gap-3 pt-2 shrink-0">
                {modalMode === "edit" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Delete sync
                  </button>
                )}

                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!saving) setIsModalOpen(false);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {saving
                      ? modalMode === "create"
                        ? "Creating…"
                        : "Saving…"
                      : modalMode === "create"
                        ? "Create Sync"
                        : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
