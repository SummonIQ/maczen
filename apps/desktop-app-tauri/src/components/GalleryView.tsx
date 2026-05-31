import { useEffect, useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Ellipsis,
  FolderOpen,
  X,
} from "lucide-react";

import { FileItem } from "../types";
import { getMediaPresentation } from "../lib/media";
import { getCachedThumbnail, getOrLoadThumbnail } from "../lib/thumbnail-cache";
import { addRecentAlbum, getRecentAlbums } from "../utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";

type GalleryViewProps = {
  files: FileItem[];
  isScreenshot: (file: FileItem) => boolean;
  projects: string[];
  theme: "dark" | "light";
  onMove: (
    filePath: string,
    projectName: string,
    isScreenshot: boolean,
  ) => void;
  onNewProject: (projectName: string) => Promise<void> | void;
  onDelete: (filePath: string) => void;
  onRevealInFinder?: (filePath: string) => void;
  onClose: () => void;
  onRenameProject?: (oldName: string, newName: string) => void;
  initialIndex?: number;
  onZoomChange?: (zoom: number) => void;
};

export default function GalleryView(props: GalleryViewProps) {
  const {
    files = [],
    theme,
    projects = [],
    initialIndex = 0,
    isScreenshot,
    onClose,
    onDelete,
    onRevealInFinder,
    onMove,
    onZoomChange,
    onNewProject,
    onRenameProject,
  } = props;

  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, files.length - 1)),
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [liveVideoUrl, setLiveVideoUrl] = useState<string | null>(null);
  const [playingLive, setPlayingLive] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [zoom, setZoom] = useState(1);

  const file = files[index];
  const dark = theme === "dark";
  const media = useMemo(() => {
    if (!file) {
      return {
        label: "Photo" as const,
        isVideo: false,
        isScreenRecording: false,
        isScreenshot: false,
        isImage: true,
      };
    }
    return getMediaPresentation(file, isScreenshot(file));
  }, [file, isScreenshot]);
  const isLivePhoto = !media.isVideo && Boolean(file?.isLivePhoto);
  const getProjectDepth = (name: string) =>
    Math.max(0, name.split("/").filter(Boolean).length - 1);
  const getProjectLabel = (name: string) => {
    const parts = name.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? name;
  };
  const filteredProjects = searchQuery.trim()
    ? projects.filter((project) =>
        project.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : projects;

  const canPrev = index > 0;
  const canNext = index < files.length - 1;

  useEffect(() => {
    if (showMoveMenu) {
      setRecentProjects(getRecentAlbums());
    }
  }, [showMoveMenu]);

  useEffect(() => {
    let cancelled = false;
    const cachedPreview = file ? getCachedThumbnail(file.path) : null;
    setPreviewUrl(cachedPreview);
    setVideoUrl(null);
    setLiveVideoUrl(null);
    setPlayingLive(false);
    setZoom(1);
    onZoomChange?.(1);

    const load = async () => {
      if (!file || !window.electronAPI) {
        setPreviewUrl(null);
        return;
      }

      try {
        if (media.isVideo) {
          const [poster, playbackUrl] = await Promise.all([
            getOrLoadThumbnail(file.path, () =>
              window.electronAPI.generateVideoThumbnail(file.path),
            ).promise,
            window.electronAPI.getVideoPlaybackUrl(file.path),
          ]);
          if (!cancelled) {
            setPreviewUrl(poster || null);
            setVideoUrl(playbackUrl || null);
          }
        } else {
          const [url, liveUrl] = await Promise.all([
            getOrLoadThumbnail(file.path, () =>
              window.electronAPI.getFileDataUrl(file.path),
            ).promise,
            isLivePhoto
              ? window.electronAPI.getLivePhotoVideoUrl(file.path)
              : Promise.resolve(null),
          ]);
          if (!cancelled) {
            setPreviewUrl(url || null);
            setLiveVideoUrl(liveUrl || null);
          }
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setVideoUrl(null);
          setLiveVideoUrl(null);
          setPlayingLive(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [file?.path, isLivePhoto, media.isVideo, onZoomChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((prev) => {
      const next = Math.min(3, Math.max(0.5, prev + delta));
      const resolved = Number.isFinite(next) ? next : prev;
      if (resolved !== prev) {
        onZoomChange?.(resolved);
      }
      return resolved;
    });
  }, [onZoomChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canPrev) setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight" && canNext) {
        setIndex((i) => Math.min(files.length - 1, i + 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, files.length, onClose]);

  const handleMove = (projectName: string) => {
    if (!projectName) return;
    addRecentAlbum(projectName);
    onMove(file.path, projectName, media.isImage);
    setShowMoveMenu(false);
    setShowNewProjectInput(false);
    setSearchQuery("");
  };

  const handleOpenChange = (open: boolean) => {
    setShowMoveMenu(open);
    if (!open) {
      setShowNewProjectInput(false);
      setNewProjectName("");
      setSearchQuery("");
      setEditingProject(null);
      setEditingProjectName("");
    }
  };

  const handleNewProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    await Promise.resolve(onNewProject(name));
    handleMove(name);
    setNewProjectName("");
    setShowNewProjectInput(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredProjects.length === 1) {
      handleMove(filteredProjects[0]);
    }
  };

  if (!file) return null;

  return (
    // Use absolute positioning so the app's title bar/header remains visible and we don't
    // affect layout/scrollbars behind the overlay.
    <div className="absolute inset-0 z-40 flex flex-col">
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        style={{ WebkitAppRegion: "no-drag" } as any}
      />

      <div className="relative z-10 flex flex-col h-full">
        <div
          className={clsx(
            "flex items-center justify-between gap-3 px-4 py-3 border-b",
            dark ? "border-neutral-900/95" : "border-black/10",
          )}
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <div className="min-w-0 flex-1">
            <div
              className={clsx(
                "select-text text-sm font-semibold truncate",
                dark ? "text-white" : "text-black",
              )}
            >
              {file.name}
            </div>
            <div
              className={clsx(
                "text-xs",
                dark ? "text-white/50" : "text-black/50",
              )}
            >
              {index + 1} / {files.length}
            </div>
            {file.album ? (
              <div
                className={clsx(
                  "text-xs",
                  dark ? "text-white/45" : "text-black/45",
                )}
              >
                Album: {getProjectLabel(file.album)}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Popover open={showMoveMenu} onOpenChange={handleOpenChange}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={clsx(
                    "h-8 px-3 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5",
                    dark
                      ? "bg-white/10 hover:bg-white/15 text-white border-white/10"
                      : "bg-black/10 hover:bg-black/15 text-black border-black/10",
                  )}
                >
                  Move to...
                  <ChevronDown
                    className={clsx(
                      "h-3 w-3 transition-transform",
                      showMoveMenu && "rotate-180",
                    )}
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={4}
                className="w-60 overflow-hidden rounded-xl p-0 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.6),0_10px_10px_-5px_rgba(0,0,0,0.5)] border border-neutral-700/40"
              >
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
                  {!searchQuery && recentProjects.length > 0 && (
                    <div className="mt-1.5 border-t border-t-border">
                      <div className="flex flex-wrap gap-1.5 pb-0.5 pt-2">
                        {recentProjects
                          .filter((project) => projects.includes(project))
                          .map((project) => (
                            <button
                              key={project}
                              onClick={() => handleMove(project)}
                              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-600/20 hover:bg-purple-600/50 text-purple-300/70 hover:text-purple-200 transition-all border border-purple-500/20 hover:border-purple-400/50 flex items-center justify-center"
                              title={project}
                            >
                              <span className="max-w-[80px] truncate">
                                {getProjectLabel(project)}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto py-1 px-1">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => {
                      const isSingleMatch = filteredProjects.length === 1;
                      return (
                        <div
                          key={project}
                          className={clsx(
                            "group/item flex w-full items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-all mb-0.5 last:mb-0",
                            isSingleMatch
                              ? "text-white bg-purple-600/70 hover:bg-purple-600/80 shadow-md shadow-purple-900/30"
                              : "text-slate-300 hover:bg-neutral-800/60",
                          )}
                          style={{
                            paddingLeft: `${10 + getProjectDepth(project) * 10}px`,
                          }}
                        >
                          {editingProject === project ? (
                            <input
                              type="text"
                              value={editingProjectName}
                              onChange={(e) =>
                                setEditingProjectName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Enter" && editingProjectName.trim()) {
                                  if (
                                    onRenameProject &&
                                    editingProjectName.trim() !== project
                                  ) {
                                    onRenameProject(
                                      project,
                                      editingProjectName.trim(),
                                    );
                                  }
                                  setEditingProject(null);
                                  setEditingProjectName("");
                                }
                                if (e.key === "Escape") {
                                  setEditingProject(null);
                                  setEditingProjectName("");
                                }
                              }}
                              onBlur={() => {
                                if (
                                  editingProjectName.trim() &&
                                  editingProjectName.trim() !== project &&
                                  onRenameProject
                                ) {
                                  onRenameProject(
                                    project,
                                    editingProjectName.trim(),
                                  );
                                }
                                setEditingProject(null);
                                setEditingProjectName("");
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className="flex-1 bg-transparent border-b border-purple-500/50 outline-none text-white text-xs"
                            />
                          ) : (
                            <>
                              <button
                                onClick={() => handleMove(project)}
                                className="flex-1 text-left truncate"
                                title={project}
                              >
                                {getProjectLabel(project)}
                              </button>
                              {onRenameProject && (
                                <Pencil
                                  className="h-3 w-3 text-slate-500 hover:text-white opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 ml-2 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProject(project);
                                    setEditingProjectName(project);
                                  }}
                                />
                              )}
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
                  {showNewProjectInput ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleNewProject();
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
                          onClick={() => void handleNewProject()}
                          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-purple-300 transition-all bg-gradient-to-br from-neutral-900/80 to-neutral-950/90 hover:opacity-80 active:opacity-50 border-t border-b border-t-white/15 border-b-neutral-800/50"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => {
                            setShowNewProjectInput(false);
                            setNewProjectName("");
                          }}
                          className="flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all bg-gradient-to-br from-neutral-900/80 to-neutral-950/90 hover:opacity-80 active:opacity-50 border-t border-b border-t-white/10 border-b-neutral-800/50"
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

            <Popover open={showMoreMenu} onOpenChange={setShowMoreMenu}>
              <PopoverTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  data-no-focus-ring="true"
                  className={clsx(
                    "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
                    dark
                      ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                      : "border-black/10 bg-black/5 text-black/70 hover:bg-black/10 hover:text-black",
                  )}
                  title="More actions"
                  aria-label="More actions"
                >
                  <Ellipsis className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={4}
                className="w-44 overflow-hidden rounded-xl p-1 bg-gradient-to-br from-neutral-900/95 to-neutral-950/95 backdrop-blur-xl border border-neutral-700/40"
              >
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
                onClick={() => onDelete(file.path)}
                data-no-focus-ring="true"
                className={clsx(
                  "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
                  dark
                    ? "border-white/10 bg-white/5 text-white/80 hover:bg-red-900/45 hover:text-red-500"
                    : "border-black/10 bg-black/5 text-black/70 hover:bg-red-200/80 hover:text-red-500",
                )}
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Tooltip>

            <button
              onClick={onClose}
              className={clsx(
                "h-8 w-8 rounded-lg border flex items-center justify-center transition-colors",
                dark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-white/70"
                  : "border-black/10 bg-black/5 hover:bg-black/10 text-black/70",
              )}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 flex items-center justify-center relative overflow-auto"
          onClick={onClose}
          onWheel={handleWheel}
        >
          <button
            disabled={!canPrev}
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.max(0, i - 1));
            }}
            className={clsx(
              "absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border flex items-center justify-center",
              canPrev
                ? dark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                  : "border-black/10 bg-black/5 hover:bg-black/10 text-black/80"
                : "opacity-30",
            )}
            style={{ WebkitAppRegion: "no-drag" } as any}
            title="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="w-full h-full flex items-center justify-center">
            {media.isVideo ? (
              videoUrl ? (
                <video
                  src={videoUrl}
                  poster={previewUrl || undefined}
                  controls
                  onClick={(e) => e.stopPropagation()}
                  className="block max-w-full max-h-full object-contain"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt={file.name}
                  onClick={(e) => e.stopPropagation()}
                  className="block max-w-full max-h-full object-contain"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                  }}
                />
              ) : (
                <div
                  className={clsx(
                    "w-full h-full flex items-center justify-center",
                    dark ? "text-white/60" : "text-black/60",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  Preview unavailable
                </div>
              )
            ) : previewUrl ? (
              <div className="relative">
                {playingLive && liveVideoUrl ? (
                  <video
                    src={liveVideoUrl}
                    autoPlay
                    muted
                    playsInline
                    onEnded={() => setPlayingLive(false)}
                    onClick={(e) => e.stopPropagation()}
                    className="block max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "center center",
                    }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    onClick={(e) => e.stopPropagation()}
                    className="block max-w-full max-h-full object-contain"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: "center center",
                    }}
                  />
                )}
                {isLivePhoto && liveVideoUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingLive((prev) => !prev);
                    }}
                    className={clsx(
                      "absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-xs font-semibold border backdrop-blur",
                      dark
                        ? "bg-white/10 text-white border-white/20 hover:bg-white/15"
                        : "bg-black/10 text-black border-black/20 hover:bg-black/15",
                    )}
                  >
                    {playingLive ? "Stop Live" : "Play Live"}
                  </button>
                )}
              </div>
            ) : (
              <div
                className={clsx(
                  "w-full h-full flex items-center justify-center",
                  dark ? "text-white/60" : "text-black/60",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                Preview unavailable
              </div>
            )}
          </div>

          <button
            disabled={!canNext}
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => Math.min(files.length - 1, i + 1));
            }}
            className={clsx(
              "absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full border flex items-center justify-center",
              canNext
                ? dark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-white/80"
                  : "border-black/10 bg-black/5 hover:bg-black/10 text-black/80"
                : "opacity-30",
            )}
            style={{ WebkitAppRegion: "no-drag" } as any}
            title="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

      </div>
    </div>
  );
}
