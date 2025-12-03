"use client";

import { useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type SyncRunResponse = {
  id: number;
  sync_id: number;
  status: "pending" | "running" | "success" | "failed";
  started_at: string;
  ended_at: string | null;
  row_count: number | null;
  error_message: string | null;
};

export default function RunSyncButton({ syncId }: { syncId: number }) {
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<SyncRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/syncs/${syncId}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail =
          (data && (data.detail as string | undefined)) ||
          `${res.status} ${res.statusText}`;
        setError(`Failed to run sync: ${detail}`);
        setLastRun(null);
      } else {
        const data = (await res.json()) as SyncRunResponse;
        setLastRun(data);
      }
    } catch (err: any) {
      setError(`Unexpected error: ${String(err?.message ?? err)}`);
      setLastRun(null);
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: SyncRunResponse["status"]) {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide";
    switch (status) {
      case "success":
        return (
          <span className={`${base} border border-emerald-500/40 text-emerald-300`}>
            success
          </span>
        );
      case "failed":
        return (
          <span className={`${base} border border-rose-500/40 text-rose-300`}>
            failed
          </span>
        );
      case "running":
        return (
          <span className={`${base} border border-sky-500/40 text-sky-300`}>
            running
          </span>
        );
      case "pending":
      default:
        return (
          <span className={`${base} border border-slate-600 text-slate-300`}>
            pending
          </span>
        );
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleRun}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Running…" : "Run sync"}
      </button>

      {error && (
        <p className="max-w-xs text-[10px] text-rose-400 text-right">{error}</p>
      )}

      {lastRun && (
        <div className="max-w-xs text-right">
          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
            {statusBadge(lastRun.status)}
            {lastRun.row_count !== null && (
              <span className="text-slate-300">
                rows: <span className="font-mono">{lastRun.row_count}</span>
              </span>
            )}
          </div>
          {lastRun.error_message && (
            <p className="mt-1 text-[10px] text-rose-400">
              {lastRun.error_message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
