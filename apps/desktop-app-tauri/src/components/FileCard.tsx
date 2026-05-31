import { useState, useEffect, useRef, memo } from "react";
import clsx from "clsx";
import { FileItem } from "../types";
import { getMediaPresentation } from "../lib/media";
import {
  deleteCachedThumbnail,
  getCachedThumbnail,
  getOrLoadThumbnail,
} from "../lib/thumbnail-cache";
import { observeVisibility } from "../lib/visibility-observer";

const THUMBNAIL_PREFETCH_ROOT_MARGIN = "600px";
const THUMBNAIL_LOAD_DELAY_MS = 45;
const ICLOUD_THUMBNAIL_LOAD_DELAY_MS = 25;
const MAX_ICLOUD_THUMBNAIL_ATTEMPTS = 5;
const ICLOUD_THUMBNAIL_RETRY_BASE_DELAY_MS = 1500;
const ICLOUD_THUMBNAIL_RETRY_MAX_DELAY_MS = 15000;
const INTERACTIVE_SELECTOR =
  "button, input, textarea, a, [role='button'], [contenteditable='true']";
import {
  ChevronDown,
  Plus,
  Image as ImageIcon,
  Video as VideoIcon,
  Search,
  Trash2,
  Ellipsis,
  FolderOpen,
  Pencil,
  Cloud,
  RefreshCw,
} from "lucide-react";
import { getRecentAlbums, addRecentAlbum } from "../utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";

interface FileCardProps {
  file: FileItem;
  isScreenshot: boolean;
  albums: string[];
  theme: "dark" | "light";
  isScrolling: boolean;
  onMove: (
    filePath: string,
    albumName: string,
    isScreenshot: boolean
  ) => void;
  onNewAlbum: (albumName: string) => Promise<void> | void;
  onDelete: (filePath: string) => void;
  onRenameFile?: (filePath: string, newName: string) => Promise<void> | void;
  onRevealInFinder?: (filePath: string) => void;
  onRenameAlbum?: (oldName: string, newName: string) => void;
  onOpenGallery?: (file: FileItem) => void;
  isDraggingItem?: boolean;
  onDragStart?: (
    event: React.DragEvent<HTMLElement>,
    file: FileItem,
    dragPreviewElement?: HTMLElement | null,
    pointerAnchor?: {
      clientX: number;
      clientY: number;
      offsetX?: number;
      offsetY?: number;
      hotspotOffsetY?: number;
    } | null,
  ) => void;
  onDragEnd?: () => void;
}

function FileCard({
  file,
  isScreenshot,
  albums,
  theme,
  isScrolling,
  onMove,
  onNewAlbum,
  onDelete,
  onRenameFile,
  onRevealInFinder,
  onRenameAlbum,
  onOpenGallery,
  isDraggingItem,
  onDragStart,
  onDragEnd,
}: FileCardProps) {
  const initialThumbnail = getCachedThumbnail(file.path);
  const [thumbnail, setThumbnail] = useState<string | null>(initialThumbnail);
  const [thumbnailStatus, setThumbnailStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >(initialThumbnail ? "loaded" : "idle");
  const [thumbnailAttempts, setThumbnailAttempts] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentAlbums, setRecentAlbums] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [isInViewport, setIsInViewport] = useState(true);
  const [editingAlbum, setEditingAlbum] = useState<string | null>(null);
  const [editingAlbumName, setEditingAlbumName] = useState("");
  const [renamingFile, setRenamingFile] = useState(false);
  const [editingFileName, setEditingFileName] = useState(file.name);
  const cardRef = useRef<HTMLDivElement>(null);
  const thumbnailRequestIdRef = useRef(0);
  const thumbnailCancelRef = useRef<(() => void) | null>(null);
  const suppressCardClickRef = useRef(false);
  const dragPointerRef = useRef<{
    clientX: number;
    clientY: number;
    offsetX?: number;
    offsetY?: number;
    hotspotOffsetY?: number;
  } | null>(null);
  const isDark = theme === "dark";
  const isIcloudItem = file.path.startsWith("photos://");
  const media = getMediaPresentation(file, isScreenshot);
  const isImage = media.isImage;
  const cardBottomBorderColor = isDark
    ? "rgba(11, 11, 17, 0.96)"
    : "rgba(204, 204, 210, 0.94)";
  const getAlbumDepth = (name: string) =>
    Math.max(0, name.split("/").filter(Boolean).length - 1);
  const getAlbumLabel = (name: string) => {
    const parts = name.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? name;
  };
  const handleImgError = () => {
    // If the data URL is a format Chromium can’t render (e.g. HEIC), we’d otherwise show a blank tile.
    deleteCachedThumbnail(file.path);
    setThumbnail(null);
    setThumbnailStatus("error");
  };

  // Reset thumbnail state when the file changes
  useEffect(() => {
    const cached = getCachedThumbnail(file.path);
    setThumbnail(cached);
    setThumbnailStatus(cached ? "loaded" : "idle");
    setThumbnailAttempts(0);
    setRetryKey((k) => k + 1);
  }, [file.path]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const currentCard = cardRef.current;
    if (!currentCard) return;
    return observeVisibility(
      currentCard,
      (isIntersecting) => {
        setIsInViewport(isIntersecting);
        if (isIntersecting) setIsVisible(true);
      },
      THUMBNAIL_PREFETCH_ROOT_MARGIN,
    );
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    if (!isInViewport) return;
    const cached = getCachedThumbnail(file.path);
    if (cached) {
      if (thumbnail !== cached) {
        setThumbnail(cached);
      }
      if (thumbnailStatus !== "loaded") {
        setThumbnailStatus("loaded");
      }
      return;
    }
    if (thumbnailStatus !== "idle") return;
    const delayMs = isIcloudItem
      ? ICLOUD_THUMBNAIL_LOAD_DELAY_MS
      : THUMBNAIL_LOAD_DELAY_MS;
    const t = window.setTimeout(() => {
      if (!isInViewport) return;
      void loadThumbnail();
    }, delayMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isVisible,
    isInViewport,
    file.path,
    isIcloudItem,
    retryKey,
    thumbnailStatus,
    thumbnail,
  ]);

  // Auto-retry a couple times for iCloud/Photos items (they can fail during dev restarts)
  useEffect(() => {
    if (isScrolling) return;
    if (!isVisible) return;
    if (!isInViewport) return;
    if (!isIcloudItem) return;
    if (thumbnailStatus !== "error") return;
    if (thumbnailAttempts >= MAX_ICLOUD_THUMBNAIL_ATTEMPTS) return;
    const retryDelay = Math.min(
      ICLOUD_THUMBNAIL_RETRY_BASE_DELAY_MS * 2 ** thumbnailAttempts,
      ICLOUD_THUMBNAIL_RETRY_MAX_DELAY_MS,
    );
    const t = window.setTimeout(() => {
      setThumbnailAttempts((n) => n + 1);
      setThumbnailStatus("idle");
      setRetryKey((k) => k + 1);
    }, retryDelay);
    return () => window.clearTimeout(t);
  }, [
    isScrolling,
    isVisible,
    isInViewport,
    isIcloudItem,
    thumbnailStatus,
    thumbnailAttempts,
  ]);

  useEffect(() => {
    if (showMenu) {
      setRecentAlbums(getRecentAlbums());
    }
  }, [showMenu]);

  useEffect(() => {
    setRenamingFile(false);
    setEditingFileName(file.name);
  }, [file.name, file.path]);

  useEffect(() => {
    return () => {
      thumbnailCancelRef.current?.();
    };
  }, []);

  const loadThumbnail = async () => {
    const cached = getCachedThumbnail(file.path);
    if (cached) {
      setThumbnail(cached);
      setThumbnailStatus("loaded");
      return;
    }

    const requestId = ++thumbnailRequestIdRef.current;
    try {
      setThumbnailStatus("loading");
      const timeoutMs = isIcloudItem ? 25_000 : 12_000;
      thumbnailCancelRef.current?.();
      const { promise, cancel } = getOrLoadThumbnail(file.path, async () => {
        const op = isScreenshot
          ? window.electronAPI.getFileDataUrl(file.path)
          : window.electronAPI.generateVideoThumbnail(file.path);
        return await Promise.race<string | null>([
          op,
          new Promise<string | null>((resolve) =>
            window.setTimeout(() => resolve(null), timeoutMs),
          ),
        ]);
      });
      thumbnailCancelRef.current = cancel;
      const dataUrl = await promise;

      // If a newer request started, ignore this result.
      if (requestId !== thumbnailRequestIdRef.current) return;
      if (dataUrl) {
        setThumbnail(dataUrl);
        setThumbnailStatus("loaded");
      } else {
        console.warn("Thumbnail returned null:", file.path);
        setThumbnailStatus("error");
      }
    } catch (error) {
      if (requestId !== thumbnailRequestIdRef.current) return;
      console.error("Error loading thumbnail:", error);
      setThumbnailStatus("error");
    }
  };

  const handleRetryThumbnail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isIcloudItem) {
      void window.electronAPI.requestPhotosAccess();
    }
    setThumbnailStatus("idle");
    setThumbnailAttempts(0);
    setRetryKey((k) => k + 1);
  };

  const handleMove = (e: React.MouseEvent | null, albumName: string) => {
    e?.stopPropagation();
    addRecentAlbum(albumName);
    onMove(file.path, albumName, isImage);
    setShowMenu(false);
    setSearchQuery("");
  };

  const handleOpenChange = (open: boolean) => {
    setShowMenu(open);
    if (!open) {
      setShowNewAlbumInput(false);
      setSearchQuery("");
    }
  };

  const handleNewAlbum = async () => {
    const name = newAlbumName.trim();
    if (name) {
      await Promise.resolve(onNewAlbum(name));
      handleMove(null, name);
      setNewAlbumName("");
      setShowNewAlbumInput(false);
    }
  };

  const formatDate = (value: unknown) => {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const filteredAlbums = searchQuery.trim()
    ? albums.filter((album) =>
        album.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : albums;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredAlbums.length === 1) {
      handleMove(null, filteredAlbums[0]);
    }
  };

  const handleCardDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDragStart) return;
    suppressCardClickRef.current = true;
    onDragStart(event, file, cardRef.current, dragPointerRef.current);
  };

  const handleCardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const thumbnailElement = event.currentTarget.querySelector<HTMLElement>(
      "[data-drag-thumbnail]"
    );
    const thumbnailRect = thumbnailElement?.getBoundingClientRect();
    const detailsHeightBelowThumbnail = thumbnailRect
      ? Math.max(0, rect.bottom - thumbnailRect.bottom)
      : 0;
    const pointerInsideThumbnail = thumbnailRect
      ? event.clientY <= thumbnailRect.bottom + 0.5
      : false;
    dragPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      hotspotOffsetY: pointerInsideThumbnail ? detailsHeightBelowThumbnail : 0,
    };
  };

  const handleCardDragEnd = () => {
    onDragEnd?.();
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
  };

  const handleCardClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (suppressCardClickRef.current) {
      suppressCardClickRef.current = false;
      return;
    }
    onOpenGallery?.(file);
  };

  const startFileRename = (event?: React.MouseEvent | React.KeyboardEvent) => {
    event?.stopPropagation();
    if (!onRenameFile) return;
    setEditingFileName(file.name);
    setRenamingFile(true);
  };

  const cancelFileRename = () => {
    setEditingFileName(file.name);
    setRenamingFile(false);
  };

  const commitFileRename = async () => {
    if (!onRenameFile) {
      setRenamingFile(false);
      return;
    }
    const nextName = editingFileName.trim();
    if (!nextName) {
      setEditingFileName(file.name);
      setRenamingFile(false);
      return;
    }
    if (nextName === file.name) {
      setRenamingFile(false);
      return;
    }
    await Promise.resolve(onRenameFile(file.path, nextName));
    setRenamingFile(false);
  };

  return (
    <div
      ref={cardRef}
      draggable={Boolean(onDragStart) && !renamingFile}
      onPointerDown={handleCardPointerDown}
      onDragStart={handleCardDragStart}
      onDragEnd={handleCardDragEnd}
      onClick={handleCardClick}
      className={clsx(
        "group relative overflow-hidden rounded-lg transition-all duration-300 shadow-xl hover:shadow-[0_8px_30px_-8px_rgba(139,92,246,0.2)] border-t border-b",
        isDark
          ? "bg-black/10 hover:bg-neutral-950/85"
          : "bg-white/80 hover:bg-white/95",
        "border-t-white/10",
        isDraggingItem && "opacity-50",
        onDragStart && !renamingFile && "cursor-grab active:cursor-grabbing",
      )}
      style={{ borderBottomColor: cardBottomBorderColor }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-55">
        <div className="absolute inset-x-0 bottom-[-120px] h-40 bg-gradient-to-t from-black/40 via-transparent" />
      </div>

      {/* Thumbnail */}
      <div
        data-drag-thumbnail
        className={clsx(
          "relative z-10 aspect-video border-l border-l-border/40 border-r border-r-border/40 overflow-hidden flex items-center justify-center rounded-t-[inherit] cursor-pointer",
          isDark ? "bg-black/15" : "bg-slate-100"
        )}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={file.name}
            className="h-full w-full object-contain"
            onError={handleImgError}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            {media.isVideo ? (
              <VideoIcon className="h-10 w-10" />
            ) : (
              <ImageIcon className="h-10 w-10" />
            )}
            {thumbnailStatus === "error" ? (
              <>
                <span className="text-xs tracking-wide uppercase">
                  Preview unavailable
                </span>
                <button
                  onClick={handleRetryThumbnail}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </>
            ) : (
              <span className="text-xs tracking-wide uppercase">
                Loading preview
              </span>
            )}
          </div>
        )}

        <div
          className={clsx(
            "absolute left-2.5 top-2.5 flex max-w-[78%] items-center gap-1.5 rounded-full py-1 text-[9px] font-medium tracking-wide backdrop-blur-md",
            isIcloudItem ? "pl-1 pr-2" : "px-2.5",
            isImage
              ? "bg-neutral-900/60 text-neutral-400 border border-neutral-600/30"
              : "bg-neutral-900/60 text-neutral-400 border border-neutral-600/30"
          )}
        >
          {isIcloudItem && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 pl-0.5 pr-1.5 py-0.5 text-[9px] font-semibold text-sky-200/80 border border-sky-500/20">
              <Cloud className="h-3 w-3" />
              iCloud
            </span>
          )}
          <span>{media.label}</span>
        </div>
        {file.album ? (
          <div className="absolute bottom-2.5 right-2.5 max-w-[70%] rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10px] font-medium text-slate-200 backdrop-blur-md">
            <span className="truncate block">{getAlbumLabel(file.album)}</span>
          </div>
        ) : null}
      </div>

      {/* Info section */}
      <div
        className={clsx(
          "relative pb-4 pt-3.5 overflow-hidden backdrop-blur-sm bg-neutral-800 rounded-b-[inherit]",
          "px-4",
          isDark ? "bg-white/[0.07]" : "bg-white/70",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className={clsx(
                "min-w-0 mt-[2px] text-sm font-semibold tracking-tight",
                "text-slate-50",
              )}
            >
              {renamingFile ? (
                <input
                  value={editingFileName}
                  onChange={(event) => setEditingFileName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onBlur={() => {
                    suppressCardClickRef.current = true;
                    cancelFileRename();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      void commitFileRename();
                    }
                    if (event.key === "Escape") {
                      cancelFileRename();
                    }
                  }}
                  autoFocus
                  data-no-open-gallery="true"
                  className="w-full rounded border border-white/25 bg-black/35 px-1.5 py-0.5 text-sm font-semibold text-white outline-none"
                />
              ) : (
                <Tooltip content="Edit filename">
                  <button
                    type="button"
                    onClick={startFileRename}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                    }}
                    data-no-open-gallery="true"
                    data-no-focus-ring="true"
                    className={clsx(
                      "select-text block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-semibold tracking-tight py-[1px] rounded-md transition-colors",
                      isDark
                        ? "text-slate-50 hover:text-white hover:bg-black/35"
                        : "text-slate-900 hover:text-slate-950 hover:bg-black/8",
                    )}
                  >
                    {file.name}
                  </button>
                </Tooltip>
              )}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(file.modified)}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
              <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
                <Tooltip content="More actions" disabled={showMoreMenu} delayMs={50}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreMenu((prev) => !prev);
                      }}
                      data-no-focus-ring="true"
                      className={clsx(
                        "flex items-center justify-center rounded-full p-1.5 transition-all",
                        isDark
                          ? "bg-white/[0.08] text-slate-300 hover:bg-white/[0.14] hover:text-white data-[tooltip-open=true]:bg-white/[0.14] data-[tooltip-open=true]:text-white"
                          : "bg-slate-200/80 text-slate-500 hover:bg-slate-200 hover:text-slate-800 data-[tooltip-open=true]:bg-slate-200 data-[tooltip-open=true]:text-slate-800"
                      )}
                      aria-label="More actions"
                    >
                      <Ellipsis className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent
                  align="end"
                  sideOffset={4}
                  className="w-44 overflow-hidden rounded-xl p-1 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border border-neutral-700/40"
                >
                  {onRenameFile ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreMenu(false);
                        startFileRename();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-neutral-800/70 hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Rename</span>
                    </button>
                  ) : null}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoreMenu(false);
                      onRevealInFinder?.(file.path);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-200 transition-colors hover:bg-neutral-800/70 hover:text-white"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Reveal in Finder</span>
                  </button>
                </PopoverContent>
              </Popover>
            <Tooltip content="Delete">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.path);
                }}
                data-no-focus-ring="true"
                aria-label="Delete"
                className={clsx(
                  "flex items-center justify-center rounded-full p-1.5 transition-all",
                  isDark
                    ? "bg-white/[0.08] text-slate-300 hover:bg-red-900/45 hover:text-red-500"
                    : "bg-slate-200/80 text-slate-500 hover:bg-red-200/80 hover:text-red-500"
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Popover open={showMenu} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-all",
                    isDark
                      ? "bg-white/[0.08] text-white hover:bg-white/[0.14]"
                      : "bg-slate-900/80 text-white hover:bg-slate-900"
                  )}
                >
                  Move
                  <ChevronDown
                    className={clsx(
                      "h-3 w-3 transition-transform",
                      showMenu && "rotate-180"
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={4}
                className="w-60 overflow-hidden rounded-xl p-0 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.6),0_10px_10px_-5px_rgba(0,0,0,0.5)] border border-neutral-700/40"
              >
                {/* Search Input */}
                <div className="p-2 bg-gradient-to-br from-neutral-950/30 to-neutral-950/80 border-b border-neutral-800/40">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search albums..."
                      autoFocus
                      className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs bg-neutral-950/80 text-white border border-neutral-600/40 placeholder-neutral-500 focus:border-purple-500/50 outline-none transition"
                    />
                  </div>
                  {/* Recent Albums Quick Access */}
                  {!searchQuery && recentAlbums.length > 0 && (
                    <div className="mt-1.5 border-t border-t-border">
                      <div className="flex flex-wrap gap-1.5 pb-0.5 pt-2">
                        {recentAlbums
                          .filter((p) => albums.includes(p))
                          .map((album) => (
                            <button
                              key={album}
                              onClick={(e) => handleMove(e, album)}
                              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-600/20 hover:bg-purple-600/50 text-purple-300/70 hover:text-purple-200 transition-all border border-purple-500/20 hover:border-purple-400/50 flex items-center justify-center"
                              title={album}
                            >
                              <span className="max-w-[80px] truncate">
                                {getAlbumLabel(album)}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto py-1 px-1">
                  {filteredAlbums.length > 0 ? (
                    filteredAlbums.map((album) => {
                      const isSingleMatch = filteredAlbums.length === 1;
                      return (
                        <div
                          key={album}
                          className={clsx(
                            "group/item flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-all mb-0.5 last:mb-0",
                            isSingleMatch
                              ? "text-white bg-purple-600/70 hover:bg-purple-600/80 shadow-md shadow-purple-900/30"
                              : "text-slate-300 hover:bg-neutral-800/60"
                          )}
                          style={{
                            paddingLeft: `${10 + getAlbumDepth(album) * 10}px`,
                          }}
                        >
                          {editingAlbum === album ? (
                            <input
                              type="text"
                              value={editingAlbumName}
                              onChange={(e) =>
                                setEditingAlbumName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (
                                  e.key === "Enter" &&
                                  editingAlbumName.trim()
                                ) {
                                  if (
                                    onRenameAlbum &&
                                    editingAlbumName.trim() !== album
                                  ) {
                                    onRenameAlbum(
                                      album,
                                      editingAlbumName.trim()
                                    );
                                  }
                                  setEditingAlbum(null);
                                  setEditingAlbumName("");
                                }
                                if (e.key === "Escape") {
                                  setEditingAlbum(null);
                                  setEditingAlbumName("");
                                }
                              }}
                              onBlur={() => {
                                if (
                                  editingAlbumName.trim() &&
                                  editingAlbumName.trim() !== album &&
                                  onRenameAlbum
                                ) {
                                  onRenameAlbum(
                                    album,
                                    editingAlbumName.trim()
                                  );
                                }
                                setEditingAlbum(null);
                                setEditingAlbumName("");
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="flex-1 bg-transparent border-b border-purple-500/50 outline-none text-white text-xs"
                            />
                          ) : (
                            <>
                              <button
                                onClick={(e) => handleMove(e, album)}
                                className="flex-1 text-left truncate"
                                title={album}
                              >
                                {getAlbumLabel(album)}
                              </button>
                              <Pencil
                                className="h-3 w-3 text-slate-500 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 ml-2 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAlbum(album);
                                  setEditingAlbumName(album);
                                }}
                              />
                            </>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2.5 py-2 text-center text-[11px] text-slate-500">
                      {searchQuery ? "No matching albums" : "No albums yet"}
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-800/40 p-2 bg-gradient-to-br from-neutral-950/30 to-neutral-950/80">
                  {showNewAlbumInput ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleNewAlbum();
                          if (e.key === "Escape") {
                            setShowNewAlbumInput(false);
                            setNewAlbumName("");
                          }
                        }}
                        placeholder="Album name"
                        autoFocus
                        className="w-full rounded-lg border border-neutral-600/40 bg-neutral-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-purple-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNewAlbum();
                          }}
                          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-purple-300 transition-all bg-gradient-to-br from-neutral-900/80 to-neutral-950/90 hover:opacity-80 active:opacity-50 border-t border-b border-t-white/15 border-b-neutral-800/50"
                        >
                          Create
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNewAlbumInput(false);
                            setNewAlbumName("");
                          }}
                          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all bg-gradient-to-br from-neutral-900/80 to-neutral-950/90 hover:opacity-80 active:opacity-50 border-t border-b border-t-white/10 border-b-neutral-800/50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowNewAlbumInput(true);
                      }}
                      className="w-full font-semibold relative group shadow-md shadow-black/30 opacity-90 hover:opacity-100 active:opacity-50 py-1.5 px-3 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-all duration-300 bg-gradient-to-br from-neutral-900/80 to-neutral-950/90 text-purple-400"
                      style={{
                        borderTop: "1px solid rgba(255, 255, 255, 0.19)",
                        borderLeft: "1px solid rgba(140, 140, 140, 0.10)",
                        borderRight: "1px solid rgba(140, 140, 140, 0.10)",
                        borderBottom: "1px solid rgba(50, 50, 50, 0.2)",
                        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.01)",
                        textShadow:
                          "0 0 10px rgba(192, 132, 252, 0.5), 0 0 20px rgba(192, 132, 252, 0.3)",
                      }}
                    >
                      <Plus
                        className="h-3.5 w-3.5"
                        style={{
                          filter:
                            "drop-shadow(0 0 4px rgba(192, 132, 252, 0.6))",
                        }}
                      />
                      <span>New Album</span>
                    </button>
                  )}
                </div>
                  </PopoverContent>
                </Popover>
	              </div>
	            </div>
	      </div>
	    </div>
	  );
}

const areAlbumListsEqual = (prev: string[], next: string[]) => {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
};

const areFileCardsEqual = (prev: FileCardProps, next: FileCardProps) =>
  prev.file.path === next.file.path &&
  prev.file.name === next.file.name &&
  prev.file.size === next.file.size &&
  String(prev.file.modified) === String(next.file.modified) &&
  prev.file.mediaType === next.file.mediaType &&
  prev.file.isLivePhoto === next.file.isLivePhoto &&
  (prev.file.album ?? null) === (next.file.album ?? null) &&
  prev.isScreenshot === next.isScreenshot &&
  prev.theme === next.theme &&
  prev.isScrolling === next.isScrolling &&
  prev.isDraggingItem === next.isDraggingItem &&
  Boolean(prev.onDragStart) === Boolean(next.onDragStart) &&
  Boolean(prev.onDragEnd) === Boolean(next.onDragEnd) &&
  areAlbumListsEqual(prev.albums, next.albums);

export default memo(FileCard, areFileCardsEqual);
