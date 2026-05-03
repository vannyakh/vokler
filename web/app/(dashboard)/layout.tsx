"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { authClient } from "@/lib/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) router.replace("/auth/sign-in");
  }, [isPending, session?.user, router]);

  return (
    <ToastProvider>
      <AppHeader />
      <main>{children}</main>
    </ToastProvider>
  );
}
