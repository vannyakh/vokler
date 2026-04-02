import Link from "next/link";

import { HistoryTable } from "@/components/HistoryTable";

export default function HistoryPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            History
          </h1>
          <p className="mt-2 text-zinc-600">
            Completed public downloads (anonymous). Authenticated clients only see
            their own history.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
        >
          ← Download
        </Link>
      </div>
      <HistoryTable />
    </div>
  );
}
