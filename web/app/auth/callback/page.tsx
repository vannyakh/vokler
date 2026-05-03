"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { safeNextPath } from "@/lib/oauth-callback-url";
import { type AuthState, useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";

function OAuthCallbackInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useAuthStore((s: AuthState) => s.bootstrapApiSessionFromOAuth);

  const [error, setError] = useState<string | null>(null);
  const oauthError = searchParams.get("error")?.trim();
  const next = safeNextPath(searchParams.get("next"));

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await bootstrap();
        if (!cancelled) {
          router.replace(next);
          router.refresh();
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : t.authError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, next, oauthError, router]);

  if (oauthError || error) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p
          className="rounded-(--vok-radius) border px-4 py-2.5 text-sm"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, var(--vok-surface2))",
            borderColor: "color-mix(in srgb, #ef4444 30%, transparent)",
            color: "#ef4444",
          }}
        >
          {error ?? oauthError}
        </p>
        <Link
          href="/auth/sign-in"
          className="rounded-(--vok-radius) py-3 text-[14px] font-semibold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
        >
          {t.signIn}
        </Link>
      </div>
    );
  }

  return (
    <p className="text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
      {t.signingIn}
    </p>
  );
}

export default function OAuthCallbackPage() {
  const t = useT();

  return (
    <>
      <h1 className="mb-8 text-center font-sans text-2xl font-semibold tracking-tight">
        {t.signIn}
      </h1>
      <Suspense
        fallback={
          <p className="text-center text-[13px]" style={{ color: "var(--vok-muted)" }}>
            {t.signingIn}
          </p>
        }
      >
        <OAuthCallbackInner />
      </Suspense>
    </>
  );
}
