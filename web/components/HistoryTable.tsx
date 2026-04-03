"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch, type HistoryEntryDto } from "@/lib/api";

export function HistoryTable() {
  const [rows, setRows] = useState<HistoryEntryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<{ items: HistoryEntryDto[] }>("/history");
      setRows(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    try {
      await apiFetch(`/history/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <p className="py-12 text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
        Loading history…
      </p>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-[var(--vok-radius)] border p-4"
        style={{
          borderColor: "rgba(255,107,107,0.3)",
          background: "rgba(255,107,107,0.06)",
          color: "var(--vok-red)",
        }}
      >
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 block text-sm font-medium underline hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
        No history yet. Complete a download to see entries here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-2 rounded-[var(--vok-radius)] border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--vok-surface2)",
            borderColor: "var(--vok-border)",
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium">{row.title}</div>
            <div
              className="mt-1 truncate font-mono text-[11px]"
              style={{ color: "var(--vok-muted)" }}
              title={row.source_url}
            >
              {row.source_url}
            </div>
            <div
              className="mt-1 truncate font-mono text-[11px]"
              style={{ color: "var(--vok-muted2)" }}
              title={row.artifact_uri}
            >
              {row.artifact_uri}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void remove(row.id)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
            style={{
              borderColor: "rgba(255,107,107,0.25)",
              color: "var(--vok-red)",
              background: "rgba(255,107,107,0.08)",
            }}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
