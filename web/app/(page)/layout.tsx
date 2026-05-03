import { AppHeader } from "@/components/AppHeader";
import { SeoJsonLd } from "@/components/SeoJsonLd";
import { ToastProvider } from "@/components/ui/toast/Toast";

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SeoJsonLd />
      <AppHeader />
      <main>{children}</main>
    </ToastProvider>
  );
}
