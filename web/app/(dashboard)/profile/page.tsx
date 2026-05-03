"use client";

import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n";

function UserAvatar({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? "?";
  return (
    <div
      className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
      style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const user = session?.user;
  const fastapiLogout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await authClient.signOut();
    await fastapiLogout();
    router.replace("/");
  }

  const joined = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-[420px] px-5 pb-16 pt-4">
      <h1 className="mb-8 text-center font-sans text-2xl font-semibold tracking-tight">
        {t.profileTitle}
      </h1>

      {user ? (
        <>
          <div
            className="mb-4 rounded-(--vok-radius) border p-6"
            style={{ background: "var(--vok-surface2)", borderColor: "var(--vok-border)" }}
          >
            <UserAvatar email={user.email} />

            <div className="flex flex-col gap-4">
              <div className="border-b pb-4" style={{ borderColor: "var(--vok-border)" }}>
                <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--vok-muted)" }}>
                  {t.email}
                </p>
                <p className="break-all text-[14px] font-medium" style={{ color: "var(--vok-text)" }}>
                  {user.email}
                </p>
              </div>

              {joined && (
                <div>
                  <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--vok-muted)" }}>
                    {t.memberSince}
                  </p>
                  <p className="text-[14px]" style={{ color: "var(--vok-text)" }}>
                    {joined}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full rounded-(--vok-radius) py-3 text-[14px] font-medium transition hover:opacity-80"
            style={{
              background: "var(--vok-surface2)",
              border: "1px solid var(--vok-border)",
              color: "var(--vok-text)",
            }}
          >
            {t.signOut}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 pt-8">
          <div className="h-16 w-16 rounded-full" style={{ background: "var(--vok-surface2)" }} />
          <p className="text-[13px]" style={{ color: "var(--vok-muted)" }}>
            {isPending ? t.signingIn : t.signIn}
          </p>
        </div>
      )}
    </div>
  );
}
