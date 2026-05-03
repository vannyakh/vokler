import { AppHeader } from "@/components/AppHeader";
import { ToastProvider } from "@/components/ui/toast/Toast";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppHeader />
      <main>{children}</main>
    </ToastProvider>
  );
}
