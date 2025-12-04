"use client";

import { useEffect, useState, FormEvent } from "react";

type Connection = {
  id: number | string;
  name?: string;
  db_type?: string;
  host?: string;
  port?: number | string;
  database?: string;
  username?: string;

  // Legacy roles if they ever existed
  roles?: string[] | string | null;

  // Current flags from backend
  is_source?: boolean;
  is_destination?: boolean;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ModalMode = "create" | "edit";

type FormState = {
  name: string;
  dbType: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  role: "source" | "destination";
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingName, setEditingName] = useState<string | null>(null); // use name, not id
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    dbType: "postgres",
    host: "",
    port: "5432",
    database: "",
    username: "",
    password: "",
    role: "source",
  });

  // Connection test state (edit mode only)
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"success" | "error" | null>(
    null,
  );
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/connections`);
      if (!res.ok) {
        throw new Error(`Failed to load connections (status ${res.status})`);
      }

      const data = await res.json();
      const list: Connection[] = Array.isArray(data)
        ? data
        : data.connections ?? [];

      setConnections(list);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const renderRole = (conn: Connection) => {
    if (conn.is_source && !conn.is_destination) return "source";
    if (conn.is_destination && !conn.is_source) return "destination";

    // Legacy / fallback
    const raw = conn.roles;
    if (!raw) return "—";
    if (Array.isArray(raw)) return raw.join(", ");
    return raw;
  };

  const resetForm = () => {
    setForm({
      name: "",
      dbType: "postgres",
      host: "",
      port: "5432",
      database: "",
      username: "",
      password: "",
      role: "source",
    });
    setModalError(null);
    setEditingName(null);
    setTestStatus(null);
    setTestMessage(null);
    setIsTesting(false);
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setIsModalOpen(true);
  };

  const openEditModal = (conn: Connection) => {
    let role: "source" | "destination" = "source";

    if (conn.is_destination && !conn.is_source) {
      role = "destination";
    } else if (conn.is_source && !conn.is_destination) {
      role = "source";
    } else if (!conn.is_source && !conn.is_destination && conn.roles) {
      const rolesArray = Array.isArray(conn.roles)
        ? conn.roles.map((r) => r.toLowerCase())
        : conn.roles
            .split(",")
            .map((r) => r.trim().toLowerCase())
            .filter(Boolean);

      if (rolesArray.includes("destination")) role = "destination";
      else if (rolesArray.includes("source")) role = "source";
    }

    setForm({
      name: conn.name ?? "",
      dbType: conn.db_type ?? "postgres",
      host: conn.host ?? "",
      port: conn.port?.toString() ?? "5432",
      database: conn.database ?? "",
      username: conn.username ?? "",
      password: "", // don’t prefill
      role,
    });
    setModalError(null);
    setEditingName(conn.name ?? null);
    setModalMode("edit");
    setTestStatus(null);
    setTestMessage(null);
    setIsTesting(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setModalError(null);

      const payload = {
        name: form.name,
        db_type: form.dbType,
        host: form.host,
        port: form.port.trim().length > 0 ? Number(form.port) : undefined,
        database: form.database,
        username: form.username,
        password: form.password.trim().length > 0 ? form.password : null,
        is_source: form.role === "source",
        is_destination: form.role === "destination",
      };

      let url = `${API_BASE_URL}/connections`;
      let method: "POST" | "PUT" = "POST";

      if (modalMode === "edit" && editingName) {
        url = `${API_BASE_URL}/connections/${encodeURIComponent(
          editingName,
        )}`;
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
          `Failed to ${modalMode === "create" ? "create" : "update"} connection (status ${res.status}): ${text}`,
        );
      }

      await fetchConnections();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(
        err.message ||
          `Failed to ${
            modalMode === "create" ? "create" : "update"
          } connection`,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingName) return;
    if (!window.confirm("Delete this connection? This cannot be undone.")) {
      return;
    }

    try {
      setSaving(true);
      setModalError(null);

      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(editingName)}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Failed to delete connection (status ${res.status}): ${text}`,
        );
      }

      await fetchConnections();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || "Failed to delete connection");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (modalMode !== "edit" || !editingName) return;

    try {
      setIsTesting(true);
      setTestStatus(null);
      setTestMessage(null);

      const res = await fetch(
        `${API_BASE_URL}/connections/${encodeURIComponent(
          editingName,
        )}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        setTestStatus("error");
        setTestMessage(
          `Connection test failed (status ${res.status}): ${text}`,
        );
        return;
      }

      const body = (await res.json().catch(() => ({}))) as {
        status?: string;
        message?: string;
        details?: string;
      };

      if (body.status === "success") {
        setTestStatus("success");
        setTestMessage(body.message ?? "Connection successful.");
      } else {
        const details = body.details ? ` Details: ${body.details}` : "";
        setTestStatus("error");
        setTestMessage(
          (body.message ?? "Connection failed.") + details,
        );
      }
    } catch (err: any) {
      console.error(err);
      setTestStatus("error");
      setTestMessage(
        err?.message || "Connection test failed due to a network error.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Connections
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-sm">
              Manage database connections that Pipecraft can use as sources and
              destinations for your syncs.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              + Add New Connection
            </button>
            <div className="text-xs text-slate-400">
              Total connections:{" "}
              <span className="font-semibold text-slate-100">
                {loading ? "…" : connections.length}
              </span>
            </div>
          </div>
        </header>

        {/* Card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm md:p-6">
          {loading && (
            <div className="py-8 text-center text-sm text-slate-300">
              Loading connections…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              <p className="font-medium">Failed to load connections.</p>
              <p className="mt-1 text-xs text-red-200">{error}</p>
            </div>
          )}

          {!loading && !error && connections.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-300">
              No connections found yet.
              <br />
              <span className="text-slate-400">
                Click{" "}
                <span className="font-semibold text-emerald-400">
                  “Add New Connection”
                </span>{" "}
                to create your first one.
              </span>
            </div>
          )}

          {!loading && !error && connections.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Host</th>
                    <th className="px-4 py-2 text-left">Database</th>
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-4 py-2 text-left">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {connections.map((conn) => (
                    <tr
                      key={conn.id}
                      className="cursor-pointer hover:bg-slate-900/80"
                      onClick={() => openEditModal(conn)}
                    >
                      <td className="py-2 pr-4 align-top text-xs text-slate-400">
                        <code className="rounded bg-slate-900/80 px-1.5 py-0.5">
                          {conn.id}
                        </code>
                      </td>
                      <td className="px-4 py-2 align-top text-sm">
                        {conn.name || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-slate-200">
                        {conn.db_type || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-slate-200">
                        {conn.host || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-slate-200">
                        {conn.database || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-slate-200">
                        {conn.username || "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-sm text-slate-200">
                        {renderRole(conn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-50">
              {modalMode === "create"
                ? "Add New Connection"
                : "Edit Connection"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {modalMode === "create"
                ? "Define a new database connection that Pipecraft can use as a source or destination."
                : "Update this connection. Changes will affect any syncs using it."}
            </p>

            {modalError && (
              <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                {modalError}
              </div>
            )}

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    Name *
                  </label>
                  <input
                    required
                    disabled={modalMode === "edit"}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400 disabled:opacity-70"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="local_postgres"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    Type (db_type)
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.dbType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dbType: e.target.value }))
                    }
                    placeholder="postgres"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    Host *
                  </label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.host}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, host: e.target.value }))
                    }
                    placeholder="localhost"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    Port *
                  </label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.port}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, port: e.target.value }))
                    }
                    placeholder="5432"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    Database *
                  </label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.database}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, database: e.target.value }))
                    }
                    placeholder="warehouse"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-200">
                    User (username) *
                  </label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="db_user"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-200">
                    Password
                  </label>
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-400"
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder={
                      modalMode === "edit"
                        ? "(leave blank to keep existing password)"
                        : "••••••••"
                    }
                  />
                </div>
              </div>

              {/* Role: source OR destination */}
              <div>
                <span className="block text-xs font-medium text-slate-200">
                  Role *
                </span>
                <p className="mt-1 text-[11px] text-slate-400">
                  Each connection can only be used as either a source or a
                  destination.
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                      checked={form.role === "source"}
                      onChange={() =>
                        setForm((f) => ({ ...f, role: "source" }))
                      }
                    />
                    <span className="text-slate-200">Source</span>
                  </label>

                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="role"
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                      checked={form.role === "destination"}
                      onChange={() =>
                        setForm((f) => ({ ...f, role: "destination" }))
                      }
                    />
                    <span className="text-slate-200">Destination</span>
                  </label>
                </div>
              </div>

              {testMessage && modalMode === "edit" && (
                <p
                  className={`mt-2 text-xs ${
                    testStatus === "success"
                      ? "text-emerald-300"
                      : "text-red-300"
                  }`}
                >
                  {testMessage}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 pt-2">
                {modalMode === "edit" && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Delete connection
                  </button>
                )}

                <div className="ml-auto flex gap-3">
                  {modalMode === "edit" && (
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={saving || isTesting}
                      className="rounded-lg border border-emerald-500/60 bg-slate-950 px-4 py-2 text-sm text-emerald-300 hover:bg-slate-900 disabled:opacity-60"
                    >
                      {isTesting ? "Testing…" : "Test connection"}
                    </button>
                  )}

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
                        ? "Create Connection"
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
