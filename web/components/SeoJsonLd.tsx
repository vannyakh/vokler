import { SITE_DESCRIPTION } from "@/lib/seo";
import { getSiteUrl } from "@/lib/siteUrl";

export function SeoJsonLd() {
  const base = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name: "Vokler",
        url: base,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${base}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name: "Vokler",
        url: base,
        logo: {
          "@type": "ImageObject",
          url: `${base}/vokler-logo.png`,
          width: 609,
          height: 609,
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${base}/#webapp`,
        name: "Vokler",
        url: base,
        description: SITE_DESCRIPTION,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        isPartOf: { "@id": `${base}/#website` },
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
  );
}
