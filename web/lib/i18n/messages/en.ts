export const en = {
  // AppHeader
  appTagline: "social video downloader",

  // Hero section
  heroLine1: "Download from",
  heroHighlight: "any platform,",
  heroLine2: "any format, instantly",
  heroSub: "YouTube · TikTok · Instagram · Twitter · Facebook · Vimeo · and more",

  // Platform badge
  morePlatforms: "+ more",

  // URL input area
  urlPlaceholder: "https://youtube.com/watch?v=…",
  pasteClipboard: "Paste from clipboard",
  fetchInfo: "Fetch video info",
  fetchingInfo: "Fetching video info",

  // VideoInfoPanel — header
  preview: "Preview",
  changeUrl: "Change URL",

  // Bundle / playlist
  playlist: "Playlist",
  videoCount: (n: number) => `${n} video${n !== 1 ? "s" : ""}`,
  unknownChannel: "Unknown channel",
  untitled: "Untitled",

  // Format picker
  chooseFormat: "Choose format",
  catVideoAudio: "Video with sound",
  catAudio: "Audio only",
  catVideoOnly: "Video only (no sound)",
  best: "Best",

  // Download button states
  download: "Download",
  fetching: "…",

  // Completed state
  completed: "Completed",
  saveToDevice: "Save to device",
  redownload: "Redownload video",

  // Hint text below the footer bar
  formatHint:
    "Choose a format, then download. Video-only options have no audio — useful for editing.",
  redownloadHint:
    "Redownload clears this clip and sends you back to the link box (same as Change URL).",

  // Toast / feedback messages
  clipboardDenied: "Clipboard access denied or empty",
  invalidUrl: "Enter a valid http(s) link",
  videoReady: "Video ready — check the new tab or your downloads folder",
  zipReady: "ZIP ready — check the new tab or your downloads folder",
  downloadFailed: "Download failed",
  archiveFailed: "Archive failed",
  couldNotLoad: "Could not load video info",
} as const;

export type Messages = typeof en;
