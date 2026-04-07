import type { MediaFormatRowDto } from "@/lib/api";

export function isAudioOnlyRow(row: MediaFormatRowDto): boolean {
  const v = row.vcodec;
  return !v || v === "none";
}

function hasAudioCodec(row: MediaFormatRowDto): boolean {
  const a = row.acodec;
  return !!a && a !== "none";
}

/** Video track without an audio stream (e.g. DASH video-only). */
export function isVideoOnlyRow(row: MediaFormatRowDto): boolean {
  if (isAudioOnlyRow(row)) return false;
  return !hasAudioCodec(row);
}

/** Single file with both video and audio. */
export function isVideoWithAudioRow(row: MediaFormatRowDto): boolean {
  if (isAudioOnlyRow(row)) return false;
  return hasAudioCodec(row);
}

export type DownloadMenuCategory = "video_audio" | "audio" | "video_only";

export type DownloadMenuEntry = {
  format_id: string;
  category: DownloadMenuCategory;
  /** Primary line, e.g. "MP4 1080p" */
  title: string;
  /** Size or bitrate hint */
  hint: string | null;
  isRecommended: boolean;
};

function bestByFilesize(rows: MediaFormatRowDto[]): MediaFormatRowDto | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0] ?? null;
}

function heightBucketKey(row: MediaFormatRowDto): string {
  const h = parseHeightPx(row);
  return h !== null ? String(snapHeightToBucket(h)) : "0";
}

function dedupeVideoPool(
  pool: MediaFormatRowDto[],
  recommended_format: string | null,
): MediaFormatRowDto[] {
  const groups = new Map<string, MediaFormatRowDto[]>();
  for (const row of pool) {
    const ext = (row.ext || "mp4").toLowerCase();
    const key = `${heightBucketKey(row)}|${ext}`;
    const g = groups.get(key);
    if (g) g.push(row);
    else groups.set(key, [row]);
  }
  const out: MediaFormatRowDto[] = [];
  for (const [, rows] of groups) {
    if (recommended_format) {
      const pref = rows.find((r) => r.format_id === recommended_format);
      if (pref) {
        out.push(pref);
        continue;
      }
    }
    const pick = bestByFilesize(rows);
    if (pick) out.push(pick);
  }
  return out;
}

function formatSizeHint(filesize: number | null | undefined): string | null {
  if (filesize == null || filesize <= 0) return null;
  if (filesize < 1024) return `${filesize} B`;
  if (filesize < 1024 * 1024) return `${(filesize / 1024).toFixed(filesize < 10_240 ? 1 : 0)} KB`;
  return `${(filesize / (1024 * 1024)).toFixed(filesize < 10_485_760 ? 1 : 1)} MB`;
}

/**
 * Builds a SaveFrom-style ordered list: video+audio, then audio-only, then video-only.
 * One entry per resolution/ext bucket where possible.
 */
export function buildDownloadMenuEntries(
  formats: MediaFormatRowDto[],
  recommended_format: string | null,
): DownloadMenuEntry[] {
  if (formats.length === 0) return [];

  const vaPool = dedupeVideoPool(
    formats.filter(isVideoWithAudioRow),
    recommended_format,
  );
  const voPool = dedupeVideoPool(
    formats.filter(isVideoOnlyRow),
    recommended_format,
  );
  let audioPool = formats.filter(isAudioOnlyRow);
  if (audioPool.length === 0) audioPool = [];

  const byExtAudio = new Map<string, MediaFormatRowDto[]>();
  for (const row of audioPool) {
    const ext = (row.ext || "audio").toLowerCase();
    const v = byExtAudio.get(ext);
    if (v) v.push(row);
    else byExtAudio.set(ext, [row]);
  }
  const audioPicks: MediaFormatRowDto[] = [];
  for (const [, rows] of byExtAudio) {
    if (recommended_format) {
      const pref = rows.find((r) => r.format_id === recommended_format);
      if (pref) {
        audioPicks.push(pref);
        continue;
      }
    }
    const pick = bestByFilesize(rows);
    if (pick) audioPicks.push(pick);
  }
  audioPicks.sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0));

  const toEntry = (row: MediaFormatRowDto, category: DownloadMenuCategory): DownloadMenuEntry => {
    const ext = (row.ext || "").toUpperCase() || "FILE";
    const h = parseHeightPx(row);
    const heightLabel = h !== null ? `${snapHeightToBucket(h)}p` : null;
    let title: string;
    if (category === "audio") {
      title = `${ext} audio`;
    } else if (heightLabel) {
      title = `${ext} ${heightLabel}`;
    } else {
      title = `${ext} ${row.resolution || "video"}`.trim();
    }
    const hintParts: string[] = [];
    const sz = formatSizeHint(row.filesize);
    if (sz) hintParts.push(sz);
    if (category === "audio" && row.tbr != null && row.tbr > 0) {
      hintParts.push(`~${Math.round(row.tbr)} kb/s`);
    }
    if (category === "video_only") hintParts.push("No audio");
    return {
      format_id: row.format_id,
      category,
      title,
      hint: hintParts.length ? hintParts.join(" · ") : null,
      isRecommended: recommended_format != null && row.format_id === recommended_format,
    };
  };

  const formatHeight = (id: string) => {
    const row = formats.find((f) => f.format_id === id);
    return row ? parseHeightPx(row) ?? 0 : 0;
  };

  const vaEntries = vaPool
    .map((r) => toEntry(r, "video_audio"))
    .sort((a, b) => formatHeight(b.format_id) - formatHeight(a.format_id));

  const audioEntries = audioPicks.map((r) => toEntry(r, "audio"));
  const voEntries = voPool
    .map((r) => toEntry(r, "video_only"))
    .sort((a, b) => formatHeight(b.format_id) - formatHeight(a.format_id));

  const combined = [...vaEntries, ...audioEntries, ...voEntries];
  if (combined.length > 0) return combined;

  return formats.slice(0, 32).map((row) => ({
    format_id: row.format_id,
    category: (isAudioOnlyRow(row) ? "audio" : isVideoOnlyRow(row) ? "video_only" : "video_audio") as DownloadMenuCategory,
    title: `${(row.ext || "file").toUpperCase()} · ${row.resolution || row.format_note || row.format_id}`,
    hint: formatSizeHint(row.filesize),
    isRecommended: recommended_format != null && row.format_id === recommended_format,
  }));
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
