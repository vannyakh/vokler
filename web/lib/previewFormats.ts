import type { MediaFormatRowDto } from "@/lib/api";

export function isAudioOnlyRow(row: MediaFormatRowDto): boolean {
  const v = row.vcodec;
  return !v || v === "none";
}

/** Max dimension in pixels from resolution string, or null for audio-only rows. */
export function parseHeightPx(row: MediaFormatRowDto): number | null {
  const r = row.resolution || "";
  const xy = r.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (xy) {
    const a = parseInt(xy[1], 10);
    const b = parseInt(xy[2], 10);
    return Math.max(a, b);
  }
  const p = r.match(/(\d+)\s*p/i);
  if (p) return parseInt(p[1], 10);
  if (/audio|none/i.test(r)) return null;
  return null;
}

export const QUALITY_BUCKETS = [
  { height: 2160, label: "4K" },
  { height: 1440, label: "1440p" },
  { height: 1080, label: "1080p", best: true as const },
  { height: 720, label: "720p" },
  { height: 480, label: "480p" },
  { height: 360, label: "360p" },
] as const;

export function snapHeightToBucket(h: number): number {
  let best: number = QUALITY_BUCKETS[0].height;
  let bestDist = Math.abs(h - best);
  for (const b of QUALITY_BUCKETS) {
    const d = Math.abs(h - b.height);
    if (d < bestDist) {
      bestDist = d;
      best = b.height;
    }
  }
  return best;
}

function pickLargest(
  pool: MediaFormatRowDto[],
  preferredId: string | null,
): MediaFormatRowDto | null {
  if (pool.length === 0) return null;
  if (preferredId) {
    const pref = pool.find((p) => p.format_id === preferredId);
    if (pref) return pref;
  }
  return [...pool].sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0] ?? null;
}

/** Resolve yt-dlp format_id from pill selections. */
export function resolveFormatId(
  formats: MediaFormatRowDto[],
  opts: {
    mediaKind: "video" | "audio";
    targetHeight: number | null;
    ext: string | null;
    recommended_format: string | null;
  },
): string | null {
  if (formats.length === 0) return null;

  let pool =
    opts.mediaKind === "audio"
      ? formats.filter(isAudioOnlyRow)
      : formats.filter((f) => !isAudioOnlyRow(f));

  if (pool.length === 0) pool = [...formats];

  if (opts.ext) {
    const e = opts.ext.toLowerCase();
    const byExt = pool.filter((f) => (f.ext || "").toLowerCase() === e);
    if (byExt.length) pool = byExt;
  }

  if (opts.mediaKind === "audio") {
    return pickLargest(pool, opts.recommended_format)?.format_id ?? null;
  }

  if (opts.targetHeight !== null) {
    const target = opts.targetHeight;
    const withHeight = pool.filter((f) => {
      const h = parseHeightPx(f);
      return h !== null && Math.abs(h - target) <= 144;
    });
    if (withHeight.length) pool = withHeight;
    else {
      const scored = pool
        .map((f) => {
          const h = parseHeightPx(f);
          return {
            f,
            dist: h !== null ? Math.abs(h - target) : 1e9,
          };
        })
        .sort((a, b) => a.dist - b.dist);
      if (scored[0] && scored[0].dist < 1e8) pool = [scored[0].f];
    }
  }

  const chosen = pickLargest(pool, opts.recommended_format);
  return chosen?.format_id ?? formats[0]?.format_id ?? null;
}

export function uniqueExts(formats: MediaFormatRowDto[], mediaKind: "video" | "audio"): string[] {
  const pool =
    mediaKind === "audio"
      ? formats.filter(isAudioOnlyRow)
      : formats.filter((f) => !isAudioOnlyRow(f));
  const use = pool.length ? pool : formats;
  const set = new Set<string>();
  for (const f of use) {
    const e = (f.ext || "").toLowerCase();
    if (e) set.add(e);
  }
  return [...set].sort();
}

/** Which quality bucket heights have at least one matching row (after kind filter). */
export function availableBucketHeights(
  formats: MediaFormatRowDto[],
  mediaKind: "video" | "audio",
  ext: string | null,
): Set<number> {
  let pool =
    mediaKind === "audio"
      ? formats.filter(isAudioOnlyRow)
      : formats.filter((f) => !isAudioOnlyRow(f));
  if (pool.length === 0) pool = [...formats];
  if (ext) {
    const byExt = pool.filter((f) => (f.ext || "").toLowerCase() === ext.toLowerCase());
    if (byExt.length) pool = byExt;
  }
  const heights = new Set<number>();
  for (const f of pool) {
    const h = parseHeightPx(f);
    if (h !== null) heights.add(snapHeightToBucket(h));
  }
  return heights;
}
