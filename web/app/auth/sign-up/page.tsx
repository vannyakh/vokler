"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";

export default function SignUpPage() {
  const t = useT();
  const router = useRouter();

  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t.passwordMismatch);
      return;
    }
    try {
      await register(email, password);
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.authError);
    }
  }

  const inputStyle = {
    background: "var(--vok-surface2)",
    border: "1px solid var(--vok-border2)",
    color: "var(--vok-text)",
  } as React.CSSProperties;

  function onFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--vok-accent)";
  }
  function onBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--vok-border2)";
  }

  return (
    <>
      <h1 className="mb-8 text-center font-sans text-2xl font-semibold tracking-tight">
        {t.signUp}
      </h1>

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
          <label htmlFor="email" className="text-[13px] font-medium" style={{ color: "var(--vok-text)" }}>
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
            className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] disabled:opacity-50"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[13px] font-medium" style={{ color: "var(--vok-text)" }}>
            {t.password}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] disabled:opacity-50"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-[13px] font-medium" style={{ color: "var(--vok-text)" }}>
            {t.confirmPassword}
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={isLoading}
            className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] disabled:opacity-50"
            style={inputStyle}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-1 rounded-(--vok-radius) py-3 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
        >
          {isLoading ? t.signingUp : t.signUp}
        </button>

        <p className="text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
          {t.haveAccount}{" "}
          <Link
            href="/auth/sign-in"
            className="font-medium hover:underline"
            style={{ color: "var(--vok-accent)" }}
          >
            {t.signIn}
          </Link>
        </p>
      </form>
    </>
  );
}
