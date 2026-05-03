"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";

export default function DashboardHomePage() {
  const t = useT();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-[780px] px-5 pb-16 pt-4">
      <div className="mb-8">
        <h1 className="mb-1 font-sans text-2xl font-semibold tracking-tight">
          {user ? `Welcome back, ${user.email.split("@")[0]}` : "Welcome back"}
        </h1>
        <p className="text-[13px]" style={{ color: "var(--vok-muted)" }}>
          {t.heroSub}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/"
          className="group flex flex-col gap-2 rounded-(--vok-radius) border p-5 transition hover:opacity-90"
          style={{ background: "var(--vok-surface2)", borderColor: "var(--vok-border)" }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--vok-text)" }}>
              {t.download}
            </p>
            <p className="text-[12px]" style={{ color: "var(--vok-muted)" }}>
              {t.urlPlaceholder}
            </p>
          </div>
        </Link>

        <Link
          href="/profile"
          className="group flex flex-col gap-2 rounded-(--vok-radius) border p-5 transition hover:opacity-90"
          style={{ background: "var(--vok-surface2)", borderColor: "var(--vok-border)" }}
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--vok-text)" }}>
              {t.profileTitle}
            </p>
            <p className="text-[12px]" style={{ color: "var(--vok-muted)" }}>
              {user?.email ?? "—"}
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
