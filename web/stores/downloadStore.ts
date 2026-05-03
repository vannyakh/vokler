import { create } from "zustand";

import {
  apiFetch,
  downloadArchiveFileToBrowser,
  downloadJobFileToBrowser,
  type ArchiveJobDto,
  type JobDto,
  type PreviewResponseDto,
  previewMedia,
} from "@/lib/api";
import { safeDownloadFilename, safeZipFilename } from "@/lib/download/filenames";
import {
  looksLikeHttpUrl,
  normalizeYoutubeUrlForSingle,
  parseUrls,
  previewModeMismatchMessage,
} from "@/lib/download/urlHelpers";
import { DEFAULT_PRESET_FORMAT_ID } from "@/lib/previewFormats";

export type DownloadMode = "single" | "multi" | "playlist" | "profile";

export type ToastFn = (
  message: string,
  options?: { type?: "error" | "success" | "warning"; duration?: number },
) => void;

const POLL_MS = 2000;
/** If job stays ``pending`` this long, assume no worker is draining the queue. */
const MAX_PENDING_POLLS = 90;

export const AUTO_FETCH_DEBOUNCE_MS = 480;

let fetchGeneration = 0;
let autoFetchTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelAutoFetchDebounce(): void {
  if (autoFetchTimer) {
    clearTimeout(autoFetchTimer);
    autoFetchTimer = null;
  }
}

export function scheduleAutoFetchDebounce(
  primary: string,
  run: (p: string) => void,
  delayMs: number = AUTO_FETCH_DEBOUNCE_MS,
): void {
  cancelAutoFetchDebounce();
  autoFetchTimer = setTimeout(() => {
    autoFetchTimer = null;
    run(primary);
  }, delayMs);
}

type DownloadState = {
  mode: DownloadMode;
  url: string;
  sourceUrl: string | null;
  preview: PreviewResponseDto | null;
  selectedFormatId: string;
  loadingInfo: boolean;
  autoPreviewBlockedKey: string | null;
  archiveJob: ArchiveJobDto | null;
  singleJob: JobDto | null;
  activeJobId: string | null;
  downloading: boolean;
};

type DownloadActions = {
  setMode: (mode: DownloadMode) => void;
  setUrl: (url: string) => void;
  onUrlInputChange: (url: string) => void;
  setSelectedFormatId: (id: string) => void;
  clearArchiveJob: () => void;
  clearPreviewSession: () => void;
  resetJobsOnly: () => void;

  patchSingleJobIfMatch: (jobId: string, patch: Partial<JobDto>) => void;
  setSingleJob: (job: JobDto | null) => void;
  setArchiveJob: (job: ArchiveJobDto | null) => void;
  setActiveJobId: (id: string | null) => void;
  setDownloading: (v: boolean) => void;

  fetchInfoManual: (addToast: ToastFn) => void;
  runFetchPreview: (primary: string, addToast: ToastFn) => Promise<void>;
  runDownload: (addToast: ToastFn) => Promise<void>;
  pasteFromClipboard: (text: string) => void;
};

export type DownloadStore = DownloadState & DownloadActions;

const initialJobs = {
  archiveJob: null as ArchiveJobDto | null,
  singleJob: null as JobDto | null,
  activeJobId: null as string | null,
};

export function autoPreviewAttemptKey(mode: DownloadMode, primary: string): string {
  return `${mode}:${primary.trim()}`;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  mode: "single",
  url: "",
  sourceUrl: null,
  preview: null,
  selectedFormatId: "",
  loadingInfo: false,
  autoPreviewBlockedKey: null,
  ...initialJobs,
  downloading: false,

  setMode: (mode) =>
    set({
      mode,
      preview: null,
      sourceUrl: null,
      selectedFormatId: "",
      autoPreviewBlockedKey: null,
      ...initialJobs,
    }),

  setUrl: (url) => set({ url }),

  onUrlInputChange: (url) => {
    const mode = get().mode;
    const next = mode === "multi" ? url : normalizeYoutubeUrlForSingle(url);
    set({
      url: next,
      preview: null,
      sourceUrl: null,
      autoPreviewBlockedKey: null,
      ...initialJobs,
    });
  },

  setSelectedFormatId: (selectedFormatId) => set({ selectedFormatId }),

  clearArchiveJob: () => set({ archiveJob: null }),

  clearPreviewSession: () =>
    set({
      preview: null,
      sourceUrl: null,
      selectedFormatId: "",
      autoPreviewBlockedKey: null,
      singleJob: null,
      archiveJob: null,
    }),

  resetJobsOnly: () => set({ ...initialJobs }),

  patchSingleJobIfMatch: (jobId, patch) =>
    set((s) => ({
      singleJob:
        s.singleJob?.id === jobId ? ({ ...s.singleJob, ...patch } as JobDto) : s.singleJob,
    })),

  setSingleJob: (singleJob) => set({ singleJob }),
  setArchiveJob: (archiveJob) => set({ archiveJob }),
  setActiveJobId: (activeJobId) => set({ activeJobId }),
  setDownloading: (downloading) => set({ downloading }),

  fetchInfoManual: (addToast) => {
    cancelAutoFetchDebounce();
    const { mode, url } = get();
    const primaryRaw = mode === "multi" ? parseUrls(url)[0] : url.trim();
    const primary =
      mode === "multi" ? (primaryRaw ?? "").trim() : normalizeYoutubeUrlForSingle(primaryRaw);
    if (primaryRaw && mode !== "multi" && primary !== primaryRaw) {
      set({ url: primary });
    }
    if (!primary) return;
    if (mode !== "multi" && !looksLikeHttpUrl(primary)) {
      addToast("Enter a valid http(s) link", { type: "warning" });
      return;
    }
    const mismatch = previewModeMismatchMessage(mode, primary);
    if (mismatch) {
      addToast(mismatch, { type: "warning", duration: 6000 });
      return;
    }
    void get().runFetchPreview(primary, addToast);
  },

  runFetchPreview: async (primaryIn, addToast) => {
    if (get().downloading) return;
    const mode = get().mode;
    const primary =
      mode === "multi" ? primaryIn.trim() : normalizeYoutubeUrlForSingle(primaryIn.trim());
    if (primary !== primaryIn.trim() && mode !== "multi") {
      set({ url: primary });
    }
    const mismatch = previewModeMismatchMessage(mode, primary);
    if (mismatch) {
      addToast(mismatch, { type: "warning", duration: 6000 });
      set({ autoPreviewBlockedKey: autoPreviewAttemptKey(mode, primary) });
      return;
    }
    const gen = ++fetchGeneration;
    set({
      preview: null,
      sourceUrl: null,
      archiveJob: null,
      singleJob: null,
      activeJobId: null,
      loadingInfo: true,
    });
    try {
      const data = await previewMedia(
        primary,
        mode === "playlist" ? "playlist" : mode === "profile" ? "profile" : undefined,
      );
      if (gen !== fetchGeneration) return;
      const updates: Partial<DownloadState> = {
        preview: data,
        autoPreviewBlockedKey: null,
      };
      if (mode !== "multi") {
        const canonical =
          mode === "playlist" || mode === "profile"
            ? primary.trim()
            : (data.webpage_url && data.webpage_url.trim()) || primary.trim();
        updates.sourceUrl = canonical;
        updates.url = "";
      }
      // Prefer merged download (preset) unless API recommends a muxed row that exists in the table.
      const rec = data.recommended_format?.trim();
      const recInTable = Boolean(rec && data.formats.some((f) => f.format_id === rec));
      const def =
        data.formats.length === 0
          ? DEFAULT_PRESET_FORMAT_ID
          : recInTable
            ? rec!
            : DEFAULT_PRESET_FORMAT_ID;
      updates.selectedFormatId = def;
      set(updates);
    } catch (e) {
      if (gen !== fetchGeneration) return;
      addToast(e instanceof Error ? e.message : "Could not load video info", { type: "error" });
      set({ autoPreviewBlockedKey: autoPreviewAttemptKey(mode, primary) });
    } finally {
      if (gen === fetchGeneration) {
        set({ loadingInfo: false });
      }
    }
  },

  runDownload: async (addToast) => {
    const st = get();
    const { mode, url, sourceUrl, preview } = st;
    const selectedFormatId =
      st.selectedFormatId ||
      (!preview?.formats?.length ? DEFAULT_PRESET_FORMAT_ID : "");
    if (!selectedFormatId) return;

    const batch = mode === "multi" || mode === "playlist" || mode === "profile";

    if (!batch) {
      const one = (sourceUrl ?? url).trim();
      if (!one) return;
      st.setDownloading(true);
      st.setSingleJob(null);
      try {
        const created = await apiFetch<JobDto>("/download", {
          method: "POST",
          body: JSON.stringify({ url: one, format: selectedFormatId }),
        });
        st.setSingleJob(created);
        st.setActiveJobId(created.id);
        let last = created;
        let pendingOnlyPolls = 0;
        while (!["completed", "failed"].includes(last.status)) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          last = await apiFetch<JobDto>(`/jobs/${created.id}`);
          st.setSingleJob(last);
          if (last.status === "pending") {
            pendingOnlyPolls += 1;
            if (pendingOnlyPolls >= MAX_PENDING_POLLS) {
              addToast(
                "Download stayed queued too long. The API background worker (ARQ) may not be running, or Redis is misconfigured.",
                { type: "error", duration: 12000 },
              );
              st.setSingleJob(null);
              return;
            }
          } else {
            pendingOnlyPolls = 0;
          }
        }
        if (last.status === "failed") {
          addToast(last.error_message ?? "Download failed", { type: "error", duration: 6000 });
          st.setSingleJob(null);
          return;
        }
        last = await apiFetch<JobDto>(`/jobs/${created.id}`);
        st.setSingleJob(last);
        await downloadJobFileToBrowser(last, safeDownloadFilename(preview?.title));
        addToast("Video ready — check the new tab or your downloads folder", { type: "success" });
      } catch (e) {
        addToast(e instanceof Error ? e.message : "Download failed", { type: "error", duration: 6000 });
        st.setSingleJob(null);
      } finally {
        st.setDownloading(false);
        st.setActiveJobId(null);
      }
      return;
    }

    let body: Record<string, unknown>;
    if (mode === "multi") {
      const urls = parseUrls(url);
      if (urls.length === 0) return;
      body = {
        urls,
        format: selectedFormatId,
        label: preview?.title ?? null,
      };
    } else {
      const one = (sourceUrl ?? url).trim();
      if (!one) return;
      body = {
        url: one,
        expand_flat: true,
        format: selectedFormatId,
        label: preview?.title ?? null,
      };
    }

    st.setDownloading(true);
    st.setArchiveJob(null);
    try {
      const created = await apiFetch<ArchiveJobDto>("/download/archive", {
        method: "POST",
        body: JSON.stringify(body),
      });
      st.setArchiveJob(created);
      let last = created;
      let archivePendingOnlyPolls = 0;
      while (!["completed", "failed"].includes(last.status)) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        last = await apiFetch<ArchiveJobDto>(`/archive/${created.id}`);
        st.setArchiveJob(last);
        if (last.status === "pending") {
          archivePendingOnlyPolls += 1;
          if (archivePendingOnlyPolls >= MAX_PENDING_POLLS) {
            addToast(
              "Archive stayed queued too long. The API background worker (ARQ) may not be running, or Redis is misconfigured.",
              { type: "error", duration: 12000 },
            );
            return;
          }
        } else {
          archivePendingOnlyPolls = 0;
        }
      }
      if (last.status === "failed") {
        addToast(last.error_message ?? "Archive failed", { type: "error", duration: 6000 });
        return;
      }
      await downloadArchiveFileToBrowser(created.id, safeZipFilename(preview?.title));
      addToast("ZIP ready — check the new tab or your downloads folder", { type: "success" });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Download failed", { type: "error", duration: 6000 });
    } finally {
      st.setDownloading(false);
    }
  },

  pasteFromClipboard: (text: string) => {
    const mode = get().mode;
    if (!text) return;
    const trimmed = text.trim();
    set({
      url: mode === "multi" ? text : normalizeYoutubeUrlForSingle(trimmed),
      preview: null,
      sourceUrl: null,
      autoPreviewBlockedKey: null,
      ...initialJobs,
    });
  },
}));

export function selectAllUrls(state: Pick<DownloadStore, "mode" | "url" | "sourceUrl">): string[] {
  if (state.mode === "multi") return parseUrls(state.url);
  if (state.sourceUrl) return [state.sourceUrl];
  const one = state.url.trim();
  return one ? [one] : [];
}

