"use client";

import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <header
      className="mx-auto mb-12 flex max-w-[780px] items-center justify-between px-5 pt-10"
      role="banner"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[10px]"
          style={{
            background: "linear-gradient(135deg, var(--vok-accent), var(--vok-accent2))",
          }}
        >
          <svg viewBox="0 0 28 28" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
            <path d="M12 2L12 17M7 12l5 5 5-5M3 23h22" />
          </svg>
        </div>
        <div>
          <div className="font-sans text-[15px] font-bold tracking-tight">Vokler</div>
          <div className="mt-px text-[11px]" style={{ color: "var(--vok-muted)" }}>
            social video downloader
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
