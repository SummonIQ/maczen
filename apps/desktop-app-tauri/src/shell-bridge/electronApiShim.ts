import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createTauriDesktopBridge } from "./tauriBridge";

const APPLE_PHOTOS_URI_PREFIX = "photos://";
const applePhotosImportProgressListeners = new Set<
  (data: {
    phase?: string;
    message: string;
    progress?: { processed: number; total: number };
  }) => void
>();
const autoOrganizeProgressListeners = new Set<
  (data: {
    suggestions: Array<{
      fileName: string;
      suggestedAlbum: string;
      reason: string;
      confidence?: string;
    }>;
    complete: boolean;
    progress?: { processed: number; total: number };
    phase?: string;
    phaseMessage?: string;
    cost?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCost: number;
      model: string;
    };
  }) => void
>();
const autoOrganizeErrorListeners = new Set<
  (error: { error: string; message: string; details: any }) => void
>();

const toFileUrl = (path: string) => `file://${encodeURI(path)}`;
const getSystemTheme = (): "dark" | "light" =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
const fromMediaItem = (item: {
  path: string;
  name: string;
  size: number;
  modified_ms: number;
  media_type?: "screenshot" | "photo" | "video" | "screen_recording";
}) => ({
  path: item.path,
  name: item.name,
  size: item.size,
  modified: new Date(item.modified_ms),
  mediaType: item.media_type,
});

type AppSettings = {
  applePhotosEnabled: boolean;
  applePhotosImportAll: boolean;
  applePhotosLookbackDays: number;
  applePhotosOrganizeExportToFolder: boolean;
  applePhotosOrganizeDeleteFromPhotos: boolean;
  applePhotosOrganizeTagInPhotos: boolean;
  applePhotosOrganizeUseMacZenFolder: boolean;
  useIcloudDestination: boolean;
  icloudDestinationPath: string;
};

const DEFAULT_INTELLIGENCE_STATUS = {
  version: 1,
  storePath: "",
  updatedAt: null,
  mediaCount: 0,
  sources: {
    "desktop-inbox": { total: 0, ocrEligible: 0, ocrReady: 0, ocrFailed: 0 },
    "organized-library": { total: 0, ocrEligible: 0, ocrReady: 0, ocrFailed: 0 },
    "apple-photos-inbox": { total: 0, ocrEligible: 0, ocrReady: 0, ocrFailed: 0 },
    "apple-photos-organized": {
      total: 0,
      ocrEligible: 0,
      ocrReady: 0,
      ocrFailed: 0,
    },
  },
  jobs: {
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  },
  indexing: {
    metadataReady: 0,
    metadataPending: 0,
    metadataFailed: 0,
    ocrEligible: 0,
    ocrReady: 0,
    ocrPending: 0,
    ocrFailed: 0,
    captionPending: 0,
    embeddingPending: 0,
  },
};

const autoOrganizeState = { cancelled: false };
const intelligenceJobs: Array<{
  id: string;
  status: "completed" | "failed";
  createdAt: string;
  source: string;
  error?: string;
}> = [];
const intelligenceCache = new Map<
  string,
  {
    path: string;
    name: string;
    source: "desktop-inbox" | "organized-library";
    album?: string;
    mediaType?: string;
    modifiedMs: number;
  }
>();

const guessAlbumFromName = (name: string): { album: string; reason: string } => {
  const lower = name.toLowerCase();
  if (
    lower.includes("invoice") ||
    lower.includes("receipt") ||
    lower.includes("bill")
  ) {
    return { album: "Finance", reason: "Detected finance terms in filename" };
  }
  if (
    lower.includes("meeting") ||
    lower.includes("work") ||
    lower.includes("project")
  ) {
    return { album: "Work", reason: "Detected work/project terms in filename" };
  }
  if (
    lower.includes("vacation") ||
    lower.includes("travel") ||
    lower.includes("family")
  ) {
    return { album: "Personal", reason: "Detected personal terms in filename" };
  }
  if (lower.includes("screen recording") || lower.endsWith(".mov")) {
    return { album: "Recordings", reason: "Detected screen recording media" };
  }
  return { album: "Inbox", reason: "No strong signal, keeping in inbox" };
};

export const installElectronApiShim = () => {
  if (window.electronAPI) return;

  const bridge = createTauriDesktopBridge();
  const resolveAppWindow = () => {
    try {
      return getCurrentWindow();
    } catch {
      return null;
    }
  };

  window.electronAPI = ({
    getTheme: async () => getSystemTheme(),
    onThemeChanged: (callback: (theme: "dark" | "light") => void) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => callback(getSystemTheme());
      media.addEventListener("change", handler);
    },
    startWindowDrag: async () => {
      const appWindow = resolveAppWindow();
      if (!appWindow) return;
      try {
        await appWindow.startDragging();
      } catch {}
    },
    nativeBridgeHealthcheck: async () => {
      const response = await bridge.invokeBridge<{
        status?: string;
        version?: string;
      }>("bridge.health");

      return {
        success: response.success,
        status: response.data?.status,
        version: response.data?.version,
      };
    },
    requestPhotosAccess: async () => {
      const response = await bridge.invokeBridge<{ granted?: boolean }>(
        "permissions.photos.request",
      );
      const granted = Boolean(response.data?.granted);
      return {
        success: granted,
        ...(granted ? {} : { error: "Photos access denied" }),
      };
    },
    getPhotoKitThumbnail: async (
      localIdentifier: string,
      size = 360,
      quality = 0.7,
    ) => {
      return bridge.invokeBridge<{ dataUrl?: string }>("photokit.thumbnail", {
        localIdentifier,
        quality,
        size,
      });
    },
    runMediaOcr: async (filePath: string) => {
      return bridge.invokeBridge<{
        text?: string;
        lineCount?: number;
        averageConfidence?: number | null;
      }>("media.ocr", { filePath });
    },
    getIntelligenceStatus: async () => {
      const scanResult = await invoke<{
        screenshots: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
        recordings: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
      }>("scan_files");
      const organized = await invoke<
        Array<{
          album: string;
          screenshots: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
          recordings: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
        }>
      >("scan_organized_files");

      const inboxTotal =
        (scanResult.screenshots?.length ?? 0) + (scanResult.recordings?.length ?? 0);
      const organizedTotal = (organized ?? []).reduce(
        (sum, album) =>
          sum + (album.screenshots?.length ?? 0) + (album.recordings?.length ?? 0),
        0,
      );

      return {
        ...DEFAULT_INTELLIGENCE_STATUS,
        updatedAt: new Date().toISOString(),
        mediaCount: inboxTotal + organizedTotal,
        sources: {
          ...DEFAULT_INTELLIGENCE_STATUS.sources,
          "desktop-inbox": {
            total: inboxTotal,
            ocrEligible: inboxTotal,
            ocrReady: inboxTotal,
            ocrFailed: 0,
          },
          "organized-library": {
            total: organizedTotal,
            ocrEligible: organizedTotal,
            ocrReady: organizedTotal,
            ocrFailed: 0,
          },
        },
        jobs: {
          total: intelligenceJobs.length,
          pending: 0,
          running: 0,
          completed: intelligenceJobs.filter((job) => job.status === "completed")
            .length,
          failed: intelligenceJobs.filter((job) => job.status === "failed").length,
        },
      };
    },
    listIntelligenceJobs: async (limit = 50) => intelligenceJobs.slice(0, limit),
    searchIntelligenceMedia: async (options?: {
      query?: string;
      album?: string | null;
      source?:
        | "desktop-inbox"
        | "organized-library"
        | "apple-photos-inbox"
        | "apple-photos-organized";
      mediaType?: "screenshot" | "photo" | "video" | "screen_recording";
      limit?: number;
    }) => {
      const query = options?.query?.toLowerCase().trim() ?? "";
      const albumFilter = (options?.album ?? "").toLowerCase().trim();
      const mediaTypeFilter = options?.mediaType?.toLowerCase();
      const sourceFilter = options?.source;
      const limit = Math.max(1, options?.limit ?? 50);

      if (intelligenceCache.size === 0) {
        const scanResult = await invoke<{
          screenshots: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
          recordings: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
        }>("scan_files");
        for (const item of [...(scanResult.screenshots ?? []), ...(scanResult.recordings ?? [])]) {
          intelligenceCache.set(item.path, {
            path: item.path,
            name: item.name,
            source: "desktop-inbox",
            mediaType: item.media_type,
            modifiedMs: item.modified_ms,
          });
        }
      }

      return Array.from(intelligenceCache.values())
        .filter((item) => (sourceFilter ? item.source === sourceFilter : true))
        .filter((item) =>
          albumFilter ? (item.album ?? "").toLowerCase() === albumFilter : true,
        )
        .filter((item) =>
          mediaTypeFilter ? (item.mediaType ?? "").toLowerCase() === mediaTypeFilter : true,
        )
        .filter((item) => {
          if (!query) return true;
          return (
            item.name.toLowerCase().includes(query) ||
            item.path.toLowerCase().includes(query) ||
            (item.album ?? "").toLowerCase().includes(query)
          );
        })
        .sort((a, b) => b.modifiedMs - a.modifiedMs)
        .slice(0, limit)
        .map((item) => ({
          path: item.path,
          name: item.name,
          source: item.source,
          mediaType: item.mediaType,
          modified: new Date(item.modifiedMs).toISOString(),
          album: item.album ?? null,
        }));
    },
    rebuildIntelligenceMetadata: async () => {
      intelligenceCache.clear();
      const scanResult = await invoke<{
        screenshots: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
        recordings: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
      }>("scan_files");
      const organized = await invoke<
        Array<{
          album: string;
          screenshots: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
          recordings: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
        }>
      >("scan_organized_files");

      for (const item of [...(scanResult.screenshots ?? []), ...(scanResult.recordings ?? [])]) {
        intelligenceCache.set(item.path, {
          path: item.path,
          name: item.name,
          source: "desktop-inbox",
          mediaType: item.media_type,
          modifiedMs: item.modified_ms,
        });
      }
      for (const album of organized ?? []) {
        for (const item of [...(album.screenshots ?? []), ...(album.recordings ?? [])]) {
          intelligenceCache.set(item.path, {
            path: item.path,
            name: item.name,
            source: "organized-library",
            album: album.album,
            mediaType: item.media_type,
            modifiedMs: item.modified_ms,
          });
        }
      }

      intelligenceJobs.unshift({
        id: `rebuild-${Date.now()}`,
        status: "completed",
        createdAt: new Date().toISOString(),
        source: "manual-rebuild",
      });
      return { mediaReset: intelligenceCache.size, jobsQueued: 1 };
    },
    retryFailedIntelligenceOcr: async () => {
      const failed = intelligenceJobs.filter((job) => job.status === "failed");
      failed.forEach((job) => {
        job.status = "completed";
        delete job.error;
      });
      return { mediaReset: failed.length, jobsQueued: failed.length };
    },
    getApplePhotosAlbums: async () => {
      const response = await bridge.invokeBridge<{
        albums?: Array<{
          id: string;
          title: string;
          count: number;
          type: "user" | "smart" | "shared";
          folder?: string | null;
        }>;
      }>("photokit.list_albums");
      return response.data?.albums ?? [];
    },
    getApplePhotosAlbumAssets: async (albumId: string) => {
      const response = await bridge.invokeBridge<{
        assets?: Array<{
          id: string;
          date: string;
          name: string;
          width?: number | null;
          height?: number | null;
          isMovie: boolean;
          isLivePhoto: boolean;
        }>;
      }>("photokit.list_album_assets", { albumId });
      return response.data?.assets ?? [];
    },
    listApplePhotosAssets: async (options?: {
      lookbackDays?: number;
      importAll?: boolean;
    }) => {
      const response = await bridge.invokeBridge<{
        items?: Array<{
          id: string;
          date: string;
          name: string;
          width?: number | null;
          height?: number | null;
          isMovie: boolean;
          isLivePhoto: boolean;
          keywords?: string[];
        }>;
      }>("photokit.list", {
        importAll: Boolean(options?.importAll),
        lookbackDays: options?.lookbackDays ?? 30,
      });
      return response.data?.items ?? [];
    },
    scanFiles: async () => {
      const result = await invoke<{
        screenshots: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
        recordings: Array<{
          path: string;
          name: string;
          size: number;
          modified_ms: number;
          media_type?: "screenshot" | "photo" | "video" | "screen_recording";
        }>;
      }>("scan_files");
      return {
        screenshots: (result.screenshots ?? []).map(fromMediaItem),
        recordings: (result.recordings ?? []).map(fromMediaItem),
      };
    },
    scanOrganizedFiles: async () => {
      const albums = await invoke<
        Array<{
          album: string;
          screenshots: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
          recordings: Array<{
            path: string;
            name: string;
            size: number;
            modified_ms: number;
            media_type?: "screenshot" | "photo" | "video" | "screen_recording";
          }>;
        }>
      >("scan_organized_files");
      return (albums ?? []).map((album) => ({
        album: album.album,
        screenshots: (album.screenshots ?? []).map(fromMediaItem),
        recordings: (album.recordings ?? []).map(fromMediaItem),
      }));
    },
    getAlbums: async () => {
      return invoke<string[]>("get_albums");
    },
    createAlbum: async (albumName: string) => {
      return invoke<{ success: boolean; error?: string }>("create_album", {
        albumName,
      });
    },
    deleteAlbum: async (albumName: string) => {
      return invoke<{ success: boolean; error?: string }>("delete_album", {
        albumName,
      });
    },
    renameAlbum: async (oldName: string, newName: string) => {
      return invoke<{ success: boolean; error?: string }>("rename_album", {
        oldName,
        newName,
      });
    },
    getSettings: async () => {
      return invoke<AppSettings>("get_settings");
    },
    updateSettings: async (updates: Partial<AppSettings>) => {
      return invoke<AppSettings>("update_settings", { updates });
    },
    selectDirectory: async (options?: { title?: string; defaultPath?: string }) => {
      return invoke<{ cancelled: boolean; path?: string }>("select_directory", {
        title: options?.title ?? null,
        defaultPath: options?.defaultPath ?? null,
      });
    },
    importApplePhotos: async (options?: { force?: boolean }) => {
      applePhotosImportProgressListeners.forEach((listener) =>
        listener({
          message: "Starting Apple Photos import...",
          phase: "starting",
          progress: { processed: 0, total: 1 },
        }),
      );

      const response = await bridge.invokeBridge<{
        destination?: string;
        importedCount?: number;
        failedCount?: number;
        items?: Array<{
          id: string;
          path: string;
          name: string;
          isMovie: boolean;
          isLivePhoto: boolean;
        }>;
      }>("photokit.import", {
        importAll: Boolean(options?.force),
        lookbackDays: 30,
      });

      if (!response.success) {
        applePhotosImportProgressListeners.forEach((listener) =>
          listener({
            message: response.error?.message ?? "Apple Photos import failed",
            phase: "error",
            progress: { processed: 0, total: 1 },
          }),
        );
        return {
          success: false,
          error: response.error?.message ?? "Photo import failed",
        };
      }

      applePhotosImportProgressListeners.forEach((listener) =>
        listener({
          message: `Imported ${response.data?.importedCount ?? 0} items`,
          phase: "complete",
          progress: { processed: 1, total: 1 },
        }),
      );
      return {
        success: true,
        importedCount: response.data?.importedCount ?? 0,
        destination: response.data?.destination,
        failedCount: response.data?.failedCount ?? 0,
      };
    },
    onApplePhotosImportProgress: (
      callback: (data: {
        phase?: string;
        message: string;
        progress?: { processed: number; total: number };
      }) => void,
    ) => {
      applePhotosImportProgressListeners.add(callback);
      return () => applePhotosImportProgressListeners.delete(callback);
    },
    generateVideoThumbnail: async (videoPath: string) => {
      const response = await bridge.invokeBridge<{ dataUrl?: string }>(
        "media.video_thumbnail",
        {
          filePath: videoPath,
          maxDimension: 640,
          quality: 0.7,
        },
      );
      if (!response.success) return null;
      return response.data?.dataUrl ?? null;
    },
    autoOrganize: async (
      files: Array<{ path: string; name: string; isScreenshot: boolean }>,
    ) => {
      autoOrganizeState.cancelled = false;
      const suggestions: Array<{
        fileName: string;
        suggestedAlbum: string;
        reason: string;
        confidence?: string;
      }> = [];

      autoOrganizeProgressListeners.forEach((listener) =>
        listener({
          suggestions: [],
          complete: false,
          progress: { processed: 0, total: files.length },
          phase: "analyzing",
          phaseMessage: "Analyzing files for album suggestions",
        }),
      );

      for (let index = 0; index < files.length; index += 1) {
        if (autoOrganizeState.cancelled) {
          autoOrganizeProgressListeners.forEach((listener) =>
            listener({
              suggestions,
              complete: true,
              progress: { processed: index, total: files.length },
              phase: "cancelled",
              phaseMessage: "Auto-organize cancelled",
            }),
          );
          return { success: true, suggestions, cancelled: true };
        }

        const file = files[index];
        const guess = guessAlbumFromName(file.name);
        suggestions.push({
          fileName: file.name,
          suggestedAlbum: guess.album,
          reason: guess.reason,
          confidence: guess.album === "Inbox" ? "low" : "medium",
        });
        autoOrganizeProgressListeners.forEach((listener) =>
          listener({
            suggestions: [suggestions[suggestions.length - 1]],
            complete: false,
            progress: { processed: index + 1, total: files.length },
            phase: "analyzing",
            phaseMessage: `Processed ${index + 1}/${files.length} files`,
          }),
        );
      }

      autoOrganizeProgressListeners.forEach((listener) =>
        listener({
          suggestions,
          complete: true,
          progress: { processed: files.length, total: files.length },
          phase: "complete",
          phaseMessage: "Auto-organize suggestions ready",
        }),
      );
      return { success: true, suggestions, cancelled: false };
    },
    cancelAutoOrganize: async () => {
      autoOrganizeState.cancelled = true;
      return { success: true };
    },
    onAutoOrganizeProgress: (
      callback: (data: {
        suggestions: Array<{
          fileName: string;
          suggestedAlbum: string;
          reason: string;
          confidence?: string;
        }>;
        complete: boolean;
        progress?: { processed: number; total: number };
        phase?: string;
        phaseMessage?: string;
        cost?: {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
          estimatedCost: number;
          model: string;
        };
      }) => void,
    ) => {
      autoOrganizeProgressListeners.add(callback);
      return () => autoOrganizeProgressListeners.delete(callback);
    },
    onAutoOrganizeError: (
      callback: (error: { error: string; message: string; details: any }) => void,
    ) => {
      autoOrganizeErrorListeners.add(callback);
      return () => autoOrganizeErrorListeners.delete(callback);
    },
    openUpgradeUrl: async () => {
      window.open("https://www.maczen.app/pricing", "_blank", "noopener,noreferrer");
      return { success: true };
    },
    captureFullscreenScreenshot: async () => {
      return invoke<{
        success: boolean;
        path?: string;
        cancelled?: boolean;
        error?: string;
      }>("capture_fullscreen_screenshot");
    },
    captureAreaScreenshot: async () => {
      return invoke<{
        success: boolean;
        path?: string;
        cancelled?: boolean;
        error?: string;
      }>("capture_area_screenshot");
    },
    captureFullscreenVideo: async () => {
      return invoke<{
        success: boolean;
        path?: string;
        recording?: boolean;
        cancelled?: boolean;
        error?: string;
      }>("capture_fullscreen_video");
    },
    captureAreaVideo: async () => {
      return invoke<{
        success: boolean;
        path?: string;
        recording?: boolean;
        cancelled?: boolean;
        error?: string;
      }>("capture_area_video");
    },
    stopVideoRecording: async () => {
      return invoke<{
        success: boolean;
        path?: string;
        recording?: boolean;
        cancelled?: boolean;
        error?: string;
      }>("stop_video_recording");
    },
    isRecording: async () => {
      const status = await invoke<{
        recording: boolean;
        path?: string | null;
      }>("is_recording");
      return {
        recording: Boolean(status.recording),
        path: status.path ?? null,
      };
    },
    getFileDataUrl: async (filePath: string) => {
      if (filePath?.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
        const localIdentifier = filePath.slice(APPLE_PHOTOS_URI_PREFIX.length);
        if (!localIdentifier) return null;
        const response = await bridge.invokeBridge<{ dataUrl?: string }>(
          "photokit.thumbnail",
          {
            localIdentifier,
            quality: 0.7,
            size: 640,
          },
        );
        if (!response.success) return null;
        return response.data?.dataUrl ?? null;
      }
      return invoke<string | null>("get_file_data_url", { filePath });
    },
    getVideoPlaybackUrl: async (videoPath: string) => {
      return videoPath ? toFileUrl(videoPath) : null;
    },
    getLivePhotoVideoUrl: async (photoPath: string) => {
      if (!photoPath?.startsWith(APPLE_PHOTOS_URI_PREFIX)) return null;
      const localIdentifier = photoPath.slice(APPLE_PHOTOS_URI_PREFIX.length);
      if (!localIdentifier) return null;

      const response = await bridge.invokeBridge<{ path?: string }>(
        "media.live_photo_video",
        { localIdentifier },
      );
      if (!response.success) return null;
      const path = response.data?.path;
      return path ? toFileUrl(path) : null;
    },
    moveFile: async (filePath: string, albumName: string, isScreenshot: boolean) => {
      const result = await invoke<{ success: boolean; dest_path?: string; error?: string }>(
        "move_file",
        {
          filePath,
          albumName,
          isScreenshot,
        },
      );
      return {
        success: result.success,
        destPath: result.dest_path,
        error: result.error,
      };
    },
    undoMoveFile: async (
      filePath: string,
      currentPath: string,
      isScreenshot: boolean,
    ) => {
      const result = await invoke<{ success: boolean; dest_path?: string; error?: string }>(
        "undo_move_file",
        {
          filePath,
          currentPath,
          isScreenshot,
        },
      );
      return {
        success: result.success,
        destPath: result.dest_path,
        error: result.error,
      };
    },
    deleteFile: async (filePath: string) => {
      return invoke<{ success: boolean; error?: string }>("delete_file", {
        filePath,
      });
    },
    renameFile: async (filePath: string, newName: string) => {
      const result = await invoke<{
        success: boolean;
        dest_path?: string;
        file_name?: string;
        error?: string;
      }>("rename_file", {
        filePath,
        newName,
      });
      return {
        success: result.success,
        destPath: result.dest_path,
        fileName: result.file_name,
        error: result.error,
      };
    },
    revealInFinder: async (filePath: string) => {
      return invoke<{ success: boolean; error?: string }>("reveal_in_finder", {
        filePath,
      });
    },
    minimizeWindow: async () => {
      const appWindow = resolveAppWindow();
      if (appWindow) await appWindow.minimize();
    },
    closeWindow: async () => {
      const appWindow = resolveAppWindow();
      if (appWindow) await appWindow.close();
    },
    hideWindow: async () => {
      const appWindow = resolveAppWindow();
      if (appWindow) await appWindow.hide();
    },
    showWindow: async () => {
      const appWindow = resolveAppWindow();
      if (appWindow) await appWindow.show();
    },
  } as any);
};
