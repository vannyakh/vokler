"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { en, type Messages } from "./messages/en";
import { km } from "./messages/km";

export type Locale = "en" | "km";

export type { Messages };

// ---------------------------------------------------------------------------
// Locale store (persisted to localStorage)
// ---------------------------------------------------------------------------

type I18nStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "vokler-locale" },
  ),
);

// ---------------------------------------------------------------------------
// Translation hook
// ---------------------------------------------------------------------------

const messages: Record<Locale, Messages> = { en, km };

/** Returns the full translation object for the active locale. */
export function useT(): Messages {
  const locale = useI18nStore((s) => s.locale);
  return messages[locale];
}

// ---------------------------------------------------------------------------
// LocaleSync — client component that keeps <html lang> in sync
// ---------------------------------------------------------------------------

/**
 * Renders nothing; syncs `document.documentElement.lang` whenever the locale
 * changes so CSS `:lang()` selectors and screen readers get the right value.
 * Mount inside `<body>` (the html element already has suppressHydrationWarning).
 */
export function LocaleSync() {
  const locale = useI18nStore((s) => s.locale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
