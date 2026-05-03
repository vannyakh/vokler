"use client";

import { useEffect, useState } from "react";

import { type Locale, useI18nStore } from "@/lib/i18n";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "km", label: "ខ្មែរ" },
];

export function LanguageSwitcher() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="flex items-center rounded-[10px] border p-0.5"
      style={{
        background: "var(--vok-surface2)",
        borderColor: "var(--vok-border)",
      }}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map(({ value, label }) => {
        const active = mounted && locale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLocale(value)}
            disabled={!mounted}
            aria-pressed={active}
            className="rounded-[8px] px-2.5 py-1 text-[12px] font-semibold transition-all"
            style={{
              background: active ? "var(--vok-accent)" : "transparent",
              color: active ? "#fff" : "var(--vok-muted)",
              cursor: mounted ? "pointer" : "default",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
