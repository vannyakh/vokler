"use client";

import Image from "next/image";

import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
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
