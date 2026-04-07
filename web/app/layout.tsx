import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Syne } from "next/font/google";

import "./globals.css";
import { PageBackground } from "@/components/PageBackground";
import { ToastProvider } from "@/components/ui/toast/Toast";

/** Syne — UI / headings (Google Fonts: 400–700). */
const fontSans = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** JetBrains Mono — monospace (Google Fonts: 400, 500). */
const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/** DM Sans — download / format panel (readable at small sizes). */
const fontPanel = DM_Sans({
  variable: "--font-vok-panel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vokler — Download videos from YouTube, TikTok, and more",
  description:
    "Free web-based video downloader. Paste a URL, pick MP4 or audio quality, and save from YouTube, TikTok, Instagram, and more. Playlists and batch ZIP supported.",
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
      className={`${fontSans.variable} ${fontMono.variable} ${fontPanel.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden font-sans">
        <PageBackground />
        <div className="relative z-1">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </body>
    </html>
  );
}
