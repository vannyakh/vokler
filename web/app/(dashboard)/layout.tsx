"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { useAuthStore } from "@/stores/authStore";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const tryRefreshToken = useAuthStore((s) => s.tryRefreshToken);

  useEffect(() => {
    async function guard() {
      if (user) return;
      try {
        await refreshUser();
      } catch {
        const ok = await tryRefreshToken();
        if (!ok) router.replace("/auth/sign-in");
      }
    }
    void guard();
  }, [user, router, refreshUser, tryRefreshToken]);

  return (
    <ToastProvider>
      <AppHeader />
      <main>{children}</main>
    </ToastProvider>
  );
}
