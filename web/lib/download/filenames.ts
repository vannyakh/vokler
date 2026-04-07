export function safeDownloadFilename(title: string | null | undefined): string {
  const t = (title ?? "video")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .trim()
    .slice(0, 120);
  return /\.(mp4|webm|mkv|m4a|mp3|opus|flac)$/i.test(t) ? t : `${t || "video"}.mp4`;
}

export function safeZipFilename(title: string | null | undefined): string {
  const base = safeDownloadFilename(title).replace(/\.(mp4|webm|mkv|m4a|mp3|opus|flac)$/i, "");
  return `${base || "vokler-bundle"}.zip`;
}
