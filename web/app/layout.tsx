import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Kantumruy_Pro } from "next/font/google";

import { SeoJsonLd } from "@/components/SeoJsonLd";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LocaleSync } from "@/lib/i18n";
import { DOWNLOAD_KEYWORDS, SITE_DESCRIPTION } from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";
import "./globals.css";

const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap";

const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const fontKhmer = Kantumruy_Pro({
  variable: "--font-kantumruy-pro",
  subsets: ["khmer"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Vokler | Free social video download",
    template: "%s | Vokler",
  },
  description: SITE_DESCRIPTION,
  keywords: [...DOWNLOAD_KEYWORDS],
  authors: [{ name: "Vokler" }],
  creator: "Vokler",
  icons: {
    icon: [
      { url: "/logo-vokler.svg", type: "image/svg+xml" },
      { url: "/vokler-logo.png", sizes: "609x609", type: "image/png" },
    ],
    apple: [{ url: "/vokler-logo.png", sizes: "609x609", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Vokler",
    title: "Vokler | Free social video download",
    description: SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/vokler-banner.png",
        width: 1536,
        height: 1024,
        alt: "Vokler — download videos from social platforms",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vokler | Free social video download",
    description: SITE_DESCRIPTION,
    images: ["/vokler-banner.png"],
  },
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontMono.variable} ${fontKhmer.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_CSS} rel="stylesheet" />
      </head>
      <body className="min-h-full overflow-x-hidden font-sans">
        <LocaleSync />
        <SeoJsonLd />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
