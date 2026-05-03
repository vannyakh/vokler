"use client";

import Image from "next/image";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useT } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";

function AuthButton() {
  const t = useT();
  const user = useAuthStore((s) => s.user);

  if (user) {
    const initial = user.email[0]?.toUpperCase() ?? "?";
    return (
      <Link
        href="/profile"
        className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white transition hover:opacity-85"
        style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
        title={user.email}
        aria-label="Profile"
      >
        {initial}
      </Link>
    );
  }

  return (
    <Link
      href="/auth/sign-in"
      className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition hover:opacity-85"
      style={{
        background: "var(--vok-surface2)",
        border: "1px solid var(--vok-border)",
        color: "var(--vok-text)",
      }}
    >
      {t.signIn}
    </Link>
  );
}

export function AppHeader() {
  const t = useT();

  return (
    <header
      className="mx-auto mb-12 flex max-w-[780px] items-center justify-between px-5 pt-10"
      role="banner"
    >
      <Link href="/" className="flex items-center gap-2.5">
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
      </Link>
      <div className="flex items-center gap-2">
        <AuthButton />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
