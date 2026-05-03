import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import "./globals.css";
import { ToastProvider } from "@/components/ui/toast/Toast";

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Crafty+Girls&family=Kantumruy+Pro:ital,wght@0,100..700;1,100..700&family=Monsieur+La+Doulaise&family=Preahvihear&family=Sedgwick+Ave+Display&family=Zen+Kaku+Gothic+New&display=swap";

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
        <ToastProvider>
        {/* <Script id="vokler-theme-init" strategy="beforeInteractive"> */}
          {children}
        {/* </Script> */}
          </ToastProvider>
      </body>
    </html>
  );
}
