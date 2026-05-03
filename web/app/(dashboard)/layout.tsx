"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { AppHeader } from "@/components/AppHeader";
import { ToastProvider } from "@/components/ui/toast/Toast";
import { useSession } from "next-auth/react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/auth/sign-in");
  }, [status, session?.user, router]);

  return (
    <ToastProvider>
      <AppHeader />
      <main>{children}</main>
    </ToastProvider>
  );
}
