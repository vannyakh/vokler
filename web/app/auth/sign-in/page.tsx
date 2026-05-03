"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";

function SignInForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/home";

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.invalidCredentials);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      {error && (
        <p
          className="rounded-(--vok-radius) border px-4 py-2.5 text-sm"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, var(--vok-surface2))",
            borderColor: "color-mix(in srgb, #ef4444 30%, transparent)",
            color: "#ef4444",
          }}
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="text-[13px] font-medium"
          style={{ color: "var(--vok-text)" }}
        >
          {t.email}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] placeholder:text-(--vok-muted2) disabled:opacity-50"
          style={{
            background: "var(--vok-surface2)",
            border: "1px solid var(--vok-border2)",
            color: "var(--vok-text)",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--vok-accent)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--vok-border2)"; }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="text-[13px] font-medium"
          style={{ color: "var(--vok-text)" }}
        >
          {t.password}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] placeholder:text-(--vok-muted2) disabled:opacity-50"
          style={{
            background: "var(--vok-surface2)",
            border: "1px solid var(--vok-border2)",
            color: "var(--vok-text)",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--vok-accent)"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--vok-border2)"; }}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="mt-1 rounded-(--vok-radius) py-3 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
      >
        {isLoading ? t.signingIn : t.signIn}
      </button>

      <p className="text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
        {t.noAccount}{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium hover:underline"
          style={{ color: "var(--vok-accent)" }}
        >
          {t.signUp}
        </Link>
      </p>
    </form>
  );
}

export default function SignInPage() {
  const t = useT();

  return (
    <>
      <h1 className="mb-8 text-center font-sans text-2xl font-semibold tracking-tight">
        {t.signIn}
      </h1>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </>
  );
}
