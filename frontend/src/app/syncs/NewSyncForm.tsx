"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type DbType = "postgres" | "mysql";

type Connection = {
  id: number;
  name: string;
  db_type: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
  is_source: boolean;
  is_destination: boolean;
};

type TableInfo = {
  schema: string;
  table: string;
};

type FormState = {
  name: string;
  description: string;
  source_connection_id: number | null;
  source_schema: string;
  source_table: string;
  dest_connection_id: number | null;
  dest_schema: string;
  dest_table: string;
};

export default function NewSyncForm() {
  const router = useRouter();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    source_connection_id: null,
    source_schema: "",
    source_table: "",
    dest_connection_id: null,
    dest_schema: "",
    dest_table: "",
  });

  const [sourceSchemas, setSourceSchemas] = useState<string[]>([]);
  const [sourceTables, setSourceTables] = useState<TableInfo[]>([]);

  const [destSchemas, setDestSchemas] = useState<string[]>([]);
  const [destTables, setDestTables] = useState<TableInfo[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper to find connection by id
  const findConnectionById = (id: number | null): Connection | undefined =>
    connections.find((c) => c.id === id ?? undefined);

  // Load connections on mount
  useEffect(() => {
    async function loadConnections() {
      try {
        const res = await fetch(`${API_BASE_URL}/connections`, {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error(
            "Failed to fetch connections:",
            res.status,
            res.statusText,
          );
          setConnections([]);
        } else {
          const data = (await res.json()) as Connection[];
          setConnections(data);
        }
      } catch (err) {
        console.error("Error fetching connections:", err);
        setConnections([]);
      } finally {
        setLoadingConnections(false);
      }
    }

    loadConnections();
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Load schemas for a given connection (by id)
  async function loadSchemas(
    connId: number | null,
    kind: "source" | "dest",
  ) {
    const conn = findConnectionById(connId);
    if (!conn) {
      if (kind === "source") {
        setSourceSchemas([]);
        setSourceTables([]);
        updateField("source_schema", "");
        updateField("source_table", "");
      } else {
        setDestSchemas([]);
        setDestTables([]);
        updateField("dest_schema", "");
        updateField("dest_table", "");
      }
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(conn.name)}/schemas`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        console.error("Failed to fetch schemas:", res.status, res.statusText);
        if (kind === "source") {
          setSourceSchemas([]);
          setSourceTables([]);
        } else {
          setDestSchemas([]);
          setDestTables([]);
        }
        return;
      }
      const data = await res.json();
      const schemas = (data.schemas ?? []) as string[];

      if (kind === "source") {
        setSourceSchemas(schemas);
        setSourceTables([]);
        updateField("source_schema", "");
        updateField("source_table", "");
      } else {
        setDestSchemas(schemas);
        setDestTables([]);
        updateField("dest_schema", "");
        updateField("dest_table", "");
      }
    } catch (err) {
      console.error("Error fetching schemas:", err);
      if (kind === "source") {
        setSourceSchemas([]);
        setSourceTables([]);
      } else {
        setDestSchemas([]);
        setDestTables([]);
      }
    }
  }

  // Load tables for connection + schema
  async function loadTables(
    connId: number | null,
    schema: string,
    kind: "source" | "dest",
  ) {
    const conn = findConnectionById(connId);
    if (!conn || !schema) {
      if (kind === "source") {
        setSourceTables([]);
        updateField("source_table", "");
      } else {
        setDestTables([]);
        updateField("dest_table", "");
      }
      return;
    }

    try {
      const url = new URL(
        `${API_BASE_URL}/connections/${encodeURIComponent(conn.name)}/tables`,
      );
      url.searchParams.set("schema", schema);

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) {
        console.error("Failed to fetch tables:", res.status, res.statusText);
        if (kind === "source") {
          setSourceTables([]);
        } else {
          setDestTables([]);
        }
        return;
      }

      const data = await res.json();
      const tables = (data.tables ?? []) as TableInfo[];

      if (kind === "source") {
        setSourceTables(tables);
        updateField("source_table", "");
      } else {
        setDestTables(tables);
        updateField("dest_table", "");
      }
    } catch (err) {
      console.error("Error fetching tables:", err);
      if (kind === "source") {
        setSourceTables([]);
      } else {
        setDestTables([]);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (
      !form.name ||
      !form.source_connection_id ||
      !form.source_schema ||
      !form.source_table ||
      !form.dest_connection_id ||
      !form.dest_table
    ) {
      setError("Please fill in all required fields.");
      setSubmitting(false);
      return;
    }

    const srcTableIdentifier = `${form.source_schema}.${form.source_table}`;

    const body = {
      name: form.name,
      description: form.description || null,
      source_connection_id: form.source_connection_id,
      source_table: srcTableIdentifier,
      dest_connection_id: form.dest_connection_id,
      dest_schema: form.dest_schema || null,
      dest_table: form.dest_table,
      write_mode: "truncate_insert" as const,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/syncs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          (data && (data.detail as string | undefined)) ||
          `${res.status} ${res.statusText}`;
        setError(`Failed to create sync: ${detail}`);
      } else {
        setSuccess("Sync created successfully.");
        // Clear only name/description to make iterative creation easier
        setForm((prev) => ({
          ...prev,
          name: "",
          description: "",
        }));
        // Refresh server-rendered list
        router.refresh();
      }
    } catch (err: any) {
      setError(`Unexpected error: ${String(err?.message ?? err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 text-xs text-slate-200"
    >
      {/* Basic info */}
      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
          Sync name
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
          placeholder="sync_users_bronze_to_silver"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
          rows={2}
          placeholder="Optional: describe what this sync does."
        />
      </div>

      {/* Source selection */}
      <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Source
        </p>

        {loadingConnections ? (
          <p className="text-[11px] text-slate-500">Loading connections…</p>
        ) : connections.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No connections available. Create one first.
          </p>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                Connection
              </label>
              <select
                value={form.source_connection_id ?? ""}
                onChange={async (e) => {
                  const id = e.target.value
                    ? Number(e.target.value)
                    : (null as number | null);
                  updateField("source_connection_id", id);
                  await loadSchemas(id, "source");
                }}
                className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
              >
                <option value="">Select source connection</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.db_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Schema
                </label>
                <select
                  value={form.source_schema}
                  onChange={async (e) => {
                    const schema = e.target.value;
                    updateField("source_schema", schema);
                    await loadTables(form.source_connection_id, schema, "source");
                  }}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                  disabled={!form.source_connection_id}
                >
                  <option value="">Select schema</option>
                  {sourceSchemas.map((schema) => (
                    <option key={schema} value={schema}>
                      {schema}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Table
                </label>
                <select
                  value={form.source_table}
                  onChange={(e) => updateField("source_table", e.target.value)}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                  disabled={!form.source_schema}
                >
                  <option value="">Select table</option>
                  {sourceTables.map((t) => (
                    <option key={t.table} value={t.table}>
                      {t.table}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Destination selection */}
      <div className="mt-2 rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Destination
        </p>

        {loadingConnections ? (
          <p className="text-[11px] text-slate-500">Loading connections…</p>
        ) : connections.length === 0 ? (
          <p className="text-[11px] text-slate-500">
            No connections available. Create one first.
          </p>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                Connection
              </label>
              <select
                value={form.dest_connection_id ?? ""}
                onChange={async (e) => {
                  const id = e.target.value
                    ? Number(e.target.value)
                    : (null as number | null);
                  updateField("dest_connection_id", id);
                  await loadSchemas(id, "dest");
                }}
                className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
              >
                <option value="">Select destination connection</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name} ({conn.db_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Schema
                </label>
                <select
                  value={form.dest_schema}
                  onChange={async (e) => {
                    const schema = e.target.value;
                    updateField("dest_schema", schema);
                    await loadTables(form.dest_connection_id, schema, "dest");
                  }}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                  disabled={!form.dest_connection_id}
                >
                  <option value="">Select schema</option>
                  {destSchemas.map((schema) => (
                    <option key={schema} value={schema}>
                      {schema}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                    Table (existing or new)
                </label>
                <input
                    type="text"
                    value={form.dest_table}
                    onChange={(e) => updateField("dest_table", e.target.value)}
                    className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
                    disabled={!form.dest_schema}
                    placeholder="existing_table or new_table_name"
                />
                {form.dest_schema && destTables.length > 0 && (
                    <p className="mt-1 text-[10px] text-slate-500">
                    Existing tables in <span className="font-mono">{form.dest_schema}</span>:{" "}
                    {destTables.map((t) => t.table).join(", ")}
                    </p>
                )}
                </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting ? "Creating sync..." : "Create sync"}
        </button>
      </div>

      {error && <p className="text-[11px] text-rose-400">{error}</p>}
      {success && <p className="text-[11px] text-emerald-400">{success}</p>}
    </form>
  );
}
