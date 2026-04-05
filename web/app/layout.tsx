import type { Metadata } from "next";
import { JetBrains_Mono, Syne } from "next/font/google";
import Script from "next/script";

import { THEME_STORAGE_KEY } from "@/lib/theme";

import "./globals.css";

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

export const metadata: Metadata = {
  title: "Vokler",
  description: "Social video downloader",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInit = `(function(){try{var k='${THEME_STORAGE_KEY}',t=localStorage.getItem(k);if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})()`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="min-h-full overflow-x-hidden font-sans">
        <Script id="vokler-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        {children}
      </body>
    </html>
  );
}
