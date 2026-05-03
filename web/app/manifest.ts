import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vokler — Social video download",
    short_name: "Vokler",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#6c63ff",
    icons: [
      {
        src: "/vokler-logo.png",
        sizes: "609x609",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-vokler.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
