/**
 * Long-form landing copy for SEO and future ad landing alignment.
 * Keep factual; users add analytics / ad tags in layout or a wrapper when ready.
 */
export function LandingContent() {
  return (
    <div className="mt-16 space-y-14 border-t pt-14" style={{ borderColor: "var(--vok-border)" }}>
      <section className="vok-landing-prose space-y-4" aria-labelledby="vok-about-heading">
        <h2 id="vok-about-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          Download videos easily with Vokler
        </h2>
        <p className="text-[14px] leading-relaxed sm:text-[15px]" style={{ color: "var(--vok-muted)" }}>
          Vokler is a simple web-based downloader for social and video platforms. Paste a link, choose a
          format, and save the file to your device—no desktop app required. It works in modern browsers on
          desktop and mobile, with a focused flow: fetch metadata, pick quality, download.
        </p>
        <p className="text-[14px] leading-relaxed sm:text-[15px]" style={{ color: "var(--vok-muted)" }}>
          Use it for YouTube, TikTok, Instagram, X (Twitter), Facebook, Vimeo, and many other sources
          supported by our pipeline. For batch jobs, switch to Multiple, Playlist, or Profile to build a ZIP
          when the platform allows listing multiple items.
        </p>
      </section>

      <section className="vok-landing-prose space-y-4" aria-labelledby="vok-quality-heading">
        <h2 id="vok-quality-heading" className="text-xl font-semibold tracking-tight sm:text-2xl">
          High-quality MP4 and more
        </h2>
        <p className="text-[14px] leading-relaxed sm:text-[15px]" style={{ color: "var(--vok-muted)" }}>
          After you fetch a link, Vokler shows the formats the host exposes—often including MP4 and
          separate audio tracks. Pick the resolution or bitrate that matches what you need, from compact
          files for mobile up to HD or higher when the source provides it. Video-only streams are clearly
          labeled so you know they have no sound.
        </p>
      </section>

      <section aria-labelledby="vok-steps-heading">
        <h2 id="vok-steps-heading" className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
          How to download in three steps
        </h2>
        <ol className="space-y-5">
          {[
            {
              title: "Copy the video URL",
              body: "Open the video in your browser or app and copy its link from the address bar or share menu.",
            },
            {
              title: "Paste and fetch",
              body: "Paste the URL into the field above, then tap Fetch. Wait for thumbnails and titles to load.",
            },
            {
              title: "Choose format and download",
              body: "Select MP4, audio-only, or another option from the list, then press Download. Your browser will save or open the file.",
            },
          ].map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-[var(--vok-radius)] border p-4 sm:p-5"
              style={{
                background: "var(--vok-surface2)",
                borderColor: "var(--vok-border)",
              }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold"
                style={{
                  background: "var(--vok-pill)",
                  color: "var(--vok-accent)",
                }}
                aria-hidden
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--vok-text)]">{step.title}</h3>
                <p
                  className="mt-1.5 text-[13px] leading-relaxed sm:text-[14px]"
                  style={{ color: "var(--vok-muted)" }}
                >
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="grid gap-6 sm:grid-cols-2"
        aria-labelledby="vok-platforms-heading"
      >
        <div
          className="rounded-[var(--vok-radius)] border p-5"
          style={{
            background: "var(--vok-surface2)",
            borderColor: "var(--vok-border)",
          }}
        >
          <h2 id="vok-platforms-heading" className="text-[16px] font-semibold">
            Resolutions
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--vok-muted)" }}>
            Available resolutions depend on each video. Vokler lists what the service returns so you can
            choose SD, HD, Full HD, or higher when offered—up to the source maximum, including 1440p or 4K
            where applicable.
          </p>
        </div>
        <div
          className="rounded-[var(--vok-radius)] border p-5"
          style={{
            background: "var(--vok-surface2)",
            borderColor: "var(--vok-border)",
          }}
        >
          <h2 className="text-[16px] font-semibold">Browsers</h2>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--vok-muted)" }}>
            Use Chrome, Firefox, Safari, Edge, or other Chromium-based browsers. Behavior matches normal
            downloads: allow pop-ups or multiple files if your browser asks when saving ZIP archives.
          </p>
        </div>
      </section>

      <section className="vok-landing-prose" aria-labelledby="vok-faq-heading">
        <h2 id="vok-faq-heading" className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">
          Frequently asked questions
        </h2>
        <div
          className="overflow-hidden rounded-[var(--vok-radius)] border"
          style={{ borderColor: "var(--vok-border)" }}
        >
          {[
            {
              q: "How do I download a video from a URL?",
              a: "Paste the full https link into the box, click Fetch, then choose a format and Download. You must have the rights or permission to save that content.",
            },
            {
              q: "Can I use Vokler on my phone?",
              a: "Yes. Open this site in your mobile browser, paste the link, and download like on desktop. Some browsers may ask where to store the file.",
            },
            {
              q: "What is the best video quality I can get?",
              a: "The best row in the list is usually marked for you. Final quality is limited by what the platform streams; you cannot exceed the source resolution.",
            },
            {
              q: "Is Vokler an all-in-one downloader?",
              a: "Single links, multi-link ZIPs, and playlist-style expansion (where supported) are built in. Always follow each platform's terms of use and copyright law.",
            },
          ].map((item, idx, arr) => (
            <details
              key={item.q}
              className={`group px-4 ${idx < arr.length - 1 ? "border-b" : ""}`}
              style={{ borderColor: "var(--vok-border)" }}
            >
              <summary className="cursor-pointer list-none py-3.5 text-[14px] font-medium outline-none marker:content-none focus-visible:ring-2 focus-visible:ring-[var(--vok-accent)] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span
                    className="text-[18px] font-normal leading-none transition group-open:rotate-45"
                    style={{ color: "var(--vok-muted)" }}
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="pb-3.5 pl-0.5 text-[13px] leading-relaxed" style={{ color: "var(--vok-muted)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Reserve hook for consent banners or ad containers later, e.g. id="vok-marketing-footer" */}
      <p className="text-center text-[11px] leading-relaxed" style={{ color: "var(--vok-muted2)" }}>
        Only download content you are allowed to use. Vokler does not host videos; it helps you retrieve
        files from URLs you provide.
      </p>
    </div>
  );
}
