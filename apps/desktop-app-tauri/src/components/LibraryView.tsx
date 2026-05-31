import { useState, useEffect, useRef, useMemo } from "react";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";
import { ApplePhotosAlbum, FileItem, OrganizedAlbum } from "../types";
import { getMediaPresentation } from "../lib/media";
import GalleryView from "./GalleryView";
import {
  FolderOpen,
  Image as ImageIcon,
  Video as VideoIcon,
  ChevronRight,
  Search,
  Plus,
  Pencil,
  Check,
  X,
  Loader2,
  Camera,
  Users,
  Sparkles,
} from "lucide-react";

// Global thumbnail cache
const thumbnailCache = new Map<string, string>();
const thumbnailInFlight = new Map<string, Promise<string | null>>();
const THUMBNAIL_PREFETCH_ROOT_MARGIN = "300px";
const THUMBNAIL_PREFETCH_CONCURRENCY = 6;
const THUMBNAIL_PREFETCH_GROUP_LIMIT = 8;
const THUMBNAIL_PREFETCH_PER_GROUP = 4;
const THUMBNAIL_PREFETCH_SELECTED_LIMIT = 48;

interface LibraryViewProps {
  files: FileItem[];
  isScreenshot: (file: FileItem) => boolean;
  projects?: string[];
  albums?: string[];
  applePhotosAlbums?: ApplePhotosAlbum[];
  dataSourceKey?: string;
  theme: "dark" | "light";
  viewMode: "grid" | "list" | "gallery";
  onMove: (
    filePath: string,
    projectName: string,
    isScreenshot: boolean,
  ) => void;
  onNewProject?: (projectName: string) => void;
  onNewAlbum?: (albumName: string) => void;
  onDelete: (filePath: string) => void;
  onRenameProject?: (oldName: string, newName: string) => void;
  onRenameAlbum?: (oldName: string, newName: string) => void;
  onDeleteAlbum?: (albumName: string) => void;
  onFileClick?: (file: FileItem, index: number) => void;
  onCloseGallery?: () => void;
}

interface ProjectGroup {
  name: string;
  files: FileItem[];
  screenshots: FileItem[];
  recordings: FileItem[];
}

const fetchThumbnail = async (
  file: FileItem,
  isVideo: boolean,
): Promise<string | null> => {
  const cached = thumbnailCache.get(file.path);
  if (cached) return cached;
  const existing = thumbnailInFlight.get(file.path);
  if (existing) return await existing;

  const task = (async () => {
    try {
      if (typeof window === "undefined" || !window.electronAPI) return null;
      const url = isVideo
        ? await window.electronAPI.generateVideoThumbnail(file.path)
        : await window.electronAPI.getFileDataUrl(file.path);
      if (url) {
        thumbnailCache.set(file.path, url);
      }
      return url ?? null;
    } catch {
      return null;
    }
  })();

  thumbnailInFlight.set(file.path, task);
  try {
    return await task;
  } finally {
    thumbnailInFlight.delete(file.path);
  }
};

function ThumbnailImage({
  file,
  isVideo,
}: {
  file: FileItem;
  isVideo: boolean;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(
    thumbnailCache.get(file.path) || null,
  );
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThumbnail(thumbnailCache.get(file.path) || null);
  }, [file.path]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      { rootMargin: THUMBNAIL_PREFETCH_ROOT_MARGIN },
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || thumbnail) return;

    const loadThumbnail = async () => {
      const url = await fetchThumbnail(file, isVideo);
      if (url) setThumbnail(url);
    };
    loadThumbnail();
  }, [isVisible, file.path, isVideo, thumbnail]);

  return (
    <div
      ref={imgRef}
      className="w-full h-full bg-neutral-900 overflow-hidden relative group"
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={file.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {isVideo ? (
            <VideoIcon className="w-6 h-6 text-neutral-600" />
          ) : (
            <ImageIcon className="w-6 h-6 text-neutral-600" />
          )}
        </div>
      )}
      {isVideo && (
        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/60 text-[8px] text-white/80">
          Video
        </div>
      )}
    </div>
  );
}

export default function LibraryView({
  files: _files,
  isScreenshot: _isScreenshot,
  projects,
  albums,
  applePhotosAlbums,
  dataSourceKey,
  theme,
  viewMode,
  onMove,
  onNewProject,
  onNewAlbum,
  onDelete,
  onRenameProject,
  onRenameAlbum,
  onDeleteAlbum,
  onFileClick,
  onCloseGallery,
}: LibraryViewProps) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedApplePhotosAlbum, setSelectedApplePhotosAlbum] = useState<ApplePhotosAlbum | null>(null);
  const [applePhotosAlbumFiles, setApplePhotosAlbumFiles] = useState<FileItem[]>([]);
  const [applePhotosAlbumLoading, setApplePhotosAlbumLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [filterType, setFilterType] = useState<"all" | "images" | "videos">(
    "all",
  );
  const [organizedProjects, setOrganizedProjects] = useState<OrganizedAlbum[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    album: string;
    x: number;
    y: number;
  } | null>(null);
  const [subAlbumParent, setSubAlbumParent] = useState<string | null>(null);
  const [subAlbumName, setSubAlbumName] = useState("");

  const isDark = theme === "dark";
  const projectNames = projects ?? albums ?? [];
  const createProject = onNewProject ?? onNewAlbum;
  const renameProject = onRenameProject ?? onRenameAlbum;
  const getModifiedMs = (value: unknown) => {
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatDate = (value: unknown) => {
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  const prefetchTokenRef = useRef(0);

  const prefetchThumbnails = (
    items: Array<{ file: FileItem; isVideo: boolean }>,
  ) => {
    if (items.length === 0) return;
    const queued: Array<{ file: FileItem; isVideo: boolean }> = [];
    const seen = new Set<string>();
    for (const item of items) {
      const path = item.file?.path;
      if (!path) continue;
      if (thumbnailCache.has(path)) continue;
      if (thumbnailInFlight.has(path)) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      queued.push(item);
    }
    if (queued.length === 0) return;

    const token = ++prefetchTokenRef.current;
    const queue = [...queued];
    const workerCount = Math.min(
      THUMBNAIL_PREFETCH_CONCURRENCY,
      queue.length,
    );
    for (let i = 0; i < workerCount; i++) {
      void (async () => {
        while (queue.length > 0) {
          if (prefetchTokenRef.current !== token) return;
          const next = queue.shift();
          if (!next) return;
          await fetchThumbnail(next.file, next.isVideo);
        }
      })();
    }
  };

  // Fetch organized files from project folders
  useEffect(() => {
    const fetchOrganizedFiles = async () => {
      setLoading(true);
      try {
        const data = await window.electronAPI.scanOrganizedFiles();
        setOrganizedProjects(data);
      } catch (error) {
        console.error("Error fetching organized files:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrganizedFiles();
  }, [dataSourceKey]);

  // Convert organized projects to project groups
  const projectGroups = useMemo(() => {
    const sortByRecent = (arr: FileItem[]) =>
      [...arr].sort((a, b) => {
        const byModified = getModifiedMs(b.modified) - getModifiedMs(a.modified);
        if (byModified !== 0) return byModified;
        const byName = String(a.name).localeCompare(String(b.name));
        if (byName !== 0) return byName;
        return String(a.path).localeCompare(String(b.path));
      });

    const groupsByName = new Map<string, ProjectGroup>();
    organizedProjects.forEach((op) => {
      const projectName = String(op.album ?? "");
      if (!projectName) return;
      const screenshots = op.screenshots ?? [];
      const recordings = op.recordings ?? [];
      const existing = groupsByName.get(projectName);
      if (existing) {
        existing.screenshots.push(...screenshots);
        existing.recordings.push(...recordings);
        existing.files.push(...screenshots, ...recordings);
        return;
      }
      groupsByName.set(projectName, {
        name: projectName,
        files: [...screenshots, ...recordings],
        screenshots: [...screenshots],
        recordings: [...recordings],
      });
    });

    // Add empty projects that exist but have no files
    projectNames.forEach((project) => {
      const projectName = String(project ?? "");
      if (!projectName) return;
      if (!groupsByName.has(projectName)) {
        groupsByName.set(projectName, {
          name: projectName,
          files: [],
          screenshots: [],
          recordings: [],
        });
      }
    });

    const groups = Array.from(groupsByName.values()).map((group) => ({
      ...group,
      screenshots: sortByRecent(group.screenshots),
      recordings: sortByRecent(group.recordings),
      files: sortByRecent(group.files),
    }));

    return groups.sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );
  }, [organizedProjects, projectNames]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projectGroups;
    return projectGroups.filter((g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [projectGroups, searchQuery]);

  const visibleProjects = useMemo(
    () => filteredProjects.filter((g) => g.name.trim().length > 0),
    [filteredProjects],
  );

  const nonEmptyProjectGroups = useMemo(
    () => projectGroups.filter((g) => g.name.trim().length > 0),
    [projectGroups],
  );

  const selectedGroup = useMemo(() => {
    if (!selectedProject) return null;
    return projectGroups.find((g) => g.name === selectedProject) || null;
  }, [selectedProject, projectGroups]);

  const displayFiles = useMemo(() => {
    if (!selectedGroup) return [];
    switch (filterType) {
      case "images":
        return selectedGroup.screenshots;
      case "videos":
        return selectedGroup.recordings;
      default:
        return selectedGroup.files;
    }
  }, [selectedGroup, filterType]);

  const displayApplePhotosFiles = useMemo(() => {
    if (!selectedApplePhotosAlbum) return [];
    switch (filterType) {
      case "images":
        return applePhotosAlbumFiles.filter((f) => f.mediaType !== "video" && f.mediaType !== "screen_recording");
      case "videos":
        return applePhotosAlbumFiles.filter((f) => f.mediaType === "video" || f.mediaType === "screen_recording");
      default:
        return applePhotosAlbumFiles;
    }
  }, [selectedApplePhotosAlbum, applePhotosAlbumFiles, filterType]);

  // Helper to check if a file is a screenshot (for gallery view)
  const isFileScreenshot = useMemo(() => {
    if (!selectedGroup) return () => false;
    const screenshotPaths = new Set(
      selectedGroup.screenshots.map((f) => f.path),
    );
    return (file: FileItem) => screenshotPaths.has(file.path);
  }, [selectedGroup]);

  useEffect(() => {
    if (loading) return;
    if (selectedApplePhotosAlbum && !applePhotosAlbumLoading && displayApplePhotosFiles.length > 0) {
      const limit =
        viewMode === "grid"
          ? THUMBNAIL_PREFETCH_SELECTED_LIMIT
          : Math.min(THUMBNAIL_PREFETCH_SELECTED_LIMIT, 24);
      const items = displayApplePhotosFiles.slice(0, limit).map((file) => ({
        file,
        isVideo: file.mediaType === "video" || file.mediaType === "screen_recording",
      }));
      prefetchThumbnails(items);
      return;
    }
    if (!selectedProject) {
      const groups = nonEmptyProjectGroups
        .filter((g) => g.files.length > 0)
        .slice(0, THUMBNAIL_PREFETCH_GROUP_LIMIT);
      const items: Array<{ file: FileItem; isVideo: boolean }> = [];
      for (const group of groups) {
        const recordingPaths = new Set(
          group.recordings.map((file) => file.path),
        );
        for (const file of group.files.slice(0, THUMBNAIL_PREFETCH_PER_GROUP)) {
          items.push({ file, isVideo: recordingPaths.has(file.path) });
        }
      }
      prefetchThumbnails(items);
      return;
    }

    const limit =
      viewMode === "grid"
        ? THUMBNAIL_PREFETCH_SELECTED_LIMIT
        : Math.min(THUMBNAIL_PREFETCH_SELECTED_LIMIT, 24);
    const items = displayFiles.slice(0, limit).map((file) => ({
      file,
      isVideo: !isFileScreenshot(file),
    }));
    prefetchThumbnails(items);
  }, [
    loading,
    selectedProject,
    selectedApplePhotosAlbum,
    applePhotosAlbumLoading,
    displayApplePhotosFiles,
    nonEmptyProjectGroups,
    displayFiles,
    viewMode,
    isFileScreenshot,
  ]);

  const handleNewProject = () => {
    if (newProjectName.trim() && createProject) {
      createProject(newProjectName.trim());
      setNewProjectName("");
      setShowNewProjectInput(false);
    }
  };

  const handleRenameProject = (oldName: string) => {
    if (editingProjectName.trim() && renameProject) {
      renameProject(oldName, editingProjectName.trim());
      setEditingProject(null);
      setEditingProjectName("");
    }
  };

  const handleCreateSubAlbum = () => {
    if (!subAlbumParent) return;
    const name = subAlbumName.trim();
    if (!name) return;
    if (!createProject) return;
    createProject(`${subAlbumParent}/${name}`);
    setSubAlbumName("");
    setSubAlbumParent(null);
  };

  const handleSelectApplePhotosAlbum = async (album: ApplePhotosAlbum) => {
    setSelectedProject(null);
    setSelectedApplePhotosAlbum(album);
    setApplePhotosAlbumLoading(true);
    setApplePhotosAlbumFiles([]);
    setFilterType("all");
    try {
      const assets = await window.electronAPI.getApplePhotosAlbumAssets(album.id);
      const files: FileItem[] = assets.map((asset) => ({
        path: `photos://${asset.id}`,
        name: asset.name || "Untitled",
        size: 0,
        modified: asset.date ? new Date(asset.date) : new Date(),
        mediaType: asset.isMovie ? "video" as const : "photo" as const,
        isLivePhoto: asset.isLivePhoto,
      }));
      setApplePhotosAlbumFiles(files);
    } catch (error) {
      console.error("Error loading Apple Photos album assets:", error);
      setApplePhotosAlbumFiles([]);
    } finally {
      setApplePhotosAlbumLoading(false);
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const getAlbumDepth = (name: string) =>
    Math.max(0, name.split("/").filter(Boolean).length - 1);
  const getAlbumLabel = (name: string) => {
    const parts = name.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? name;
  };

  return (
    <div className="flex h-full">
      {/* Project Sidebar */}
      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={clsx(
          "w-56 shrink-0 flex flex-col border-r",
          isDark
            ? "bg-neutral-950/50 border-white/10"
            : "bg-white/50 border-black/10",
        )}
      >
        {/* Search */}
        <div className="p-3 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search albums..."
              className={clsx(
                "w-full pl-8 pr-3 py-1.5 rounded-lg text-xs border outline-none transition",
                isDark
                  ? "bg-neutral-900/50 text-white border-white/10 placeholder-neutral-500 focus:border-purple-500/50"
                  : "bg-white text-black border-black/10 placeholder-neutral-400 focus:border-purple-500",
              )}
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => { setSelectedProject(null); setSelectedApplePhotosAlbum(null); }}
            className={clsx(
              "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
              !selectedProject && !selectedApplePhotosAlbum
                ? isDark
                  ? "bg-white/10 text-white"
                  : "bg-black/10 text-black"
                : isDark
                  ? "text-white/70 hover:bg-white/5"
                  : "text-black/70 hover:bg-black/5",
            )}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="font-medium">All Albums</span>
            <span className="ml-auto text-xs opacity-50">
              {projectGroups.reduce((sum, g) => sum + g.files.length, 0)}
            </span>
          </button>

          <div className="h-px bg-white/10 my-2" />

          {visibleProjects.map((group) => (
            <div key={group.name} className="group">
              {editingProject === group.name ? (
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <input
                    type="text"
                    value={editingProjectName}
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameProject(group.name);
                      if (e.key === "Escape") setEditingProject(null);
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 rounded text-xs bg-neutral-900 text-white border border-purple-500/50 outline-none"
                  />
                  <button
                    onClick={() => handleRenameProject(group.name)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <Check className="w-3 h-3 text-green-400" />
                  </button>
                  <button
                    onClick={() => setEditingProject(null)}
                    className="p-1 rounded hover:bg-white/10"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setSelectedProject(group.name); setSelectedApplePhotosAlbum(null); }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setContextMenu({
                      album: group.name,
                      x: event.clientX,
                      y: event.clientY,
                    });
                  }}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                    selectedProject === group.name
                      ? isDark
                        ? "bg-white/10 text-white"
                        : "bg-black/10 text-black"
                      : isDark
                        ? "text-white/70 hover:bg-white/5"
                        : "text-black/70 hover:bg-black/5",
                  )}
                  style={{
                    paddingLeft: `${10 + getAlbumDepth(group.name) * 10}px`,
                  }}
                  title={group.name}
                >
                  <FolderOpen className="w-4 h-4" />
                  <span className="truncate flex-1">
                    {getAlbumLabel(group.name)}
                  </span>
                  <span className="text-xs opacity-50">
                    {group.files.length}
                  </span>
                  {onRenameProject && (
                    <Pencil
                      className="w-3 h-3 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(group.name);
                        setEditingProjectName(group.name);
                      }}
                    />
                  )}
                </button>
              )}
              {subAlbumParent === group.name && (
                <div
                  className="flex items-center gap-1 px-2 py-1.5"
                  style={{
                    paddingLeft: `${10 + (getAlbumDepth(group.name) + 1) * 10}px`,
                  }}
                >
                  <input
                    type="text"
                    value={subAlbumName}
                    onChange={(e) => setSubAlbumName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "NumpadEnter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateSubAlbum();
                      }
                      if (e.key === "Escape") {
                        setSubAlbumParent(null);
                        setSubAlbumName("");
                      }
                    }}
                    autoFocus
                    placeholder="Sub-album name"
                    className="flex-1 px-2 py-1.5 rounded text-sm bg-neutral-900 text-white border border-purple-500/50 outline-none"
                  />
                  <button
                    onClick={handleCreateSubAlbum}
                    className="p-1 rounded hover:bg-white/10"
                    title="Create sub-album"
                  >
                    <Check className="w-3 h-3 text-green-400" />
                  </button>
                  <button
                    onClick={() => {
                      setSubAlbumParent(null);
                      setSubAlbumName("");
                    }}
                    className="p-1 rounded hover:bg-white/10"
                    title="Cancel"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Apple Photos Albums */}
          {applePhotosAlbums && applePhotosAlbums.length > 0 && (() => {
            const query = searchQuery.toLowerCase();
            const sortAlbums = <T extends { title: string }>(arr: T[]) =>
              [...arr].sort((a, b) => a.title.localeCompare(b.title));
            const userAlbums = sortAlbums(applePhotosAlbums.filter(
              (a) => a.type === "user" && (!query || a.title.toLowerCase().includes(query)),
            ));
            const sharedAlbums = sortAlbums(applePhotosAlbums.filter(
              (a) => a.type === "shared" && (!query || a.title.toLowerCase().includes(query)),
            ));
            const smartAlbums = sortAlbums(applePhotosAlbums.filter(
              (a) => a.type === "smart" && (!query || a.title.toLowerCase().includes(query)),
            ));
            // Group user albums by folder
            const folderMap = new Map<string, typeof userAlbums>();
            const topLevel: typeof userAlbums = [];
            for (const album of userAlbums) {
              if (album.folder) {
                const existing = folderMap.get(album.folder);
                if (existing) existing.push(album);
                else folderMap.set(album.folder, [album]);
              } else {
                topLevel.push(album);
              }
            }
            const hasAny = userAlbums.length > 0 || sharedAlbums.length > 0 || smartAlbums.length > 0;
            if (!hasAny) return null;
            return (
              <>
                <div className="h-px bg-white/10 my-2" />
                <div className="px-2.5 py-1">
                  <span className={clsx("text-[10px] font-medium uppercase tracking-wider", isDark ? "text-white/30" : "text-black/30")}>
                    Apple Photos
                  </span>
                </div>
                {topLevel.map((album) => (
                  <button
                    key={`photos-${album.id}`}
                    onClick={() => handleSelectApplePhotosAlbum(album)}
                    className={clsx(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                      selectedApplePhotosAlbum?.id === album.id
                        ? isDark
                          ? "bg-white/10 text-white"
                          : "bg-black/10 text-black"
                        : isDark
                          ? "text-white/70 hover:bg-white/5"
                          : "text-black/70 hover:bg-black/5",
                    )}
                    title={album.title}
                  >
                    <Camera className="w-4 h-4 shrink-0 opacity-60" />
                    <span className="truncate flex-1">{album.title}</span>
                    <span className="text-xs opacity-50">{album.count}</span>
                  </button>
                ))}
                {Array.from(folderMap.entries()).map(([folderName, folderAlbums]) => (
                  <div key={`folder-${folderName}`}>
                    <div
                      className={clsx(
                        "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm",
                        isDark ? "text-white/50" : "text-black/50",
                      )}
                    >
                      <FolderOpen className="w-4 h-4 shrink-0 opacity-60" />
                      <span className="truncate flex-1 font-medium">{folderName}</span>
                    </div>
                    {folderAlbums.map((album) => (
                      <button
                        key={`photos-${album.id}`}
                        onClick={() => handleSelectApplePhotosAlbum(album)}
                        className={clsx(
                          "w-full flex items-center gap-2 py-2 rounded-lg text-left text-sm transition-colors",
                          selectedApplePhotosAlbum?.id === album.id
                            ? isDark
                              ? "bg-white/10 text-white"
                              : "bg-black/10 text-black"
                            : isDark
                              ? "text-white/70 hover:bg-white/5"
                              : "text-black/70 hover:bg-black/5",
                        )}
                        style={{ paddingLeft: "20px" }}
                        title={album.title}
                      >
                        <Camera className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate flex-1">{album.title}</span>
                        <span className="text-xs opacity-50">{album.count}</span>
                      </button>
                    ))}
                  </div>
                ))}
                {sharedAlbums.length > 0 && (
                  <>
                    <div className="px-2.5 py-1 mt-1">
                      <span className={clsx("text-[10px] font-medium uppercase tracking-wider", isDark ? "text-white/30" : "text-black/30")}>
                        Shared
                      </span>
                    </div>
                    {sharedAlbums.map((album) => (
                      <button
                        key={`photos-${album.id}`}
                        onClick={() => handleSelectApplePhotosAlbum(album)}
                        className={clsx(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                          selectedApplePhotosAlbum?.id === album.id
                            ? isDark
                              ? "bg-white/10 text-white"
                              : "bg-black/10 text-black"
                            : isDark
                              ? "text-white/70 hover:bg-white/5"
                              : "text-black/70 hover:bg-black/5",
                        )}
                        title={album.title}
                      >
                        <Users className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate flex-1">{album.title}</span>
                        <span className="text-xs opacity-50">{album.count}</span>
                      </button>
                    ))}
                  </>
                )}
                {smartAlbums.length > 0 && (
                  <>
                    <div className="px-2.5 py-1 mt-1">
                      <span className={clsx("text-[10px] font-medium uppercase tracking-wider", isDark ? "text-white/30" : "text-black/30")}>
                        Smart Albums
                      </span>
                    </div>
                    {smartAlbums.map((album) => (
                      <button
                        key={`photos-${album.id}`}
                        onClick={() => handleSelectApplePhotosAlbum(album)}
                        className={clsx(
                          "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors",
                          selectedApplePhotosAlbum?.id === album.id
                            ? isDark
                              ? "bg-white/10 text-white"
                              : "bg-black/10 text-black"
                            : isDark
                              ? "text-white/70 hover:bg-white/5"
                              : "text-black/70 hover:bg-black/5",
                        )}
                        title={album.title}
                      >
                        <Sparkles className="w-4 h-4 shrink-0 opacity-60" />
                        <span className="truncate flex-1">{album.title}</span>
                        <span className="text-xs opacity-50">{album.count}</span>
                      </button>
                    ))}
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* New Project Button */}
        <div className="p-3 border-t border-white/10">
          {showNewProjectInput ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNewProject();
                  if (e.key === "Escape") setShowNewProjectInput(false);
                }}
                placeholder="Album name..."
                autoFocus
                className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-neutral-900 text-white border border-purple-500/50 outline-none"
              />
              <button
                onClick={handleNewProject}
                className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500"
              >
                <Check className="w-3 h-3 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewProjectInput(true)}
              className={clsx(
                "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                isDark
                  ? "bg-white/5 hover:bg-white/10 text-white/70"
                  : "bg-black/5 hover:bg-black/10 text-black/70",
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              New Album
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.1 }}
        className="flex-1 flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div
          className={clsx(
            "flex items-center justify-between px-4 py-3 border-b",
            isDark ? "border-white/10" : "border-black/10",
          )}
        >
          <div className="flex items-center gap-2">
            {(selectedProject || selectedApplePhotosAlbum) && (
              <>
                <button
                  onClick={() => { setSelectedProject(null); setSelectedApplePhotosAlbum(null); }}
                  className="text-sm text-white/50 hover:text-white/80 transition"
                >
                  All Albums
                </button>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </>
            )}
            <h2
              className={clsx(
                "text-sm font-semibold",
                isDark ? "text-white" : "text-black",
              )}
            >
              {selectedApplePhotosAlbum?.title || selectedProject || "All Albums"}
            </h2>
            {selectedGroup && (
              <span className="text-xs text-white/40 ml-2">
                {displayFiles.length}{" "}
                {filterType === "all" ? "items" : filterType}
              </span>
            )}
            {selectedApplePhotosAlbum && !applePhotosAlbumLoading && (
              <span className="text-xs text-white/40 ml-2">
                {displayApplePhotosFiles.length}{" "}
                {filterType === "all" ? "items" : filterType}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs */}
            {(selectedProject || selectedApplePhotosAlbum) && (
              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
                {(["all", "images", "videos"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={clsx(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      filterType === type
                        ? "bg-white/15 text-white"
                        : "text-white/50 hover:text-white/80",
                    )}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-white/30" />
            </div>
          ) : selectedApplePhotosAlbum ? (
            applePhotosAlbumLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-white/30" />
              </div>
            ) : displayApplePhotosFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Camera className="w-12 h-12 text-white/20 mb-4" />
                <p className="text-white/50">
                  No {filterType === "all" ? "items" : filterType} in this album
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                <AnimatePresence>
                  {displayApplePhotosFiles.map((file, index) => (
                    <motion.div
                      key={file.path}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => {
                        setGalleryIndex(index);
                        onFileClick?.(file, index);
                      }}
                      className={clsx(
                        "cursor-pointer rounded-lg overflow-hidden border transition-all hover:scale-[1.02]",
                        isDark
                          ? "bg-neutral-900/50 border-white/10 hover:border-white/20"
                          : "bg-white border-black/10 hover:border-black/20",
                      )}
                    >
                      <div className="aspect-square">
                        <ThumbnailImage
                          file={file}
                          isVideo={file.mediaType === "video" || file.mediaType === "screen_recording"}
                        />
                      </div>
                      <div className="p-2">
                        <p
                          className={clsx(
                            "text-xs truncate",
                            isDark ? "text-white/80" : "text-black/80",
                          )}
                        >
                          {file.name}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="space-y-1">
                <AnimatePresence>
                  {displayApplePhotosFiles.map((file, index) => {
                    const isVideo = file.mediaType === "video" || file.mediaType === "screen_recording";
                    return (
                      <motion.div
                        key={file.path}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ delay: index * 0.02 }}
                        onClick={() => {
                          setGalleryIndex(index);
                          onFileClick?.(file, index);
                        }}
                        className={clsx(
                          "group cursor-pointer flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors duration-200",
                          isDark
                            ? "hover:bg-white/[0.03]"
                            : "hover:bg-black/[0.02]",
                        )}
                      >
                        <div
                          className={clsx(
                            "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
                            isDark
                              ? "border-white/10 bg-neutral-950/65"
                              : "border-slate-200 bg-slate-100",
                          )}
                        >
                          <ThumbnailImage file={file} isVideo={isVideo} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={clsx(
                              "truncate text-[13px] font-semibold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {file.name}
                          </h3>
                          <p
                            className={clsx(
                              "mt-0.5 text-xs",
                              isDark ? "text-slate-400" : "text-slate-600",
                            )}
                          >
                            {isVideo ? "Video" : file.isLivePhoto ? "Live Photo" : "Photo"}
                          </p>
                        </div>
                        <div
                          className={clsx(
                            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                            isDark
                              ? "border-white/10 bg-white/[0.04] text-white/50"
                              : "border-black/10 bg-black/[0.03] text-black/50",
                          )}
                        >
                          {isVideo ? (
                            <VideoIcon className="h-4 w-4" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )
          ) : viewMode === "gallery" &&
            selectedProject &&
            displayFiles.length > 0 ? (
            <GalleryView
              files={displayFiles}
              isScreenshot={isFileScreenshot}
              projects={projectNames}
              theme={theme}
              onMove={onMove}
              onNewProject={createProject ?? (() => {})}
              onDelete={onDelete}
              onClose={() => onCloseGallery?.()}
              onRenameProject={renameProject}
              initialIndex={galleryIndex}
            />
          ) : !selectedProject ? (
            // Show all projects
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {nonEmptyProjectGroups
                  .filter((g) => g.files.length > 0)
                  .map((group) => (
                    <motion.button
                      key={group.name}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedProject(group.name)}
                      className={clsx(
                        "relative rounded-xl overflow-hidden border transition-colors text-left",
                        isDark
                          ? "bg-neutral-900/50 border-white/10 hover:border-white/20"
                          : "bg-white border-black/10 hover:border-black/20",
                      )}
                    >
                      {/* Preview thumbnails - consistent 2x2 grid */}
                      <div className="grid grid-cols-2 gap-px bg-neutral-800/50 rounded-t-lg overflow-hidden aspect-square">
                        {group.files.slice(0, 4).map((file, idx) => (
                          <div
                            key={file.path}
                            className={clsx(
                              "bg-neutral-800 overflow-hidden",
                              group.files.length === 1 &&
                                "col-span-2 row-span-2",
                              group.files.length === 2 && "row-span-2",
                              group.files.length === 3 &&
                                idx === 0 &&
                                "row-span-2",
                            )}
                          >
                            <ThumbnailImage
                              file={file}
                              isVideo={!group.screenshots.includes(file)}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Info */}
                      <div className="p-3">
                        <h3
                          className={clsx(
                            "font-medium text-sm truncate",
                            isDark ? "text-white" : "text-black",
                          )}
                        >
                          {group.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/50">
                          {group.screenshots.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {group.screenshots.length}
                            </span>
                          )}
                          {group.recordings.length > 0 && (
                            <span className="flex items-center gap-1">
                              <VideoIcon className="w-3 h-3" />
                              {group.recordings.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
              </div>
            ) : (
              // List view for all projects
              <div className="space-y-1">
                {nonEmptyProjectGroups
                  .filter((g) => g.files.length > 0)
                  .map((group) => (
                    <motion.button
                      key={group.name}
                      whileHover={{ x: 2 }}
                      onClick={() => setSelectedProject(group.name)}
                      className={clsx(
                        "group w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left transition-colors duration-200",
                        isDark
                          ? "hover:bg-white/[0.03]"
                          : "hover:bg-black/[0.02]",
                      )}
                    >
                      {/* Small thumbnail preview */}
                      <div
                        className={clsx(
                          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
                          isDark
                            ? "border-white/10 bg-neutral-950/65"
                            : "border-slate-200 bg-slate-100",
                        )}
                      >
                        {group.files[0] && (
                          <ThumbnailImage
                            file={group.files[0]}
                            isVideo={
                              !group.screenshots.includes(group.files[0])
                            }
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={clsx(
                            "truncate text-[13px] font-semibold",
                            isDark ? "text-slate-100" : "text-slate-900",
                          )}
                        >
                          {group.name}
                        </h3>
                        <div
                          className={clsx(
                            "flex items-center gap-3 mt-0.5 text-xs",
                            isDark ? "text-slate-400" : "text-slate-600",
                          )}
                        >
                          {group.screenshots.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              {group.screenshots.length}
                            </span>
                          )}
                          {group.recordings.length > 0 && (
                            <span className="flex items-center gap-1">
                              <VideoIcon className="w-3 h-3" />
                              {group.recordings.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={clsx(
                          "w-4 h-4 transition-colors",
                          isDark ? "text-white/40" : "text-black/30",
                        )}
                      />
                    </motion.button>
                  ))}
              </div>
            )
          ) : viewMode === "grid" ? (
            // Grid view for files in selected project
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              <AnimatePresence>
                {displayFiles.map((file, index) => (
                  <motion.div
                    key={file.path}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => {
                      setGalleryIndex(index);
                      onFileClick?.(file, index);
                    }}
                    className={clsx(
                      "cursor-pointer rounded-lg overflow-hidden border transition-all hover:scale-[1.02]",
                      isDark
                        ? "bg-neutral-900/50 border-white/10 hover:border-white/20"
                        : "bg-white border-black/10 hover:border-black/20",
                    )}
                  >
                    <div className="aspect-square">
                      <ThumbnailImage
                        file={file}
                        isVideo={
                          selectedGroup
                            ? !selectedGroup.screenshots.includes(file)
                            : false
                        }
                      />
                    </div>
                    <div className="p-2">
                      <p
                        className={clsx(
                          "text-xs truncate",
                          isDark ? "text-white/80" : "text-black/80",
                        )}
                      >
                        {file.name}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            // List view for files in selected project
            <div className="space-y-1">
              <AnimatePresence>
                {displayFiles.map((file, index) => {
                  const media = getMediaPresentation(
                    file,
                    isFileScreenshot(file),
                  );
                  const typeLabel = media.label;
                  return (
                    <motion.div
                      key={file.path}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => {
                        setGalleryIndex(index);
                        onFileClick?.(file, index);
                      }}
                      className={clsx(
                        "group cursor-pointer flex items-center gap-3 px-2 py-1.5 rounded-lg transition-colors duration-200",
                        isDark
                          ? "hover:bg-white/[0.03]"
                          : "hover:bg-black/[0.02]",
                      )}
                    >
                      <div
                        className={clsx(
                          "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
                          isDark
                            ? "border-white/10 bg-neutral-950/65"
                            : "border-slate-200 bg-slate-100",
                        )}
                      >
                        <ThumbnailImage file={file} isVideo={media.isVideo} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={clsx(
                              "truncate text-[13px] font-semibold",
                              isDark ? "text-slate-100" : "text-slate-900",
                            )}
                          >
                            {file.name}
                          </h3>
                          <span
                            className={clsx(
                              "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider border",
                              isDark
                                ? "bg-neutral-800/60 text-neutral-400 border-neutral-600/30"
                                : "bg-neutral-200/70 text-neutral-600 border-neutral-300/70",
                            )}
                          >
                            {typeLabel}
                          </span>
                        </div>
                        <p
                          className={clsx(
                            "mt-0.5 text-xs",
                            isDark ? "text-slate-400" : "text-slate-600",
                          )}
                        >
                          {formatDate(file.modified)}
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                          isDark
                            ? "border-white/10 bg-white/[0.04] text-white/50"
                            : "border-black/10 bg-black/[0.03] text-black/50",
                        )}
                      >
                        {media.isVideo ? (
                          <VideoIcon className="h-4 w-4" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {selectedProject && displayFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FolderOpen className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white/50">
                No {filterType === "all" ? "files" : filterType} in this album
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {contextMenu && (
        <div
          className={clsx(
            "fixed z-50 min-w-[160px] rounded-lg border shadow-lg",
            isDark
              ? "bg-neutral-900 border-white/10 text-white"
              : "bg-white border-black/10 text-black",
          )}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          {renameProject && (
            <button
              className={clsx(
                "w-full px-3 py-2 text-left text-xs transition-colors",
                isDark ? "hover:bg-white/5" : "hover:bg-black/5",
              )}
              onClick={() => {
                setEditingProject(contextMenu.album);
                setEditingProjectName(contextMenu.album);
                setContextMenu(null);
              }}
            >
              Rename
            </button>
          )}
          {onDeleteAlbum && (
            <button
              className={clsx(
                "w-full px-3 py-2 text-left text-xs transition-colors text-red-400",
                isDark ? "hover:bg-white/5" : "hover:bg-black/5",
              )}
              onClick={() => {
                const target = contextMenu.album;
                setContextMenu(null);
                if (
                  window.confirm(
                    `Delete album "${getAlbumLabel(target)}" and all sub-albums?`,
                  )
                ) {
                  if (
                    selectedProject === target ||
                    selectedProject?.startsWith(`${target}/`)
                  ) {
                    setSelectedProject(null);
                  }
                  onDeleteAlbum(target);
                }
              }}
            >
              Delete
            </button>
          )}
          <button
            className={clsx(
              "w-full px-3 py-2 text-left text-xs transition-colors",
              isDark ? "hover:bg-white/5" : "hover:bg-black/5",
            )}
            onClick={() => {
              setSubAlbumParent(contextMenu.album);
              setSubAlbumName("");
              setContextMenu(null);
            }}
          >
            Add sub-album
          </button>
        </div>
      )}
    </div>
  );
}
