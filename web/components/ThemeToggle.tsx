"use client";

import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isDark = resolvedTheme !== "light";

  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);
  const a11y = mounted
    ? isDark
      ? { label: "Switch to light theme", title: "Light theme" }
      : { label: "Switch to dark theme", title: "Dark theme" }
    : { label: "Toggle color theme", title: "Theme" };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition hover:opacity-90"
      style={{
        background: "var(--vok-surface2)",
        borderColor: "var(--vok-border)",
        color: "var(--vok-muted)",
      }}
      aria-label={a11y.label}
      title={a11y.title}
      disabled={!mounted}
    >
      {!mounted ? (
        <span className="h-[18px] w-[18px]" aria-hidden />
      ) : isDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
