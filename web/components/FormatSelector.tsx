"use client";

import { FORMAT_OPTIONS, type FormatValue } from "@/lib/api";

type Props = {
  value: FormatValue;
  onChange: (v: FormatValue) => void;
  disabled?: boolean;
};

export function FormatSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="format" className="text-sm font-medium text-zinc-400">
        Format
      </label>
      <select
        id="format"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as FormatValue)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-sky-500 disabled:opacity-50"
      >
        {FORMAT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
