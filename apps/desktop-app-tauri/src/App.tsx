import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  AppSettings,
  ApplePhotosPhotoKitFallbackReason,
  FileItem,
  IntelligenceJob,
  IntelligenceStoreStatus,
  IntelligenceSearchResult,
} from "./types";
import FileCard from "./components/FileCard";
import ListView from "./components/ListView";
import GalleryView from "./components/GalleryView";
import CaptureMode from "./components/CaptureMode";
import {
  FolderOpen,
  Image,
  Video,
  RefreshCw,
  Grid3x3,
  List,
  GalleryHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  X,
  Sparkles,
  Plus,
  Settings,
  Camera,
  User,
  Images,
  HardDrive,
  Search,
  LoaderCircle,
  Database,
  ScanText,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "./lib/utils";
import { normalizeAlbumName } from "./utils";

type FilterId = "library" | "all" | "screenshots" | "recordings" | "organize";
const APPLE_PHOTOS_URI_PREFIX = "photos://";
const MEDIA_DRAG_MIME = "application/x-maczen-media-item";
const ALBUM_DRAG_MIME = "application/x-maczen-album-item";
const ALBUM_ORDER_STORAGE_KEY = "maczen.album-order.v1";
const ALBUM_REORDER_EDGE_RATIO = 0.28;
const DRAG_PREVIEW_SCALE = 0.94;
const DRAG_PREVIEW_ALBUM_HOVER_SCALE = 0.46;
const DRAG_PREVIEW_SCALE_TRANSITION_MS = 120;
const DRAG_PREVIEW_OPACITY = 0.5;
const DRAG_PREVIEW_SIDEBAR_CURSOR_LEAD_PX = 10;
const DRAG_PREVIEW_RING =
  "0 18px 40px rgba(0, 0, 0, 0.45)";
const DRAG_PREVIEW_BORDER = "2px solid rgba(236, 72, 153, 0.85)";
const UNDO_TOAST_DURATION_MS = 5000;
const API_SERVER_URL =
  ((import.meta as any).env?.VITE_API_URL as string) ||
  "http://localhost:30051";
type MediaDragPayload = {
  path: string;
  isScreenshot: boolean;
};
type DragPointerAnchor = {
  clientX: number;
  clientY: number;
  offsetX?: number;
  offsetY?: number;
  hotspotOffsetY?: number;
};
type AlbumDragPayload = {
  albumName: string;
};
type AlbumReorderTarget = {
  albumName: string;
  position: "before" | "after";
};
type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};
type AccountEntitlements = {
  aiOrganization: boolean;
  ocrTextSearch: boolean;
  cloudBackup: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  unlimitedScreenshots: boolean;
};
const DEFAULT_ACCOUNT_ENTITLEMENTS: AccountEntitlements = {
  aiOrganization: false,
  ocrTextSearch: false,
  cloudBackup: false,
  prioritySupport: false,
  advancedAnalytics: false,
  unlimitedScreenshots: true,
};

const VIEW_MODES: Array<{
  id: "grid" | "list" | "gallery";
  label: string;
  icon: typeof Grid3x3;
}> = [
  { id: "grid", label: "Grid", icon: Grid3x3 },
  { id: "list", label: "List", icon: List },
  { id: "gallery", label: "Gallery", icon: GalleryHorizontal },
];
const ORGANIZE_SOURCE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "desktop", label: "Desktop" },
  { id: "photos", label: "Apple Photos" },
] as const;
type OrganizeSourceFilter = (typeof ORGANIZE_SOURCE_OPTIONS)[number]["id"];
const SCROLL_IDLE_DELAY_MS = 160;
const LIST_ITEM_ESTIMATED_HEIGHT = 82;
const LIST_OVERSCAN_ITEMS = 10;
const GRID_ROW_ESTIMATED_HEIGHT = 300;
const GRID_OVERSCAN_ROWS = 3;
const ORGANIZE_SCROLL_REFRESH_COOLDOWN_MS = 12000;
const APPLE_PHOTOS_FALLBACK_REASON_LABELS: Record<
  ApplePhotosPhotoKitFallbackReason,
  string
> = {
  "not-macos": "this device is not macOS",
  "helper-unavailable": "helper missing or failed to compile",
  "access-denied": "Photos access denied",
  "runtime-failure": "helper runtime failure",
};

const getModifiedTimeMs = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const areFileItemsEqual = (a: FileItem, b: FileItem) =>
  a.path === b.path &&
  a.name === b.name &&
  a.size === b.size &&
  a.mediaType === b.mediaType &&
  a.isLivePhoto === b.isLivePhoto &&
  (a.album ?? null) === (b.album ?? null) &&
  getModifiedTimeMs(a.modified) === getModifiedTimeMs(b.modified);

const areFileListsEqual = (prev: FileItem[], next: FileItem[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!areFileItemsEqual(prev[i], next[i])) return false;
  }
  return true;
};

const areStringListsEqual = (prev: string[], next: string[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
};

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await mapper(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

const OrganizeSourceDropdown = ({
  value,
  onChange,
}: {
  value: OrganizeSourceFilter;
  onChange: (value: OrganizeSourceFilter) => void;
}) => {
  const [open, setOpen] = useState(false);

  const currentLabel =
    ORGANIZE_SOURCE_OPTIONS.find((item) => item.id === value)?.label ?? "All";
  const arrowPointsUp = !open;

  return (
    <div className="relative h-full shrink-0 flex items-center gap-1.5">
      <span className="text-[10px] leading-none text-white/50">Source</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 w-auto shrink-0 items-center gap-2 rounded-md border border-t-[rgba(255,255,255,0.09)] border-l-[rgba(22,22,28,0.94)] border-r-[rgba(22,22,28,0.94)] border-b-[rgba(8,8,12,0.98)] bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 pl-1.5 pr-2 text-[10.5px] leading-none text-white/75 transition-colors hover:text-white/90"
          >
            <span className="whitespace-nowrap">{currentLabel}</span>
            <span className="ml-0.5 flex items-center text-white/55">
              {arrowPointsUp ? (
                <ChevronUp
                  className="h-3 w-3"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  className="h-3 w-3"
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={6}
          className="z-[140] w-36 overflow-hidden rounded-lg border border-t-[rgba(255,255,255,0.09)] border-l-[rgba(22,22,28,0.94)] border-r-[rgba(22,22,28,0.94)] border-b-[rgba(8,8,12,0.98)] bg-neutral-950/88 p-1 shadow-xl shadow-black/70 outline-none backdrop-blur-2xl backdrop-saturate-150 data-[state=open]:animate-none data-[state=closed]:animate-none"
        >
          {ORGANIZE_SOURCE_OPTIONS.map((item) => {
            const isActive = value === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1 text-left text-[10px] transition-colors",
                  isActive
                    ? "bg-emerald-500/14 text-emerald-300"
                    : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <span>{item.label}</span>
                <span className="shrink-0">
                  {isActive ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2.3} />
                  ) : null}
                </span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
};

function MacZenGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(12 12) scale(1.06) translate(-12 -12)"
      >
        <polyline points="3.94 2 6.94 12.5 16.9 12.5" strokeWidth="2.22" />
        <line x1="9.5" y1="12.5" x2="7" y2="19.9" strokeWidth="1.88" />
        <line x1="15" y1="12.5" x2="17" y2="19.9" strokeWidth="1.88" />
        <line x1="4.2" y1="18.35" x2="3.2" y2="17.65" strokeWidth="2.1" />
        <line x1="19.8" y1="18.35" x2="20.8" y2="17.65" strokeWidth="2.1" />
        <path d="M4.2 18.35 Q12 23.55 19.8 18.35" strokeWidth="2.1" />
      </g>
    </svg>
  );
}

interface Suggestion {
  fileName: string;
  suggestedAlbum: string;
  reason: string;
  confidence?: string;
}

type UndoActionKind = "move" | "delete";

type PendingUndoAction = {
  id: number;
  kind: UndoActionKind;
  file: FileItem;
  isScreenshot: boolean;
  toAlbum?: string;
  movedPath?: string;
  origin: {
    screenshots: boolean;
    recordings: boolean;
    libraryScreenshots: boolean;
    libraryRecordings: boolean;
  };
};

function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [screenshots, setScreenshots] = useState<FileItem[]>([]);
  const [recordings, setRecordings] = useState<FileItem[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [libraryCounts, setLibraryCounts] = useState<{
    screenshots: number;
    recordings: number;
  }>({ screenshots: 0, recordings: 0 });
  const [libraryScreenshots, setLibraryScreenshots] = useState<FileItem[]>([]);
  const [libraryRecordings, setLibraryRecordings] = useState<FileItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterId>("library");
  const [selectedSubFilter, setSelectedSubFilter] = useState<
    "all" | "images" | "videos"
  >("all");
  const [selectedLibraryAlbum, setSelectedLibraryAlbum] = useState<
    string | null
  >(null);
  const [indexedSearchQuery, setIndexedSearchQuery] = useState("");
  const [indexedSearchResults, setIndexedSearchResults] = useState<
    IntelligenceSearchResult[]
  >([]);
  const [indexedSearchLoading, setIndexedSearchLoading] = useState(false);
  const [indexedSearchError, setIndexedSearchError] = useState<string | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] =
    useState<IntelligenceStoreStatus | null>(null);
  const [intelligenceJobs, setIntelligenceJobs] = useState<IntelligenceJob[]>([]);
  const [intelligenceStatusLoading, setIntelligenceStatusLoading] = useState(false);
  const [intelligenceStatusError, setIntelligenceStatusError] = useState<string | null>(null);
  const [rebuildingIntelligence, setRebuildingIntelligence] = useState(false);
  const [retryingFailedOcr, setRetryingFailedOcr] = useState(false);
  const [draggedMediaPath, setDraggedMediaPath] = useState<string | null>(null);
  const [draggedAlbumName, setDraggedAlbumName] = useState<string | null>(null);
  const [albumDropTarget, setAlbumDropTarget] = useState<string | null>(null);
  const [albumReorderTarget, setAlbumReorderTarget] =
    useState<AlbumReorderTarget | null>(null);
  const [albumOrder, setAlbumOrder] = useState<string[]>(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ALBUM_ORDER_STORAGE_KEY)
          : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((value) => normalizeAlbumName(String(value ?? "")))
        .filter((value): value is string => Boolean(value));
    } catch {
      return [];
    }
  });
  const [isAlbumsSidebarDragHover, setIsAlbumsSidebarDragHover] = useState(false);
  const [undoToast, setUndoToast] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const [albumContextMenu, setAlbumContextMenu] = useState<{
    albumName: string;
    x: number;
    y: number;
  } | null>(null);

  const [organizeSourceFilter, setOrganizeSourceFilter] =
    useState<OrganizeSourceFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "gallery">("grid");
  const [activeViewMode, setActiveViewMode] = useState<
    "grid" | "list" | "gallery"
  >("grid");
  const [organizing, setOrganizing] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<
      Suggestion & {
        filePath: string;
        isScreenshot: boolean;
        accepted: boolean;
        thumbnail?: string;
      }
    >
  >([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [windowFocused, setWindowFocused] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [galleryZoom, setGalleryZoom] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const albumContextMenuRef = useRef<HTMLDivElement>(null);
  const [scrollMetrics, setScrollMetrics] = useState({
    top: 0,
    height: 0,
    width: 0,
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const scrollGenerationRef = useRef(0);
  const isScrollingRef = useRef(false);
  const lastViewPerfLogAtRef = useRef(0);
  const [isWindowResizing, setIsWindowResizing] = useState(false);
  const resizeIdleTimerRef = useRef<number | null>(null);
  const isWindowResizingRef = useRef(false);
  const [zoomLevel, setZoomLevel] = useState(2); // 1 = large (1-2 cols), 2 = medium (2-3 cols), 3 = small (3-4 cols), 4 = tiny (4-5 cols)
  const [progress, setProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [cost, setCost] = useState<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    model: string;
  } | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    error: string;
    message: string;
    details: any;
  } | null>(null);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<
    "account" | "apple_photos" | "storage"
  >("account");
  useEffect(() => {
    const handleOpenSettings = () => {
      setSettingsTab("account");
      setShowSettings(true);
    };
    window.addEventListener("maczen-open-settings", handleOpenSettings);
    return () => {
      window.removeEventListener("maczen-open-settings", handleOpenSettings);
    };
  }, []);
  const [accountUser, setAccountUser] = useState<AuthUser | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<"sign_in" | "sign_up">(
    "sign_in",
  );
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountFirstName, setAccountFirstName] = useState("");
  const [accountLastName, setAccountLastName] = useState("");
  const [accountEntitlements, setAccountEntitlements] = useState(
    DEFAULT_ACCOUNT_ENTITLEMENTS,
  );
  const librarySourceIdentityRef = useRef<string>("");
  const hasLoadedLibraryRef = useRef(false);
  const undoActionIdRef = useRef(0);
  const pendingUndoRef = useRef<{
    action: PendingUndoAction;
    timerId: number;
  } | null>(null);
  const mediaDragOverlayRef = useRef<HTMLElement | null>(null);
  const mediaDragOverlayAnchorRef = useRef<{
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const mediaDragLastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const albumDropTargetRef = useRef<string | null>(null);
  const albumsSidebarDragHoverRef = useRef(false);
  const isIndexedSearchView =
    selectedFilter === "library" || selectedFilter === "organize";
  const trimmedIndexedSearchQuery = indexedSearchQuery.trim();
  const hasIndexedSearchQuery =
    isIndexedSearchView && trimmedIndexedSearchQuery.length > 0;

  const scrollRafRef = useRef<number | null>(null);

  const syncScrollMetrics = (element: HTMLDivElement | null) => {
    if (!element) return;
    const next = {
      top: element.scrollTop,
      height: element.clientHeight,
      width: element.clientWidth,
    };
    setScrollMetrics((prev) => (
      prev.top === next.top &&
      prev.height === next.height &&
      prev.width === next.width
        ? prev
        : next
    ));
  };

  const handleScroll = (event?: React.UIEvent<HTMLDivElement>) => {
    scrollGenerationRef.current += 1;
    lastUserScrollAtRef.current = Date.now();
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      setIsScrolling(true);
    }
    if (scrollIdleTimerRef.current) {
      window.clearTimeout(scrollIdleTimerRef.current);
    }
    scrollIdleTimerRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
      setIsScrolling(false);
    }, SCROLL_IDLE_DELAY_MS);
    // Throttle scroll metric updates to one per animation frame
    if (scrollRafRef.current === null) {
      const source = event?.currentTarget ?? scrollContainerRef.current;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        syncScrollMetrics(source);
      });
    }
  };

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    syncScrollMetrics(element);
    const observer = new ResizeObserver(() => {
      syncScrollMetrics(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewMode, selectedFilter]);

  useEffect(() => {
    return () => {
      if (scrollIdleTimerRef.current) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
      if (resizeIdleTimerRef.current) {
        window.clearTimeout(resizeIdleTimerRef.current);
      }
      if (pendingUndoRef.current) {
        window.clearTimeout(pendingUndoRef.current.timerId);
        pendingUndoRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (!isWindowResizingRef.current) {
        isWindowResizingRef.current = true;
        setIsWindowResizing(true);
      }
      if (resizeIdleTimerRef.current) {
        window.clearTimeout(resizeIdleTimerRef.current);
      }
      resizeIdleTimerRef.current = window.setTimeout(() => {
        isWindowResizingRef.current = false;
        setIsWindowResizing(false);
      }, 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeIdleTimerRef.current) {
        window.clearTimeout(resizeIdleTimerRef.current);
      }
    };
  }, []);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [applePhotosImporting, setApplePhotosImporting] = useState(false);
  const [applePhotosImportStatus, setApplePhotosImportStatus] = useState<
    string | null
  >(null);
  const [applePhotosImportProgress, setApplePhotosImportProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);
  const [applePhotosLookbackInput, setApplePhotosLookbackInput] =
    useState("30");
  const [showCaptureMode, setShowCaptureMode] = useState(false);

  // Use refs to avoid re-registering listeners on every file scan
  const screenshotsRef = useRef<FileItem[]>([]);
  const recordingsRef = useRef<FileItem[]>([]);
  const albumsRef = useRef<string[]>([]);
  const libraryScreenshotsRef = useRef<FileItem[]>([]);
  const libraryRecordingsRef = useRef<FileItem[]>([]);
  const fileByPathRef = useRef<Map<string, FileItem>>(new Map());
  const loadingRef = useRef(true);
  const draggedMediaPathRef = useRef<string | null>(null);
  const lastUserScrollAtRef = useRef(0);
  const isScanningRef = useRef(false);
  const organizeCancelledRef = useRef(false);
  const applePhotosGotProgressRef = useRef(false);

  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  useEffect(() => {
    albumsRef.current = albums;
  }, [albums]);

  useEffect(() => {
    libraryScreenshotsRef.current = libraryScreenshots;
  }, [libraryScreenshots]);

  useEffect(() => {
    libraryRecordingsRef.current = libraryRecordings;
  }, [libraryRecordings]);

  useEffect(() => {
    const map = new Map<string, FileItem>();
    for (const file of screenshots) map.set(file.path, file);
    for (const file of recordings) map.set(file.path, file);
    for (const file of libraryScreenshots) {
      if (!map.has(file.path)) map.set(file.path, file);
    }
    for (const file of libraryRecordings) {
      if (!map.has(file.path)) map.set(file.path, file);
    }
    fileByPathRef.current = map;
  }, [screenshots, recordings, libraryScreenshots, libraryRecordings]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    draggedMediaPathRef.current = draggedMediaPath;
  }, [draggedMediaPath]);

  const refreshAccountState = async () => {
    setAccountLoading(true);
    try {
      const response = await fetch(`${API_SERVER_URL}/api/account/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        setAccountUser(null);
        setAccountEntitlements(DEFAULT_ACCOUNT_ENTITLEMENTS);
        return;
      }
      const data = (await response.json()) as {
        user: AuthUser | null;
        entitlements?: Partial<AccountEntitlements>;
      };
      setAccountUser(data.user || null);
      setAccountEntitlements({
        ...DEFAULT_ACCOUNT_ENTITLEMENTS,
        ...(data.entitlements || {}),
      });
    } catch {
      setAccountUser(null);
      setAccountEntitlements(DEFAULT_ACCOUNT_ENTITLEMENTS);
    } finally {
      setAccountLoading(false);
    }
  };

  useEffect(() => {
    void refreshAccountState();
  }, []);

  useEffect(() => {
    if (!window.electronAPI) {
      setSettingsLoading(false);
      return;
    }

    let active = true;
    setSettingsLoading(true);
    window.electronAPI
      .getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setApplePhotosLookbackInput(String(data.applePhotosLookbackDays || 30));
      })
      .catch(() => {
        if (!active) return;
        setSettingsError("Failed to load settings");
      })
      .finally(() => {
        if (active) setSettingsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (settings) {
      setApplePhotosLookbackInput(
        String(settings.applePhotosLookbackDays || 30),
      );
    }
  }, [settings?.applePhotosLookbackDays]);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getTheme().then(setTheme);
    window.electronAPI.onThemeChanged(setTheme);

    // Track window focus
    const handleFocus = () => setWindowFocused(true);
    const handleBlur = () => setWindowFocused(false);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    // Listen for streaming progress
    const cleanupProgress = window.electronAPI.onAutoOrganizeProgress(
      (data) => {
        // Ignore results if user cancelled
        if (organizeCancelledRef.current) return;

        // Update phase message for better feedback
        if (data.phaseMessage) {
          setPhaseMessage(data.phaseMessage);
        }

        // Update progress and cost even if no suggestions yet
        if (data.progress) {
          setProgress(data.progress);
        }
        if (data.cost) {
          setCost(data.cost);
        }

        if (data.suggestions && data.suggestions.length > 0) {
          const allFiles = [
            ...screenshotsRef.current,
            ...recordingsRef.current,
          ];
          const suggestionsWithPaths = data.suggestions.map((s: any) => {
            const file = allFiles.find((f) => f.name === s.fileName);
            return {
              ...s,
              suggestedAlbum:
                s.suggestedAlbum || s.suggestedProject || "Inbox",
              filePath: file?.path || "",
              isScreenshot: file
                ? screenshotsRef.current.includes(file)
                : false,
              accepted: true,
            };
          });
          setSuggestions(suggestionsWithPaths);
        }

        if (data.complete) {
          setPhaseMessage(null);
          setShowConfirmation(true);
        }
      },
    );

    const cleanupApplePhotosProgress =
      window.electronAPI.onApplePhotosImportProgress((data) => {
        applePhotosGotProgressRef.current = true;
        if (data.photoKitFallbackReason) {
          setApplePhotosImportStatus(
            `PhotoKit unavailable: ${APPLE_PHOTOS_FALLBACK_REASON_LABELS[data.photoKitFallbackReason]}. Querying Photos directly…`,
          );
        } else {
          setApplePhotosImportStatus(data.message);
        }
        // Avoid stale determinate progress during "query"/"parse"/"save" phases.
        setApplePhotosImportProgress(
          data.phase === "index" && data.progress ? data.progress : null,
        );
      });

    // Listen for errors
    const cleanupError = window.electronAPI.onAutoOrganizeError((error) => {
      setErrorDetails(error);
      setOrganizing(false);
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      cleanupProgress();
      cleanupApplePhotosProgress();
      cleanupError();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    if (selectedFilter === "library") return;
    void scanFiles();
  }, [selectedFilter]);

  useEffect(() => {
    if (!isIndexedSearchView) {
      setIndexedSearchLoading(false);
      setIndexedSearchError(null);
      setIndexedSearchResults([]);
      return;
    }
    if (!trimmedIndexedSearchQuery || !window.electronAPI) {
      setIndexedSearchLoading(false);
      setIndexedSearchError(null);
      setIndexedSearchResults([]);
      return;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      setIndexedSearchLoading(true);
      setIndexedSearchError(null);
      try {
        const nextResults = await window.electronAPI.searchIntelligenceMedia({
          query: trimmedIndexedSearchQuery,
          album: selectedFilter === "library" ? selectedLibraryAlbum : null,
          limit: 2000,
        });
        if (!cancelled) {
          setIndexedSearchResults(nextResults);
        }
      } catch (error) {
        if (!cancelled) {
          setIndexedSearchResults([]);
          setIndexedSearchError(
            error instanceof Error ? error.message : "Search is unavailable right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setIndexedSearchLoading(false);
        }
      }
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [
    isIndexedSearchView,
    selectedFilter,
    selectedLibraryAlbum,
    trimmedIndexedSearchQuery,
  ]);

  const refreshIntelligenceStatus = useCallback(async () => {
    if (!window.electronAPI) {
      setIntelligenceStatus(null);
      setIntelligenceJobs([]);
      setIntelligenceStatusError(null);
      setIntelligenceStatusLoading(false);
      return;
    }

    setIntelligenceStatusLoading(true);
    try {
      const [status, jobs] = await Promise.all([
        window.electronAPI.getIntelligenceStatus(),
        window.electronAPI.listIntelligenceJobs(6),
      ]);
      setIntelligenceStatus(status);
      setIntelligenceJobs(jobs);
      setIntelligenceStatusError(null);
    } catch (error) {
      setIntelligenceStatusError(
        error instanceof Error ? error.message : "Failed to load indexing status.",
      );
    } finally {
      setIntelligenceStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshIntelligenceStatus();
    if (!window.electronAPI) return;

    const timer = window.setInterval(() => {
      void refreshIntelligenceStatus();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [refreshIntelligenceStatus]);

  // Auto-refresh based on window focus
  useEffect(() => {
    if (!window.electronAPI) return;

    const interval = windowFocused ? 30050 : 120000; // 30s when focused, 2min when not
    const timer = setInterval(() => {
      if (selectedFilter === "library") return;
      if (isScrollingRef.current || isWindowResizingRef.current || draggedMediaPathRef.current) {
        return;
      }
      const scrollCooldownMs =
        selectedFilter === "organize"
          ? ORGANIZE_SCROLL_REFRESH_COOLDOWN_MS
          : 1200;
      if (Date.now() - lastUserScrollAtRef.current < scrollCooldownMs) {
        return;
      }
      void scanFiles();
    }, interval);

    return () => clearInterval(timer);
  }, [windowFocused, selectedFilter]);

  // Load thumbnails for suggestions
  useEffect(() => {
    if (!window.electronAPI) return;

    const loadThumbnails = async () => {
      const updated = await mapWithConcurrency(
        suggestions,
        4,
        async (s) => {
          if (s.thumbnail || !s.filePath) return s;
          try {
            const thumb = s.isScreenshot
              ? await window.electronAPI.getFileDataUrl(s.filePath)
              : await window.electronAPI.generateVideoThumbnail(s.filePath);
            return { ...s, thumbnail: thumb || undefined };
          } catch {
            return s;
          }
        },
      );
      // Only update if thumbnails were actually loaded
      if (updated.some((s, i) => s.thumbnail !== suggestions[i].thumbnail)) {
        setSuggestions(updated);
      }
    };
    if (
      suggestions.length > 0 &&
      suggestions.some((s) => !s.thumbnail && s.filePath)
    ) {
      loadThumbnails();
    }
  }, [suggestions]);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const scanFiles = useCallback(async () => {
    // Prevent concurrent scans
    if (isScanningRef.current || !window.electronAPI) {
      return;
    }

    isScanningRef.current = true;
    const scanStartedAt = performance.now();
    let ipcDurationMs = 0;

    const wasLoading = loadingRef.current;
    const hasExistingData =
      screenshotsRef.current.length > 0 || recordingsRef.current.length > 0;

    if (hasExistingData) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const ipcStartedAt = performance.now();
      const [filesResult, albumsResult] = await Promise.all([
        window.electronAPI.scanFiles(),
        window.electronAPI.getAlbums(),
      ]);
      ipcDurationMs = performance.now() - ipcStartedAt;

      const screenshotsChanged = !areFileListsEqual(
        screenshotsRef.current,
        filesResult.screenshots,
      );
      const recordingsChanged = !areFileListsEqual(
        recordingsRef.current,
        filesResult.recordings,
      );
      const albumsChanged = !areStringListsEqual(albumsRef.current, albumsResult);
      const shouldRestoreAfterScan =
        !wasLoading && (screenshotsChanged || recordingsChanged || albumsChanged);

      setScreenshots((prev) =>
        areFileListsEqual(prev, filesResult.screenshots) ? prev : filesResult.screenshots,
      );
      setRecordings((prev) =>
        areFileListsEqual(prev, filesResult.recordings) ? prev : filesResult.recordings,
      );
      setAlbums((prev) =>
        areStringListsEqual(prev, albumsResult) ? prev : albumsResult,
      );

      const totalMs = performance.now() - scanStartedAt;
      console.debug(
        `[perf] scanFiles total ${totalMs.toFixed(1)}ms (ipc ${ipcDurationMs.toFixed(1)}ms, files ${filesResult.screenshots.length + filesResult.recordings.length}, changed=${shouldRestoreAfterScan})`,
      );
    } catch (error) {
      console.error("Error scanning files:", error);
    } finally {
      void refreshIntelligenceStatus();
      setLoading(false);
      setIsRefreshing(false);
      isScanningRef.current = false;
    }
  }, [refreshIntelligenceStatus]);

  const updateSettings = async (updates: Partial<AppSettings>) => {
    if (!window.electronAPI) return null;
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const next = await window.electronAPI.updateSettings(updates);
      setSettings(next);
      return next;
    } catch (error) {
      setSettingsError("Failed to save settings");
      return null;
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleToggleApplePhotos = async () => {
    if (!settings) return;
    const next = await updateSettings({
      applePhotosEnabled: !settings.applePhotosEnabled,
    });
    if (next) {
      if (next.applePhotosEnabled) {
        void startApplePhotosSync();
      }
      scanFiles();
    }
  };

  const handleApplePhotosLookbackCommit = async () => {
    const value = Number(applePhotosLookbackInput);
    if (!Number.isFinite(value)) return;
    await updateSettings({ applePhotosLookbackDays: value });
  };

  const applePhotosSyncInFlightRef = useRef(false);
  const startApplePhotosSync = async () => {
    if (!window.electronAPI) return;
    if (applePhotosSyncInFlightRef.current) return;
    // Avoid repeated sync triggers during dev hot-reloads.
    const lastAttemptRaw = localStorage.getItem(
      "maczen:applePhotosLastSyncAttemptAt",
    );
    const lastAttempt = lastAttemptRaw ? Number(lastAttemptRaw) : 0;
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 60_000) {
      return;
    }
    localStorage.setItem(
      "maczen:applePhotosLastSyncAttemptAt",
      String(Date.now()),
    );
    applePhotosSyncInFlightRef.current = true;
    setApplePhotosImporting(true);
    setApplePhotosImportStatus(null);
    setApplePhotosImportProgress(null);
    applePhotosGotProgressRef.current = false;
    try {
      const result = await window.electronAPI.importApplePhotos();
      if (!result.success && !applePhotosGotProgressRef.current) {
        setApplePhotosImportStatus(
          result.cancelled
            ? "Apple Photos sync interrupted (app restarted)."
            : result.error || "Apple Photos sync failed",
        );
      }
      await scanFiles();
    } finally {
      setApplePhotosImporting(false);
      applePhotosSyncInFlightRef.current = false;
    }
  };

  const handleApplePhotosSyncNow = async () => {
    if (!window.electronAPI) return;
    applePhotosSyncInFlightRef.current = true;
    setApplePhotosImporting(true);
    setApplePhotosImportStatus(null);
    setApplePhotosImportProgress(null);
    applePhotosGotProgressRef.current = false;
    try {
      const result = await window.electronAPI.importApplePhotos({
        force: true,
      });
      if (!result.success && !applePhotosGotProgressRef.current) {
        setApplePhotosImportStatus(
          result.cancelled
            ? "Apple Photos sync interrupted (app restarted)."
            : result.error || "Apple Photos sync failed",
        );
      }
      await scanFiles();
    } finally {
      setApplePhotosImporting(false);
      applePhotosSyncInFlightRef.current = false;
      localStorage.setItem(
        "maczen:applePhotosLastSyncAttemptAt",
        String(Date.now()),
      );
    }
  };

  useEffect(() => {
    if (!settings?.applePhotosEnabled) return;
    // Sync automatically when Photos integration is enabled or lookback changes.
    void startApplePhotosSync();
  }, [settings?.applePhotosEnabled, settings?.applePhotosLookbackDays]);

  const handleSelectIcloudPath = async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.selectDirectory({
      title: "Choose iCloud destination",
      defaultPath: settings?.icloudDestinationPath || undefined,
    });
    if (!result.cancelled && result.path) {
      await updateSettings({
        icloudDestinationPath: result.path,
        useIcloudDestination: true,
      });
      await scanFiles();
    }
  };

  const handleToggleIcloudDestination = async () => {
    if (!settings) return;
    if (!settings.useIcloudDestination) {
      if (!settings.icloudDestinationPath) {
        await handleSelectIcloudPath();
        return;
      }
      await updateSettings({ useIcloudDestination: true });
      await scanFiles();
      return;
    }
    await updateSettings({ useIcloudDestination: false });
    await scanFiles();
  };

  const removeFileFromState = (filePath: string) => {
    setScreenshots((prev) => prev.filter((f) => f.path !== filePath));
    setRecordings((prev) => prev.filter((f) => f.path !== filePath));
    setLibraryScreenshots((prev) => prev.filter((f) => f.path !== filePath));
    setLibraryRecordings((prev) => prev.filter((f) => f.path !== filePath));
  };

  const getFileNameFromPath = (filePath: string) => {
    const normalized = filePath.replace(/\\/g, "/");
    const name = normalized.split("/").pop();
    return name && name.length > 0 ? name : filePath;
  };

  const restoreFileInState = (action: PendingUndoAction, file?: FileItem) => {
    const restoredFile = file ?? action.file;
    if (action.origin.screenshots) {
      setScreenshots((prev) =>
        prev.some((item) => item.path === restoredFile.path)
          ? prev
          : [restoredFile, ...prev],
      );
    }
    if (action.origin.recordings) {
      setRecordings((prev) =>
        prev.some((item) => item.path === restoredFile.path)
          ? prev
          : [restoredFile, ...prev],
      );
    }
    if (action.origin.libraryScreenshots) {
      setLibraryScreenshots((prev) =>
        prev.some((item) => item.path === restoredFile.path)
          ? prev
          : [restoredFile, ...prev],
      );
    }
    if (action.origin.libraryRecordings) {
      setLibraryRecordings((prev) =>
        prev.some((item) => item.path === restoredFile.path)
          ? prev
          : [restoredFile, ...prev],
      );
    }
  };

  const commitPendingUndoAction = async (action: PendingUndoAction) => {
    if (action.kind === "move") {
      // Move commits immediately now; timeout just dismisses undo.
      return;
    }

    const result = await window.electronAPI.deleteFile(action.file.path);
    if (result.success) {
      if (action.origin.libraryScreenshots || action.origin.libraryRecordings) {
        setLibraryRefreshKey((prev) => prev + 1);
      }
      return;
    }
    restoreFileInState(action);
    alert(`Failed to delete file: ${result.error}`);
  };

  const undoPendingUndoAction = async (action: PendingUndoAction) => {
    if (action.kind === "move") {
      const result = await window.electronAPI.undoMoveFile(
        action.file.path,
        action.movedPath || action.file.path,
        action.isScreenshot,
      );
      if (!result.success) {
        alert(`Failed to undo move: ${result.error}`);
        return;
      }
      const restoredPath = result.destPath || action.file.path;
      const restoredFile: FileItem =
        restoredPath === action.file.path
          ? action.file
          : {
              ...action.file,
              path: restoredPath,
              name: getFileNameFromPath(restoredPath),
            };
      restoreFileInState(action, restoredFile);
      if (action.origin.libraryScreenshots || action.origin.libraryRecordings) {
        setLibraryRefreshKey((prev) => prev + 1);
      }
      return;
    }

    restoreFileInState(action);
  };

  const flushPendingUndo = (mode: "commit" | "undo") => {
    const pending = pendingUndoRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timerId);
    pendingUndoRef.current = null;
    setUndoToast((prev) => (prev?.id === pending.action.id ? null : prev));
    if (mode === "undo") {
      void undoPendingUndoAction(pending.action);
      return;
    }
    void commitPendingUndoAction(pending.action);
  };

  const queueUndoAction = (action: PendingUndoAction, message: string) => {
    flushPendingUndo("commit");
    const timerId = window.setTimeout(() => {
      const pending = pendingUndoRef.current;
      if (!pending || pending.action.id !== action.id) return;
      pendingUndoRef.current = null;
      setUndoToast((prev) => (prev?.id === action.id ? null : prev));
      void commitPendingUndoAction(action);
    }, UNDO_TOAST_DURATION_MS);
    pendingUndoRef.current = { action, timerId };
    setUndoToast({ id: action.id, message });
  };

  const handleUndoToastAction = () => {
    flushPendingUndo("undo");
  };

  const handleFileMove = async (
    filePath: string,
    albumName: string,
    isScreenshot: boolean,
  ) => {
    const normalizedAlbum = normalizeAlbumName(albumName);
    if (!normalizedAlbum) {
      alert("Album name is required.");
      return;
    }
    const sourceFile = fileByPathRef.current.get(filePath);
    if (!sourceFile) {
      alert("File not found.");
      return;
    }
    const result = await window.electronAPI.moveFile(
      sourceFile.path,
      normalizedAlbum,
      isScreenshot,
    );
    if (!result.success) {
      alert(`Failed to move file: ${result.error}`);
      return;
    }

    const action: PendingUndoAction = {
      id: ++undoActionIdRef.current,
      kind: "move",
      file: sourceFile,
      isScreenshot,
      toAlbum: normalizedAlbum,
      movedPath: result.destPath || sourceFile.path,
      origin: {
        screenshots: screenshotsRef.current.some((file) => file.path === filePath),
        recordings: recordingsRef.current.some((file) => file.path === filePath),
        libraryScreenshots: libraryScreenshotsRef.current.some(
          (file) => file.path === filePath,
        ),
        libraryRecordings: libraryRecordingsRef.current.some(
          (file) => file.path === filePath,
        ),
      },
    };
    removeFileFromState(filePath);
    if (action.origin.libraryScreenshots || action.origin.libraryRecordings) {
      setLibraryRefreshKey((prev) => prev + 1);
    }
    const normalizedAlbumParts = normalizedAlbum.split("/").filter(Boolean);
    const targetAlbumLabel =
      normalizedAlbumParts[normalizedAlbumParts.length - 1] || normalizedAlbum;
    queueUndoAction(action, `Moved to ${targetAlbumLabel}`);
  };

  const handleNewAlbum = async (albumName: string) => {
    const name = normalizeAlbumName(albumName);
    if (!name) return;
    if (!albums.includes(name)) {
      const result = await window.electronAPI.createAlbum(name);
      if (!result.success) {
        alert(`Failed to create album: ${result.error}`);
        return;
      }
      setAlbums((prev) =>
        prev.includes(name) ? prev : [...prev, name].sort(),
      );
      setLibraryRefreshKey((prev) => prev + 1);
    }
  };

  const handleFileDelete = async (filePath: string) => {
    const sourceFile = fileByPathRef.current.get(filePath);
    if (!sourceFile) {
      alert("File not found.");
      return;
    }
    const action: PendingUndoAction = {
      id: ++undoActionIdRef.current,
      kind: "delete",
      file: sourceFile,
      isScreenshot: isScreenshot(sourceFile),
      origin: {
        screenshots: screenshotsRef.current.some((file) => file.path === filePath),
        recordings: recordingsRef.current.some((file) => file.path === filePath),
        libraryScreenshots: libraryScreenshotsRef.current.some(
          (file) => file.path === filePath,
        ),
        libraryRecordings: libraryRecordingsRef.current.some(
          (file) => file.path === filePath,
        ),
      },
    };
    removeFileFromState(filePath);
    queueUndoAction(action, "Deleted item");
  };

  const handleRenameFile = async (filePath: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      alert("File name is required.");
      return;
    }
    const result = await window.electronAPI.renameFile(filePath, trimmedName);
    if (!result.success || !result.destPath) {
      alert(`Failed to rename file: ${result.error || "Unknown error"}`);
      return;
    }

    const nextName = result.fileName || trimmedName;
    const updateItems = (items: FileItem[]) =>
      items.map((item) =>
        item.path === filePath
          ? {
              ...item,
              path: result.destPath as string,
              name: nextName,
            }
          : item,
      );

    setScreenshots((prev) => updateItems(prev));
    setRecordings((prev) => updateItems(prev));
    setLibraryScreenshots((prev) => updateItems(prev));
    setLibraryRecordings((prev) => updateItems(prev));

    if (draggedMediaPath === filePath) {
      setDraggedMediaPath(result.destPath);
    }
  };

  const handleRevealInFinder = async (filePath: string) => {
    const result = await window.electronAPI.revealInFinder(filePath);
    if (!result.success && result.error) {
      alert(result.error);
    }
  };

  const handleRenameAlbum = async (oldName: string, newName: string) => {
    const normalizedOld = normalizeAlbumName(oldName);
    const normalizedNew = normalizeAlbumName(newName);
    if (normalizedOld === normalizedNew || !normalizedNew) return;
    if (albums.includes(normalizedNew)) {
      alert(`Album "${normalizedNew}" already exists`);
      return;
    }
    const result = await window.electronAPI.renameAlbum(
      normalizedOld,
      normalizedNew,
    );
    if (result.success) {
      setAlbums((prev) => {
        const renamed = prev.map((album) => {
          if (album === normalizedOld) return normalizedNew;
          if (album.startsWith(`${normalizedOld}/`)) {
            return `${normalizedNew}${album.slice(normalizedOld.length)}`;
          }
          return album;
        });
        return Array.from(new Set(renamed)).sort();
      });
      setSelectedLibraryAlbum((prev) => {
        if (!prev) return prev;
        if (prev === normalizedOld) return normalizedNew;
        if (prev.startsWith(`${normalizedOld}/`)) {
          return `${normalizedNew}${prev.slice(normalizedOld.length)}`;
        }
        return prev;
      });
      setLibraryRefreshKey((prev) => prev + 1);
    } else {
      alert(`Failed to rename album: ${result.error}`);
    }
  };

  const handleDeleteAlbum = async (albumName: string) => {
    const name = normalizeAlbumName(albumName);
    if (!name || !window.electronAPI) return;
    const result = await window.electronAPI.deleteAlbum(name);
    if (!result.success) {
      alert(`Failed to delete album: ${result.error}`);
      return;
    }
    try {
      const albumsResult = await window.electronAPI.getAlbums();
      setAlbums(albumsResult);
    } catch {}
    setLibraryRefreshKey((prev) => prev + 1);
  };
  void handleDeleteAlbum;

  const handleAccountSubmit = async () => {
    const email = accountEmail.trim().toLowerCase();
    if (!email || !accountPassword) {
      setAccountError("Email and password are required.");
      return;
    }

    setAccountSubmitting(true);
    setAccountError(null);
    try {
      const endpoint =
        accountMode === "sign_in"
          ? "/api/auth/sign-in/email"
          : "/api/auth/sign-up/email";
      const payload =
        accountMode === "sign_in"
          ? { email, password: accountPassword }
          : {
              email,
              password: accountPassword,
              name: `${accountFirstName} ${accountLastName}`.trim() || email,
              firstName: accountFirstName.trim() || undefined,
              lastName: accountLastName.trim() || undefined,
            };
      const response = await fetch(`${API_SERVER_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = "Authentication failed";
        try {
          const data = (await response.json()) as { message?: string; error?: string };
          message = data.message || data.error || message;
        } catch {}
        throw new Error(message);
      }
      setAccountPassword("");
      void refreshAccountState();
    } catch (error) {
      setAccountError(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleAccountSignOut = async () => {
    setAccountSubmitting(true);
    setAccountError(null);
    try {
      await fetch(`${API_SERVER_URL}/api/auth/sign-out`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    setAccountSubmitting(false);
    setAccountUser(null);
    setAccountEntitlements(DEFAULT_ACCOUNT_ENTITLEMENTS);
    setAccountPassword("");
  };

  const handleAutoOrganize = async () => {
    if (!accountUser) {
      setSettingsTab("account");
      setAccountError("Sign in to use AI organization.");
      setShowSettings(true);
      return;
    }
    if (!accountEntitlements.aiOrganization) {
      setSettingsTab("account");
      setShowSettings(true);
      return;
    }
    setSelectedFilter("organize");

    organizeCancelledRef.current = false; // Reset cancellation flag
    setOrganizing(true);
    setSuggestions([]);
    setProgress(null);
    setCost(null);
    setShowConfirmation(true); // Open modal immediately to show streaming progress

    try {
      const allFiles = [...screenshots, ...recordings];
      if (allFiles.length === 0) {
        alert("No files to organize!");
        setShowConfirmation(false);
        return;
      }

      const filesToOrganize = allFiles.map((f) => ({
        path: f.path,
        name: f.name,
        isScreenshot: screenshotPaths.has(f.path),
      }));

      const result = await window.electronAPI.autoOrganize(filesToOrganize);

      if (!result.success) {
        // Error details will be shown via the auto-organize-error event listener
        // Don't close the modal so user can see progress/cost data
        console.error("Auto-organize failed:", result.error);
      }
      // Success case is handled by the streaming listener
    } catch (error) {
      console.error("Error organizing:", error);
      // Error details will be shown via the auto-organize-error event listener
    } finally {
      setOrganizing(false);
    }
  };

  const handleCancelOrganize = async () => {
    organizeCancelledRef.current = true;
    // Cancel the backend request immediately
    await window.electronAPI.cancelAutoOrganize();
    setShowConfirmation(false);
    setOrganizing(false);
    setSuggestions([]);
    setProgress(null);
  };

  const handleAcceptSuggestions = async () => {
    const acceptedSuggestions = suggestions.filter((s) => s.accepted);

    for (const suggestion of acceptedSuggestions) {
      await handleFileMove(
        suggestion.filePath,
        suggestion.suggestedAlbum,
        suggestion.isScreenshot,
      );
    }

    setShowConfirmation(false);
    setSuggestions([]);
    await scanFiles();
  };

  const toggleSuggestion = (fileName: string) => {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.fileName === fileName ? { ...s, accepted: !s.accepted } : s,
      ),
    );
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.max(1, prev - 1));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.min(4, prev + 1));
  };

  const getGridColumns = () => {
    // Returns Tailwind grid-cols classes based on zoom level
    switch (zoomLevel) {
      case 1: // Large
        return "grid-cols-1 sm:grid-cols-2";
      case 2: // Medium (default)
        return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
      case 3: // Small
        return "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4";
      case 4: // Tiny
        return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
      default:
        return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
    }
  };

  const getCardScale = () => {
    // Returns scale factor based on zoom level
    switch (zoomLevel) {
      case 1:
        return 1.1; // Largest
      case 2:
        return 1.0; // Default
      case 3:
        return 0.92; // Smaller
      case 4:
        return 0.85; // Smallest
      default:
        return 1.0;
    }
  };

  const getGridColumnCount = () => {
    const w = scrollMetrics.width || (typeof window !== "undefined" ? window.innerWidth : 1280);
    switch (zoomLevel) {
      case 1: return w >= 640 ? 2 : 1;
      case 2: return w >= 1280 ? 3 : w >= 640 ? 2 : 1;
      case 3: return w >= 1280 ? 4 : w >= 640 ? 3 : 2;
      case 4: return w >= 1280 ? 5 : w >= 1024 ? 4 : w >= 640 ? 3 : 2;
      default: return w >= 1280 ? 3 : w >= 640 ? 2 : 1;
    }
  };

  const switchViewMode = (
    nextMode: "grid" | "list" | "gallery",
    options?: { immediate?: boolean },
  ) => {
    setActiveViewMode(nextMode);
    if (options?.immediate || nextMode === "gallery") {
      setViewMode(nextMode);
      return;
    }
    setViewMode(nextMode);
  };

  const handleCloseGallery = () => {
    setGalleryIndex(null);
    switchViewMode("grid");
    setGalleryZoom(1);
  };

  const allFiles = useMemo(
    () => [...screenshots, ...recordings],
    [screenshots, recordings],
  );

  const organizedBaseDirLabel = useMemo(() => {
    if (!settings) return "";
    if (settings.useIcloudDestination && settings.icloudDestinationPath) {
      return settings.icloudDestinationPath.endsWith("/MacZen")
        ? settings.icloudDestinationPath
        : `${settings.icloudDestinationPath}/MacZen`;
    }
    return "~/Documents/MacZen";
  }, [settings]);

  const librarySourceIdentity = useMemo(() => {
    if (!settings) return "";
    return `${settings.useIcloudDestination ? "icloud" : "local"}:${settings.icloudDestinationPath || ""}`;
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    const refreshLibraryCounts = async () => {
      if (!window.electronAPI) return;
      const sourceChanged =
        librarySourceIdentityRef.current !== librarySourceIdentity;
      const shouldShowLoading = !hasLoadedLibraryRef.current || sourceChanged;
      if (shouldShowLoading) {
        setLibraryLoading(true);
      }
      try {
        const organized = await window.electronAPI.scanOrganizedFiles();
        const nextScreenshots: FileItem[] = [];
        const nextRecordings: FileItem[] = [];
        for (const p of organized) {
          nextScreenshots.push(
            ...p.screenshots.map((file) => ({ ...file, album: p.album })),
          );
          nextRecordings.push(
            ...p.recordings.map((file) => ({ ...file, album: p.album })),
          );
        }
        if (cancelled) return;
        const screenshotCount = nextScreenshots.length;
        const recordingCount = nextRecordings.length;
        setLibraryScreenshots((prev) =>
          areFileListsEqual(prev, nextScreenshots) ? prev : nextScreenshots,
        );
        setLibraryRecordings((prev) =>
          areFileListsEqual(prev, nextRecordings) ? prev : nextRecordings,
        );
        setLibraryCounts((prev) => (
          prev.screenshots === screenshotCount && prev.recordings === recordingCount
            ? prev
            : {
                screenshots: screenshotCount,
                recordings: recordingCount,
              }
        ));
      } catch {
        if (cancelled) return;
        setLibraryScreenshots([]);
        setLibraryRecordings([]);
        setLibraryCounts({ screenshots: 0, recordings: 0 });
      } finally {
        if (!cancelled) {
          setLibraryLoading(false);
          hasLoadedLibraryRef.current = true;
          librarySourceIdentityRef.current = librarySourceIdentity;
        }
      }
    };

    void refreshLibraryCounts();
    return () => {
      cancelled = true;
    };
  }, [librarySourceIdentity, libraryRefreshKey]);

  // O(1) lookup for fallback screenshot check instead of O(n) includes()
  const screenshotPaths = useMemo(
    () => new Set(screenshots.map((s) => s.path)),
    [screenshots],
  );
  const isScreenshot = useMemo(
    () => (file: FileItem) =>
      file.mediaType
        ? file.mediaType === "screenshot"
        : screenshotPaths.has(file.path),
    [screenshotPaths],
  );
  const allLibraryFiles = useMemo(
    () => [...libraryScreenshots, ...libraryRecordings],
    [libraryScreenshots, libraryRecordings],
  );
  const organizedIndex = useMemo(() => {
    const paths = new Set<string>();
    const signatures = new Set<string>();
    for (const file of allLibraryFiles) {
      paths.add(file.path);
      if (file.size > 0) {
        signatures.add(`${file.name}::${file.size}`);
      }
    }
    return { paths, signatures };
  }, [allLibraryFiles]);
  const organizeIndexLoading = selectedFilter === "organize" && libraryLoading;
  const indexedSearchScoresByPath = useMemo(() => {
    const map = new Map<string, number>();
    for (const result of indexedSearchResults) {
      const existing = map.get(result.item.path);
      if (existing === undefined || result.score > existing) {
        map.set(result.item.path, result.score);
      }
    }
    return map;
  }, [indexedSearchResults]);
  const albumCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of allLibraryFiles) {
      const albumName = file.album?.trim();
      if (!albumName) continue;
      counts.set(albumName, (counts.get(albumName) ?? 0) + 1);
    }
    return counts;
  }, [allLibraryFiles]);
  const availableAlbums = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const album of albums) {
      const normalized = String(album ?? "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
    for (const album of albumCounts.keys()) {
      const normalized = String(album ?? "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
    return merged;
  }, [albums, albumCounts]);
  const sortedAlbums = useMemo(() => {
    const availableSet = new Set(availableAlbums);
    const prioritized = albumOrder.filter((albumName) =>
      availableSet.has(albumName),
    );
    const prioritizedSet = new Set(prioritized);
    const remainder = availableAlbums
      .filter((albumName) => !prioritizedSet.has(albumName))
      .sort((a, b) => a.localeCompare(b));
    return [...prioritized, ...remainder];
  }, [availableAlbums, albumOrder]);
  useEffect(() => {
    setAlbumOrder((prev) => {
      const availableSet = new Set(availableAlbums);
      const kept = prev.filter((albumName) => availableSet.has(albumName));
      const keptSet = new Set(kept);
      const appended = availableAlbums
        .filter((albumName) => !keptSet.has(albumName))
        .sort((a, b) => a.localeCompare(b));
      const next = [...kept, ...appended];
      if (
        prev.length === next.length &&
        prev.every((albumName, index) => albumName === next[index])
      ) {
        return prev;
      }
      return next;
    });
  }, [availableAlbums]);
  useEffect(() => {
    try {
      window.localStorage.setItem(ALBUM_ORDER_STORAGE_KEY, JSON.stringify(albumOrder));
    } catch {}
  }, [albumOrder]);
  const getAlbumDepth = (name: string) =>
    Math.max(0, name.split("/").filter(Boolean).length - 1);
  const getAlbumLabel = (name: string) => {
    const parts = name.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? name;
  };
  const albumMatchesSelection = (albumName: string, selectedAlbum: string) =>
    albumName === selectedAlbum || albumName.startsWith(`${selectedAlbum}/`);
  const parseMediaDragPayload = (
    event: React.DragEvent<HTMLElement>,
  ): MediaDragPayload | null => {
    const directPayload = event.dataTransfer.getData(MEDIA_DRAG_MIME);
    if (directPayload) {
      try {
        const parsed = JSON.parse(directPayload) as Partial<MediaDragPayload>;
        if (parsed.path) {
          return {
            path: parsed.path,
            isScreenshot: Boolean(parsed.isScreenshot),
          };
        }
      } catch {}
    }
    const plainPath = event.dataTransfer.getData("text/plain");
    if (!plainPath) return null;
    const fallbackFile = fileByPathRef.current.get(plainPath);
    if (!fallbackFile) return null;
    return { path: plainPath, isScreenshot: isScreenshot(fallbackFile) };
  };
  const hasMediaDragData = (event: React.DragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return (
      types.includes(MEDIA_DRAG_MIME) ||
      types.includes("text/plain") ||
      Boolean(draggedMediaPath)
    );
  };
  const parseAlbumDragPayload = (
    event: React.DragEvent<HTMLElement>,
  ): AlbumDragPayload | null => {
    const directPayload = event.dataTransfer.getData(ALBUM_DRAG_MIME);
    if (!directPayload) return null;
    try {
      const parsed = JSON.parse(directPayload) as Partial<AlbumDragPayload>;
      if (!parsed.albumName) return null;
      return { albumName: parsed.albumName };
    } catch {
      return null;
    }
  };
  const hasAlbumDragData = (event: React.DragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return types.includes(ALBUM_DRAG_MIME) || Boolean(draggedAlbumName);
  };
  const getMediaDragOverlayScale = () =>
    albumDropTargetRef.current || albumsSidebarDragHoverRef.current
      ? DRAG_PREVIEW_ALBUM_HOVER_SCALE
      : DRAG_PREVIEW_SCALE;
  const removeMediaDragOverlay = () => {
    mediaDragOverlayRef.current?.remove();
    mediaDragOverlayRef.current = null;
    mediaDragOverlayAnchorRef.current = null;
    mediaDragLastPointerRef.current = null;
  };
  const applyMediaDragOverlayScale = () => {
    const overlay = mediaDragOverlayRef.current;
    const anchor = mediaDragOverlayAnchorRef.current;
    if (!overlay || !anchor) return;
    const sidebarHover = albumsSidebarDragHoverRef.current;
    const scale = getMediaDragOverlayScale();
    overlay.style.transformOrigin = sidebarHover
      ? `0px ${anchor.offsetY}px`
      : `${anchor.offsetX}px ${anchor.offsetY}px`;
    overlay.style.transform = `scale(${scale})`;
  };
  const positionMediaDragOverlay = (clientX: number, clientY: number) => {
    const overlay = mediaDragOverlayRef.current;
    const anchor = mediaDragOverlayAnchorRef.current;
    if (!overlay || !anchor) return;
    const sidebarHover = albumsSidebarDragHoverRef.current;
    const left = sidebarHover
      ? clientX + DRAG_PREVIEW_SIDEBAR_CURSOR_LEAD_PX
      : clientX - anchor.offsetX;
    overlay.style.left = `${Math.round(left)}px`;
    overlay.style.top = `${Math.round(clientY - anchor.offsetY)}px`;
    mediaDragLastPointerRef.current = { x: clientX, y: clientY };
  };
  const handleMediaDragStart = (
    event: React.DragEvent<HTMLElement>,
    file: FileItem,
    dragPreviewElement?: HTMLElement | null,
    pointerAnchor?: DragPointerAnchor | null,
  ) => {
    setIsAlbumsSidebarDragHover(false);
    setAlbumReorderTarget(null);
    const payload: MediaDragPayload = {
      path: file.path,
      isScreenshot: isScreenshot(file),
    };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(MEDIA_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", file.path);
    const sourceElement =
      dragPreviewElement ?? (event.currentTarget as HTMLElement);
    const sourceRect = sourceElement.getBoundingClientRect();
    const previewWidth = Math.max(1, sourceRect.width);
    const previewHeight = Math.max(1, sourceRect.height);
    const hasDragEventCoords =
      Number.isFinite(event.clientX) &&
      Number.isFinite(event.clientY) &&
      !(event.clientX === 0 && event.clientY === 0);
    const anchorX = pointerAnchor?.clientX ??
      (hasDragEventCoords ? event.clientX : sourceRect.left + sourceRect.width * 0.5);
    const anchorY = pointerAnchor?.clientY ??
      (hasDragEventCoords ? event.clientY : sourceRect.top + sourceRect.height * 0.5);
    const hasStoredPointerOffset =
      Number.isFinite(pointerAnchor?.offsetX ?? NaN) &&
      Number.isFinite(pointerAnchor?.offsetY ?? NaN);
    const pointerOffsetX = hasStoredPointerOffset
      ? (pointerAnchor?.offsetX as number)
      : anchorX - sourceRect.left;
    const pointerOffsetY = hasStoredPointerOffset
      ? (pointerAnchor?.offsetY as number)
      : anchorY - sourceRect.top;
    const dragImageOffsetX = Math.min(
      Math.max(0, pointerOffsetX),
      Math.max(0, previewWidth - 1),
    );
    const dragImageOffsetY = Math.min(
      Math.max(0, pointerOffsetY),
      Math.max(0, previewHeight - 1),
    );
    const hiddenDragImage = document.createElement("div");
    hiddenDragImage.style.position = "fixed";
    hiddenDragImage.style.left = "-10000px";
    hiddenDragImage.style.top = "-10000px";
    hiddenDragImage.style.width = "1px";
    hiddenDragImage.style.height = "1px";
    hiddenDragImage.style.opacity = "0";
    hiddenDragImage.style.pointerEvents = "none";
    document.body.appendChild(hiddenDragImage);
    event.dataTransfer.setDragImage(hiddenDragImage, 0, 0);
    window.requestAnimationFrame(() => {
      hiddenDragImage.remove();
    });
    removeMediaDragOverlay();
    const overlayElement = sourceElement.cloneNode(true) as HTMLElement;
    overlayElement.style.position = "fixed";
    overlayElement.style.left = "-10000px";
    overlayElement.style.top = "-10000px";
    overlayElement.style.pointerEvents = "none";
    overlayElement.style.margin = "0";
    overlayElement.style.width = `${previewWidth}px`;
    overlayElement.style.height = `${previewHeight}px`;
    overlayElement.style.opacity = String(DRAG_PREVIEW_OPACITY);
    overlayElement.style.border = DRAG_PREVIEW_BORDER;
    overlayElement.style.boxSizing = "border-box";
    overlayElement.style.boxShadow = DRAG_PREVIEW_RING;
    overlayElement.style.borderRadius = "12px";
    overlayElement.style.zIndex = "2147483647";
    overlayElement.style.contain = "layout paint style";
    overlayElement.style.willChange = "transform,left,top";
    overlayElement.style.transformOrigin = `${dragImageOffsetX}px ${dragImageOffsetY}px`;
    overlayElement.style.transition = `transform ${DRAG_PREVIEW_SCALE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    overlayElement.dataset.dragOverlay = "true";
    document.body.appendChild(overlayElement);
    mediaDragOverlayRef.current = overlayElement;
    mediaDragOverlayAnchorRef.current = {
      offsetX: dragImageOffsetX,
      offsetY: dragImageOffsetY,
    };
    applyMediaDragOverlayScale();
    positionMediaDragOverlay(anchorX, anchorY);
    document.body.style.cursor = "grabbing";
    document.documentElement.style.cursor = "grabbing";
    setDraggedMediaPath(file.path);
  };
  const handleMediaDragEnd = () => {
    removeMediaDragOverlay();
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    setDraggedMediaPath(null);
    setAlbumDropTarget(null);
    setAlbumReorderTarget(null);
    setIsAlbumsSidebarDragHover(false);
  };
  useEffect(() => {
    albumDropTargetRef.current = albumDropTarget;
    albumsSidebarDragHoverRef.current = isAlbumsSidebarDragHover;
    applyMediaDragOverlayScale();
    const lastPointer = mediaDragLastPointerRef.current;
    if (lastPointer) {
      positionMediaDragOverlay(lastPointer.x, lastPointer.y);
    }
  }, [albumDropTarget, isAlbumsSidebarDragHover]);
  useEffect(() => {
    if (!draggedMediaPath) {
      setIsAlbumsSidebarDragHover(false);
      removeMediaDragOverlay();
      return;
    }
    const handleWindowDragOver = (event: DragEvent) => {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
        return;
      }
      positionMediaDragOverlay(event.clientX, event.clientY);
    };
    window.addEventListener("dragover", handleWindowDragOver);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
    };
  }, [draggedMediaPath]);
  useEffect(() => {
    return () => {
      removeMediaDragOverlay();
    };
  }, []);
  const handleAlbumItemDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    albumName: string,
  ) => {
    event.stopPropagation();
    setIsAlbumsSidebarDragHover(false);
    setAlbumReorderTarget(null);
    const payload: AlbumDragPayload = { albumName };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ALBUM_DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", albumName);
    setDraggedAlbumName(albumName);
  };
  const handleAlbumItemDragEnd = () => {
    setDraggedAlbumName(null);
    setAlbumDropTarget(null);
    setAlbumReorderTarget(null);
    setIsAlbumsSidebarDragHover(false);
  };
  const reorderAlbums = (
    sourceAlbumName: string,
    targetAlbumName: string,
    position: "before" | "after",
  ) => {
    const sourceAlbum = normalizeAlbumName(sourceAlbumName);
    const targetAlbum = normalizeAlbumName(targetAlbumName);
    if (!sourceAlbum || !targetAlbum || sourceAlbum === targetAlbum) {
      return;
    }
    const sourceIndex = sortedAlbums.indexOf(sourceAlbum);
    const targetIndex = sortedAlbums.indexOf(targetAlbum);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }
    const nextOrder = sortedAlbums.filter((album) => album !== sourceAlbum);
    const normalizedTargetIndex = nextOrder.indexOf(targetAlbum);
    if (normalizedTargetIndex === -1) {
      return;
    }
    const insertIndex =
      position === "before" ? normalizedTargetIndex : normalizedTargetIndex + 1;
    nextOrder.splice(insertIndex, 0, sourceAlbum);
    setAlbumOrder(nextOrder);
  };
  const resolveNestedAlbumName = (targetAlbum: string, sourceAlbum: string) => {
    const sourceLeaf = getAlbumLabel(sourceAlbum);
    const baseCandidate = normalizeAlbumName(`${targetAlbum}/${sourceLeaf}`);
    if (!baseCandidate) return null;
    const existing = new Set(
      albums.map((album) => normalizeAlbumName(album)).filter(Boolean) as string[],
    );
    if (!existing.has(baseCandidate)) return baseCandidate;
    let suffix = 2;
    while (suffix <= 200) {
      const candidate = normalizeAlbumName(
        `${targetAlbum}/${sourceLeaf} ${suffix}`,
      );
      if (candidate && !existing.has(candidate)) {
        return candidate;
      }
      suffix += 1;
    }
    return baseCandidate;
  };
  const handleNestAlbumIntoAlbum = async (
    sourceAlbumName: string,
    targetAlbumName: string,
  ) => {
    const sourceAlbum = normalizeAlbumName(sourceAlbumName);
    const targetAlbum = normalizeAlbumName(targetAlbumName);
    if (!sourceAlbum || !targetAlbum) return;
    if (sourceAlbum === targetAlbum) return;
    if (targetAlbum.startsWith(`${sourceAlbum}/`)) return;
    const nextAlbumName = resolveNestedAlbumName(targetAlbum, sourceAlbum);
    if (!nextAlbumName || nextAlbumName === sourceAlbum) return;
    await handleRenameAlbum(sourceAlbum, nextAlbumName);
  };
  const handleAlbumDragOver = (
    event: React.DragEvent<HTMLButtonElement>,
    albumName: string,
  ) => {
    const isMediaDrag = hasMediaDragData(event);
    const isAlbumDrag = hasAlbumDragData(event);
    if (!isMediaDrag && !isAlbumDrag) return;
    if (isAlbumDrag) {
      const albumPayload = parseAlbumDragPayload(event);
      const sourceAlbum = normalizeAlbumName(albumPayload?.albumName ?? "");
      const targetAlbum = normalizeAlbumName(albumName);
      if (!sourceAlbum || !targetAlbum || sourceAlbum === targetAlbum) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const rowRect = event.currentTarget.getBoundingClientRect();
      const relativeY = event.clientY - rowRect.top;
      const edgeThreshold = Math.min(
        14,
        Math.max(6, rowRect.height * ALBUM_REORDER_EDGE_RATIO),
      );
      if (relativeY <= edgeThreshold) {
        if (
          albumReorderTarget?.albumName !== albumName ||
          albumReorderTarget.position !== "before"
        ) {
          setAlbumReorderTarget({ albumName, position: "before" });
        }
        if (albumDropTarget !== null) {
          setAlbumDropTarget(null);
        }
        return;
      }
      if (relativeY >= rowRect.height - edgeThreshold) {
        if (
          albumReorderTarget?.albumName !== albumName ||
          albumReorderTarget.position !== "after"
        ) {
          setAlbumReorderTarget({ albumName, position: "after" });
        }
        if (albumDropTarget !== null) {
          setAlbumDropTarget(null);
        }
        return;
      }
      if (targetAlbum.startsWith(`${sourceAlbum}/`)) {
        return;
      }
      if (albumReorderTarget !== null) {
        setAlbumReorderTarget(null);
      }
      if (albumDropTarget !== albumName) {
        setAlbumDropTarget(albumName);
      }
      return;
    }
    if (albumReorderTarget !== null) {
      setAlbumReorderTarget(null);
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (albumDropTarget !== albumName) {
      setAlbumDropTarget(albumName);
    }
  };
  const isAlbumSidebarDrag = (event: React.DragEvent<HTMLElement>) => {
    const isMediaDrag = hasMediaDragData(event);
    const isAlbumDrag = hasAlbumDragData(event);
    if (!isMediaDrag && !isAlbumDrag) return false;
    if (isMediaDrag && selectedFilter !== "organize" && selectedFilter !== "library") {
      return false;
    }
    return true;
  };
  const handleAlbumsSidebarDragOver = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    if (!isAlbumSidebarDrag(event)) return;
    const isMediaDrag = hasMediaDragData(event);
    if (isMediaDrag) {
      if (!isAlbumsSidebarDragHover) {
        setIsAlbumsSidebarDragHover(true);
      }
    } else if (isAlbumsSidebarDragHover) {
      setIsAlbumsSidebarDragHover(false);
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const target = event.target as HTMLElement | null;
    const hoveredAlbumRow = target?.closest("[data-album-drop-target='true']");
    if (!hoveredAlbumRow) {
      if (albumDropTarget !== null) {
        setAlbumDropTarget(null);
      }
      if (albumReorderTarget !== null) {
        setAlbumReorderTarget(null);
      }
    }
  };
  const handleAlbumsSidebarDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setAlbumDropTarget(null);
      setAlbumReorderTarget(null);
      setIsAlbumsSidebarDragHover(false);
    }
  };
  const handleAlbumDrop = async (
    event: React.DragEvent<HTMLButtonElement>,
    albumName: string,
  ) => {
    event.preventDefault();
    const albumPayload = parseAlbumDragPayload(event);
    if (albumPayload?.albumName) {
      if (albumReorderTarget) {
        reorderAlbums(
          albumPayload.albumName,
          albumReorderTarget.albumName,
          albumReorderTarget.position,
        );
        setAlbumReorderTarget(null);
        setAlbumDropTarget(null);
        setIsAlbumsSidebarDragHover(false);
        setDraggedAlbumName(null);
        return;
      }
      await handleNestAlbumIntoAlbum(albumPayload.albumName, albumName);
      setAlbumDropTarget(null);
      setAlbumReorderTarget(null);
      setIsAlbumsSidebarDragHover(false);
      setDraggedAlbumName(null);
      return;
    }
    const payload = parseMediaDragPayload(event);
    setAlbumDropTarget(null);
    setAlbumReorderTarget(null);
    setIsAlbumsSidebarDragHover(false);
    removeMediaDragOverlay();
    setDraggedMediaPath(null);
    document.body.style.cursor = "default";
    document.documentElement.style.cursor = "default";
    if (!payload) return;
    await handleFileMove(payload.path, albumName, payload.isScreenshot);
  };
  const canShowAlbumsSidebar =
    selectedFilter === "library" || selectedFilter === "organize";
  const openAlbumContextMenu = (
    albumName: string,
    clientX: number,
    clientY: number,
  ) => {
    const menuWidth = 188;
    const menuHeight = 112;
    const x = Math.min(
      Math.max(8, clientX),
      window.innerWidth - menuWidth - 8,
    );
    const y = Math.min(
      Math.max(8, clientY),
      window.innerHeight - menuHeight - 8,
    );
    setAlbumContextMenu({
      albumName,
      x,
      y,
    });
  };
  const handleAlbumContextAction = async (
    action: "rename" | "delete" | "newSub",
    albumName: string,
  ) => {
    const normalizedAlbum = normalizeAlbumName(albumName);
    if (!normalizedAlbum) return;
    if (action === "rename") {
      const slashIndex = normalizedAlbum.lastIndexOf("/");
      const parentPath =
        slashIndex >= 0 ? normalizedAlbum.slice(0, slashIndex) : "";
      const currentLabel = getAlbumLabel(normalizedAlbum);
      const nextLabel = window.prompt("Rename album", currentLabel)?.trim();
      if (!nextLabel || nextLabel === currentLabel) return;
      const nextFullName = parentPath
        ? `${parentPath}/${nextLabel}`
        : nextLabel;
      await handleRenameAlbum(normalizedAlbum, nextFullName);
      return;
    }
    if (action === "newSub") {
      const subLabel = window.prompt("New sub-album name", "")?.trim();
      if (!subLabel) return;
      await handleNewAlbum(`${normalizedAlbum}/${subLabel}`);
      return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(
        `Delete album "${getAlbumLabel(normalizedAlbum)}" and its contents?`,
      );
      if (!confirmed) return;
      await handleDeleteAlbum(normalizedAlbum);
    }
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.documentElement.style.cursor = "";
    };
  }, []);

  useEffect(() => {
    if (!albumContextMenu) return;
    const close = () => setAlbumContextMenu(null);
    const onPointerDown = (event: PointerEvent) => {
      // Keep the menu open for right-click interactions.
      if (event.button !== 0) return;
      const target = event.target as Node | null;
      if (target && albumContextMenuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [albumContextMenu]);

  const filteredFiles = useMemo(() => {
    let nextFiles: FileItem[];

    if (selectedFilter === "organize" || selectedFilter === "library") {
      const base = (() => {
        switch (selectedSubFilter) {
        case "images":
          return screenshots;
        case "videos":
          return recordings;
        default:
          return allFiles;
        }
      })();

      if (selectedFilter === "library") {
        const libraryItems = (() => {
          switch (selectedSubFilter) {
          case "images":
            return libraryScreenshots;
          case "videos":
            return libraryRecordings;
          default:
            return allLibraryFiles;
          }
        })();
        nextFiles = !selectedLibraryAlbum
          ? libraryItems
          : libraryItems.filter((file) => {
            const albumName = file.album?.trim();
            if (!albumName) return false;
            return albumMatchesSelection(albumName, selectedLibraryAlbum);
          });
      } else {
        let filteredBase = base;
        if (organizeSourceFilter === "desktop") {
          filteredBase = base.filter(
            (file) => !file.path.startsWith(APPLE_PHOTOS_URI_PREFIX),
          );
        } else if (organizeSourceFilter === "photos") {
          filteredBase = base.filter((file) =>
            file.path.startsWith(APPLE_PHOTOS_URI_PREFIX),
          );
        }
        nextFiles = filteredBase.filter((file) => {
          if (organizedIndex.paths.has(file.path)) return false;
          if (file.size > 0) {
            const signature = `${file.name}::${file.size}`;
            if (organizedIndex.signatures.has(signature)) return false;
          }
          return true;
        });
      }
    } else {
      switch (selectedFilter) {
        case "screenshots":
          nextFiles = screenshots;
          break;
        case "recordings":
          nextFiles = recordings;
          break;
        case "all":
        default:
          nextFiles = allFiles;
          break;
      }
    }

    if (!hasIndexedSearchQuery) {
      return nextFiles;
    }

    return nextFiles.filter((file) => indexedSearchScoresByPath.has(file.path));
  }, [
    hasIndexedSearchQuery,
    indexedSearchScoresByPath,
    selectedFilter,
    selectedSubFilter,
    selectedLibraryAlbum,
    organizeSourceFilter,
    screenshots,
    recordings,
    allFiles,
    organizedIndex,
    libraryScreenshots,
    libraryRecordings,
    allLibraryFiles,
  ]);

  const displayFiles = useMemo(() => {
    const seen = new Set<string>();
    return filteredFiles
      .filter((file) => {
        if (seen.has(file.path)) return false;
        seen.add(file.path);
        return true;
      })
      .map((file) => ({
        file,
        modifiedMs: getModifiedTimeMs(file.modified),
        name: String(file.name),
        path: String(file.path),
        searchScore: indexedSearchScoresByPath.get(file.path) ?? 0,
      }))
      .sort((a, b) => {
        if (hasIndexedSearchQuery) {
          const bySearchScore = b.searchScore - a.searchScore;
          if (bySearchScore !== 0) return bySearchScore;
        }
        const byModified = b.modifiedMs - a.modifiedMs;
        if (byModified !== 0) return byModified;
        const byName = a.name.localeCompare(b.name);
        if (byName !== 0) return byName;
        return a.path.localeCompare(b.path);
      })
      .map(({ file }) => file);
  }, [filteredFiles, hasIndexedSearchQuery, indexedSearchScoresByPath]);

  const displayFileIndexByPath = useMemo(() => {
    const map = new Map<string, number>();
    displayFiles.forEach((file, index) => {
      map.set(file.path, index);
    });
    return map;
  }, [displayFiles]);

  const handleFileClick = useCallback((file: FileItem) => {
    const index = displayFileIndexByPath.get(file.path) ?? -1;
    if (index !== -1) {
      setGalleryIndex(index);
      setActiveViewMode("gallery");
      setViewMode("gallery");
    }
  }, [displayFileIndexByPath]);

  const gridColumnCount = useMemo(() => getGridColumnCount(), [zoomLevel, scrollMetrics.width]);

  const virtualization = useMemo(() => {
    const total = displayFiles.length;
    if (viewMode === "gallery") {
      return {
        startIndex: 0,
        endIndex: total,
        paddingTop: 0,
        paddingBottom: 0,
      };
    }

    const scrollTop = Math.max(0, scrollMetrics.top);
    const viewportHeight = Math.max(1, scrollMetrics.height || 900);

    if (viewMode === "grid") {
      const cols = gridColumnCount;
      const totalRows = Math.ceil(total / cols);
      const startRow = Math.max(
        0,
        Math.floor(scrollTop / GRID_ROW_ESTIMATED_HEIGHT) - GRID_OVERSCAN_ROWS,
      );
      const endRow = Math.min(
        totalRows,
        Math.ceil((scrollTop + viewportHeight) / GRID_ROW_ESTIMATED_HEIGHT) +
          GRID_OVERSCAN_ROWS,
      );
      const startIndex = startRow * cols;
      const endIndex = Math.min(total, endRow * cols);
      const paddingTop = startRow * GRID_ROW_ESTIMATED_HEIGHT;
      const paddingBottom = Math.max(
        0,
        (totalRows - endRow) * GRID_ROW_ESTIMATED_HEIGHT,
      );
      return { startIndex, endIndex, paddingTop, paddingBottom };
    }

    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / LIST_ITEM_ESTIMATED_HEIGHT) - LIST_OVERSCAN_ITEMS,
    );
    const endIndex = Math.min(
      total,
      Math.ceil((scrollTop + viewportHeight) / LIST_ITEM_ESTIMATED_HEIGHT) +
        LIST_OVERSCAN_ITEMS,
    );
    const paddingTop = startIndex * LIST_ITEM_ESTIMATED_HEIGHT;
    const paddingBottom = Math.max(
      0,
      (total - endIndex) * LIST_ITEM_ESTIMATED_HEIGHT,
    );
    return { startIndex, endIndex, paddingTop, paddingBottom };
  }, [displayFiles.length, scrollMetrics.top, scrollMetrics.height, viewMode, gridColumnCount]);

  const visibleListFiles = useMemo(() => {
    return displayFiles.slice(virtualization.startIndex, virtualization.endIndex);
  }, [displayFiles, virtualization.endIndex, virtualization.startIndex]);

  useEffect(() => {
    if (viewMode !== "list") return;
    const now = Date.now();
    if (now - lastViewPerfLogAtRef.current < 1200) return;
    lastViewPerfLogAtRef.current = now;
    const mark = performance.now();
    const total = displayFiles.length;
    const visible = visibleListFiles.length;
    requestAnimationFrame(() => {
      const frameMs = performance.now() - mark;
      console.debug(
        `[perf] ${viewMode} frame ${frameMs.toFixed(1)}ms (visible ${visible}/${total})`,
      );
    });
  }, [
    displayFiles.length,
    scrollMetrics.top,
    viewMode,
    visibleListFiles.length,
  ]);

  const statusBarItemsCount = useMemo(() => {
    if (hasIndexedSearchQuery) {
      return displayFiles.length;
    }
    if (selectedFilter === "library") {
      if (selectedLibraryAlbum) {
        return displayFiles.length;
      }
      return libraryCounts.screenshots + libraryCounts.recordings;
    }
    if (selectedFilter === "organize") {
      return displayFiles.length;
    }
    return displayFiles.length;
  }, [
    hasIndexedSearchQuery,
    selectedFilter,
    selectedLibraryAlbum,
    displayFiles.length,
    libraryCounts.screenshots,
    libraryCounts.recordings,
  ]);

  const pendingIndexedSearchItems = intelligenceStatus?.indexing.ocrPending ?? 0;
  const indexedSearchEmptyMessage =
    pendingIndexedSearchItems > 0
      ? `Still indexing ${pendingIndexedSearchItems} item${pendingIndexedSearchItems === 1 ? "" : "s"}. Results will improve as OCR finishes.`
      : "Try a filename, album name, source, or media type.";

  const intelligenceSummary = useMemo(() => {
    if (!intelligenceStatus) {
      return {
        label: intelligenceStatusLoading ? "Indexing..." : "Index offline",
        toneClass: intelligenceStatusError
          ? "text-rose-300"
          : "text-white/60",
        dotClass: intelligenceStatusError ? "bg-rose-400" : "bg-white/35",
      };
    }

    const { indexing, jobs } = intelligenceStatus;
    if (jobs.pending > 0 || jobs.running > 0) {
      return {
        label: `Indexing ${indexing.ocrReady}/${Math.max(indexing.ocrEligible, 1)} OCR`,
        toneClass: "text-sky-200",
        dotClass: "bg-sky-400",
      };
    }
    if (indexing.ocrFailed > 0 || jobs.failed > 0 || indexing.metadataFailed > 0) {
      return {
        label: `${indexing.ocrFailed + jobs.failed + indexing.metadataFailed} issues`,
        toneClass: "text-amber-200",
        dotClass: "bg-amber-400",
      };
    }
    return {
      label: `${intelligenceStatus.mediaCount} indexed`,
      toneClass: "text-emerald-200",
      dotClass: "bg-emerald-400",
    };
  }, [intelligenceStatus, intelligenceStatusError, intelligenceStatusLoading]);

  const handleRebuildIntelligenceMetadata = useCallback(async () => {
    if (!window.electronAPI || rebuildingIntelligence) return;
    setRebuildingIntelligence(true);
    try {
      await window.electronAPI.rebuildIntelligenceMetadata();
      await refreshIntelligenceStatus();
    } catch (error) {
      setIntelligenceStatusError(
        error instanceof Error ? error.message : "Failed to rebuild the index.",
      );
    } finally {
      setRebuildingIntelligence(false);
    }
  }, [rebuildingIntelligence, refreshIntelligenceStatus]);

  const handleRetryFailedIntelligenceOcr = useCallback(async () => {
    if (!window.electronAPI || retryingFailedOcr) return;
    setRetryingFailedOcr(true);
    try {
      await window.electronAPI.retryFailedIntelligenceOcr();
      await refreshIntelligenceStatus();
    } catch (error) {
      setIntelligenceStatusError(
        error instanceof Error ? error.message : "Failed to retry OCR jobs.",
      );
    } finally {
      setRetryingFailedOcr(false);
    }
  }, [refreshIntelligenceStatus, retryingFailedOcr]);

  const intelligenceSourceRows = useMemo(() => {
    if (!intelligenceStatus) return [];
    return [
      {
        key: "desktop-inbox",
        label: "Desktop Inbox",
        data: intelligenceStatus.sources["desktop-inbox"],
      },
      {
        key: "organized-library",
        label: "Organized Library",
        data: intelligenceStatus.sources["organized-library"],
      },
      {
        key: "apple-photos-inbox",
        label: "Photos Inbox",
        data: intelligenceStatus.sources["apple-photos-inbox"],
      },
      {
        key: "apple-photos-organized",
        label: "Photos Organized",
        data: intelligenceStatus.sources["apple-photos-organized"],
      },
    ];
  }, [intelligenceStatus]);

  const viewModeOptions = VIEW_MODES;
  const hasAiOrganization = accountEntitlements.aiOrganization;
  const isTauriShell = useMemo(
    () =>
      typeof document !== "undefined" &&
      document.body.classList.contains("tauri-shell"),
    [],
  );
  const handleTitleBarMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!isTauriShell || event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (
        !target ||
        target.closest(
          [
            "[data-no-window-drag]",
            "button",
            "input",
            "textarea",
            "select",
            "a",
            "[role='button']",
            "[contenteditable='true']",
          ].join(","),
        )
      ) {
        return;
      }
      void window.electronAPI.startWindowDrag?.();
    },
    [isTauriShell],
  );
  const handleAlbumContextMenuActionClick = (
    action: "rename" | "delete" | "newSub",
  ) => {
    if (!albumContextMenu) return;
    const albumName = albumContextMenu.albumName;
    setAlbumContextMenu(null);
    void handleAlbumContextAction(action, albumName);
  };
  return (
    <div
      className={clsx(
        "h-screen select-none flex flex-col overflow-hidden rounded-[18px] bg-neutral-950/98 text-white shadow-[0_28px_80px_-40px_rgba(0,0,0,0.95),inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] transition-opacity duration-400",
        isWindowResizing && "window-resizing",
        isScrolling && "content-scrolling",
        Boolean(draggedMediaPath) && "media-dragging",
      )}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{ borderRadius: "inherit" }}
      >
        {/* Header / Title bar */}
        <header
          className="select-none flex flex-col bg-gradient-to-br from-neutral-900 to-neutral-950 border-b border-neutral-950/90"
          data-tauri-drag-region={isTauriShell ? "" : undefined}
          data-window-drag-handle={isTauriShell ? "" : undefined}
          onMouseDownCapture={handleTitleBarMouseDown}
        >
            <div
              className="flex h-[38px] items-center justify-between px-3 drag-region relative"
              data-tauri-drag-region={isTauriShell ? "" : undefined}
              data-window-drag-handle={isTauriShell ? "" : undefined}
              onMouseDown={handleTitleBarMouseDown}
            >
              <div className="flex items-center space-x-3 h-full">
                <div className="flex items-center space-x-2 -translate-x-1.5 translate-y-[2px] px-1">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-pink-600 via-fuchsia-600 to-purple-600 flex items-center justify-center shadow-lg shadow-fuchsia-600/20">
                    <div style={{ transform: "translate(0.55px, 0.55px)" }}>
                      <MacZenGlyph className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-white/80">
                    MacZen
                  </span>
                </div>
              </div>

              {/* Centered Filter Tabs */}
              <div
                className="overflow-hidden absolute left-1/2 -translate-x-1/2 translate-y-px flex items-center"
                data-no-window-drag
                data-tauri-drag-region="false"
                style={{ WebkitAppRegion: "no-drag" } as any}
              >
                <LayoutGroup>
                  <div
                    className={cn(
                      "relative flex h-[28px] w-[311px] items-center overflow-hidden rounded-lg bg-neutral-950",
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center h-[28px]",
                        selectedFilter === "library"
                          ? "bg-gradient-to-br from-neutral-600 to-neutral-800"
                          : "bg-neutral-700/50",
                      )}
                    >
                      <button
                        className={cn(
                          "flex items-center text-xs px-2.5 pr-3 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                          selectedFilter === "library"
                            ? "text-white"
                            : "text-white/50",
                        )}
                        onClick={() => {
                          setSelectedFilter("library");
                        }}
                      >
                        <FolderOpen className="w-3 h-3 mr-1.5" />
                        <span>Library</span>
                      </button>
                      <div className="flex items-center pr-2 space-x-0.5">
                        <button
                          className={cn(
                            "text-xs px-1.5 h-5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "all"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("all");
                          }}
                        >
                          All
                        </button>
                        <button
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "images"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("images");
                          }}
                        >
                          Images
                        </button>
                        <button
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "videos"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("videos");
                          }}
                        >
                          Videos
                        </button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "relative -ml-[10px] pl-[10px] flex items-center h-[28px] w-[320px] transition-transform duration-200 ease-out will-change-transform",
                        selectedFilter === "organize"
                          ? "bg-gradient-to-br from-neutral-600 to-neutral-900 translate-x-[-140px]"
                          : "bg-neutral-800 translate-x-0",
                      )}
                      style={{
                        clipPath: "polygon(10px 0, 100% 0, 100% 100%, 0 100%)",
                      }}
                    >
                      <div className="pointer-events-none absolute inset-y-0 left-[10px] w-[2px] origin-top-left -skew-x-[20deg] bg-black" />
                      <button
                        className={cn(
                          "flex items-center text-xs px-2.5 pr-3 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                          selectedFilter === "organize"
                            ? "text-white"
                            : "text-white/50",
                        )}
                        onClick={() => {
                          setSelectedFilter("organize");
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-1.5" />
                        <span>Organize</span>
                      </button>
                      <div className="flex items-center pr-2 space-x-0.5">
                        <button
                          className={cn(
                            "text-xs px-1.5 pt-px pb-0.5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "all"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("all");
                          }}
                        >
                          All
                        </button>
                        <button
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "images"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("images");
                          }}
                        >
                          Images
                        </button>
                        <button
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded-md outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                            selectedSubFilter === "videos"
                              ? "bg-black/[0.6] shadow-black/30 shadow-xl"
                              : "",
                          )}
                          onClick={() => {
                            setSelectedSubFilter("videos");
                          }}
                        >
                          Videos
                        </button>
                      </div>
                    </div>
                  </div>
                </LayoutGroup>
              </div>

              <div
                className="flex items-center pr-0.5 space-x-2 h-full relative z-[100]"
                data-no-window-drag
                data-tauri-drag-region="false"
                style={
                  {
                    transform: "translate(3px, 0px)",
                    WebkitAppRegion: "no-drag",
                  } as any
                }
              >
                {/* Zoom Controls */}
                {viewMode === "grid" && (
                  <div className="hidden items-center space-x-1 mr-2">
                    <button
                      onClick={handleZoomOut}
                      disabled={zoomLevel === 4}
                      className={clsx(
                        "size-4 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95",
                        zoomLevel === 4
                          ? "bg-white/5 text-slate-600"
                          : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white",
                      )}
                      style={{ WebkitAppRegion: "no-drag" } as any}
                      title="Zoom Out"
                    >
                      <Minus className="w-3 h-3 pointer-events-none" />
                    </button>
                    <button
                      onClick={handleZoomIn}
                      disabled={zoomLevel === 1}
                      className={clsx(
                        "size-4 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95",
                        zoomLevel === 1
                          ? "bg-white/5 text-slate-600"
                          : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white",
                      )}
                      style={{ WebkitAppRegion: "no-drag" } as any}
                      title="Zoom In"
                    >
                      <Plus className="w-3 h-3 pointer-events-none" />
                    </button>
                  </div>
                )}

                {/* Capture Button */}
                <button
                  onClick={() => setShowCaptureMode(true)}
                  className="size-5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-150 flex items-center justify-center"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Screenshot & Video Capture"
                >
                  <Camera className="w-3 h-3 text-white/70 hover:text-white pointer-events-none" />
                </button>

                {/* Settings Button */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="size-5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all duration-150 flex items-center justify-center"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Settings"
                >
                  <Settings className="w-3 h-3 text-white/70 hover:text-white pointer-events-none" />
                </button>

                {/* Separator */}
                <div className="w-px h-3 bg-white/10 mx-1" />

                <button
                  onClick={() => window.electronAPI.minimizeWindow()}
                  className="w-5 h-5 rounded-full bg-yellow-500/15 hover:bg-yellow-500/25 active:scale-95 transition-all duration-150 flex items-center justify-center group"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Minimize"
                >
                  <Minus className="w-3.5 h-3.5 text-yellow-400 group-hover:text-yellow-300 transition-colors pointer-events-none" />
                </button>
                <button
                  onClick={() => window.electronAPI.closeWindow()}
                  className="w-5 h-5 rounded-full bg-red-500/15 hover:bg-red-500/25 active:scale-95 transition-all duration-150 flex items-center justify-center group"
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Close"
                >
                  <X className="w-3.5 h-3.5 text-red-400 group-hover:text-red-300 transition-colors pointer-events-none" />
                </button>
              </div>
            </div>
        </header>

        {/* Content */}
        <main className="no-drag relative flex flex-1 flex-col overflow-hidden min-h-0">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(12, 13, 17, 0.98) 0%, rgba(7, 8, 11, 0.99) 100%)",
            }}
          />

          <LayoutGroup>
            <div className="relative z-10 flex bg-black/10 flex-1 flex-col min-h-0">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-neutral-950/55 px-4 py-3 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex min-w-0 items-center gap-3">
                  {isIndexedSearchView && (
                    <div
                      className="flex h-12 items-center rounded-xl px-2 shadow-lg shadow-black/25"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(10, 10, 12, 0.95) 0%, rgba(2, 2, 4, 0.98) 100%)",
                        borderTop: "1px solid rgba(255, 255, 255, 0.10)",
                        borderBottom: "1px solid rgba(18, 18, 18, 0.88)",
                      }}
                    >
                      <label
                        className="group flex h-9 min-w-0 w-[272px] items-center gap-2 rounded-lg px-3 text-white/70 transition-colors focus-within:text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(24, 24, 28, 0.96) 0%, rgba(8, 8, 12, 0.98) 100%)",
                          borderTop: "1px solid rgba(255, 255, 255, 0.07)",
                          borderBottom: "1px solid rgba(18, 18, 18, 0.72)",
                          boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.02)",
                        }}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05]">
                          {indexedSearchLoading ? (
                            <LoaderCircle className="h-4 w-4 animate-spin text-sky-200/80" />
                          ) : (
                            <Search className="h-4 w-4 text-white/55 group-focus-within:text-sky-100" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <input
                            value={indexedSearchQuery}
                            onChange={(event) => setIndexedSearchQuery(event.target.value)}
                            placeholder="Search your library"
                            className="w-full border-none bg-transparent p-0 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
                            spellCheck={false}
                          />
                        </div>
                        {indexedSearchQuery ? (
                          <button
                            type="button"
                            onClick={() => setIndexedSearchQuery("")}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/80"
                            title="Clear search"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className="flex h-12 items-center gap-2 rounded-xl px-2 bg-neutral-950/80 shadow-lg shadow-black/25"
                    style={{
                      borderTop: "1px solid rgba(255, 255, 255, 0.10)",
                      borderLeft: "1px solid rgba(120, 120, 120, 0.12)",
                      borderRight: "1px solid rgba(120, 120, 120, 0.12)",
                      borderBottom: "1px solid rgba(18, 18, 18, 0.85)",
                    }}
                  >
                  {/* View Mode Buttons */}
                  <div
                    className="relative grid h-9 w-[204px] grid-cols-3 items-stretch overflow-hidden rounded-lg bg-neutral-900/85 shadow-sm shadow-black"
                    style={{
                      borderLeft: "1px solid rgba(140, 140, 140, 0.06)",
                      borderRight: "1px solid rgba(140, 140, 140, 0.06)",
                      borderBottom: "1px solid rgba(50, 50, 50, 0.14)",
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.01)",
                    }}
                  >
                    {viewModeOptions.map((item, index) => {
                      const Icon = item.icon;
                      const isActive = activeViewMode === item.id;
                      const isFirst = index === 0;
                      const isLast = index === viewModeOptions.length - 1;
                      const hasActiveLeftNeighbor =
                        index > 0 && activeViewMode === viewModeOptions[index - 1].id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (
                              item.id === "gallery" &&
                              displayFiles.length > 0
                            ) {
                              setGalleryIndex(0);
                            }
                            if (item.id !== activeViewMode) {
                              switchViewMode(item.id);
                            }
                          }}
                          className={clsx(
                            "group relative h-full w-full min-w-0 flex flex-col items-center justify-center gap-1 focus-visible:z-20",
                            isFirst && "rounded-l-[7px]",
                            isLast && "rounded-r-[7px]",
                            isActive
                              ? "bg-gradient-to-br from-sky-300/20 via-sky-500/20 to-indigo-700/20"
                              : "hover:bg-white/[0.02]",
                          )}
                          style={{
                            borderTop: isActive
                              ? "1px solid rgba(210, 235, 255, 0.24)"
                              : "1px solid rgba(255, 255, 255, 0.07)",
                            borderBottom: isActive
                              ? "1px solid rgba(0, 0, 0, 0.2)"
                              : "1px solid rgba(26, 30, 38, 0.72)",
                            borderLeft: isFirst
                              ? isActive
                                ? "1px solid rgba(190, 226, 255, 0.16)"
                                : "1px solid rgba(255, 255, 255, 0.05)"
                              : isActive || hasActiveLeftNeighbor
                                ? "1px solid rgba(165, 212, 255, 0.14)"
                                : "1px solid rgba(255, 255, 255, 0.05)",
                            borderRight: isLast
                              ? isActive
                                ? "1px solid rgba(190, 226, 255, 0.16)"
                                : "1px solid rgba(255, 255, 255, 0.05)"
                              : undefined,
                          }}
                          title={item.label}
                        >
                          <div className="relative z-10 flex flex-col items-center gap-1">
                            <Icon
                              className={clsx(
                                "h-4 w-4",
                                isActive
                                  ? "text-white"
                                  : "text-white/42 group-hover:text-white/68",
                              )}
                              strokeWidth={1.9}
                            />
                            <span
                              className={clsx(
                                "text-[10px] font-medium leading-none",
                                isActive
                                  ? "text-white"
                                  : "text-white/42 group-hover:text-white/68",
                              )}
                            >
                              {item.label}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  </div>

                  {/* Auto Organize Button */}
                  <button
                    onClick={handleAutoOrganize}
                    disabled={organizing || loading}
                    className={clsx(
                      "font-semibold relative group shadow-md shadow-black hover:opacity-100 active:scale-95",
                      "size-12 rounded-xl text-[9px] flex flex-col items-center justify-center gap-1",
                      "transition-all duration-150 bg-neutral-950/85 opacity-95",
                      hasAiOrganization
                        ? "text-amber-400"
                        : "text-purple-400",
                      (organizing || loading) && "cursor-wait",
                    )}
                    style={{
                      borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                      borderLeft: "1px solid rgba(140, 140, 140, 0.10)",
                      borderRight: "1px solid rgba(140, 140, 140, 0.10)",
                      borderBottom: "1px solid rgba(50, 50, 50, 0.2)",
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.01)",
                      textShadow:
                        hasAiOrganization
                          ? "0 0 10px rgba(251, 191, 36, 0.5), 0 0 20px rgba(251, 191, 36, 0.3)"
                          : "0 0 10px rgba(168, 85, 247, 0.5), 0 0 20px rgba(168, 85, 247, 0.3)",
                    }}
                    title={
                      hasAiOrganization
                        ? "AI Organize"
                        : accountUser
                          ? "Upgrade to Pro for AI organization"
                          : "Sign in to use AI organization"
                    }
                  >
                    {!hasAiOrganization && (
                      <span className="absolute -top-1 -right-1 text-[8px] bg-gradient-to-br from-purple-500 via-purple-700 to-purple-900 border-t border-t-purple-950/60 border-b border-b-purple-950 text-white px-1.5 py-0.5 rounded font-bold shadow-md shadow-purple-900/50">
                        {accountUser ? "PRO" : "LOGIN"}
                      </span>
                    )}
                    <Sparkles
                      className={clsx("w-5 h-5", organizing && "animate-pulse")}
                      style={{
                        filter:
                          hasAiOrganization
                            ? "drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))"
                            : "drop-shadow(0 0 4px rgba(168, 85, 247, 0.6))",
                      }}
                    />
                    <span className="font-medium whitespace-nowrap">
                      {organizing ? "Organizing..." : "Organize"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative flex-1 min-h-0 flex">
                {canShowAlbumsSidebar && (
                  <aside className="flex w-56 shrink-0 flex-col border-r border-white/[0.08] bg-neutral-950/55">
                    <div className="border-b border-white/[0.07] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-medium tracking-wide text-white/70">
                          Albums
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            const name = window
                              .prompt("New album name", "")
                              ?.trim();
                            if (!name) return;
                            void handleNewAlbum(name);
                          }}
                          className="relative -top-px left-px inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                          title="Create album"
                          aria-label="Create album"
                        >
                          <Plus className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <p className="mt-0 text-[11.5px] text-white/40">
                        {selectedFilter === "library"
                          ? "Browse your organized albums"
                          : "Drag items to an album to organize"}
                      </p>
                    </div>
                    <div
                      className="flex-1 overflow-y-auto px-2 py-2"
                      onDragOver={handleAlbumsSidebarDragOver}
                      onDragLeave={handleAlbumsSidebarDragLeave}
                      onDrop={() => {
                        setAlbumDropTarget(null);
                        setAlbumReorderTarget(null);
                        setIsAlbumsSidebarDragHover(false);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedFilter !== "library") return;
                          setSelectedLibraryAlbum(null);
                        }}
                        className={clsx(
                          "mb-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                          selectedFilter === "library" && !selectedLibraryAlbum
                            ? "bg-white/12 text-white"
                            : "text-white/65 hover:bg-white/5 hover:text-white/90",
                        )}
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">All Albums</span>
                        <span className="text-[10px] text-white/45">
                          {allLibraryFiles.length}
                        </span>
                      </button>
                      {sortedAlbums.length === 0 ? (
                        <p className="px-2.5 py-3 text-[11px] text-white/40">
                          No albums created yet.
                        </p>
                      ) : (
                        sortedAlbums.map((albumName) => {
                          const isSelectedAlbum =
                            selectedFilter === "library" &&
                            selectedLibraryAlbum === albumName;
                          const isDropTarget = albumDropTarget === albumName;
                          const isReorderBefore =
                            albumReorderTarget?.albumName === albumName &&
                            albumReorderTarget.position === "before";
                          const isReorderAfter =
                            albumReorderTarget?.albumName === albumName &&
                            albumReorderTarget.position === "after";
                          const albumDepth = getAlbumDepth(albumName);
                          const rowPaddingLeft = 10 + albumDepth * 10;
                          const count = albumCounts.get(albumName) ?? 0;
                          return (
                            <button
                              key={albumName}
                              type="button"
                              draggable
                              onClick={() => {
                                if (selectedFilter !== "library") return;
                                setSelectedLibraryAlbum(albumName);
                              }}
                              onContextMenu={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openAlbumContextMenu(
                                  albumName,
                                  event.clientX,
                                  event.clientY,
                                );
                              }}
                              onPointerDown={(event) => {
                                const isSecondaryClick =
                                  event.button === 2 ||
                                  (event.button === 0 && event.ctrlKey);
                                if (!isSecondaryClick) return;
                                event.preventDefault();
                                event.stopPropagation();
                                openAlbumContextMenu(
                                  albumName,
                                  event.clientX,
                                  event.clientY,
                                );
                              }}
                              onDragStart={(event) =>
                                handleAlbumItemDragStart(event, albumName)
                              }
                              onDragEnd={handleAlbumItemDragEnd}
                              onDragEnter={(event) => {
                                if (!isAlbumSidebarDrag(event)) return;
                                event.preventDefault();
                                setAlbumDropTarget(albumName);
                              }}
                              onDragOver={(event) =>
                                handleAlbumDragOver(event, albumName)
                              }
                              onDragLeave={(event) => {
                                if (albumDropTarget !== albumName) {
                                  return;
                                }
                                const nextTarget = event.relatedTarget as
                                  | Node
                                  | null;
                                if (
                                  !nextTarget ||
                                  !event.currentTarget.contains(nextTarget)
                                ) {
                                  setAlbumDropTarget(null);
                                }
                              }}
                              onDrop={(event) => handleAlbumDrop(event, albumName)}
                              data-album-drop-target="true"
                              className={clsx(
                                "relative mb-1 flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-xs transition-colors",
                                isSelectedAlbum
                                  ? "bg-white/12 text-white"
                                  : "text-white/65 hover:bg-white/5 hover:text-white/90",
                                ((selectedFilter === "organize" &&
                                  draggedMediaPath) ||
                                  draggedAlbumName) &&
                                  "cursor-copy",
                                !draggedMediaPath &&
                                  !draggedAlbumName &&
                                  "active:cursor-grabbing",
                                isDropTarget &&
                                  "bg-fuchsia-500/15 text-fuchsia-100 ring-1 ring-fuchsia-400/60",
                              )}
                              style={{
                                paddingLeft: `${rowPaddingLeft}px`,
                              }}
                              title={albumName}
                            >
                              {isReorderBefore ? (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -top-[1px] right-2 h-[2px] rounded-full bg-fuchsia-300/90 shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                                  style={{ left: `${rowPaddingLeft}px` }}
                                />
                              ) : null}
                              {isReorderAfter ? (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -bottom-[1px] right-2 h-[2px] rounded-full bg-fuchsia-300/90 shadow-[0_0_8px_rgba(232,121,249,0.6)]"
                                  style={{ left: `${rowPaddingLeft}px` }}
                                />
                              ) : null}
                              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                              <span className="min-w-0 flex-1 truncate">
                                {getAlbumLabel(albumName)}
                              </span>
                              <span className="text-[10px] text-white/45">
                                {count}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </aside>
                )}

                <div className="relative flex-1 min-h-0 flex flex-col">
                  {/* Gallery View (constrained below toolbar row) */}
                  {viewMode === "gallery" && galleryIndex !== null && (
                    <GalleryView
                      files={displayFiles}
                      isScreenshot={isScreenshot}
                      projects={albums}
                      theme={theme}
                      onMove={handleFileMove}
                      onNewProject={handleNewAlbum}
                      onDelete={handleFileDelete}
                      onRevealInFinder={handleRevealInFinder}
                      onClose={handleCloseGallery}
                      onRenameProject={handleRenameAlbum}
                      initialIndex={galleryIndex}
                      onZoomChange={setGalleryZoom}
                    />
                  )}
                  {isRefreshing && selectedFilter === "organize" && (
                    <div className="absolute right-4 top-4 z-20 rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-xs text-neutral-200 shadow-lg">
                      Refreshing files…
                    </div>
                  )}
                  <div
                    ref={scrollContainerRef}
                    className={clsx(
                      "flex-1 min-h-0 bg-black/35",
                      viewMode !== "gallery" &&
                        "overflow-y-auto py-4 scrollbar-gutter-balanced",
                      viewMode === "grid" && "px-2",
                      viewMode === "list" && "px-4",
                    )}
                    onScroll={viewMode !== "gallery" ? handleScroll : undefined}
                  >
                    {viewMode === "gallery" ? null : loading && selectedFilter !== "library" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
                        <RefreshCw className="h-8 w-8 animate-spin text-slate-200" />
                        <span className="text-sm tracking-wide text-slate-400">
                          Scanning your desktop...
                        </span>
                      </div>
                    ) : selectedFilter === "library" && libraryLoading ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
                        <RefreshCw className="h-8 w-8 animate-spin text-slate-200" />
                        <span className="text-sm tracking-wide text-slate-400">
                          Loading your library...
                        </span>
                      </div>
                    ) : selectedFilter === "organize" && organizeIndexLoading ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
                        <RefreshCw className="h-8 w-8 animate-spin text-slate-200" />
                        <span className="text-sm tracking-wide text-slate-400">
                          Loading organize content...
                        </span>
                      </div>
                    ) : displayFiles.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
                        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/[0.03]">
                          <FolderOpen className="h-10 w-10 text-slate-200/70" />
                        </div>
                        <p className="text-lg font-medium text-slate-200">
                          {hasIndexedSearchQuery
                            ? "No indexed matches found"
                            : `No ${selectedFilter === "all" ? "files" : selectedFilter} found`}
                        </p>
                        <p className="text-sm text-slate-400/80">
                          {hasIndexedSearchQuery
                            ? indexedSearchEmptyMessage
                            : "Capture a new screenshot or recording and refresh to see it here."}
                        </p>
                        {hasIndexedSearchQuery && indexedSearchError ? (
                          <p className="text-xs text-rose-300/80">
                            {indexedSearchError}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div
                          key="grid-view"
                          className={clsx(
                            viewMode === "grid" ? "block" : "hidden",
                          )}
                          aria-hidden={viewMode !== "grid"}
                        >
                          {viewMode === "grid" && virtualization.paddingTop > 0 && (
                            <div
                              aria-hidden="true"
                              style={{ height: virtualization.paddingTop }}
                            />
                          )}
                          <div
                            className={clsx(
                              "grid gap-4",
                              getGridColumns(),
                            )}
                            style={{
                              transform: `scale(${getCardScale()})`,
                              transformOrigin: "top left",
                            }}
                          >
                            {displayFiles
                              .slice(virtualization.startIndex, virtualization.endIndex)
                              .map((file) => (
                              <FileCard
                                key={file.path}
                                file={file}
                                isScreenshot={isScreenshot(file)}
                                albums={albums}
                                theme={theme}
                                isScrolling={false}
                                onMove={handleFileMove}
                                onNewAlbum={handleNewAlbum}
                                onDelete={handleFileDelete}
                                onRenameFile={handleRenameFile}
                                onRevealInFinder={handleRevealInFinder}
                                onRenameAlbum={handleRenameAlbum}
                                onOpenGallery={handleFileClick}
                                isDraggingItem={draggedMediaPath === file.path}
                                onDragStart={
                                  selectedFilter === "organize" || selectedFilter === "library"
                                    ? handleMediaDragStart
                                    : undefined
                                }
                                onDragEnd={
                                  selectedFilter === "organize" || selectedFilter === "library"
                                    ? handleMediaDragEnd
                                    : undefined
                                }
                              />
                            ))}
                          </div>
                          {viewMode === "grid" && virtualization.paddingBottom > 0 && (
                            <div
                              aria-hidden="true"
                              style={{ height: virtualization.paddingBottom }}
                            />
                          )}
                        </div>
                        <div
                          key="list-view"
                          className={clsx(viewMode === "list" ? "block" : "hidden")}
                          aria-hidden={viewMode !== "list"}
                        >
                          {virtualization.paddingTop > 0 && (
                            <div
                              aria-hidden="true"
                              style={{ height: `${virtualization.paddingTop}px` }}
                            />
                          )}
                          <ListView
                            files={visibleListFiles}
                            isScreenshot={isScreenshot}
                            albums={albums}
                            theme={theme}
                            isScrolling={isScrolling}
                            onMove={handleFileMove}
                            onNewAlbum={handleNewAlbum}
                            onDelete={handleFileDelete}
                            onRenameFile={handleRenameFile}
                            onRevealInFinder={handleRevealInFinder}
                            onOpenGallery={handleFileClick}
                            draggedPath={draggedMediaPath}
                            onDragStart={
                              selectedFilter === "organize" || selectedFilter === "library"
                                ? handleMediaDragStart
                                : undefined
                            }
                            onDragEnd={
                              selectedFilter === "organize" || selectedFilter === "library"
                                ? handleMediaDragEnd
                                : undefined
                            }
                          />
                          {virtualization.paddingBottom > 0 && (
                            <div
                              aria-hidden="true"
                              style={{ height: `${virtualization.paddingBottom}px` }}
                            />
                          )}
                        </div>
                        {viewMode !== "grid" && viewMode !== "list" && (
                          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                            <p className="text-sm text-slate-300">No active view</p>
                            <button
                              onClick={() => switchViewMode("grid")}
                              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/70 hover:text-white"
                            >
                              Switch to Grid
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </LayoutGroup>
        </main>

        {albumContextMenu ? (
          <div
            ref={albumContextMenuRef}
            className="fixed z-[280] min-w-[176px] overflow-hidden rounded-lg border border-white/15 bg-neutral-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl"
            style={{
              left: `${albumContextMenu.x}px`,
              top: `${albumContextMenu.y}px`,
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={() => handleAlbumContextMenuActionClick("rename")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Rename album
            </button>
            <button
              type="button"
              onClick={() => handleAlbumContextMenuActionClick("newSub")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Create sub-album
            </button>
            <div className="h-px bg-white/10" />
            <button
              type="button"
              onClick={() => handleAlbumContextMenuActionClick("delete")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-300/85 transition-colors hover:bg-red-500/15 hover:text-red-200"
            >
              Delete album
            </button>
          </div>
        ) : null}

        <AnimatePresence>
          {undoToast ? (
            <motion.div
              key={undoToast.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="fixed bottom-12 left-1/2 z-[330] -translate-x-1/2 rounded-lg border border-white/15 bg-neutral-950/95 px-3 py-2 shadow-2xl shadow-black/70 backdrop-blur-xl"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/85">{undoToast.message}</span>
                <button
                  type="button"
                  onClick={handleUndoToastAction}
                  className="rounded-md border border-fuchsia-400/55 bg-fuchsia-500/15 px-2 py-1 text-[11px] font-semibold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/25 hover:text-fuchsia-100"
                >
                  Undo
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <footer
          className="no-drag relative z-30 h-9 overflow-visible border-t border-white/5 bg-neutral-950/95 px-3 flex items-center justify-between"
          style={{
            borderBottomLeftRadius: "inherit",
            borderBottomRightRadius: "inherit",
          }}
        >
          <div className="relative -top-px flex h-full min-w-0 flex-1 items-center gap-3 text-[12px] leading-none text-white/58">
            <span className="truncate whitespace-nowrap leading-none text-white/78">
              {statusBarItemsCount} {hasIndexedSearchQuery ? "matches" : "items"}
            </span>
            {selectedFilter === "organize" && (
              <>
                <div className="h-3 w-px shrink-0 bg-white/15" />
                <OrganizeSourceDropdown
                  value={organizeSourceFilter}
                  onChange={setOrganizeSourceFilter}
                />
              </>
            )}
            <div className="h-3 w-px shrink-0 bg-white/15" />
            <div className="flex min-w-0 items-center gap-3 text-[12px] font-medium text-white/72">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-white/58">Shots</span>
                <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-white/[0.14] to-black/[0.26] px-1.5 py-1 text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  {selectedFilter === "library" ? libraryCounts.screenshots : screenshots.length}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-white/58">Recordings</span>
                <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-white/[0.14] to-black/[0.26] px-1.5 py-1 text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  {selectedFilter === "library" ? libraryCounts.recordings : recordings.length}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-white/58">Albums</span>
                <span className="inline-flex items-center justify-center rounded-md bg-gradient-to-br from-white/[0.14] to-black/[0.26] px-1.5 py-1 text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  {albums.length}
                </span>
              </span>
            </div>
            {hasIndexedSearchQuery && (
              <div className="h-3 w-px shrink-0 bg-white/15" />
            )}
            {hasIndexedSearchQuery && (
              <span className="truncate whitespace-nowrap leading-none text-white/35">
                for "{trimmedIndexedSearchQuery}"
              </span>
            )}
            {indexedSearchError && hasIndexedSearchQuery && (
              <span className="truncate whitespace-nowrap leading-none text-rose-300/80">
                Search unavailable
              </span>
            )}
            <div className="h-3 w-px shrink-0 bg-white/15" />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  data-testid="intelligence-status-trigger"
                  className={clsx(
                    "inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors hover:text-white",
                    intelligenceSummary.toneClass,
                  )}
                >
                  <span
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      intelligenceSummary.dotClass,
                    )}
                  />
                  <span className="whitespace-nowrap">{intelligenceSummary.label}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={8}
                className="z-[180] w-[300px] rounded-xl border border-white/10 bg-neutral-950/95 p-0 text-white shadow-2xl shadow-black/70 backdrop-blur-xl"
              >
                <div className="border-b border-white/10 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        Search Index
                      </p>
                      <p className="mt-1 text-sm text-white/85">
                        {intelligenceStatus
                          ? `${intelligenceStatus.mediaCount} media items tracked`
                          : intelligenceStatusLoading
                            ? "Loading index status..."
                            : "Index status unavailable"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="retry-failed-ocr-button"
                        onClick={handleRetryFailedIntelligenceOcr}
                        disabled={
                          retryingFailedOcr ||
                          intelligenceStatusLoading ||
                          (intelligenceStatus?.indexing.ocrFailed ?? 0) === 0
                        }
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                          retryingFailedOcr
                            ? "cursor-wait border-amber-400/20 bg-amber-400/10 text-amber-100"
                            : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45",
                        )}
                      >
                        <RotateCw
                          className={clsx("h-3 w-3", retryingFailedOcr && "animate-spin")}
                        />
                        Retry OCR
                      </button>
                      <button
                        type="button"
                        data-testid="reindex-intelligence-button"
                        onClick={handleRebuildIntelligenceMetadata}
                        disabled={rebuildingIntelligence || intelligenceStatusLoading}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
                          rebuildingIntelligence
                            ? "cursor-wait border-sky-400/20 bg-sky-400/10 text-sky-100"
                            : "border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white",
                        )}
                      >
                        <RotateCw
                          className={clsx("h-3 w-3", rebuildingIntelligence && "animate-spin")}
                        />
                        Reindex
                      </button>
                    </div>
                  </div>
                  {intelligenceStatusError ? (
                    <p className="mt-2 text-[11px] text-rose-300/80">
                      {intelligenceStatusError}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 border-b border-white/10 px-3 py-3 text-[11px]">
                  <div className="rounded-lg bg-white/[0.04] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-white/40">
                      <Database className="h-3 w-3" />
                      Media
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white/90">
                      {intelligenceStatus?.mediaCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-white/40">
                      <ScanText className="h-3 w-3" />
                      OCR
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white/90">
                      {intelligenceStatus
                        ? `${intelligenceStatus.indexing.ocrReady}/${intelligenceStatus.indexing.ocrEligible}`
                        : "0/0"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-white/40">
                      <AlertTriangle className="h-3 w-3" />
                      Issues
                    </div>
                    <p className="mt-1 text-sm font-semibold text-white/90">
                      {intelligenceStatus
                        ? intelligenceStatus.indexing.ocrFailed +
                          intelligenceStatus.indexing.metadataFailed +
                          intelligenceStatus.jobs.failed
                        : 0}
                    </p>
                  </div>
                </div>

                <div className="border-b border-white/10 px-3 py-3 text-[11px] text-white/65">
                  <div className="flex items-center justify-between">
                    <span>Pending jobs</span>
                    <span className="font-medium text-white/85">
                      {intelligenceStatus
                        ? intelligenceStatus.jobs.pending + intelligenceStatus.jobs.running
                        : 0}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>OCR failures</span>
                    <span className="font-medium text-white/85">
                      {intelligenceStatus?.indexing.ocrFailed ?? 0}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Metadata failures</span>
                    <span className="font-medium text-white/85">
                      {intelligenceStatus?.indexing.metadataFailed ?? 0}
                    </span>
                  </div>
                </div>

                <div className="border-b border-white/10 px-3 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Sources
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    {intelligenceSourceRows.map((source) => (
                      <div
                        key={source.key}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg bg-white/[0.035] px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-white/80">{source.label}</p>
                          <p className="truncate text-white/35">
                            {source.data.total} media
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/35">OCR</p>
                          <p className="font-medium text-white/85">
                            {source.data.ocrReady}/{source.data.ocrEligible}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white/35">Failed</p>
                          <p className="font-medium text-white/85">
                            {source.data.ocrFailed}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-3 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                    Recent Jobs
                  </p>
                  <div className="space-y-1.5">
                    {intelligenceJobs.length === 0 ? (
                      <p className="text-[11px] text-white/45">No indexing jobs yet.</p>
                    ) : (
                      intelligenceJobs.map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between rounded-lg bg-white/[0.035] px-2.5 py-2 text-[11px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-white/85">
                              {job.type === "SYNC_MEDIA_OCR" ? "OCR extraction" : "Metadata sync"}
                            </p>
                            <p className="truncate text-white/35">
                              attempt {job.attemptCount}
                            </p>
                          </div>
                          <span
                            className={clsx(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              job.status === "COMPLETED" && "bg-emerald-500/15 text-emerald-200",
                              job.status === "FAILED" && "bg-rose-500/15 text-rose-200",
                              (job.status === "PENDING" || job.status === "RUNNING") &&
                                "bg-sky-500/15 text-sky-200",
                            )}
                          >
                            {job.status.toLowerCase()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {viewMode === "grid" && (
            <div className="relative -top-px flex shrink-0 items-center">
              <div className="flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-1">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel === 4}
                  className={clsx(
                    "h-[18px] w-[18px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-95",
                    zoomLevel === 4
                      ? "bg-white/5 text-slate-600"
                      : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white",
                  )}
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Zoom Out"
                >
                  <Minus className="w-2.5 h-2.5 pointer-events-none" />
                </button>

                <span className="text-[10px] tabular-nums text-white/60 w-[44px] text-center">
                  {Math.round(getCardScale() * 100)}%
                </span>

                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel === 1}
                  className={clsx(
                    "h-[18px] w-[18px] rounded-full flex items-center justify-center transition-all duration-150 active:scale-95",
                    zoomLevel === 1
                      ? "bg-white/5 text-slate-600"
                      : "bg-white/10 hover:bg-white/20 text-white/70 hover:text-white",
                  )}
                  style={{ WebkitAppRegion: "no-drag" } as any}
                  title="Zoom In"
                >
                  <Plus className="w-2.5 h-2.5 pointer-events-none" />
                </button>
              </div>
            </div>
          )}

          {viewMode === "gallery" && (
            <div className="relative -top-px flex shrink-0 items-center gap-2 text-[10px] text-white/50">
              <span>Zoom {Math.round(galleryZoom * 100)}%</span>
              <span className="text-white/30">Hold ⌘ and pinch</span>
            </div>
          )}
        </footer>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  AI Organization Suggestions
                </h2>
                <button
                  onClick={handleCancelOrganize}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Bar */}
              {progress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>{phaseMessage || "Processing files..."}</span>
                    <span>
                      {progress.processed} / {progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          (progress.processed / progress.total) * 100
                        }%`,
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Cost Analysis */}
              {cost && (
                <div className="mt-3 p-2 bg-neutral-900/50 rounded-lg border border-neutral-800/50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-neutral-500">Model:</span>
                        <span className="ml-1 text-neutral-300 font-mono">
                          {cost.model}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Tokens:</span>
                        <span className="ml-1 text-neutral-300 font-mono">
                          {cost.totalTokens.toLocaleString()}
                        </span>
                        <span className="ml-1 text-neutral-500 text-[10px]">
                          ({cost.inputTokens.toLocaleString()} in /{" "}
                          {cost.outputTokens.toLocaleString()} out)
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-500">Cost:</span>
                      <span className="ml-1 text-emerald-400 font-semibold font-mono">
                        ${cost.estimatedCost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Sparkles className="w-8 h-8 text-purple-400 animate-pulse" />
                  <p className="text-neutral-400 text-sm">
                    AI is analyzing your files...
                  </p>
                  <div className="flex gap-1">
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <div
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {suggestions.map((suggestion, index) => (
                    <motion.div
                      key={suggestion.fileName}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={clsx(
                        "p-3 rounded-lg border transition-all",
                        suggestion.accepted
                          ? "bg-purple-500/10 border-purple-500/30"
                          : "bg-neutral-900/60 border-neutral-800/60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={suggestion.accepted}
                          onChange={() => toggleSuggestion(suggestion.fileName)}
                          className="mt-1 w-4 h-4 rounded border-neutral-600 text-purple-500 focus:ring-purple-500"
                        />
                        <div className="w-16 h-12 rounded-md overflow-hidden bg-neutral-800 flex-shrink-0">
                          {suggestion.thumbnail ? (
                            <img
                              src={suggestion.thumbnail}
                              alt={suggestion.fileName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {suggestion.isScreenshot ? (
                                <Image className="w-5 h-5 text-neutral-600" />
                              ) : (
                                <Video className="w-5 h-5 text-neutral-600" />
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {suggestion.isScreenshot ? (
                              <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            ) : (
                              <Video className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            )}
                            <span className="text-sm font-medium text-white truncate">
                              {suggestion.fileName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <FolderOpen className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">
                              {suggestion.suggestedAlbum}
                            </span>
                            <span className="text-neutral-500">•</span>
                            <span className="text-neutral-400">
                              {suggestion.reason}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="p-4 border-t border-neutral-800 flex gap-3">
              <button
                onClick={handleCancelOrganize}
                className="flex-1 py-2 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptSuggestions}
                disabled={!suggestions.some((s) => s.accepted)}
                className="flex-1 py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Apply {suggestions.filter((s) => s.accepted).length} Suggestions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Details Modal */}
      {errorDetails && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-red-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-red-700 bg-red-900/20">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <X className="w-5 h-5" />
                  {errorDetails.error}
                </h2>
                <button
                  onClick={() => setErrorDetails(null)}
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-neutral-300">
                {errorDetails.message}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-2">
                  Error Details
                </h3>
                <div className="bg-neutral-900 rounded-lg p-3 space-y-2 text-xs font-mono">
                  {errorDetails.details.model && (
                    <div>
                      <span className="text-neutral-500">Model:</span>
                      <span className="ml-2 text-neutral-300">
                        {errorDetails.details.model}
                      </span>
                    </div>
                  )}
                  {errorDetails.details.responseLength !== undefined && (
                    <div>
                      <span className="text-neutral-500">Response Length:</span>
                      <span className="ml-2 text-neutral-300">
                        {errorDetails.details.responseLength.toLocaleString()}{" "}
                        characters
                      </span>
                    </div>
                  )}
                  {errorDetails.details.inputTokens !== undefined && (
                    <div>
                      <span className="text-neutral-500">Input Tokens:</span>
                      <span className="ml-2 text-neutral-300">
                        {errorDetails.details.inputTokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {errorDetails.details.outputTokens !== undefined && (
                    <div>
                      <span className="text-neutral-500">Output Tokens:</span>
                      <span className="ml-2 text-neutral-300">
                        {errorDetails.details.outputTokens.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {errorDetails.details.estimatedCost !== undefined && (
                    <div>
                      <span className="text-neutral-500">Estimated Cost:</span>
                      <span className="ml-2 text-emerald-400 font-semibold">
                        ${errorDetails.details.estimatedCost.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {errorDetails.details.finishReason && (
                    <div>
                      <span className="text-neutral-500">Finish Reason:</span>
                      <span className="ml-2 text-neutral-300">
                        {errorDetails.details.finishReason}
                      </span>
                      {errorDetails.details.wasTruncated && (
                        <span className="ml-2 text-yellow-400 font-semibold">
                          ⚠️ TRUNCATED
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {errorDetails.details.wasTruncated && (
                <div className="p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                  <p className="text-sm text-yellow-200 font-semibold mb-1">
                    ⚠️ Response Truncated at Token Limit
                  </p>
                  <p className="text-xs text-yellow-100">
                    The AI's response was cut off because it exceeded the
                    maximum token limit. Try organizing fewer files at once
                    (e.g., 10-20 files per batch instead of all at once).
                  </p>
                </div>
              )}

              {errorDetails.details.responsePreview && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Response Preview (First 1000 chars)
                  </h3>
                  <div className="bg-neutral-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words">
                      {errorDetails.details.responsePreview}
                    </pre>
                  </div>
                </div>
              )}

              {errorDetails.details.responseSuffix && (
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">
                    Response End (Last 500 chars)
                  </h3>
                  <div className="bg-neutral-900 rounded-lg p-3 overflow-x-auto">
                    <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words">
                      {errorDetails.details.responseSuffix}
                    </pre>
                  </div>
                </div>
              )}

              <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p className="text-xs text-yellow-200">
                  <strong>Tip:</strong> Copy this error information and share it
                  with the developer to help troubleshoot the issue.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-800 flex gap-3">
              <button
                onClick={() => {
                  const errorText = JSON.stringify(errorDetails, null, 2);
                  navigator.clipboard.writeText(errorText);
                  alert("Error details copied to clipboard!");
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold transition-colors"
              >
                Copy Error Details
              </button>
              <button
                onClick={() => setErrorDetails(null)}
                className="flex-1 py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
              className="bg-neutral-950 border border-white/10 rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/[0.08] bg-neutral-950/90">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-neutral-400" />
                    Settings
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Configure account access, Photos import, and storage behavior.
                </p>
              </div>

              <div className="flex flex-1 min-h-0">
                <aside className="w-48 shrink-0 border-r border-white/[0.08] bg-neutral-950/70 p-3">
                  <div className="space-y-1.5">
                    <button
                      className={clsx(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        settingsTab === "account"
                          ? "bg-white/10 text-white"
                          : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                      )}
                      onClick={() => setSettingsTab("account")}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-semibold">Account</span>
                      </span>
                      <span className="ml-[22px] mt-0.5 block text-[10px] leading-[1.15] opacity-70">
                        Sign in and subscription
                      </span>
                    </button>
                    <button
                      className={clsx(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        settingsTab === "apple_photos"
                          ? "bg-white/10 text-white"
                          : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                      )}
                      onClick={() => setSettingsTab("apple_photos")}
                    >
                      <span className="flex items-center gap-2">
                        <Images className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-semibold">Photos</span>
                      </span>
                      <span className="ml-[22px] mt-0.5 block text-[10px] leading-[1.15] opacity-70">
                        Import and organize
                      </span>
                    </button>
                    <button
                      className={clsx(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        settingsTab === "storage"
                          ? "bg-white/10 text-white"
                          : "text-neutral-400 hover:bg-white/[0.04] hover:text-white",
                      )}
                      onClick={() => setSettingsTab("storage")}
                    >
                      <span className="flex items-center gap-2">
                        <HardDrive className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-semibold">Storage</span>
                      </span>
                      <span className="ml-[22px] mt-0.5 block text-[10px] leading-[1.15] opacity-70">
                        Destination and sync
                      </span>
                    </button>
                  </div>
                </aside>

                <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0 bg-black/15">
                {settingsTab === "account" && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">
                      Account
                    </h3>

                    {accountLoading ? (
                      <p className="text-xs text-neutral-500">Checking session…</p>
                    ) : accountUser ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-neutral-900/45 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-400" />
                            <span className="text-sm font-medium text-emerald-300">
                              Signed in
                            </span>
                          </div>
                          <p className="text-xs text-neutral-300">
                            {accountUser.name || accountUser.email}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {accountUser.email}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={clsx(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                accountEntitlements.aiOrganization
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-white/10 text-neutral-400",
                              )}
                            >
                              {accountEntitlements.aiOrganization
                                ? "Pro features enabled"
                                : "Free plan"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleAccountSignOut}
                            disabled={accountSubmitting}
                            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/5 disabled:opacity-60"
                          >
                            Sign out
                          </button>
                          <button
                            onClick={() => window.electronAPI.openUpgradeUrl()}
                            className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
                          >
                            Manage plan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-white/10 bg-neutral-900/45 p-3">
                          <div className="mb-3 flex rounded-lg bg-black/25 p-1">
                            <button
                              onClick={() => {
                                setAccountMode("sign_in");
                                setAccountError(null);
                              }}
                              className={clsx(
                                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                accountMode === "sign_in"
                                  ? "bg-white/10 text-white"
                                  : "text-neutral-400 hover:text-white",
                              )}
                            >
                              Sign in
                            </button>
                            <button
                              onClick={() => {
                                setAccountMode("sign_up");
                                setAccountError(null);
                              }}
                              className={clsx(
                                "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                accountMode === "sign_up"
                                  ? "bg-white/10 text-white"
                                  : "text-neutral-400 hover:text-white",
                              )}
                            >
                              Sign up
                            </button>
                          </div>
                          {accountMode === "sign_up" && (
                            <div className="mb-2 grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={accountFirstName}
                                onChange={(e) => setAccountFirstName(e.target.value)}
                                placeholder="First name"
                                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/25 focus:outline-none"
                              />
                              <input
                                type="text"
                                value={accountLastName}
                                onChange={(e) => setAccountLastName(e.target.value)}
                                placeholder="Last name"
                                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/25 focus:outline-none"
                              />
                            </div>
                          )}
                          <input
                            type="email"
                            value={accountEmail}
                            onChange={(e) => setAccountEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="mb-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/25 focus:outline-none"
                          />
                          <input
                            type="password"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            placeholder="Password"
                            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-neutral-500 focus:border-white/25 focus:outline-none"
                          />
                          {accountError && (
                            <p className="mt-2 text-xs text-red-400">{accountError}</p>
                          )}
                          <button
                            onClick={handleAccountSubmit}
                            disabled={accountSubmitting}
                            className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
                          >
                            {accountSubmitting
                              ? "Please wait..."
                              : accountMode === "sign_in"
                                ? "Sign in"
                                : "Create account"}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-500">
                          Sign in to enable account-based feature access instead of
                          license keys.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {settingsTab !== "account" && settingsLoading && (
                  <p className="text-xs text-neutral-500">
                    Loading settings...
                  </p>
                )}

                {settingsTab !== "account" &&
                  !settingsLoading &&
                  !settings && (
                    <p className="text-xs text-neutral-500">
                      Settings are only available in the desktop app.
                    </p>
                  )}

                {settingsTab === "apple_photos" && settings && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">
                      Apple Photos
                    </h3>
                    <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-neutral-300">
                            Enable Apple Photos integration
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            Pulls your recent Photos items into the Organize
                            tab.
                          </p>
                        </div>
                        <button
                          onClick={handleToggleApplePhotos}
                          disabled={settingsSaving}
                          className={clsx(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition",
                            settings.applePhotosEnabled
                              ? "bg-emerald-500/70"
                              : "bg-white/10",
                            settingsSaving && "opacity-60 cursor-wait",
                          )}
                          aria-label="Toggle Apple Photos import"
                        >
                          <span
                            className={clsx(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition",
                              settings.applePhotosEnabled
                                ? "translate-x-4"
                                : "translate-x-1",
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-neutral-300">
                            Import all Photos (ignore lookback)
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            Pulls your entire library into the Organize tab. Can
                            be slow for large libraries.
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            updateSettings({
                              applePhotosImportAll:
                                !settings.applePhotosImportAll,
                            })
                          }
                          disabled={
                            settingsSaving || !settings.applePhotosEnabled
                          }
                          className={clsx(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition",
                            settings.applePhotosImportAll
                              ? "bg-emerald-500/70"
                              : "bg-white/10",
                            (settingsSaving || !settings.applePhotosEnabled) &&
                              "opacity-60 cursor-not-allowed",
                          )}
                          aria-label="Toggle Apple Photos import all"
                        >
                          <span
                            className={clsx(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition",
                              settings.applePhotosImportAll
                                ? "translate-x-4"
                                : "translate-x-1",
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs text-neutral-400">
                          Lookback (days)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          value={applePhotosLookbackInput}
                          onChange={(e) =>
                            setApplePhotosLookbackInput(e.target.value)
                          }
                          onBlur={handleApplePhotosLookbackCommit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleApplePhotosLookbackCommit();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          disabled={settings.applePhotosImportAll}
                          className={clsx(
                            "w-20 px-2 py-1 bg-neutral-950 border border-neutral-700 rounded text-xs text-white focus:outline-none focus:border-neutral-600",
                            settings.applePhotosImportAll &&
                              "opacity-60 cursor-not-allowed",
                          )}
                        />
                      </div>

                      <button
                        onClick={handleApplePhotosSyncNow}
                        disabled={
                          !settings.applePhotosEnabled || applePhotosImporting
                        }
                        className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800/60 text-xs text-white font-semibold transition-colors"
                      >
                        {applePhotosImporting ? "Syncing..." : "Sync now"}
                      </button>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-neutral-500">
                          Organized folder
                        </span>
                        <span className="text-[10px] text-neutral-400 truncate">
                          {organizedBaseDirLabel}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-3">
                        <p className="text-[10px] text-neutral-500">
                          When organizing Apple Photos items
                        </p>

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-300">
                              Copy to organized folder
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              Exports a copy into your MacZen album folders.
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateSettings({
                                applePhotosOrganizeExportToFolder:
                                  !settings.applePhotosOrganizeExportToFolder,
                              })
                            }
                            disabled={settingsSaving}
                            className={clsx(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition",
                              settings.applePhotosOrganizeExportToFolder
                                ? "bg-emerald-500/70"
                                : "bg-white/10",
                              settingsSaving && "opacity-60 cursor-wait",
                            )}
                            aria-label="Toggle Apple Photos export to folder"
                          >
                            <span
                              className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition",
                                settings.applePhotosOrganizeExportToFolder
                                  ? "translate-x-4"
                                  : "translate-x-1",
                              )}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-300">
                              Delete from Photos after copy
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              Requires copy enabled (safety).
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateSettings({
                                applePhotosOrganizeDeleteFromPhotos:
                                  !settings.applePhotosOrganizeDeleteFromPhotos,
                              })
                            }
                            disabled={
                              settingsSaving ||
                              !settings.applePhotosOrganizeExportToFolder
                            }
                            className={clsx(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition",
                              settings.applePhotosOrganizeDeleteFromPhotos
                                ? "bg-rose-500/70"
                                : "bg-white/10",
                              (settingsSaving ||
                                !settings.applePhotosOrganizeExportToFolder) &&
                                "opacity-60 cursor-not-allowed",
                            )}
                            aria-label="Toggle Apple Photos delete after copy"
                          >
                            <span
                              className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition",
                                settings.applePhotosOrganizeDeleteFromPhotos
                                  ? "translate-x-4"
                                  : "translate-x-1",
                              )}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-300">
                              Tag in Photos with album name
                            </p>
                            <p className="text-[10px] text-neutral-500">
                              Adds a keyword (or album) so Photos stays
                              organized too.
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateSettings({
                                applePhotosOrganizeTagInPhotos:
                                  !settings.applePhotosOrganizeTagInPhotos,
                              })
                            }
                            disabled={settingsSaving}
                            className={clsx(
                              "relative inline-flex h-5 w-9 items-center rounded-full transition",
                              settings.applePhotosOrganizeTagInPhotos
                                ? "bg-emerald-500/70"
                                : "bg-white/10",
                              settingsSaving && "opacity-60 cursor-wait",
                            )}
                            aria-label="Toggle Apple Photos tag in Photos"
                          >
                            <span
                              className={clsx(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition",
                                settings.applePhotosOrganizeTagInPhotos
                                  ? "translate-x-4"
                                  : "translate-x-1",
                              )}
                            />
                          </button>
                        </div>

                      </div>

                      {(applePhotosImporting || applePhotosImportStatus) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs text-neutral-400">
                            <div className="flex items-center gap-2 min-w-0">
                              {applePhotosImporting && (
                                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                              )}
                              <span className="truncate">
                                {applePhotosImportStatus ||
                                  (applePhotosImporting
                                    ? "Syncing Apple Photos…"
                                    : "")}
                              </span>
                            </div>
                            {applePhotosImporting &&
                              applePhotosImportProgress &&
                              applePhotosImportProgress.total > 0 && (
                                <span className="shrink-0 text-[10px] text-neutral-500">
                                  {applePhotosImportProgress.processed}/
                                  {applePhotosImportProgress.total}
                                </span>
                              )}
                          </div>

                          {applePhotosImporting &&
                            applePhotosImportProgress &&
                            applePhotosImportProgress.total > 0 && (
                            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full bg-purple-400/70 transition-[width] duration-200"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        (applePhotosImportProgress.processed /
                                          applePhotosImportProgress.total) *
                                          100,
                                      ),
                                    )}%`,
                                  }}
                                />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {settingsTab === "storage" && settings && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white">
                      Storage
                    </h3>
                    <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs text-neutral-300">
                            Save organized files to iCloud Drive
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            New moves go to your selected iCloud folder.
                          </p>
                        </div>
                        <button
                          onClick={handleToggleIcloudDestination}
                          disabled={settingsSaving}
                          className={clsx(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition",
                            settings.useIcloudDestination
                              ? "bg-emerald-500/70"
                              : "bg-white/10",
                            settingsSaving && "opacity-60 cursor-wait",
                          )}
                          aria-label="Toggle iCloud destination"
                        >
                          <span
                            className={clsx(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition",
                              settings.useIcloudDestination
                                ? "translate-x-4"
                                : "translate-x-1",
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-neutral-500">
                          Destination folder
                        </span>
                        <span
                          className="text-[10px] text-neutral-400 truncate"
                          title={settings.icloudDestinationPath || undefined}
                        >
                          {settings.icloudDestinationPath || "Not set"}
                        </span>
                        <button
                          onClick={handleSelectIcloudPath}
                          className="text-[10px] text-sky-300 hover:text-sky-200 font-medium transition-colors"
                        >
                          Choose
                        </button>
                      </div>

                      <p className="text-[10px] text-neutral-500">
                        Organized files are stored in a MacZen folder inside
                        the destination.
                      </p>
                    </div>

                    {settingsError && (
                      <p className="text-xs text-red-400">{settingsError}</p>
                    )}
                  </div>
                )}
                </div>
              </div>

              <div className="flex justify-end p-4 border-t border-white/[0.08] bg-neutral-950/85">
                <button
                  onClick={() => setShowSettings(false)}
                  className="min-w-24 py-2 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture Mode Modal */}
      <AnimatePresence>
        {showCaptureMode && (
          <CaptureMode
            onClose={() => setShowCaptureMode(false)}
            onCaptureComplete={() => {
              // Refresh files after capture
              scanFiles();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
