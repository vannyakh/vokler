"use client";
import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en, type Messages } from "./messages/en";
import { km } from "./messages/km";

export type Locale = "en" | "km";
export type { Messages };

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
    { name: "vokler-locale" }
  )
);

const messages: Record<Locale, Messages> = { en, km };

export function useT(): Messages {
  const locale = useI18nStore((s) => s.locale);
  return messages[locale];
}

export function LocaleSync() {
  const locale = useI18nStore((s) => s.locale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
