"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { authGithubButtonEnabled, authGoogleButtonEnabled } from "@/lib/auth-ui-flags";
import { useT } from "@/lib/i18n";

async function postSendVerificationEmail(email: string): Promise<void> {
  const origin = window.location.origin;
  const res = await fetch(`${origin}/api/auth/send-verification-email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      callbackURL: `${origin}/auth/sign-in`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to send verification email");
  }
}

function oauthButtonClass() {
  return "flex w-full items-center justify-center gap-2 rounded-(--vok-radius) border py-3 text-[14px] font-medium transition hover:opacity-90 disabled:opacity-50";
}

function SignInForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/home";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setShowResend(false);
    setResendOk(false);
    setIsLoading(true);
    try {
      const { error: err } = await authClient.signIn.email({
        email,
        password,
        callbackURL: next.startsWith("/") ? `${window.location.origin}${next}` : next,
      });
      if (err) {
        const msg = err.message ?? "";
        if (/verify|verified|EMAIL_NOT_VERIFIED/i.test(msg) || err.status === 403) {
          setShowResend(true);
          setError(t.emailNotVerified);
        } else {
          setError(msg || t.invalidCredentials);
        }
        return;
      }
      router.refresh();
      router.replace(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.authError);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setResendBusy(true);
    setResendOk(false);
    setError(null);
    try {
      await postSendVerificationEmail(email);
      setResendOk(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.authError);
    } finally {
      setResendBusy(false);
    }
  }

  async function startSocial(provider: "google" | "github") {
    setError(null);
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider,
        callbackURL: next.startsWith("/") ? `${window.location.origin}${next}` : next,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.authError);
      setIsLoading(false);
    }
  }

  const showGoogle = authGoogleButtonEnabled();
  const showGithub = authGithubButtonEnabled();

  return (
    <div className="flex flex-col gap-6">
      {(showGoogle || showGithub) && (
        <div className="flex flex-col gap-2">
          {showGoogle ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void startSocial("google")}
              className={oauthButtonClass()}
              style={{
                background: "var(--vok-surface2)",
                borderColor: "var(--vok-border)",
                color: "var(--vok-text)",
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t.continueWithGoogle}
            </button>
          ) : null}
          {showGithub ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void startSocial("github")}
              className={oauthButtonClass()}
              style={{
                background: "var(--vok-surface2)",
                borderColor: "var(--vok-border)",
                color: "var(--vok-text)",
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {t.continueWithGitHub}
            </button>
          ) : null}
          <p className="text-center text-[12px] uppercase tracking-wide" style={{ color: "var(--vok-muted)" }}>
            {t.orContinueWithEmail}
          </p>
        </div>
      )}

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
        {resendOk && (
          <p
            className="rounded-(--vok-radius) border px-4 py-2.5 text-sm"
            style={{
              background: "color-mix(in srgb, #22c55e 10%, var(--vok-surface2))",
              borderColor: "color-mix(in srgb, #22c55e 30%, transparent)",
              color: "#22c55e",
            }}
          >
            {t.verificationSent}
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
            className="rounded-(--vok-radius) py-3 px-4 text-sm outline-none transition-[border-color] placeholder:text-(--vok-muted2) disabled:opacity-50"
            style={{
              background: "var(--vok-surface2)",
              border: "1px solid var(--vok-border2)",
              color: "var(--vok-text)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--vok-accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--vok-border2)";
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[13px] font-medium" style={{ color: "var(--vok-text)" }}>
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
            onFocus={(e) => {
              e.target.style.borderColor = "var(--vok-accent)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--vok-border2)";
            }}
          />
        </div>

        {showResend ? (
          <button
            type="button"
            disabled={resendBusy || !email.trim()}
            onClick={() => void handleResend()}
            className="rounded-(--vok-radius) border py-2.5 text-[13px] font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{
              background: "var(--vok-surface2)",
              borderColor: "var(--vok-border)",
              color: "var(--vok-accent)",
            }}
          >
            {resendBusy ? t.fetching : t.resendVerification}
          </button>
        ) : null}

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
          <Link href="/auth/sign-up" className="font-medium hover:underline" style={{ color: "var(--vok-accent)" }}>
            {t.signUp}
          </Link>
        </p>
      </form>
    </div>
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
