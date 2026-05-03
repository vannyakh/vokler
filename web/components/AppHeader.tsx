"use client";

import Image from "next/image";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useT } from "@/lib/i18n";

export function AppHeader() {
  const t = useT();

  return (
    <header
      className="mx-auto mb-12 flex max-w-[780px] items-center justify-between px-5 pt-10"
      role="banner"
    >
      <div className="flex items-center gap-2.5">
        <Image
          src="/logo-vokler.svg"
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain"
          aria-hidden
          priority
        />
        <div>
          <div className="font-sans text-[15px] font-bold tracking-tight">Vokler</div>
          <div className="mt-px text-[11px]" style={{ color: "var(--vok-muted)" }}>
            {t.appTagline}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
