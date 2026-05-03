import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import { AppHeader } from "@/components/AppHeader";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast/Toast";

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap";

/** JetBrains Mono — monospace (Google Fonts: 400, 500). */
const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vokler",
  description: "Social video downloader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_CSS} rel="stylesheet" />
      </head>
      <body className="min-h-full overflow-x-hidden font-sans">
        <ThemeProvider>
          <ToastProvider>
            <AppHeader />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
