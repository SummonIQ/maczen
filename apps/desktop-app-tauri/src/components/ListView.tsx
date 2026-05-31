import { useState, useRef, useEffect, memo } from "react";
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
  Cloud,
  RefreshCw,
  Pencil,
} from "lucide-react";
import { getRecentAlbums, addRecentAlbum } from "../utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";

interface ListViewProps {
  files: FileItem[];
  isScreenshot: (file: FileItem) => boolean;
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
  onOpenGallery?: (file: FileItem) => void;
  draggedPath?: string | null;
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

function ListView({
  files,
  isScreenshot,
  albums,
  theme,
  isScrolling,
  onMove,
  onNewAlbum,
  onDelete,
  onRenameFile,
  onRevealInFinder,
  onOpenGallery,
  draggedPath,
  onDragStart,
  onDragEnd,
}: ListViewProps) {
  return (
    <div className="overflow-hidden">
      {files.map((file) => (
        <MemoizedListItem
          key={file.path}
          file={file}
          isScreenshot={isScreenshot(file)}
          albums={albums}
          theme={theme}
          isScrolling={isScrolling}
          onMove={onMove}
          onNewAlbum={onNewAlbum}
          onDelete={onDelete}
          onRenameFile={onRenameFile}
          onRevealInFinder={onRevealInFinder}
          onOpenGallery={onOpenGallery}
          isDraggingItem={draggedPath === file.path}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </div>
  );
}

const MemoizedListItem = memo(ListItem, areListItemsEqual);
export default memo(ListView, areListViewsEqual);

interface ListItemProps {
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

function ListItem({
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
  onOpenGallery,
  isDraggingItem,
  onDragStart,
  onDragEnd,
}: ListItemProps) {
  const initialThumbnail = getCachedThumbnail(file.path);
  const [thumbnail, setThumbnail] = useState<string | null>(initialThumbnail);
  const [thumbnailStatus, setThumbnailStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >(initialThumbnail ? "loaded" : "idle");
  const [thumbnailAttempts, setThumbnailAttempts] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isInViewport, setIsInViewport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentAlbums, setRecentAlbums] = useState<string[]>([]);
  const [openUpward, setOpenUpward] = useState(false);
  const [renamingFile, setRenamingFile] = useState(false);
  const [editingFileName, setEditingFileName] = useState(file.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const thumbnailRequestIdRef = useRef(0);
  const suppressItemClickRef = useRef(false);
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
  const getAlbumDepth = (name: string) =>
    Math.max(0, name.split("/").filter(Boolean).length - 1);
  const getAlbumLabel = (name: string) => {
    const parts = name.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? name;
  };
  const handleImgError = () => {
    deleteCachedThumbnail(file.path);
    setThumbnail(null);
    setThumbnailStatus("error");
  };

  useEffect(() => {
    const cached = getCachedThumbnail(file.path);
    setThumbnail(cached);
    setThumbnailStatus(cached ? "loaded" : "idle");
    setThumbnailAttempts(0);
    setRetryKey((k) => k + 1);
  }, [file.path]);

  // Lazy load with IntersectionObserver
  useEffect(() => {
    const currentItem = itemRef.current;
    if (!currentItem) return;
    return observeVisibility(
      currentItem,
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
    setRenamingFile(false);
    setEditingFileName(file.name);
  }, [file.name, file.path]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowNewProjectInput(false);
        setSearchQuery("");
      }
    };

    if (showMenu) {
      // Load recent albums when menu opens
      setRecentAlbums(getRecentAlbums());
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

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
      const { promise: thumbnailPromise } = getOrLoadThumbnail(file.path, async () => {
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
      const dataUrl = await thumbnailPromise;

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

  const handleMove = (albumName: string) => {
    addRecentAlbum(albumName);
    onMove(file.path, albumName, media.isImage);
    setShowMenu(false);
    setSearchQuery("");
  };

  const filteredAlbums = searchQuery.trim()
    ? albums.filter((album) =>
        album.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : albums;

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredAlbums.length === 1) {
      handleMove(filteredAlbums[0]);
    }
  };

  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const handleToggleMenu = () => {
    if (!showMenu && buttonRef.current) {
      // Check if menu would overflow bottom of screen
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 400; // Approximate max menu height
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      // Open upward if not enough space below and more space above
      setOpenUpward(spaceBelow < menuHeight && spaceAbove > spaceBelow);

      // Calculate position for fixed positioning
      setMenuPosition({
        top:
          spaceBelow < menuHeight && spaceAbove > spaceBelow
            ? buttonRect.top - menuHeight - 12
            : buttonRect.bottom + 12,
        left: buttonRect.right - 240, // 240px is the menu width (60 * 4)
      });
    }
    setShowMenu(!showMenu);
  };

  const handleNewAlbum = async () => {
    const nextName = newProjectName.trim();
    if (nextName) {
      await Promise.resolve(onNewAlbum(nextName));
      handleMove(nextName);
      setNewProjectName("");
      setShowNewProjectInput(false);
    }
  };

  const formatDate = (value: unknown) => {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

  const handleItemDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDragStart) return;
    suppressItemClickRef.current = true;
    onDragStart(event, file, itemRef.current, dragPointerRef.current);
  };

  const handleItemPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
  };

  const handleItemDragEnd = () => {
    onDragEnd?.();
    window.setTimeout(() => {
      suppressItemClickRef.current = false;
    }, 0);
  };

  const handleItemClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (suppressItemClickRef.current) {
      suppressItemClickRef.current = false;
      return;
    }
    onOpenGallery?.(file);
  };

  return (
    <div
      ref={itemRef}
      data-file-path={file.path}
      draggable={Boolean(onDragStart) && !renamingFile}
      onPointerDown={handleItemPointerDown}
      onDragStart={handleItemDragStart}
      onDragEnd={handleItemDragEnd}
      onClick={handleItemClick}
      className={clsx(
        "group flex h-[82px] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-200",
        isDark ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]",
        isDraggingItem && "opacity-50",
        onDragStart && !renamingFile && "cursor-grab active:cursor-grabbing",
      )}
    >
      {/* Thumbnail */}
      <div
        className={clsx(
          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
          isDark
            ? "border-white/10 bg-neutral-950/65"
            : "border-slate-200 bg-slate-100"
        )}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={file.name}
            className="h-full w-full object-cover"
            onError={handleImgError}
          />
        ) : (
          <div className="flex items-center justify-center text-slate-400">
            {thumbnailStatus === "error" ? (
              <Tooltip content="Retry preview">
                <button
                  onClick={handleRetryThumbnail}
                  className="inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 p-1.5"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </Tooltip>
            ) : media.isVideo ? (
              <VideoIcon className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
          </div>
        )}
      </div>

      {/* File info */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3
            className={clsx(
              "min-w-0 mt-[2px] flex-1 max-w-[380px] text-[13px] font-semibold",
              isDark ? "text-slate-100" : "text-slate-900"
            )}
          >
            {renamingFile ? (
              <input
                value={editingFileName}
                onChange={(event) => setEditingFileName(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                onBlur={() => {
                  suppressItemClickRef.current = true;
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
                className="w-full rounded border border-white/25 bg-black/35 px-1.5 py-0.5 text-[13px] font-semibold text-white outline-none"
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
                    "select-text block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-[13px] font-semibold py-[1px] rounded-md transition-colors",
                    isDark
                      ? "text-inherit hover:text-white hover:bg-black/35"
                      : "text-inherit hover:text-slate-950 hover:bg-black/8",
                  )}
                >
                  {file.name}
                </button>
              </Tooltip>
            )}
          </h3>
          <span
            className={clsx(
              "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider",
              media.isImage
                ? "bg-neutral-800/60 text-neutral-400 border border-neutral-600/30"
                : "bg-neutral-800/60 text-neutral-400 border border-neutral-600/30"
            )}
          >
            {media.label}
          </span>
          {isIcloudItem && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full pl-0.5 pr-2 py-0.5 text-[9px] font-semibold tracking-wide bg-sky-500/10 text-sky-200/80 border border-sky-500/20">
              <Cloud className="h-3 w-3" />
              iCloud
            </span>
          )}
        </div>
        <p
          className={clsx(
            "mt-0.5 text-xs",
            isDark ? "text-slate-400" : "text-slate-600"
          )}
        >
          {formatDate(file.modified)}
        </p>
        {file.album ? (
          <p
            className={clsx(
              "mt-0.5 text-[11px]",
              isDark ? "text-slate-500" : "text-slate-500",
            )}
          >
            Album:{" "}
            <span className={clsx(isDark ? "text-slate-300" : "text-slate-700")}>
              {getAlbumLabel(file.album)}
            </span>
          </p>
        ) : null}
      </div>

      {/* Delete and Move buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
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
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleMenu();
            }}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
              isDark
                ? "bg-white/[0.08] text-white hover:bg-white/[0.14]"
                : "bg-slate-900/80 text-white hover:bg-slate-900"
            )}
          >
            Move
            <ChevronDown
              className={clsx(
                "h-3 w-3 transition-transform",
                showMenu && openUpward && "rotate-180"
              )}
            />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                "fixed w-60 overflow-hidden rounded-xl border z-[100]",
                "bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border-neutral-800/40",
                openUpward && "flex flex-col-reverse"
              )}
              style={{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                boxShadow:
                  "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.2)",
              }}
            >
              {/* Search Input */}
              <div
                className={clsx(
                  "p-2 bg-gradient-to-br from-neutral-950/30 to-neutral-950/80",
                  openUpward
                    ? "border-t border-neutral-800/40"
                    : "border-b border-neutral-800/40"
                )}
              >
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
                  <div
                    className={clsx(
                      "mt-1.5",
                      openUpward
                        ? "border-b border-neutral-800/20"
                        : "border-t border-neutral-800/20"
                    )}
                  >
                    <div className="flex flex-wrap gap-1.5 pb-0.5">
                      {recentAlbums
                        .filter((p) => albums.includes(p))
                        .map((album) => (
                          <button
                            key={album}
                            onClick={() => handleMove(album)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-purple-600/20 hover:bg-purple-600/50 text-purple-300/70 hover:text-purple-200 transition-all border border-purple-500/20 hover:border-purple-400/50"
                            title={album}
                          >
                            <span className="max-w-[80px] truncate inline-block">
                              {getAlbumLabel(album)}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto py-1 px-1">
                {filteredAlbums.length > 0 ? (
                  filteredAlbums.map((album) => {
                    const isSingleMatch = filteredAlbums.length === 1;
                    return (
                      <button
                        key={album}
                        onClick={() => handleMove(album)}
                        className={clsx(
                          "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition-all mb-0.5 last:mb-0",
                          isSingleMatch
                            ? "text-white bg-purple-600/70 hover:bg-purple-600/80 shadow-md shadow-purple-900/30"
                            : "text-slate-200 hover:bg-neutral-800/60 hover:shadow-md hover:shadow-black/20"
                        )}
                        style={{
                          paddingLeft: `${10 + getAlbumDepth(album) * 10}px`,
                        }}
                      >
                        <span className="truncate" title={album}>
                          {getAlbumLabel(album)}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-2 text-center text-xs text-slate-400">
                    {searchQuery ? "No matching albums" : "No albums yet"}
                  </div>
                )}
              </div>

              <div className="border-t border-neutral-800/40 p-2 bg-gradient-to-br from-neutral-950/30 to-neutral-950/80">
                {showNewProjectInput ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleNewAlbum();
                        if (e.key === "Escape") {
                          setShowNewProjectInput(false);
                          setNewProjectName("");
                        }
                      }}
                      placeholder="Album name"
                      autoFocus
                      className="w-full rounded-lg border border-neutral-600/40 bg-neutral-950/80 px-3 py-2 text-sm text-white outline-none transition focus:border-purple-500/50"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleNewAlbum}
                        className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.02]"
                      >
                        Create
                      </button>
                      <button
                        onClick={() => {
                          setShowNewProjectInput(false);
                          setNewProjectName("");
                        }}
                        className="flex-1 rounded-lg bg-neutral-800/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-neutral-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewProjectInput(true)}
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
                        filter: "drop-shadow(0 0 4px rgba(192, 132, 252, 0.6))",
                      }}
                    />
                    <span>New Album</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function areAlbumListsEqual(prev: string[], next: string[]) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function areListItemsEqual(prev: ListItemProps, next: ListItemProps) {
  return (
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
    areAlbumListsEqual(prev.albums, next.albums)
  );
}

function areListViewsEqual(prev: ListViewProps, next: ListViewProps) {
  return (
    prev.files === next.files &&
    prev.albums === next.albums &&
    prev.theme === next.theme &&
    prev.isScrolling === next.isScrolling &&
    prev.draggedPath === next.draggedPath &&
    prev.isScreenshot === next.isScreenshot &&
    Boolean(prev.onDragStart) === Boolean(next.onDragStart) &&
    Boolean(prev.onDragEnd) === Boolean(next.onDragEnd)
  );
}
