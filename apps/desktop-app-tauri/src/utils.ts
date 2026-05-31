const RECENT_ALBUMS_KEY = "maczen_recent_albums";
const RECENT_PROJECTS_KEY = "maczen_recent_projects";
const MAX_RECENT_ALBUMS = 5;
const MAX_RECENT_PROJECTS = 5;

export function getRecentAlbums(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_ALBUMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error reading recent albums:", error);
    return [];
  }
}

export function addRecentAlbum(albumName: string): void {
  try {
    const recent = getRecentAlbums();
    // Remove if already exists
    const filtered = recent.filter((p) => p !== albumName);
    // Add to front
    const updated = [albumName, ...filtered].slice(0, MAX_RECENT_ALBUMS);
    localStorage.setItem(RECENT_ALBUMS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving recent album:", error);
  }
}

export function getRecentProjects(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error reading recent projects:", error);
    return [];
  }
}

export function addRecentProject(projectName: string): void {
  try {
    const recent = getRecentProjects();
    const filtered = recent.filter((p) => p !== projectName);
    const updated = [projectName, ...filtered].slice(0, MAX_RECENT_PROJECTS);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error saving recent project:", error);
  }
}

export function normalizeAlbumName(input: string): string {
  const cleaned = String(input || "").replace(/\\/g, "/");
  const parts = cleaned
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  return parts.join("/");
}
