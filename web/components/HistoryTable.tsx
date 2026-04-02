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
      <p className="py-12 text-center text-zinc-500" role="status">
        Loading history…
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 block text-sm font-medium underline hover:text-red-900"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-center text-zinc-500 py-12">
        No history yet. Complete a download to see entries here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm text-zinc-700">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Artifact</th>
            <th className="px-4 py-3 w-28" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium text-zinc-900">{row.title}</td>
              <td className="px-4 py-3 max-w-[220px] truncate" title={row.source_url}>
                {row.source_url}
              </td>
              <td className="px-4 py-3 max-w-[220px] truncate font-mono text-xs" title={row.artifact_uri}>
                {row.artifact_uri}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  className="text-red-700 hover:text-red-800 text-xs font-semibold"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
