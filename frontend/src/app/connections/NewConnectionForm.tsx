"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type DbType = "postgres" | "mysql";

type FormState = {
  name: string;
  db_type: DbType;
  host: string;
  port: string; // keep as string in the form, convert to number on submit
  database: string;
  username: string;
  password: string;
  is_source: boolean;
  is_destination: boolean;
};

export default function NewConnectionForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    db_type: "postgres",
    host: "localhost",
    port: "5432",
    database: "",
    username: "",
    password: "",
    is_source: true,
    is_destination: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const body = {
      ...form,
      port: Number(form.port) || 0,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/connections`, {
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
        setError(`Failed to create connection: ${detail}`);
      } else {
        setSuccess("Connection created successfully.");
        // Clear form name only so you can quickly add similar ones
        setForm((prev) => ({
          ...prev,
          name: "",
        }));
        // Refresh server-side data on this route so the table updates
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
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
            Connection name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
            placeholder="local_postgres"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              DB type
            </label>
            <select
              value={form.db_type}
              onChange={(e) =>
                updateField("db_type", e.target.value as DbType)
              }
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
            >
              <option value="postgres">Postgres</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              Port
            </label>
            <input
              type="number"
              value={form.port}
              onChange={(e) => updateField("port", e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-[2fr,1fr] gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              Host
            </label>
            <input
              type="text"
              value={form.host}
              onChange={(e) => updateField("host", e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
              placeholder="localhost"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              Database
            </label>
            <input
              type="text"
              value={form.database}
              onChange={(e) => updateField("database", e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs outline-none focus:border-emerald-500"
          />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={form.is_source}
              onChange={(e) => updateField("is_source", e.target.checked)}
              className="h-3 w-3 rounded border-slate-700 bg-slate-900"
            />
            Source
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={form.is_destination}
              onChange={(e) => updateField("is_destination", e.target.checked)}
              className="h-3 w-3 rounded border-slate-700 bg-slate-900"
            />
            Destination
          </label>
        </div>
      </div>

      <div className="pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {submitting ? "Creating..." : "Create connection"}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
      {success && (
        <p className="text-[11px] text-emerald-400">
          {success}
        </p>
      )}
    </form>
  );
}
