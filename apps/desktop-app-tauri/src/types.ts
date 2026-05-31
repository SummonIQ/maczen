export interface FileItem {
  path: string;
  name: string;
  size: number;
  modified: Date;
  mediaType?: "screenshot" | "photo" | "video" | "screen_recording";
  isLivePhoto?: boolean;
  album?: string | null;
}

export interface ScanResult {
  screenshots: FileItem[];
  recordings: FileItem[];
}

export interface OrganizedAlbum {
  album: string;
  screenshots: FileItem[];
  recordings: FileItem[];
}

export interface AppSettings {
  applePhotosEnabled: boolean;
  applePhotosImportAll: boolean;
  applePhotosLookbackDays: number;
  applePhotosOrganizeExportToFolder: boolean;
  applePhotosOrganizeDeleteFromPhotos: boolean;
  applePhotosOrganizeTagInPhotos: boolean;
  applePhotosOrganizeUseMacZenFolder: boolean;
  useIcloudDestination: boolean;
  icloudDestinationPath: string;
}

export interface ProfilingStatus {
  enabled: boolean;
  sessionId: string | null;
  sessionDir: string | null;
  sampleFilePath: string | null;
  traceFilePath: string | null;
  traceActive: boolean;
  traceStartedAt: string | null;
  sampleIntervalMs: number;
  remoteDebuggingPort: number | null;
  lastSampleAt: string | null;
}

export interface IntelligenceStoreStatus {
  version: number;
  storePath: string;
  updatedAt: string | null;
  mediaCount: number;
  sources: Record<
    | "desktop-inbox"
    | "organized-library"
    | "apple-photos-inbox"
    | "apple-photos-organized",
    {
      total: number;
      ocrEligible: number;
      ocrReady: number;
      ocrFailed: number;
    }
  >;
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  indexing: {
    metadataReady: number;
    metadataPending: number;
    metadataFailed: number;
    ocrEligible: number;
    ocrReady: number;
    ocrPending: number;
    ocrFailed: number;
    captionPending: number;
    embeddingPending: number;
  };
}

export interface IntelligenceJob {
  id: string;
  mediaId: string;
  type: "SYNC_MEDIA_METADATA" | "SYNC_MEDIA_OCR";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  attemptCount: number;
  priority: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface IntelligenceMediaRecord {
  id: string;
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  mediaType: "screenshot" | "photo" | "video" | "screen_recording";
  source:
    | "desktop-inbox"
    | "organized-library"
    | "apple-photos-inbox"
    | "apple-photos-organized";
  album?: string | null;
  signature: string;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
  metadataIndexedAt: string | null;
  metadataStatus: "NOT_STARTED" | "READY" | "FAILED";
  ocrIndexedAt: string | null;
  ocrStatus: "NOT_STARTED" | "READY" | "FAILED" | "SKIPPED";
  ocrText: string | null;
  captionStatus: "NOT_STARTED" | "READY" | "FAILED";
  embeddingStatus: "NOT_STARTED" | "READY" | "FAILED";
}

export interface IntelligenceSearchResult {
  item: IntelligenceMediaRecord;
  score: number;
  reasons: string[];
}

export interface IntelligenceSearchOptions {
  query?: string;
  album?: string | null;
  source?:
    | "desktop-inbox"
    | "organized-library"
    | "apple-photos-inbox"
    | "apple-photos-organized";
  mediaType?: "screenshot" | "photo" | "video" | "screen_recording";
  limit?: number;
}

export interface ApplePhotosAlbum {
  id: string;
  title: string;
  count: number;
  type: "user" | "smart" | "shared";
  folder?: string | null;
}

export type ApplePhotosPhotoKitFallbackReason =
  | "not-macos"
  | "helper-unavailable"
  | "access-denied"
  | "runtime-failure";

export interface ElectronAPI {
  getTheme: () => Promise<"dark" | "light">;
  getProfilingStatus: () => Promise<ProfilingStatus>;
  captureProfilingSnapshot: () => Promise<unknown>;
  startProfilingTrace: (label?: string) => Promise<string | null>;
  stopProfilingTrace: () => Promise<string | null>;
  getIntelligenceStatus: () => Promise<IntelligenceStoreStatus>;
  listIntelligenceJobs: (limit?: number) => Promise<IntelligenceJob[]>;
  searchIntelligenceMedia: (
    options?: IntelligenceSearchOptions,
  ) => Promise<IntelligenceSearchResult[]>;
  rebuildIntelligenceMetadata: () => Promise<{
    mediaReset: number;
    jobsQueued: number;
  }>;
  retryFailedIntelligenceOcr: () => Promise<{
    mediaReset: number;
    jobsQueued: number;
  }>;
  onThemeChanged: (callback: (theme: "dark" | "light") => void) => void;
  scanFiles: () => Promise<ScanResult>;
  scanOrganizedFiles: () => Promise<OrganizedAlbum[]>;
  getAlbums: () => Promise<string[]>;
  getApplePhotosAlbums: () => Promise<ApplePhotosAlbum[]>;
  getApplePhotosAlbumAssets: (albumId: string) => Promise<
    Array<{
      id: string;
      date: string;
      name: string;
      width?: number | null;
      height?: number | null;
      isMovie: boolean;
      isLivePhoto: boolean;
    }>
  >;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  createAlbum: (albumName: string) => Promise<{ success: boolean; error?: string }>;
  deleteAlbum: (albumName: string) => Promise<{ success: boolean; error?: string }>;
  selectDirectory: (options?: {
    title?: string;
    defaultPath?: string;
  }) => Promise<{ cancelled: boolean; path?: string }>;
  startWindowDrag?: () => Promise<void> | void;
  importApplePhotos: (options?: { force?: boolean }) => Promise<{
    success: boolean;
    importedCount?: number;
    cancelled?: boolean;
    error?: string;
  }>;
  onApplePhotosImportProgress: (
    callback: (data: {
      phase?: string;
      message: string;
      progress?: { processed: number; total: number };
      photoKitFallbackReason?: ApplePhotosPhotoKitFallbackReason;
    }) => void,
  ) => () => void;
  moveFile: (
    filePath: string,
    albumName: string,
    isScreenshot: boolean,
  ) => Promise<{ success: boolean; destPath?: string; error?: string }>;
  undoMoveFile: (
    filePath: string,
    currentPath: string,
    isScreenshot: boolean,
  ) => Promise<{ success: boolean; destPath?: string; error?: string }>;
  generateVideoThumbnail: (videoPath: string) => Promise<string | null>;
  getFileDataUrl: (filePath: string) => Promise<string | null>;
  getVideoPlaybackUrl: (videoPath: string) => Promise<string | null>;
  getLivePhotoVideoUrl: (photoPath: string) => Promise<string | null>;
  revealInFinder: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (
    filePath: string,
  ) => Promise<{ success: boolean; error?: string }>;
  renameFile: (
    filePath: string,
    newName: string,
  ) => Promise<{ success: boolean; destPath?: string; fileName?: string; error?: string }>;
  renameAlbum: (
    oldName: string,
    newName: string,
  ) => Promise<{ success: boolean; error?: string }>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  autoOrganize: (
    files: Array<{ path: string; name: string; isScreenshot: boolean }>,
  ) => Promise<{
    success: boolean;
    suggestions?: Array<{
      fileName: string;
      suggestedAlbum: string;
      reason: string;
    }>;
    error?: string;
    cancelled?: boolean;
  }>;
  cancelAutoOrganize: () => Promise<{ success: boolean }>;
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
  ) => () => void;
  onAutoOrganizeError: (
    callback: (error: { error: string; message: string; details: any }) => void,
  ) => () => void;
  requestPhotosAccess: () => Promise<{ success: boolean; error?: string }>;
  // License management
  getLicense: () => Promise<{
    valid: boolean;
    plan: string;
    key?: string;
    email?: string;
  }>;
  activateLicense: (licenseKey: string) => Promise<{
    success: boolean;
    valid?: boolean;
    plan?: string;
    email?: string;
    error?: string;
  }>;
  deactivateLicense: () => Promise<{ success: boolean }>;
  openUpgradeUrl: () => Promise<{ success: boolean }>;

  // Window controls for capture mode
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;

  // Screenshot/Video capture
  captureFullscreenScreenshot: () => Promise<{
    success: boolean;
    path?: string;
    error?: string;
  }>;
  captureAreaScreenshot: () => Promise<{
    success: boolean;
    path?: string;
    cancelled?: boolean;
    error?: string;
  }>;
  captureFullscreenVideo: () => Promise<{
    success: boolean;
    path?: string;
    recording?: boolean;
    error?: string;
  }>;
  captureAreaVideo: () => Promise<{
    success: boolean;
    path?: string;
    recording?: boolean;
    error?: string;
  }>;
  stopVideoRecording: () => Promise<{
    success: boolean;
    path?: string;
    cancelled?: boolean;
    error?: string;
  }>;
  isRecording: () => Promise<{
    recording: boolean;
    path: string | null;
  }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
