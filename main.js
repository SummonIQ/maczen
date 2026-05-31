"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto = __importStar(require("crypto"));
const url_1 = require("url");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const setDockIconIfMac = () => {
    if (process.platform !== "darwin")
        return;
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0ea5e9"/>
          <stop offset="50%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#bg)"/>
      <circle cx="180" cy="190" r="90" fill="rgba(255,255,255,0.18)"/>
      <path d="M80 360l90-120 70 90 70-110 120 140H80z" fill="rgba(10,10,14,0.55)"/>
      <path d="M120 320l50-70 40 50 50-80 90 100H120z" fill="rgba(255,255,255,0.22)"/>
      <rect x="84" y="84" width="344" height="16" rx="8" fill="url(#glow)"/>
      <text x="256" y="410" text-anchor="middle" font-size="96" font-family="Helvetica, Arial, sans-serif" fill="rgba(255,255,255,0.92)" font-weight="700">MZ</text>
    </svg>
  `;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    const icon = electron_1.nativeImage.createFromDataURL(dataUrl);
    if (!icon.isEmpty()) {
        electron_1.app.dock.setIcon(icon);
        return;
    }
    const iconPath = path.join(__dirname, "../../icon.png");
    const fallback = electron_1.nativeImage.createFromPath(iconPath);
    if (!fallback.isEmpty()) {
        electron_1.app.dock.setIcon(fallback);
    }
};
// Prevent dev hot-reloads / electronmon restarts from spawning multiple app instances.
// If another instance starts, it will exit and focus the existing window.
const gotSingleInstanceLock = electron_1.app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        try {
            if (mainWindow) {
                if (mainWindow.isMinimized())
                    mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
            else if (electron_1.BrowserWindow.getAllWindows().length > 0) {
                const win = electron_1.BrowserWindow.getAllWindows()[0];
                if (win.isMinimized())
                    win.restore();
                win.show();
                win.focus();
            }
        }
        catch { }
    });
}
// Prevent EPIPE errors from crashing the app
// This happens when stdout/stderr pipe is closed (e.g., parent terminal closed)
process.stdout?.on?.("error", () => { });
process.stderr?.on?.("error", () => { });
// Safe console logging to prevent EPIPE errors
const safeLog = (...args) => {
    try {
        console.log(...args);
    }
    catch { }
};
const safeWarn = (...args) => {
    try {
        console.warn(...args);
    }
    catch { }
};
const safeError = (...args) => {
    try {
        console.error(...args);
    }
    catch { }
};
const appendDevLog = async (message, data) => {
    try {
        const baseDir = path.join(electron_1.app.getPath("userData"), "logs");
        await fs.mkdir(baseDir, { recursive: true });
        const logPath = path.join(baseDir, "dev.log");
        const line = `${new Date().toISOString()} ${message}` +
            (data ? ` ${JSON.stringify(data)}` : "") +
            "\n";
        await fs.appendFile(logPath, line, "utf8");
    }
    catch {
        // Ignore logging failures
    }
};
const getApplePhotosPreviewCacheDir = () => path.join(electron_1.app.getPath("userData"), "cache", "apple-photos-previews");
const getApplePhotosPreviewCachePath = (mediaItemId, kind, ext = "jpg") => {
    // Use a stable filename to avoid filesystem issues with '/' in Photos localIdentifiers.
    const hash = crypto.createHash("sha1").update(mediaItemId).digest("hex");
    return path.join(getApplePhotosPreviewCacheDir(), `${hash}.${kind}.${ext}`);
};
const tryReadCachedApplePhotosPreviewDataUrl = async (mediaItemId, kind) => {
    try {
        // Prefer jpeg, but allow png (QuickLook often produces png thumbnails).
        const candidates = kind === "image"
            ? [
                getApplePhotosPreviewCachePath(mediaItemId, kind, "jpg"),
                getApplePhotosPreviewCachePath(mediaItemId, kind, "png"),
            ]
            : [getApplePhotosPreviewCachePath(mediaItemId, kind, "jpg")];
        for (const p of candidates) {
            try {
                const data = await fs.readFile(p);
                if (p.endsWith(".png")) {
                    return `data:image/png;base64,${data.toString("base64")}`;
                }
                return `data:image/jpeg;base64,${data.toString("base64")}`;
            }
            catch { }
        }
        return null;
    }
    catch {
        return null;
    }
};
const tryWriteCachedApplePhotosPreviewDataUrl = async (mediaItemId, kind, dataUrl) => {
    try {
        // Only cache jpeg/png thumbnails.
        const jpegPrefix = "data:image/jpeg;base64,";
        const pngPrefix = "data:image/png;base64,";
        let base64 = null;
        let ext = null;
        if (dataUrl.startsWith(jpegPrefix))
            base64 = dataUrl.slice(jpegPrefix.length);
        else if (dataUrl.startsWith(pngPrefix))
            base64 = dataUrl.slice(pngPrefix.length);
        if (!base64)
            return;
        ext = dataUrl.startsWith(pngPrefix) ? "png" : "jpg";
        const dir = getApplePhotosPreviewCacheDir();
        await fs.mkdir(dir, { recursive: true });
        const outPath = getApplePhotosPreviewCachePath(mediaItemId, kind, ext);
        await fs.writeFile(outPath, Buffer.from(base64, "base64"));
    }
    catch { }
};
const fileExists = async (p) => {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
};
const PHOTOKIT_HELPER_NAME = "photokit-thumbnailer";
let photoKitHelperStatus = "unknown";
let photoKitHelperPath = null;
let photoKitAccessDenied = false;
const resolvePhotoKitHelperSourcePath = async () => {
    const candidates = [
        path.join(process.resourcesPath, "photokit", "photokit-thumbnailer.swift"),
        path.join(__dirname, "photokit-thumbnailer.swift"),
        path.join(electron_1.app.getAppPath(), "electron", "photokit-thumbnailer.swift"),
        path.join(process.cwd(), "apps/desktop-app/electron/photokit-thumbnailer.swift"),
    ];
    for (const candidate of candidates) {
        if (await fileExists(candidate))
            return candidate;
    }
    return null;
};
const resolvePhotoKitHelperBinaryPath = async () => {
    const packagedAppCandidate = path.join(process.resourcesPath, "photokit", `${PHOTOKIT_HELPER_NAME}.app`, "Contents", "MacOS", PHOTOKIT_HELPER_NAME);
    if (await fileExists(packagedAppCandidate))
        return packagedAppCandidate;
    const packagedCandidate = path.join(process.resourcesPath, "photokit", PHOTOKIT_HELPER_NAME);
    if (await fileExists(packagedCandidate))
        return packagedCandidate;
    const devCandidates = [
        path.join(__dirname, "photokit", `${PHOTOKIT_HELPER_NAME}.app`, "Contents", "MacOS", PHOTOKIT_HELPER_NAME),
        path.join(__dirname, "photokit", PHOTOKIT_HELPER_NAME),
        path.join(electron_1.app.getAppPath(), "electron", "photokit", `${PHOTOKIT_HELPER_NAME}.app`, "Contents", "MacOS", PHOTOKIT_HELPER_NAME),
        path.join(electron_1.app.getAppPath(), "electron", "photokit", PHOTOKIT_HELPER_NAME),
        path.join(process.cwd(), "apps/desktop-app/electron/photokit", `${PHOTOKIT_HELPER_NAME}.app`, "Contents", "MacOS", PHOTOKIT_HELPER_NAME),
        path.join(process.cwd(), "apps/desktop-app/electron/photokit", PHOTOKIT_HELPER_NAME),
    ];
    for (const candidate of devCandidates) {
        if (await fileExists(candidate))
            return candidate;
    }
    if (photoKitHelperPath && (await fileExists(photoKitHelperPath))) {
        return photoKitHelperPath;
    }
    const userBin = path.join(electron_1.app.getPath("userData"), "bin", PHOTOKIT_HELPER_NAME);
    if (await fileExists(userBin))
        return userBin;
    return null;
};
const ensurePhotoKitHelper = async () => {
    if (photoKitHelperStatus === "available")
        return photoKitHelperPath;
    if (photoKitHelperStatus === "unavailable")
        return null;
    // Always prefer the userData binary — it retains TCC (Photos) permission
    // across rebuilds, whereas the packaged binary gets a new path each build.
    const binDir = path.join(electron_1.app.getPath("userData"), "bin");
    const binPath = path.join(binDir, PHOTOKIT_HELPER_NAME);
    const sourcePath = await resolvePhotoKitHelperSourcePath();
    console.log("[PhotoKit] source path:", sourcePath, "binPath:", binPath);
    if (sourcePath) {
        try {
            await fs.mkdir(binDir, { recursive: true });
            await execFileAsync("xcrun", ["swiftc", sourcePath, "-o", binPath], {
                timeout: 60000,
            });
            await fs.chmod(binPath, 0o755);
            console.log("[PhotoKit] compiled to", binPath);
            photoKitHelperStatus = "available";
            photoKitHelperPath = binPath;
            return binPath;
        }
        catch (error) {
            console.error("[PhotoKit] compile failed:", error);
            safeWarn("PhotoKit helper compile failed, trying existing binary:", error);
        }
    }
    // If compilation failed or source not found, try the existing userData binary
    if (await fileExists(binPath)) {
        console.log("[PhotoKit] using existing userData binary:", binPath);
        photoKitHelperStatus = "available";
        photoKitHelperPath = binPath;
        return binPath;
    }
    // Last resort: packaged binary (may lack TCC permission)
    const packaged = await resolvePhotoKitHelperBinaryPath();
    if (packaged) {
        console.log("[PhotoKit] using packaged binary:", packaged);
        photoKitHelperStatus = "available";
        photoKitHelperPath = packaged;
        return packaged;
    }
    console.warn("[PhotoKit] no helper available");
    photoKitHelperStatus = "unavailable";
    return null;
};
const requestPhotoKitAccess = async () => {
    if (process.platform !== "darwin")
        return;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return;
    try {
        await execFileAsync(helperPath, ["--authorize"], {
            timeout: 20000,
            maxBuffer: 1024 * 1024,
        });
        photoKitAccessDenied = false;
    }
    catch { }
};
const tryPhotoKitThumbnailDataUrl = async (mediaItemId, size = 720, quality = 0.7) => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    try {
        const result = await execFileAsync(helperPath, [
            "--id",
            mediaItemId,
            "--size",
            String(size),
            "--quality",
            String(quality),
        ], { timeout: 20000, maxBuffer: 10 * 1024 * 1024 });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return null;
        photoKitAccessDenied = false;
        return `data:image/jpeg;base64,${stdout}`;
    }
    catch (error) {
        const errAny = error;
        const exitCode = errAny?.code;
        if (exitCode === 2 || exitCode === "2") {
            photoKitAccessDenied = true;
        }
        return null;
    }
};
const tryPhotoKitExportAsset = async (mediaItemId, options) => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    const args = ["--export", "--id", mediaItemId, "--out", options.outDir];
    if (options.resource) {
        args.push("--resource", options.resource);
    }
    try {
        const result = await execFileAsync(helperPath, args, {
            timeout: options.timeoutMs ?? 120000,
            maxBuffer: 10 * 1024 * 1024,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return null;
        photoKitAccessDenied = false;
        return stdout.split("\n")[0]?.trim() || null;
    }
    catch (error) {
        const errAny = error;
        const exitCode = errAny?.code;
        if (exitCode === 2 || exitCode === "2") {
            photoKitAccessDenied = true;
        }
        return null;
    }
};
const tryPhotoKitLiveVideoPath = async (mediaItemId, options) => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    try {
        const result = await execFileAsync(helperPath, ["--live-video", "--id", mediaItemId, "--out", options.outDir], {
            timeout: options.timeoutMs ?? 120000,
            maxBuffer: 10 * 1024 * 1024,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return null;
        photoKitAccessDenied = false;
        return stdout.split("\n")[0]?.trim() || null;
    }
    catch (error) {
        const errAny = error;
        const exitCode = errAny?.code;
        if (exitCode === 2 || exitCode === "2") {
            photoKitAccessDenied = true;
        }
        return null;
    }
};
const tryPhotoKitListAssets = async (options) => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    const args = ["--list"];
    if (options.importAll) {
        args.push("--import-all");
    }
    else {
        args.push("--lookback", String(options.lookbackDays));
    }
    try {
        const result = await execFileAsync(helperPath, args, {
            timeout: 120000,
            maxBuffer: 50 * 1024 * 1024,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return [];
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        const items = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed && typeof parsed.id === "string" && parsed.id.length > 0) {
                    items.push(parsed);
                }
            }
            catch { }
        }
        photoKitAccessDenied = false;
        return items;
    }
    catch (error) {
        const errAny = error;
        const exitCode = errAny?.code;
        if (exitCode === 2 || exitCode === "2") {
            photoKitAccessDenied = true;
        }
        return null;
    }
};
const tryPhotoKitListAlbums = async () => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    try {
        const result = await execFileAsync(helperPath, ["--list-albums"], {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return [];
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        const albums = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed && typeof parsed.title === "string" && parsed.title.length > 0) {
                    albums.push(parsed);
                }
            }
            catch { }
        }
        return albums;
    }
    catch {
        return null;
    }
};
const listApplePhotosAlbumsViaAppleScript = async () => {
    if (process.platform !== "darwin")
        return [];
    const photosReady = await ensureApplePhotosAppReady({ allowLaunch: true });
    if (!photosReady)
        return [];
    // AppleScript: Photos returns ALL albums from top-level `albums` including
    // ones nested inside folders. We first collect folder-child album IDs, then
    // mark the rest as top-level.
    const script = `
    tell application "Photos"
      set out to ""
      set t to ASCII character 9
      set lf to ASCII character 10

      -- Collect albums inside folders first (so we know which are nested)
      set folderAlbumIds to {}
      repeat with f in folders
        set folderTitle to name of f
        repeat with a in albums of f
          set albumTitle to name of a
          set albumId to id of a
          set albumCount to count of media items of a
          set end of folderAlbumIds to albumId
          set out to out & albumId & t & albumTitle & t & albumCount & t & "user" & t & folderTitle & lf
        end repeat
      end repeat

      -- Top-level albums (skip ones already seen in folders)
      repeat with a in albums
        set albumId to id of a
        if albumId is not in folderAlbumIds then
          set albumTitle to name of a
          set albumCount to count of media items of a
          set out to out & albumId & t & albumTitle & t & albumCount & t & "user" & t & "" & lf
        end if
      end repeat

      return out
    end tell
  `;
    try {
        const result = await execFileAsync("osascript", ["-e", script], {
            timeout: 60000,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return [];
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        const albums = [];
        const seen = new Set();
        for (const line of lines) {
            const parts = line.split("\t");
            const id = parts[0] || "";
            const title = parts[1] || "";
            const count = parseInt(parts[2] || "0", 10) || 0;
            const type = (parts[3] || "user");
            const folder = parts[4] || null;
            if (!title || seen.has(id))
                continue;
            seen.add(id);
            albums.push({ id, title, count, type, folder });
        }
        return albums;
    }
    catch (error) {
        safeWarn("AppleScript album listing failed:", error);
        return [];
    }
};
const tryPhotoKitListAlbumAssets = async (albumId) => {
    if (process.platform !== "darwin")
        return null;
    const helperPath = await ensurePhotoKitHelper();
    if (!helperPath)
        return null;
    try {
        const result = await execFileAsync(helperPath, ["--list-album-assets", "--id", albumId], { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return [];
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        const items = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed && typeof parsed.id === "string" && parsed.id.length > 0) {
                    items.push(parsed);
                }
            }
            catch { }
        }
        return items;
    }
    catch (error) {
        const errAny = error;
        const exitCode = errAny?.code;
        if (exitCode === 2 || exitCode === "2") {
            photoKitAccessDenied = true;
        }
        return null;
    }
};
const listAlbumAssetsViaAppleScript = async (albumId) => {
    if (process.platform !== "darwin")
        return [];
    const photosReady = await ensureApplePhotosAppReady({ allowLaunch: true });
    if (!photosReady)
        return [];
    const escapedId = albumId.replace(/"/g, '\\"');
    const script = `
    tell application "Photos"
      set out to ""
      set t to ASCII character 9
      set lf to ASCII character 10
      set targetAlbum to missing value
      repeat with a in albums
        if id of a is "${escapedId}" then
          set targetAlbum to a
          exit repeat
        end if
      end repeat
      if targetAlbum is missing value then
        repeat with f in folders
          repeat with a in albums of f
            if id of a is "${escapedId}" then
              set targetAlbum to a
              exit repeat
            end if
          end repeat
          if targetAlbum is not missing value then exit repeat
        end repeat
      end if
      if targetAlbum is missing value then return ""
      repeat with m in media items of targetAlbum
        set itemId to id of m
        set itemName to filename of m
        set itemDate to date of m
        set itemWidth to width of m
        set itemHeight to height of m
        set out to out & itemId & t & itemName & t & itemDate & t & itemWidth & t & itemHeight & lf
      end repeat
      return out
    end tell
  `;
    try {
        const result = await execFileAsync("osascript", ["-e", script], {
            timeout: 120000,
        });
        const stdout = String(result?.stdout ?? "").trim();
        if (!stdout)
            return [];
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        const items = [];
        for (const line of lines) {
            const parts = line.split("\t");
            const id = parts[0] || "";
            const name = parts[1] || "";
            const dateStr = parts[2] || "";
            const width = parseInt(parts[3] || "0", 10) || null;
            const height = parseInt(parts[4] || "0", 10) || null;
            if (!id)
                continue;
            const isMovie = name.toLowerCase().endsWith(".mov") ||
                name.toLowerCase().endsWith(".mp4") ||
                name.toLowerCase().endsWith(".m4v");
            items.push({
                id,
                name,
                date: dateStr,
                width,
                height,
                isMovie,
                isLivePhoto: false,
            });
        }
        return items;
    }
    catch (error) {
        safeWarn("AppleScript album asset listing failed:", error);
        return [];
    }
};
const quickLookThumbnailDataUrl = async (inputPath, size = 500) => {
    const outDir = path.join(electron_1.app.getPath("temp"), `maczen-qlthumb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(outDir, { recursive: true });
    try {
        await execFileAsync("qlmanage", ["-t", "-s", String(size), "-o", outDir, inputPath], {
            timeout: 20000,
        });
        const entries = await fs.readdir(outDir);
        const candidates = [];
        for (const name of entries) {
            if (name.startsWith("."))
                continue;
            const full = path.join(outDir, name);
            try {
                const stat = await fs.stat(full);
                if (!stat.isFile())
                    continue;
                candidates.push({ name, mtime: stat.mtimeMs });
            }
            catch { }
        }
        candidates.sort((a, b) => b.mtime - a.mtime);
        const picked = candidates[0]?.name;
        if (!picked)
            return null;
        const buf = await fs.readFile(path.join(outDir, picked));
        // qlmanage produces png thumbnails
        return `data:image/png;base64,${buf.toString("base64")}`;
    }
    catch {
        return null;
    }
    finally {
        try {
            const entries = await fs.readdir(outDir);
            await Promise.all(entries.map(async (name) => {
                try {
                    await fs.unlink(path.join(outDir, name));
                }
                catch { }
            }));
            await fs.rmdir(outDir);
        }
        catch { }
    }
};
const SETTINGS_FILE_NAME = "settings.json";
let cachedSettings = null;
const APPLE_PHOTOS_INDEX_FILE_NAME = "apple-photos-index.json";
const getSettingsFilePath = () => path.join(electron_1.app.getPath("userData"), SETTINGS_FILE_NAME);
const getApplePhotosIndexFilePath = () => path.join(electron_1.app.getPath("userData"), APPLE_PHOTOS_INDEX_FILE_NAME);
const getDefaultSettings = () => ({
    applePhotosEnabled: false,
    applePhotosImportAll: false,
    applePhotosLookbackDays: 30,
    applePhotosOrganizeExportToFolder: true,
    applePhotosOrganizeDeleteFromPhotos: false,
    applePhotosOrganizeTagInPhotos: true,
    applePhotosOrganizeUseMacZenFolder: false,
    useIcloudDestination: false,
    icloudDestinationPath: "",
});
const sanitizeSettings = (input) => {
    const output = {};
    if (typeof input.applePhotosEnabled === "boolean") {
        output.applePhotosEnabled = input.applePhotosEnabled;
    }
    if (typeof input.applePhotosImportAll === "boolean") {
        output.applePhotosImportAll = input.applePhotosImportAll;
    }
    if (typeof input.applePhotosLookbackDays === "number") {
        const value = Math.round(input.applePhotosLookbackDays);
        output.applePhotosLookbackDays = Math.max(1, Math.min(3650, value));
    }
    if (typeof input.applePhotosOrganizeExportToFolder === "boolean") {
        output.applePhotosOrganizeExportToFolder =
            input.applePhotosOrganizeExportToFolder;
    }
    if (typeof input.applePhotosOrganizeDeleteFromPhotos === "boolean") {
        output.applePhotosOrganizeDeleteFromPhotos =
            input.applePhotosOrganizeDeleteFromPhotos;
    }
    if (typeof input.applePhotosOrganizeTagInPhotos === "boolean") {
        output.applePhotosOrganizeTagInPhotos =
            input.applePhotosOrganizeTagInPhotos;
    }
    if (typeof input.applePhotosOrganizeUseMacZenFolder === "boolean") {
        output.applePhotosOrganizeUseMacZenFolder =
            input.applePhotosOrganizeUseMacZenFolder;
    }
    if (typeof input.useIcloudDestination === "boolean") {
        output.useIcloudDestination = input.useIcloudDestination;
    }
    if (typeof input.icloudDestinationPath === "string") {
        output.icloudDestinationPath = input.icloudDestinationPath;
    }
    return output;
};
const loadSettings = async () => {
    const defaults = getDefaultSettings();
    try {
        const raw = await fs.readFile(getSettingsFilePath(), "utf-8");
        const parsed = JSON.parse(raw);
        return { ...defaults, ...sanitizeSettings(parsed) };
    }
    catch {
        return defaults;
    }
};
const saveSettings = async (settings) => {
    const next = { ...getDefaultSettings(), ...sanitizeSettings(settings) };
    await fs.mkdir(path.dirname(getSettingsFilePath()), { recursive: true });
    await fs.writeFile(getSettingsFilePath(), JSON.stringify(next, null, 2), "utf-8");
};
const loadApplePhotosIndex = async () => {
    try {
        const raw = await fs.readFile(getApplePhotosIndexFilePath(), "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 2 && parsed.items) {
            const migratedItems = {};
            for (const [id, item] of Object.entries(parsed.items)) {
                if (!item || typeof item !== "object")
                    continue;
                migratedItems[id] = {
                    id: String(item.id || id),
                    name: String(item.name || item.id || id),
                    date: String(item.date || ""),
                    kind: String(item.kind || ""),
                    isScreenshot: Boolean(item.isScreenshot),
                    isLivePhoto: Boolean(item.isLivePhoto),
                    album: typeof item.album === "string" && item.album.length > 0
                        ? item.album
                        : typeof item.project === "string" && item.project.length > 0
                            ? item.project
                            : null,
                    keywords: Array.isArray(item.keywords)
                        ? item.keywords.map((k) => String(k))
                        : [],
                    exportedPath: typeof item.exportedPath === "string" ? item.exportedPath : null,
                    exportedAt: typeof item.exportedAt === "number" ? item.exportedAt : null,
                    addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
                };
            }
            return {
                version: 2,
                lastSyncAt: typeof parsed.lastSyncAt === "number" ? parsed.lastSyncAt : null,
                items: migratedItems,
            };
        }
        // Back-compat: v1 index
        if (parsed && parsed.version === 1 && parsed.items) {
            const migrated = {
                version: 2,
                lastSyncAt: null,
                items: {},
            };
            for (const [id, item] of Object.entries(parsed.items)) {
                if (!item || typeof item !== "object")
                    continue;
                migrated.items[id] = {
                    id: String(item.id || id),
                    name: String(item.name || item.id || id),
                    date: String(item.date || ""),
                    kind: String(item.kind || ""),
                    isScreenshot: Boolean(item.isScreenshot),
                    isLivePhoto: Boolean(item.isLivePhoto),
                    album: typeof item.album === "string" && item.album.length > 0
                        ? item.album
                        : typeof item.project === "string" && item.project.length > 0
                            ? item.project
                            : null,
                    keywords: [],
                    exportedPath: null,
                    exportedAt: null,
                    addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
                };
            }
            return migrated;
        }
    }
    catch { }
    return { version: 2, lastSyncAt: null, items: {} };
};
const saveApplePhotosIndex = async (index) => {
    await fs.mkdir(path.dirname(getApplePhotosIndexFilePath()), {
        recursive: true,
    });
    await fs.writeFile(getApplePhotosIndexFilePath(), JSON.stringify(index, null, 2), "utf-8");
};
const ensureSettingsLoaded = async () => {
    if (!cachedSettings) {
        cachedSettings = await loadSettings();
    }
    return cachedSettings;
};
const getOrganizedBaseDir = (settings) => {
    const root = settings.useIcloudDestination && settings.icloudDestinationPath
        ? settings.icloudDestinationPath
        : path.join(electron_1.app.getPath("home"), "Documents");
    return path.join(root, "MacZen");
};
const getLegacyOrganizedDirs = (settings) => {
    const root = settings.useIcloudDestination && settings.icloudDestinationPath
        ? settings.icloudDestinationPath
        : path.join(electron_1.app.getPath("home"), "Documents");
    return [
        path.join(root, "Screenshots"),
        path.join(electron_1.app.getPath("home"), "MacZen"),
    ];
};
const normalizeAlbumName = (input) => {
    const cleaned = String(input || "").replace(/\\/g, "/");
    const parts = cleaned
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part && part !== "." && part !== "..");
    return parts.join("/");
};
const getAlbumPathParts = (input) => {
    const normalized = normalizeAlbumName(input);
    return normalized ? normalized.split("/") : [];
};
const getAlbumDirectories = async (baseDir) => {
    const results = [];
    const queue = [baseDir];
    while (queue.length > 0) {
        const currentDir = queue.shift();
        if (!currentDir)
            continue;
        let entries = [];
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        const hasScreenshots = entries.some((entry) => entry.isDirectory() && entry.name === "Screenshots");
        const hasRecordings = entries.some((entry) => entry.isDirectory() && entry.name === "Recordings");
        if (currentDir !== baseDir && (hasScreenshots || hasRecordings)) {
            results.push(currentDir);
        }
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            if (entry.name.startsWith("."))
                continue;
            if (entry.name === "Screenshots" || entry.name === "Recordings")
                continue;
            queue.push(path.join(currentDir, entry.name));
        }
    }
    return results;
};
const getAlbumNames = async (settings) => {
    const albums = new Set();
    const primaryBaseDir = getOrganizedBaseDir(settings);
    const legacyDirs = getLegacyOrganizedDirs(settings);
    const baseDirs = [primaryBaseDir, ...legacyDirs].filter((dir, index, list) => list.indexOf(dir) === index);
    for (const baseDir of baseDirs) {
        const albumDirs = await getAlbumDirectories(baseDir);
        for (const albumDir of albumDirs) {
            const relative = path.relative(baseDir, albumDir);
            const albumName = normalizeAlbumName(relative);
            if (albumName)
                albums.add(albumName);
        }
    }
    if (albums.size === 0) {
        return ["Personal", "Work", "Archive"];
    }
    return Array.from(albums).sort();
};
const pathExists = async (targetPath) => {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
};
const moveFileWithUniqueName = async (srcPath, destDir) => {
    const fileName = path.basename(srcPath);
    let destPath = path.join(destDir, fileName);
    if (await pathExists(destPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        let counter = 1;
        while (await pathExists(destPath)) {
            destPath = path.join(destDir, `${base}_${counter}${ext}`);
            counter++;
        }
    }
    try {
        await fs.rename(srcPath, destPath);
    }
    catch (error) {
        // Cross-device moves (e.g. local disk -> iCloud) can fail with EXDEV.
        if (error && error.code === "EXDEV") {
            await fs.copyFile(srcPath, destPath);
            await fs.unlink(srcPath);
            return destPath;
        }
        throw error;
    }
    return destPath;
};
const moveDirectoryContents = async (srcDir, destDir) => {
    await fs.mkdir(destDir, { recursive: true });
    let entries;
    try {
        entries = await fs.readdir(srcDir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry.name.startsWith("."))
            continue;
        const srcPath = path.join(srcDir, entry.name);
        if (entry.isDirectory()) {
            const destPath = path.join(destDir, entry.name);
            await moveDirectoryContents(srcPath, destPath);
            try {
                await fs.rmdir(srcPath);
            }
            catch { }
            continue;
        }
        if (entry.isFile()) {
            await moveFileWithUniqueName(srcPath, destDir);
        }
    }
};
const migrateAlbumsToBaseDir = async (fromDirs, toDir) => {
    const uniqueFromDirs = Array.from(new Set(fromDirs)).filter(Boolean);
    if (uniqueFromDirs.length === 0)
        return;
    if (uniqueFromDirs.every((d) => d === toDir))
        return;
    await fs.mkdir(toDir, { recursive: true });
    const albums = new Set();
    for (const dir of uniqueFromDirs) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory())
                    continue;
                if (entry.name.startsWith("."))
                    continue;
                albums.add(entry.name);
            }
        }
        catch { }
    }
    for (const albumName of albums) {
        for (const fromDir of uniqueFromDirs) {
            const srcAlbumPath = path.join(fromDir, albumName);
            if (!(await pathExists(srcAlbumPath)))
                continue;
            const destAlbumPath = path.join(toDir, albumName);
            if (!(await pathExists(destAlbumPath))) {
                try {
                    await fs.rename(srcAlbumPath, destAlbumPath);
                    continue;
                }
                catch { }
            }
            await moveDirectoryContents(srcAlbumPath, destAlbumPath);
            try {
                await fs.rmdir(srcAlbumPath);
            }
            catch { }
        }
    }
};
const escapeAppleScriptString = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const APPLE_PHOTOS_URI_PREFIX = "photos://";
const APPLE_PHOTOS_TEMP_DIR_PREFIX = "maczen-apple-photos-";
const isApplePhotosAppRunning = async () => {
    if (process.platform !== "darwin")
        return false;
    try {
        const result = await execFileAsync("osascript", [
            "-e",
            'application "Photos" is running',
        ]);
        const stdout = String(result?.stdout ?? "").trim().toLowerCase();
        return stdout === "true";
    }
    catch {
        return false;
    }
};
const ensureApplePhotosAppReady = async (options) => {
    if (process.platform !== "darwin")
        return false;
    if (await isApplePhotosAppRunning())
        return true;
    if (!options?.allowLaunch)
        return false;
    try {
        await execFileAsync("osascript", ["-e", 'tell application "Photos" to activate'], {
            timeout: 10000,
        });
    }
    catch { }
    return await isApplePhotosAppRunning();
};
const tryParsePhotosDate = (raw) => {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime()))
        return parsed;
    return new Date();
};
const KNOWN_APPLE_SCREENSHOT_SIZES = new Set([
    // iPhone (portrait/landscape; we normalize to max x min)
    "2796x1290", // 14 Pro Max / 15 Pro Max
    "2778x1284", // 12/13/14 Pro Max
    "2688x1242", // XS Max / 11 Pro Max
    "2556x1179", // 15 / 15 Pro
    "2532x1170", // 12/13/14
    "2436x1125", // X/XS/11 Pro
    "2340x1080", // 12 mini / 13 mini
    "1792x828", // XR / 11
    "1334x750", // 6/7/8/SE (2nd/3rd)
    "1136x640", // 5/SE (1st)
    // iPad (common)
    "2732x2048", // 12.9"
    "2388x1668", // 11" / Air
    "2360x1640", // Air (5th/4th)
    "2224x1668", // 10.5"
    "2160x1620", // 10.2"
    "2000x1500", // 8th/9th gen variations
]);
const inferIsScreenshotFromPhotosItem = (input) => {
    if (input.isMovie)
        return false;
    const name = (input.fileName || "").toLowerCase();
    const keywordsLower = input.keywords.map((k) => k.toLowerCase());
    const isJpeg = name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".jpe");
    // macOS screenshots and many imports keep explicit names.
    if (name.includes("screen shot") || name.includes("screenshot"))
        return true;
    if (keywordsLower.includes("screenshot"))
        return true;
    if (isJpeg)
        return false;
    // iOS screenshots often share the same IMG_#### naming as photos; dimensions help.
    const wRaw = input.width ?? null;
    const hRaw = input.height ?? null;
    if (typeof wRaw === "number" &&
        typeof hRaw === "number" &&
        wRaw > 0 &&
        hRaw > 0) {
        const w = Math.max(wRaw, hRaw);
        const h = Math.min(wRaw, hRaw);
        const key = `${w}x${h}`;
        if (KNOWN_APPLE_SCREENSHOT_SIZES.has(key))
            return true;
        const aspect = w / h;
        // Many screenshots are tall/skinny compared to typical camera photos.
        if ((name.endsWith(".png") ||
            name.endsWith(".heic") ||
            name.endsWith(".heif")) &&
            aspect > 1.9) {
            return true;
        }
    }
    return false;
};
const inferIsScreenshotFromPhotosIndex = (item) => {
    if (item.kind === "video")
        return false;
    const name = (item.name || "").toLowerCase();
    const keywordsLower = (item.keywords || []).map((k) => String(k).toLowerCase());
    const isJpeg = name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".jpe");
    if (name.includes("screen shot") || name.includes("screenshot"))
        return true;
    if (keywordsLower.includes("screenshot"))
        return true;
    if (isJpeg)
        return false;
    return Boolean(item.isScreenshot);
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getManagedApplePhotosTempDirFromPath = (filePath) => {
    const resolvedDir = path.resolve(path.dirname(filePath));
    const tempRoot = path.resolve(electron_1.app.getPath("temp"));
    if (path.dirname(resolvedDir) !== tempRoot)
        return null;
    if (!path.basename(resolvedDir).startsWith(APPLE_PHOTOS_TEMP_DIR_PREFIX)) {
        return null;
    }
    return resolvedDir;
};
const resolveApplePhotosLocalFallbackPath = async (mediaItemId) => {
    try {
        const index = await loadApplePhotosIndex();
        const item = index.items[mediaItemId];
        if (!item)
            return null;
        if (item.exportedPath) {
            if (await pathExists(item.exportedPath)) {
                return item.exportedPath;
            }
            item.exportedPath = null;
            item.exportedAt = null;
            await saveApplePhotosIndex(index);
        }
        if (!item.album || !item.name)
            return null;
        const settings = await ensureSettingsLoaded();
        const mediaSubdir = item.kind === "video" || !inferIsScreenshotFromPhotosIndex(item)
            ? "Recordings"
            : "Screenshots";
        const albumDir = path.join(getOrganizedBaseDir(settings), item.album, mediaSubdir);
        if (!(await pathExists(albumDir)))
            return null;
        const ext = path.extname(item.name);
        const base = path.basename(item.name, ext);
        const pattern = new RegExp(`^${escapeRegExp(base)}(?:_\\d+)?${escapeRegExp(ext)}$`, "i");
        const entries = await fs.readdir(albumDir);
        const matches = [];
        for (const entry of entries) {
            if (!pattern.test(entry))
                continue;
            const fullPath = path.join(albumDir, entry);
            try {
                const stat = await fs.stat(fullPath);
                if (!stat.isFile())
                    continue;
                matches.push({ fullPath, mtime: stat.mtimeMs });
            }
            catch { }
        }
        if (matches.length === 0)
            return null;
        matches.sort((a, b) => b.mtime - a.mtime);
        const pickedPath = matches[0].fullPath;
        item.exportedPath = pickedPath;
        item.exportedAt = Date.now();
        await saveApplePhotosIndex(index);
        return pickedPath;
    }
    catch {
        return null;
    }
};
const applePhotosExportInFlight = new Map();
const applePhotosTempDirCleanupTimers = new Map();
const applePhotosExportFailureLogAt = new Map();
const scheduleApplePhotosTempDirCleanup = (tempDir, delayMs = 120000) => {
    const existing = applePhotosTempDirCleanupTimers.get(tempDir);
    if (existing) {
        clearTimeout(existing);
    }
    const t = setTimeout(() => {
        applePhotosTempDirCleanupTimers.delete(tempDir);
        void cleanupTempDir(tempDir);
    }, delayMs);
    applePhotosTempDirCleanupTimers.set(tempDir, t);
};
const resolveApplePhotosItemToTempFile = async (mediaItemId, options) => {
    const inFlightKey = `${mediaItemId}:${options?.forPreview ? "preview" : "organize"}`;
    const existingPromise = applePhotosExportInFlight.get(inFlightKey);
    if (existingPromise)
        return await existingPromise;
    const task = (async () => {
        if (options?.forPreview) {
            const localFallbackPath = await resolveApplePhotosLocalFallbackPath(mediaItemId);
            if (localFallbackPath) {
                return localFallbackPath;
            }
        }
        const tempDir = path.join(electron_1.app.getPath("temp"), `${APPLE_PHOTOS_TEMP_DIR_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(tempDir, { recursive: true });
        const timeoutMs = typeof options?.timeoutMs === "number"
            ? options.timeoutMs
            : options?.forPreview
                ? 45000
                : 300000;
        const pruneMissingApplePhotosItem = async () => {
            try {
                const index = await loadApplePhotosIndex();
                if (index.items[mediaItemId]) {
                    delete index.items[mediaItemId];
                    await saveApplePhotosIndex(index);
                }
                thumbnailCache.delete(`${APPLE_PHOTOS_URI_PREFIX}${mediaItemId}`);
            }
            catch { }
        };
        const runExportScript = async (script) => {
            const result = await queueApplePhotosExport(() => execFileAsync("osascript", ["-e", script], { timeout: timeoutMs }));
            const stdout = String(result?.stdout ?? "").trim();
            if (stdout.includes("not_found")) {
                return "not_found";
            }
            return "ok";
        };
        const photoKitExport = await tryPhotoKitExportAsset(mediaItemId, {
            outDir: tempDir,
            timeoutMs,
        });
        if (photoKitExport) {
            return photoKitExport;
        }
        if (options?.forPreview && options?.allowPhotosAppLaunch === false) {
            const photosRunning = await isApplePhotosAppRunning();
            if (!photosRunning) {
                try {
                    await cleanupTempDir(tempDir);
                }
                catch { }
                return null;
            }
        }
        const photosReady = await ensureApplePhotosAppReady({
            allowLaunch: options?.allowPhotosAppLaunch,
        });
        if (!photosReady) {
            try {
                await cleanupTempDir(tempDir);
            }
            catch { }
            return null;
        }
        // Some Photos items (especially iCloud-only) can behave differently when exporting originals.
        // For previews, prefer rendered exports first (often faster / avoids downloading originals).
        const preferRendered = Boolean(options?.forPreview);
        const scriptOriginals = `
    tell application "Photos"
      set exportFolder to POSIX file "${escapeAppleScriptString(tempDir)}"
      set targetId to "${escapeAppleScriptString(mediaItemId)}"
      set matches to (media items whose id is targetId)
      if (count of matches) is 0 then return "not_found"
      set targetItem to item 1 of matches
      export {targetItem} to exportFolder using originals true
      return "ok"
    end tell
  `;
        const scriptRendered = `
    tell application "Photos"
      set exportFolder to POSIX file "${escapeAppleScriptString(tempDir)}"
      set targetId to "${escapeAppleScriptString(mediaItemId)}"
      set matches to (media items whose id is targetId)
      if (count of matches) is 0 then return "not_found"
      set targetItem to item 1 of matches
      export {targetItem} to exportFolder
      return "ok"
    end tell
  `;
        try {
            const status = await runExportScript(preferRendered ? scriptRendered : scriptOriginals);
            if (status === "not_found") {
                safeWarn("Apple Photos export: item not found (pruning from index):", {
                    id: mediaItemId,
                    forPreview: Boolean(options?.forPreview),
                });
                void appendDevLog("Apple Photos export: item not found", {
                    id: mediaItemId,
                    forPreview: Boolean(options?.forPreview),
                });
                if (options?.forPreview) {
                    await pruneMissingApplePhotosItem();
                }
                try {
                    await cleanupTempDir(tempDir);
                }
                catch { }
                return null;
            }
        }
        catch (error) {
            // Best-effort fallback for preview (avoid long stalls / hard failure).
            try {
                const status = await runExportScript(preferRendered ? scriptOriginals : scriptRendered);
                if (status === "not_found") {
                    safeWarn("Apple Photos export: item not found (pruning from index):", {
                        id: mediaItemId,
                        forPreview: Boolean(options?.forPreview),
                    });
                    void appendDevLog("Apple Photos export: item not found", {
                        id: mediaItemId,
                        forPreview: Boolean(options?.forPreview),
                    });
                    if (options?.forPreview) {
                        await pruneMissingApplePhotosItem();
                    }
                    try {
                        await cleanupTempDir(tempDir);
                    }
                    catch { }
                    return null;
                }
            }
            catch (fallbackError) {
                // Log a throttled warning so failures are visible during dev (previews can silently fail otherwise).
                const now = Date.now();
                const last = applePhotosExportFailureLogAt.get(inFlightKey) ?? 0;
                if (now - last > 10000) {
                    applePhotosExportFailureLogAt.set(inFlightKey, now);
                    const errAny = error;
                    const fallbackAny = fallbackError;
                    const payload = {
                        id: mediaItemId,
                        forPreview: Boolean(options?.forPreview),
                        timeoutMs,
                        firstAttempt: {
                            killed: Boolean(errAny?.killed),
                            signal: errAny?.signal,
                            code: errAny?.code,
                            stderr: errAny?.stderr,
                        },
                        fallbackAttempt: {
                            killed: Boolean(fallbackAny?.killed),
                            signal: fallbackAny?.signal,
                            code: fallbackAny?.code,
                            stderr: fallbackAny?.stderr,
                        },
                    };
                    safeWarn("Apple Photos export failed:", payload);
                    void appendDevLog("Apple Photos export failed", payload);
                }
                try {
                    await cleanupTempDir(tempDir);
                }
                catch { }
                return null;
            }
        }
        let exported = [];
        try {
            const entries = await fs.readdir(tempDir);
            for (const name of entries) {
                if (name.startsWith("."))
                    continue;
                const fullPath = path.join(tempDir, name);
                try {
                    const stat = await fs.stat(fullPath);
                    if (!stat.isFile())
                        continue;
                    exported.push({ name, mtime: stat.mtimeMs });
                }
                catch { }
            }
        }
        catch { }
        exported.sort((a, b) => b.mtime - a.mtime);
        if (exported.length === 0) {
            const now = Date.now();
            const last = applePhotosExportFailureLogAt.get(`${inFlightKey}:empty`) ?? 0;
            if (now - last > 10000) {
                applePhotosExportFailureLogAt.set(`${inFlightKey}:empty`, now);
                const payload = {
                    id: mediaItemId,
                    forPreview: Boolean(options?.forPreview),
                    timeoutMs,
                    tempDir,
                };
                safeWarn("Apple Photos export produced no files (possibly iCloud download pending):", payload);
                void appendDevLog("Apple Photos export produced no files", payload);
            }
            try {
                await fs.rmdir(tempDir);
            }
            catch { }
            return null;
        }
        return path.join(tempDir, exported[0].name);
    })();
    applePhotosExportInFlight.set(inFlightKey, task);
    try {
        return await task;
    }
    finally {
        applePhotosExportInFlight.delete(inFlightKey);
    }
};
const cleanupTempDir = async (tempDir) => {
    try {
        const entries = await fs.readdir(tempDir);
        await Promise.all(entries.map(async (name) => {
            try {
                await fs.unlink(path.join(tempDir, name));
            }
            catch { }
        }));
        await fs.rmdir(tempDir);
    }
    catch { }
};
const tagApplePhotosItem = async (mediaItemId, tagName) => {
    if (!(await ensureApplePhotosAppReady()))
        return;
    const normalizedTag = normalizeAlbumName(tagName);
    const parts = getAlbumPathParts(normalizedTag);
    const albumName = parts.length > 0 ? parts[parts.length - 1] : normalizedTag;
    const folderParts = parts.slice(0, -1);
    const folderScript = folderParts
        .map((folderName, index) => {
        const escaped = escapeAppleScriptString(folderName);
        if (index === 0) {
            return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          set parentContainer to make new folder named folderNameValue${index}
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
        }
        return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          make new folder named folderNameValue${index} at parentContainer
          set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        end if
        set parentContainer to item 1 of existingFolders
      `;
    })
        .join("\n");
    const script = `
    tell application "Photos"
      set targetId to "${escapeAppleScriptString(mediaItemId)}"
      set albumNameValue to "${escapeAppleScriptString(albumName)}"
      set targetItem to (first media item whose id is targetId)
      set folderPartsCount to ${folderParts.length}
      ${folderScript}
      if folderPartsCount is 0 then
        set existingAlbums to (albums whose name is albumNameValue)
        if (count of existingAlbums) is 0 then
          set targetAlbum to make new album named albumNameValue
        else
          set targetAlbum to item 1 of existingAlbums
        end if
      else
        set existingAlbums to (albums of parentContainer whose name is albumNameValue)
        if (count of existingAlbums) is 0 then
          set targetAlbum to make new album named albumNameValue at parentContainer
        else
          set targetAlbum to item 1 of existingAlbums
        end if
      end if
      add {targetItem} to targetAlbum
      return "ok"
    end tell
  `;
    await execFileAsync("osascript", ["-e", script], { timeout: 300000 });
};
const ensureApplePhotosAlbumPath = async (albumPath) => {
    if (process.platform !== "darwin")
        return;
    if (!(await ensureApplePhotosAppReady()))
        return;
    const normalizedTag = normalizeAlbumName(albumPath);
    if (!normalizedTag)
        return;
    const parts = getAlbumPathParts(normalizedTag);
    const albumName = parts.length > 0 ? parts[parts.length - 1] : normalizedTag;
    const folderParts = parts.slice(0, -1);
    const folderScript = folderParts
        .map((folderName, index) => {
        const escaped = escapeAppleScriptString(folderName);
        if (index === 0) {
            return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          set parentContainer to make new folder named folderNameValue${index}
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
        }
        return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          make new folder named folderNameValue${index} at parentContainer
          set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        end if
        set parentContainer to item 1 of existingFolders
      `;
    })
        .join("\n");
    const script = `
    tell application "Photos"
      set albumNameValue to "${escapeAppleScriptString(albumName)}"
      set folderPartsCount to ${folderParts.length}
      ${folderScript}
      if folderPartsCount is 0 then
        set existingAlbums to (albums whose name is albumNameValue)
        if (count of existingAlbums) is 0 then
          make new album named albumNameValue
        end if
      else
        set existingAlbums to (albums of parentContainer whose name is albumNameValue)
        if (count of existingAlbums) is 0 then
          make new album named albumNameValue at parentContainer
        end if
      end if
      return "ok"
    end tell
  `;
    await execFileAsync("osascript", ["-e", script], { timeout: 300000 });
};
const deleteApplePhotosAlbumPath = async (albumPath) => {
    if (process.platform !== "darwin")
        return;
    if (!(await ensureApplePhotosAppReady()))
        return;
    const normalizedTag = normalizeAlbumName(albumPath);
    if (!normalizedTag)
        return;
    const parts = getAlbumPathParts(normalizedTag);
    const albumName = parts.length > 0 ? parts[parts.length - 1] : normalizedTag;
    const folderParts = parts.slice(0, -1);
    const folderScript = folderParts
        .map((folderName, index) => {
        const escaped = escapeAppleScriptString(folderName);
        if (index === 0) {
            return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          return "ok"
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
        }
        return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          return "ok"
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
    })
        .join("\n");
    const folderDeletionScript = folderParts
        .map((folderName, index) => {
        const escaped = escapeAppleScriptString(folderName);
        if (index === 0) {
            return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          return "ok"
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
        }
        return `
        set folderNameValue${index} to "${escaped}"
        set existingFolders to (folders of parentContainer whose name is folderNameValue${index})
        if (count of existingFolders) is 0 then
          return "ok"
        else
          set parentContainer to item 1 of existingFolders
        end if
      `;
    })
        .join("\n");
    const script = `
    tell application "Photos"
      set albumNameValue to "${escapeAppleScriptString(albumName)}"
      set folderPartsCount to ${folderParts.length}
      ${folderScript}
      if folderPartsCount is 0 then
        set existingAlbums to (albums whose name is albumNameValue)
        if (count of existingAlbums) is not 0 then
          delete item 1 of existingAlbums
        end if
      else
        set existingAlbums to (albums of parentContainer whose name is albumNameValue)
        if (count of existingAlbums) is not 0 then
          delete item 1 of existingAlbums
        end if
      end if
      return "ok"
    end tell
  `;
    const deleteFolderScript = `
    tell application "Photos"
      ${folderDeletionScript}
      if ${folderParts.length} is 0 then
        set targetFolders to (folders whose name is "${escapeAppleScriptString(albumName)}")
      else
        set targetFolders to (folders of parentContainer whose name is "${escapeAppleScriptString(albumName)}")
      end if
      if (count of targetFolders) is not 0 then
        delete item 1 of targetFolders
      end if
      return "ok"
    end tell
  `;
    await execFileAsync("osascript", ["-e", script], { timeout: 300000 });
    await execFileAsync("osascript", ["-e", deleteFolderScript], {
        timeout: 300000,
    });
};
const deleteApplePhotosItem = async (mediaItemId) => {
    if (!(await ensureApplePhotosAppReady()))
        return;
    const script = `
    tell application "Photos"
      set targetId to "${escapeAppleScriptString(mediaItemId)}"
      set targetItem to (first media item whose id is targetId)
      delete targetItem
      return "ok"
    end tell
  `;
    await execFileAsync("osascript", ["-e", script], { timeout: 300000 });
};
const IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".heic",
    ".heif",
    ".tif",
    ".tiff",
    ".bmp",
    ".webp",
]);
const RESIZE_IMAGE_EXTENSIONS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".heic",
    ".heif",
    ".tif",
    ".tiff",
    ".bmp",
    ".webp",
]);
const VIDEO_EXTENSIONS = new Set([
    ".mov",
    ".mp4",
    ".m4v",
    ".avi",
    ".mkv",
    ".webm",
]);
const scanMediaFolder = async (folderPath) => {
    const screenshots = [];
    const recordings = [];
    const stack = [folderPath];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current)
            continue;
        let entries;
        try {
            entries = await fs.readdir(current, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name.startsWith("."))
                continue;
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile())
                continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext) && !VIDEO_EXTENSIONS.has(ext))
                continue;
            try {
                const stats = await fs.stat(fullPath);
                if (!stats.isFile())
                    continue;
                const record = {
                    path: fullPath,
                    name: entry.name,
                    size: stats.size,
                    modified: stats.mtime,
                };
                if (IMAGE_EXTENSIONS.has(ext)) {
                    screenshots.push(record);
                }
                else {
                    recordings.push(record);
                }
            }
            catch {
                // Ignore unreadable files
            }
        }
    }
    return { screenshots, recordings };
};
let mainWindow = null;
let isWindowVisible = false;
let captureWindow = null;
// Menu bar tray
let tray = null;
const isDevMode = () => process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
// ============================================
// Menu Bar Tray
// ============================================
/**
 * Take a quick screenshot from the tray menu
 */
const takeQuickScreenshot = async () => {
    try {
        // Hide any visible windows first
        if (mainWindow?.isVisible()) {
            mainWindow.hide();
            isWindowVisible = false;
        }
        // Small delay for windows to hide
        await new Promise((resolve) => setTimeout(resolve, 150));
        // Use screencapture for interactive area selection
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const desktopPath = electron_1.app.getPath("desktop");
        const filePath = path.join(desktopPath, `MacZen-Screenshot-${timestamp}.png`);
        await execAsync(`screencapture -i "${filePath}"`);
        // Check if file was created (user didn't cancel)
        try {
            await fs.access(filePath);
            // Show notification or open file
            electron_1.shell.showItemInFolder(filePath);
        }
        catch {
            // User cancelled - file doesn't exist
        }
    }
    catch (error) {
        safeError("Failed to take screenshot:", error);
    }
};
/**
 * Create the menu bar tray icon and menu
 */
const createTray = () => {
    // Create tray icon - use a template image for macOS menu bar
    const iconPath = path.join(__dirname, "../../icon.png");
    let trayIcon = electron_1.nativeImage.createFromPath(iconPath);
    // Resize for menu bar (16x16 or 18x18 is standard)
    if (!trayIcon.isEmpty()) {
        trayIcon = trayIcon.resize({ width: 18, height: 18 });
        // Mark as template for proper dark/light mode handling on macOS
        trayIcon.setTemplateImage(true);
    }
    tray = new electron_1.Tray(trayIcon);
    tray.setToolTip("MacZen");
    // Build context menu
    const updateTrayMenu = () => {
        const isMainVisible = mainWindow?.isVisible() ?? false;
        const contextMenu = electron_1.Menu.buildFromTemplate([
            {
                label: "MacZen",
                enabled: false,
            },
            { type: "separator" },
            {
                label: isMainVisible ? "Hide Main Window" : "Show Main Window",
                click: () => {
                    if (mainWindow) {
                        if (mainWindow.isVisible()) {
                            mainWindow.hide();
                            isWindowVisible = false;
                        }
                        else {
                            mainWindow.show();
                            mainWindow.focus();
                            isWindowVisible = true;
                        }
                        updateTrayMenu();
                    }
                },
            },
            { type: "separator" },
            {
                label: "Take Screenshot...",
                accelerator: "CmdOrCtrl+Shift+5",
                click: () => {
                    void takeQuickScreenshot();
                },
            },
            {
                label: "Take Fullscreen Screenshot",
                click: async () => {
                    try {
                        // Hide windows
                        if (mainWindow?.isVisible()) {
                            mainWindow.hide();
                            isWindowVisible = false;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 150));
                        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                        const desktopPath = electron_1.app.getPath("desktop");
                        const filePath = path.join(desktopPath, `MacZen-Screenshot-${timestamp}.png`);
                        await execAsync(`screencapture -x "${filePath}"`);
                        electron_1.shell.showItemInFolder(filePath);
                    }
                    catch (error) {
                        safeError("Failed to take fullscreen screenshot:", error);
                    }
                },
            },
            { type: "separator" },
            {
                label: "Quit MacZen",
                accelerator: "CmdOrCtrl+Q",
                click: () => {
                    electron_1.app.quit();
                },
            },
        ]);
        tray?.setContextMenu(contextMenu);
    };
    // Initial menu build
    updateTrayMenu();
    // Click on tray icon toggles main window
    tray.on("click", () => {
        toggleWindow();
        setTimeout(updateTrayMenu, 100);
    });
};
// Toggle main window visibility
const toggleWindow = () => {
    if (!mainWindow) {
        createWindow();
        return;
    }
    if (isWindowVisible && mainWindow.isVisible()) {
        mainWindow.hide();
        isWindowVisible = false;
    }
    else {
        const cursorPoint = electron_1.screen.getCursorScreenPoint();
        const currentDisplay = electron_1.screen.getDisplayNearestPoint(cursorPoint);
        const { x, y, width, height } = currentDisplay.workArea;
        const windowBounds = mainWindow.getBounds();
        const centerX = x + Math.floor((width - windowBounds.width) / 2);
        const centerY = y + Math.floor((height - windowBounds.height) / 3);
        mainWindow.setPosition(centerX, centerY);
        mainWindow.show();
        mainWindow.focus();
        isWindowVisible = true;
    }
};
// AbortController for cancelling AI organize requests
let autoOrganizeAbortController = null;
// API server URL (marketing-site running on port 30051)
const API_SERVER_URL = "http://localhost:30051";
// Thumbnail cache system to avoid regenerating thumbnails constantly
// Stores both video thumbnails and screenshot data URLs
// Cache entries expire after 5 minutes
const thumbnailCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
// Apple Photos exports are expensive and Photos/osascript can stall if we run too many
// concurrently (e.g. when scrolling a large grid). Queue them to keep previews streaming.
const MAX_CONCURRENT_APPLE_PHOTOS_EXPORTS = 3;
let activeApplePhotosExports = 0;
const applePhotosExportQueue = [];
function runNextApplePhotosExport() {
    if (applePhotosExportQueue.length > 0 &&
        activeApplePhotosExports < MAX_CONCURRENT_APPLE_PHOTOS_EXPORTS) {
        const next = applePhotosExportQueue.shift();
        if (next)
            next();
    }
}
async function queueApplePhotosExport(fn) {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            activeApplePhotosExports++;
            try {
                const result = await fn();
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
            finally {
                activeApplePhotosExports--;
                runNextApplePhotosExport();
            }
        };
        if (activeApplePhotosExports < MAX_CONCURRENT_APPLE_PHOTOS_EXPORTS) {
            execute();
        }
        else {
            applePhotosExportQueue.push(execute);
        }
    });
}
// Background preview prefetcher for Apple Photos: warms the on-disk preview cache so
// scrolling doesn’t need to synchronously export/thumbnail iCloud items.
let applePhotosPrefetchTimer = null;
let applePhotosPrefetchCursor = 0;
let applePhotosPrefetchPlan = [];
let applePhotosPrefetchPlanAt = 0;
const ensureApplePhotosPrefetchRunning = () => {
    if (applePhotosPrefetchTimer)
        return;
    applePhotosPrefetchTimer = setInterval(() => {
        void runApplePhotosPrefetchTick();
    }, 1200);
};
const stopApplePhotosPrefetch = () => {
    if (applePhotosPrefetchTimer) {
        clearInterval(applePhotosPrefetchTimer);
        applePhotosPrefetchTimer = null;
    }
};
const refreshApplePhotosPrefetchPlan = async () => {
    const index = await loadApplePhotosIndex();
    const items = Object.values(index.items || {});
    items.sort((a, b) => {
        const ad = tryParsePhotosDate(a.date).getTime();
        const bd = tryParsePhotosDate(b.date).getTime();
        return bd - ad;
    });
    applePhotosPrefetchPlan = items.map((i) => ({
        id: i.id,
        name: i.name || i.id,
        date: i.date || "",
    }));
    applePhotosPrefetchPlanAt = Date.now();
    applePhotosPrefetchCursor = 0;
};
const isLikelyVideoName = (name) => {
    const n = (name || "").toLowerCase();
    return (n.endsWith(".mov") ||
        n.endsWith(".mp4") ||
        n.endsWith(".m4v") ||
        n.endsWith(".avi") ||
        n.endsWith(".mkv") ||
        n.endsWith(".webm"));
};
const runApplePhotosPrefetchTick = async () => {
    try {
        const settings = await ensureSettingsLoaded();
        if (!settings.applePhotosEnabled) {
            stopApplePhotosPrefetch();
            return;
        }
        // Don’t steal capacity from on-demand preview requests.
        if (activeApplePhotosExports > 0 || applePhotosExportQueue.length > 0)
            return;
        if (activeFfmpegCount > 0 || ffmpegQueue.length > 0)
            return;
        if (Date.now() - applePhotosPrefetchPlanAt > 30000 ||
            applePhotosPrefetchPlan.length === 0) {
            await refreshApplePhotosPrefetchPlan();
        }
        // Prefetch the next uncached item (images only for now; videos are heavier).
        for (let i = 0; i < applePhotosPrefetchPlan.length; i++) {
            const idx = (applePhotosPrefetchCursor + i) % applePhotosPrefetchPlan.length;
            const item = applePhotosPrefetchPlan[idx];
            if (!item)
                continue;
            if (isLikelyVideoName(item.name))
                continue;
            const already = await tryReadCachedApplePhotosPreviewDataUrl(item.id, "image");
            if (already)
                continue;
            const photoKitThumb = await tryPhotoKitThumbnailDataUrl(item.id, 720);
            if (photoKitThumb) {
                void tryWriteCachedApplePhotosPreviewDataUrl(item.id, "image", photoKitThumb);
                applePhotosPrefetchCursor = idx + 1;
                return;
            }
            if (photoKitHelperStatus === "unavailable") {
                applePhotosPrefetchCursor = idx + 1;
                return;
            }
            const tempFile = await resolveApplePhotosItemToTempFile(item.id, {
                timeoutMs: 45000,
                forPreview: true,
                allowPhotosAppLaunch: true,
            });
            if (!tempFile) {
                applePhotosPrefetchCursor = idx + 1;
                return;
            }
            // Generate a thumbnail quickly via QuickLook and save to disk cache.
            const dataUrl = await quickLookThumbnailDataUrl(tempFile, 720);
            if (dataUrl) {
                void tryWriteCachedApplePhotosPreviewDataUrl(item.id, "image", dataUrl);
            }
            const cleanupDir = getManagedApplePhotosTempDirFromPath(tempFile);
            if (cleanupDir) {
                scheduleApplePhotosTempDirCleanup(cleanupDir);
            }
            applePhotosPrefetchCursor = idx + 1;
            return;
        }
    }
    catch { }
};
// Queue system to limit concurrent FFmpeg processes
const MAX_CONCURRENT_FFMPEG = 3;
let activeFfmpegCount = 0;
const ffmpegQueue = [];
function runNextFfmpeg() {
    if (ffmpegQueue.length > 0 && activeFfmpegCount < MAX_CONCURRENT_FFMPEG) {
        const next = ffmpegQueue.shift();
        if (next)
            next();
    }
}
async function queueFfmpeg(fn) {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            activeFfmpegCount++;
            try {
                const result = await fn();
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
            finally {
                activeFfmpegCount--;
                runNextFfmpeg();
            }
        };
        if (activeFfmpegCount < MAX_CONCURRENT_FFMPEG) {
            execute();
        }
        else {
            ffmpegQueue.push(execute);
        }
    });
}
// Clean up old cache entries periodically to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of thumbnailCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            thumbnailCache.delete(key);
        }
    }
}, 60 * 1000); // Run every minute
// Optimize rendering performance
electron_1.app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
function createWindow() {
    const isMac = process.platform === "darwin";
    const isDev = process.env.NODE_ENV === "development" || !electron_1.app.isPackaged;
    mainWindow = new electron_1.BrowserWindow({
        width: 1100,
        height: 720,
        minWidth: 940,
        minHeight: 620,
        frame: false,
        show: false,
        titleBarStyle: "customButtonsOnHover",
        trafficLightPosition: isMac ? { x: -120, y: -120 } : undefined,
        transparent: true,
        backgroundColor: "#00000000",
        vibrancy: "under-window",
        visualEffectState: "active",
        autoHideMenuBar: true,
        roundedCorners: true,
        hasShadow: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
            enableBlinkFeatures: "",
            disableBlinkFeatures: "Accelerated2dCanvas",
        },
    });
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
        isWindowVisible = true;
        if (isMac) {
            electron_1.app.dock.show();
            setDockIconIfMac();
        }
    });
    if (isDev) {
        mainWindow.loadURL("http://localhost:30050");
        // mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    mainWindow.on("show", () => {
        if (isMac) {
            electron_1.app.dock.show();
            setDockIconIfMac();
        }
    });
}
electron_1.app.whenReady().then(() => {
    // Set dock icon and name for dev mode on macOS
    if (process.platform === "darwin") {
        setDockIconIfMac();
        electron_1.app.setName("MacZen");
    }
    createWindow();
    // Create menu bar tray
    createTray();
    // Start Apple Photos thumbnail prefetch in the background (low priority).
    // This warms the disk cache so scrolling doesn’t have to export/thumbnail on-demand.
    void ensureSettingsLoaded()
        .then((settings) => {
        if (settings.applePhotosEnabled) {
            ensureApplePhotosPrefetchRunning();
        }
    })
        .catch(() => { });
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
// IPC Handlers
// Get system theme
electron_1.ipcMain.handle("get-theme", () => {
    return electron_1.nativeTheme.shouldUseDarkColors ? "dark" : "light";
});
// Listen for theme changes
electron_1.nativeTheme.on("updated", () => {
    if (mainWindow) {
        // Update vibrancy when theme changes
        mainWindow.setVibrancy("under-window");
        mainWindow.webContents.send("theme-changed", electron_1.nativeTheme.shouldUseDarkColors ? "dark" : "light");
    }
});
// Settings management
electron_1.ipcMain.handle("get-settings", async () => {
    return ensureSettingsLoaded();
});
electron_1.ipcMain.handle("update-settings", async (_event, updates) => {
    const current = await ensureSettingsLoaded();
    const next = { ...current, ...sanitizeSettings(updates) };
    const shouldMigrateToIcloud = (!current.useIcloudDestination && next.useIcloudDestination) ||
        (current.useIcloudDestination &&
            next.useIcloudDestination &&
            current.icloudDestinationPath !== next.icloudDestinationPath);
    await saveSettings(next);
    cachedSettings = next;
    if (shouldMigrateToIcloud && next.icloudDestinationPath) {
        try {
            const oldBaseDir = getOrganizedBaseDir(current);
            const legacyBaseDir = path.join(electron_1.app.getPath("home"), "MacZen");
            const newBaseDir = getOrganizedBaseDir(next);
            const sources = current.useIcloudDestination
                ? [oldBaseDir]
                : [oldBaseDir, legacyBaseDir];
            await migrateAlbumsToBaseDir(sources, newBaseDir);
        }
        catch (error) {
            safeWarn("Failed to migrate existing albums to iCloud:", error);
        }
    }
    return next;
});
electron_1.ipcMain.handle("select-directory", async (_event, options) => {
    const result = await electron_1.dialog.showOpenDialog({
        title: options?.title,
        defaultPath: options?.defaultPath,
        properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { cancelled: true };
    }
    return { cancelled: false, path: result.filePaths[0] };
});
electron_1.ipcMain.handle("import-apple-photos", async (event, options) => {
    if (process.platform !== "darwin") {
        return {
            success: false,
            error: "Apple Photos import is only supported on macOS.",
        };
    }
    const sendProgress = (data) => {
        try {
            event.sender.send("apple-photos-import-progress", data);
        }
        catch { }
    };
    try {
        sendProgress({
            phase: "starting",
            message: "Starting Apple Photos import…",
            progress: { processed: 0, total: 0 },
        });
        const settings = await ensureSettingsLoaded();
        const importAll = Boolean(settings.applePhotosImportAll);
        const lookbackDays = Math.max(1, settings.applePhotosLookbackDays || 30);
        const albumNames = await getAlbumNames(settings);
        const albumNamesLower = albumNames.map((p) => p.toLowerCase());
        // Throttle background sync (dev hot-reloads can trigger lots of restarts).
        // Manual "Sync now" can bypass with { force: true }.
        if (!options?.force) {
            try {
                const existingIndex = await loadApplePhotosIndex();
                if (typeof existingIndex.lastSyncAt === "number" &&
                    Date.now() - existingIndex.lastSyncAt < 60000) {
                    sendProgress({
                        phase: "done",
                        message: "Apple Photos already synced recently.",
                    });
                    return { success: true, importedCount: 0 };
                }
            }
            catch { }
        }
        sendProgress({
            phase: "query",
            message: importAll
                ? "Querying Photos for all items… (this can take a while for large libraries)"
                : `Querying Photos for last ${lookbackDays} days… (Photos can be slow for large libraries)`,
            progress: { processed: 0, total: 0 },
        });
        const photoKitItems = await tryPhotoKitListAssets({
            importAll,
            lookbackDays,
        });
        if (photoKitItems) {
            sendProgress({
                phase: "parse",
                message: "Parsing PhotoKit results…",
                progress: { processed: 0, total: 0 },
            });
            const index = await loadApplePhotosIndex();
            let newCount = 0;
            index.lastSyncAt = Date.now();
            if (photoKitItems.length === 0) {
                sendProgress({
                    phase: "done",
                    message: importAll
                        ? "No Photos items found in your library."
                        : `No Photos items found in the last ${lookbackDays} days. Try increasing the lookback.`,
                    progress: { processed: 0, total: 0 },
                });
                await saveApplePhotosIndex(index);
                return { success: true, importedCount: 0 };
            }
            sendProgress({
                phase: "index",
                message: `Found ${photoKitItems.length} item${photoKitItems.length === 1 ? "" : "s"}. Indexing…`,
                progress: { processed: 0, total: photoKitItems.length },
            });
            let processed = 0;
            for (const item of photoKitItems) {
                const id = item.id || "";
                if (!id)
                    continue;
                const date = item.date || "";
                const name = item.name || "";
                const kind = item.isMovie ? "video" : "image";
                const rawKeywords = Array.isArray(item.keywords) ? item.keywords : [];
                const keywords = rawKeywords
                    .map((k) => String(k).trim())
                    .filter(Boolean);
                const widthNum = typeof item.width === "number"
                    ? item.width
                    : Number.isFinite(Number(item.width))
                        ? Number(item.width)
                        : null;
                const heightNum = typeof item.height === "number"
                    ? item.height
                    : Number.isFinite(Number(item.height))
                        ? Number(item.height)
                        : null;
                const normalizedName = name.toLowerCase();
                const isMovie = Boolean(item.isMovie) ||
                    normalizedName.endsWith(".mov") ||
                    normalizedName.endsWith(".mp4") ||
                    normalizedName.endsWith(".m4v") ||
                    normalizedName.endsWith(".avi") ||
                    normalizedName.endsWith(".webm");
                const isScreenshot = inferIsScreenshotFromPhotosItem({
                    fileName: name,
                    width: Number.isFinite(Number(widthNum)) ? Number(widthNum) : null,
                    height: Number.isFinite(Number(heightNum))
                        ? Number(heightNum)
                        : null,
                    keywords,
                    isMovie,
                });
                const existing = index.items[id];
                if (!existing)
                    newCount++;
                const existingAlbum = existing?.album ?? null;
                let nextAlbum = existingAlbum;
                if (!existingAlbum && keywords.length > 0) {
                    const keywordsLower = keywords.map((k) => k.toLowerCase());
                    const matchIndex = albumNamesLower.findIndex((p) => keywordsLower.includes(p));
                    if (matchIndex !== -1) {
                        nextAlbum = albumNames[matchIndex];
                    }
                }
                index.items[id] = {
                    id,
                    date: date || "",
                    kind,
                    name: name || existing?.name || id,
                    isScreenshot,
                    album: nextAlbum,
                    isLivePhoto: Boolean(item.isLivePhoto),
                    keywords,
                    exportedPath: existing?.exportedPath ?? null,
                    exportedAt: existing?.exportedAt ?? null,
                    addedAt: existing?.addedAt ?? Date.now(),
                };
                processed++;
                if (processed % 25 === 0) {
                    const displayName = name || existing?.name || id;
                    sendProgress({
                        phase: "index",
                        message: `Indexing ${processed}/${photoKitItems.length}: ${displayName}`,
                        progress: { processed, total: photoKitItems.length },
                    });
                }
            }
            sendProgress({
                phase: "save",
                message: "Saving index…",
                progress: { processed: 0, total: 0 },
            });
            await saveApplePhotosIndex(index);
            sendProgress({
                phase: "done",
                message: `Sync complete. Found ${photoKitItems.length} item${photoKitItems.length === 1 ? "" : "s"} (${newCount} new).`,
                progress: {
                    processed: photoKitItems.length,
                    total: photoKitItems.length,
                },
            });
            ensureApplePhotosPrefetchRunning();
            return {
                success: true,
                importedCount: newCount,
            };
        }
        sendProgress({
            phase: "query",
            message: "PhotoKit unavailable. Querying Photos directly…",
            progress: { processed: 0, total: 0 },
        });
        const photosReady = await ensureApplePhotosAppReady({
            allowLaunch: true,
        });
        if (!photosReady) {
            sendProgress({
                phase: "error",
                message: "Apple Photos isn’t running. Open Photos and try again.",
            });
            return {
                success: false,
                error: "Apple Photos isn’t running. Open Photos and try again.",
            };
        }
        const script = `
      tell application "Photos"
        set importAll to ${importAll ? "true" : "false"}
        set cutoffDate to (current date) - (${lookbackDays} * days)
        set recentItems to media items
        if (count of recentItems) is 0 then return ""
        set out to ""
        set t to ASCII character 9
        set lf to ASCII character 10
        repeat with mi in recentItems
          set itemDateValue to (date of mi)
          if itemDateValue is missing value then
            -- skip
          else
            if (importAll is false) and (itemDateValue is less than or equal to cutoffDate) then
              -- skip
            else
            set itemId to (id of mi) as string
            set itemDate to itemDateValue as string
            set itemName to ""
            try
              set itemName to (filename of mi) as string
            end try
            set itemWidth to ""
            set itemHeight to ""
            try
              set itemWidth to (width of mi) as string
              set itemHeight to (height of mi) as string
            end try
            set kwNames to ""
            try
              set kwList to keywords of mi
              repeat with k in kwList
                set kwNames to kwNames & (name of k) & ","
              end repeat
            end try
            set out to out & itemId & t & itemDate & t & itemName & t & itemWidth & t & itemHeight & t & kwNames & lf
            end if
          end if
        end repeat
        return out
      end tell
    `;
        let stdout = "";
        try {
            const result = await execFileAsync("osascript", ["-e", script], {
                timeout: 300000,
            });
            stdout = result.stdout || "";
        }
        catch (error) {
            // In dev, the app can restart mid-sync, which SIGTERM's osascript.
            if (error && error.killed && error.signal === "SIGTERM") {
                sendProgress({
                    phase: "cancelled",
                    message: "Apple Photos sync interrupted (app restarted).",
                });
                return { success: false, cancelled: true, error: "Sync interrupted" };
            }
            throw error;
        }
        sendProgress({
            phase: "parse",
            message: "Parsing Photos results…",
            progress: { processed: 0, total: 0 },
        });
        const index = await loadApplePhotosIndex();
        let newCount = 0;
        const lines = stdout
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);
        index.lastSyncAt = Date.now();
        if (lines.length === 0) {
            sendProgress({
                phase: "done",
                message: `No Photos items found in the last ${lookbackDays} days. Try increasing the lookback.`,
                progress: { processed: 0, total: 0 },
            });
            await saveApplePhotosIndex(index);
            return { success: true, importedCount: 0 };
        }
        sendProgress({
            phase: "index",
            message: `Found ${lines.length} item${lines.length === 1 ? "" : "s"}. Indexing…`,
            progress: { processed: 0, total: lines.length },
        });
        let processed = 0;
        for (const line of lines) {
            const parts = line.split("\t");
            const id = parts[0] || "";
            const date = parts[1] || "";
            const name = parts[2] || "";
            const kind = "";
            const widthRaw = parts[3] || "";
            const heightRaw = parts[4] || "";
            const rawKeywords = parts[5] || "";
            if (!id)
                continue;
            const normalizedKind = (kind || "").toLowerCase();
            const normalizedName = (name || "").toLowerCase();
            const isMovie = normalizedKind.includes("movie") ||
                normalizedKind.includes("video") ||
                normalizedKind.includes("clip") ||
                normalizedName.endsWith(".mov") ||
                normalizedName.endsWith(".mp4") ||
                normalizedName.endsWith(".m4v") ||
                normalizedName.endsWith(".avi") ||
                normalizedName.endsWith(".webm");
            const existing = index.items[id];
            if (!existing)
                newCount++;
            const keywords = rawKeywords
                .split(",")
                .map((k) => k.trim())
                .filter(Boolean);
            const width = Number.isFinite(Number(widthRaw))
                ? Number(widthRaw)
                : null;
            const height = Number.isFinite(Number(heightRaw))
                ? Number(heightRaw)
                : null;
            const isScreenshot = inferIsScreenshotFromPhotosItem({
                fileName: name,
                width,
                height,
                keywords,
                isMovie,
            });
            const existingAlbum = existing?.album ?? null;
            let nextAlbum = existingAlbum;
            if (!existingAlbum && keywords.length > 0) {
                // If the user tagged this item in Photos with an album name, treat it as organized.
                const keywordsLower = keywords.map((k) => k.toLowerCase());
                const matchIndex = albumNamesLower.findIndex((p) => keywordsLower.includes(p));
                if (matchIndex !== -1) {
                    nextAlbum = albumNames[matchIndex];
                }
            }
            index.items[id] = {
                id,
                date: date || "",
                kind: kind || "",
                name: name || existing?.name || id,
                isScreenshot,
                isLivePhoto: existing?.isLivePhoto ?? false,
                album: nextAlbum,
                // Always trust the latest keywords from Photos so tags stay in sync.
                keywords,
                exportedPath: existing?.exportedPath ?? null,
                exportedAt: existing?.exportedAt ?? null,
                addedAt: existing?.addedAt ?? Date.now(),
            };
            processed++;
            if (processed % 25 === 0) {
                const displayName = name || existing?.name || id;
                sendProgress({
                    phase: "index",
                    message: `Indexing ${processed}/${lines.length}: ${displayName}`,
                    progress: { processed, total: lines.length },
                });
            }
        }
        sendProgress({
            phase: "save",
            message: "Saving index…",
            progress: { processed: 0, total: 0 },
        });
        await saveApplePhotosIndex(index);
        sendProgress({
            phase: "done",
            message: `Sync complete. Found ${lines.length} recent item${lines.length === 1 ? "" : "s"} (${newCount} new).`,
            progress: { processed: lines.length, total: lines.length },
        });
        // Warm previews in the background after a successful sync.
        ensureApplePhotosPrefetchRunning();
        return {
            success: true,
            importedCount: newCount,
        };
    }
    catch (error) {
        safeError("Apple Photos import failed:", error);
        sendProgress({
            phase: "error",
            message: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
});
// Scan desktop for screenshots and recordings
electron_1.ipcMain.handle("scan-files", async () => {
    try {
        const settings = await ensureSettingsLoaded();
        const desktopPath = path.join(electron_1.app.getPath("home"), "Desktop");
        const files = await fs.readdir(desktopPath);
        const screenshots = [];
        const recordings = [];
        // Pre-filter by filename pattern before stat calls (faster)
        const potentialFiles = files.filter((file) => {
            const nameLower = file.toLowerCase();
            const isRecording = (nameLower.startsWith("screen recording") ||
                nameLower.startsWith("screenrecording") ||
                nameLower.startsWith("grabación") ||
                nameLower.startsWith("screen rec")) &&
                (nameLower.endsWith(".mov") ||
                    nameLower.endsWith(".mp4") ||
                    nameLower.endsWith(".avi") ||
                    nameLower.endsWith(".mkv"));
            const isScreenshot = (nameLower.startsWith("screenshot") ||
                nameLower.startsWith("screen shot") ||
                nameLower.startsWith("captura")) &&
                (nameLower.endsWith(".png") ||
                    nameLower.endsWith(".jpg") ||
                    nameLower.endsWith(".jpeg") ||
                    nameLower.endsWith(".gif"));
            return isRecording || isScreenshot;
        });
        // Parallel stat calls for filtered files only
        const statsResults = await Promise.all(potentialFiles.map(async (file) => {
            const filePath = path.join(desktopPath, file);
            try {
                const stats = await fs.stat(filePath);
                return { file, filePath, stats, valid: stats.isFile() };
            }
            catch {
                return { file, filePath, stats: null, valid: false };
            }
        }));
        // Categorize results
        for (const { file, filePath, stats, valid } of statsResults) {
            if (!valid || !stats)
                continue;
            const nameLower = file.toLowerCase();
            const isRecording = (nameLower.startsWith("screen recording") ||
                nameLower.startsWith("screenrecording") ||
                nameLower.startsWith("grabación") ||
                nameLower.startsWith("screen rec")) &&
                (nameLower.endsWith(".mov") ||
                    nameLower.endsWith(".mp4") ||
                    nameLower.endsWith(".avi") ||
                    nameLower.endsWith(".mkv"));
            if (isRecording) {
                recordings.push({
                    path: filePath,
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    mediaType: "screen_recording",
                });
            }
            else {
                screenshots.push({
                    path: filePath,
                    name: file,
                    size: stats.size,
                    modified: stats.mtime,
                    mediaType: "screenshot",
                });
            }
        }
        let applePhotos = { screenshots: [], recordings: [] };
        if (settings.applePhotosEnabled) {
            const index = await loadApplePhotosIndex();
            const items = Object.values(index.items).filter((i) => !i.album);
            for (const item of items) {
                const modified = tryParsePhotosDate(item.date);
                const isScreenshot = inferIsScreenshotFromPhotosIndex(item);
                const mediaType = isScreenshot
                    ? "screenshot"
                    : item.kind === "video"
                        ? "video"
                        : "photo";
                const record = {
                    path: `${APPLE_PHOTOS_URI_PREFIX}${item.id}`,
                    name: item.name || item.id,
                    size: 0,
                    modified,
                    mediaType,
                    isLivePhoto: item.isLivePhoto,
                };
                if (mediaType === "video") {
                    applePhotos.recordings.push(record);
                }
                else {
                    applePhotos.screenshots.push(record);
                }
            }
        }
        return {
            screenshots: [...screenshots, ...applePhotos.screenshots],
            recordings: [...recordings, ...applePhotos.recordings],
        };
    }
    catch (error) {
        safeError("Error scanning files:", error);
        return { screenshots: [], recordings: [] };
    }
});
// Get existing albums
electron_1.ipcMain.handle("get-albums", async () => {
    try {
        const settings = await ensureSettingsLoaded();
        return await getAlbumNames(settings);
    }
    catch (error) {
        safeError("Error getting albums:", error);
        return ["Personal", "Work", "Archive"];
    }
});
electron_1.ipcMain.handle("get-apple-photos-albums", async () => {
    console.log("[IPC] get-apple-photos-albums called");
    try {
        const photoKitAlbums = await tryPhotoKitListAlbums();
        if (photoKitAlbums !== null) {
            console.log("[IPC] get-apple-photos-albums: PhotoKit returned", photoKitAlbums.length, "albums");
            return photoKitAlbums;
        }
        // PhotoKit unavailable (access denied) — fall back to AppleScript
        console.log("[IPC] get-apple-photos-albums: PhotoKit unavailable, trying AppleScript...");
        const albums = await listApplePhotosAlbumsViaAppleScript();
        console.log("[IPC] get-apple-photos-albums: AppleScript returned", albums.length, "albums");
        return albums;
    }
    catch (error) {
        safeError("Error getting Apple Photos albums:", error);
        return [];
    }
});
electron_1.ipcMain.handle("get-apple-photos-album-assets", async (_event, albumId) => {
    try {
        console.log("[IPC] get-apple-photos-album-assets: albumId =", albumId);
        const photoKitAssets = await tryPhotoKitListAlbumAssets(albumId);
        console.log("[IPC] get-apple-photos-album-assets: PhotoKit returned", photoKitAssets === null ? "null" : `${photoKitAssets.length} assets`);
        if (photoKitAssets !== null)
            return photoKitAssets;
        // PhotoKit unavailable — fall back to AppleScript
        const asAssets = await listAlbumAssetsViaAppleScript(albumId);
        console.log("[IPC] get-apple-photos-album-assets: AppleScript returned", asAssets.length, "assets");
        return asAssets;
    }
    catch (error) {
        safeError("Error getting Apple Photos album assets:", error);
        return [];
    }
});
// Create a new album directory (and subfolders) on disk
electron_1.ipcMain.handle("create-album", async (_event, albumName) => {
    try {
        const name = normalizeAlbumName(albumName);
        if (!name) {
            return { success: false, error: "Album name is required." };
        }
        const settings = await ensureSettingsLoaded();
        const baseDir = path.join(getOrganizedBaseDir(settings), name);
        const screenshotsDir = path.join(baseDir, "Screenshots");
        const recordingsDir = path.join(baseDir, "Recordings");
        await fs.mkdir(screenshotsDir, { recursive: true });
        await fs.mkdir(recordingsDir, { recursive: true });
        if (settings.applePhotosEnabled) {
            try {
                await ensureApplePhotosAlbumPath(name);
            }
            catch (error) {
                safeWarn("Failed to ensure Apple Photos album:", error);
            }
        }
        return { success: true };
    }
    catch (error) {
        safeError("Error creating album:", error);
        return { success: false, error: String(error) };
    }
});
electron_1.ipcMain.handle("delete-album", async (_event, albumName) => {
    try {
        const name = normalizeAlbumName(albumName);
        if (!name) {
            return { success: false, error: "Album name is required." };
        }
        const settings = await ensureSettingsLoaded();
        const baseDir = path.join(getOrganizedBaseDir(settings), name);
        await fs.rm(baseDir, { recursive: true, force: true });
        if (settings.applePhotosEnabled) {
            try {
                await deleteApplePhotosAlbumPath(name);
            }
            catch (error) {
                safeWarn("Failed to delete Apple Photos album:", error);
            }
            try {
                const index = await loadApplePhotosIndex();
                const prefix = `${name}/`;
                for (const item of Object.values(index.items)) {
                    if (!item.album)
                        continue;
                    if (item.album === name || item.album.startsWith(prefix)) {
                        item.album = null;
                    }
                }
                await saveApplePhotosIndex(index);
            }
            catch (error) {
                safeWarn("Failed to update Apple Photos index:", error);
            }
        }
        return { success: true };
    }
    catch (error) {
        safeError("Error deleting album:", error);
        return { success: false, error: String(error) };
    }
});
// Move file to album
electron_1.ipcMain.handle("move-file", async (_event, filePath, albumName, isScreenshot) => {
    try {
        const normalizedAlbumName = normalizeAlbumName(albumName);
        if (!normalizedAlbumName) {
            return { success: false, error: "Album name is required." };
        }
        if (filePath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
            const settings = await ensureSettingsLoaded();
            const baseDir = path.join(getOrganizedBaseDir(settings), normalizedAlbumName);
            const targetDir = isScreenshot
                ? path.join(baseDir, "Screenshots")
                : path.join(baseDir, "Recordings");
            await fs.mkdir(targetDir, { recursive: true });
            const id = filePath.slice(APPLE_PHOTOS_URI_PREFIX.length);
            const index = await loadApplePhotosIndex();
            const existing = index.items[id];
            if (!existing) {
                return { success: false, error: "Apple Photos item not found." };
            }
            // Enforce safety: never delete from Photos unless we've exported a copy.
            if (settings.applePhotosOrganizeDeleteFromPhotos &&
                !settings.applePhotosOrganizeExportToFolder) {
                return {
                    success: false,
                    error: "Cannot delete from Apple Photos unless 'Copy to organized folder' is enabled.",
                };
            }
            let exportedDestPath = null;
            let cleanupDir = null;
            if (settings.applePhotosOrganizeExportToFolder) {
                const tempFile = await resolveApplePhotosItemToTempFile(id, {
                    timeoutMs: 300000,
                    forPreview: false,
                });
                if (!tempFile) {
                    return {
                        success: false,
                        error: "Failed to export item from Apple Photos. Check Photos permissions and try again.",
                    };
                }
                cleanupDir = path.dirname(tempFile);
                exportedDestPath = await moveFileWithUniqueName(tempFile, targetDir);
                await cleanupTempDir(cleanupDir);
                cleanupDir = null;
            }
            if (settings.applePhotosOrganizeTagInPhotos) {
                try {
                    await tagApplePhotosItem(id, normalizedAlbumName);
                }
                catch (error) {
                    safeWarn("Failed to tag Apple Photos item:", error);
                }
            }
            if (settings.applePhotosOrganizeDeleteFromPhotos) {
                try {
                    await deleteApplePhotosItem(id);
                    // If the item is deleted from Photos, remove from our index entirely.
                    delete index.items[id];
                }
                catch (error) {
                    safeWarn("Failed to delete Apple Photos item:", error);
                }
            }
            else {
                // Keep it in Photos: mark it organized in our index. If we exported a file,
                // store the exported path so Library won't show the Photos-backed duplicate.
                index.items[id] = {
                    ...existing,
                    album: normalizedAlbumName,
                    keywords: settings.applePhotosOrganizeTagInPhotos
                        ? Array.from(new Set([
                            ...(existing.keywords || []),
                            normalizedAlbumName,
                        ]))
                        : existing.keywords || [],
                    exportedPath: exportedDestPath ?? existing.exportedPath ?? null,
                    exportedAt: exportedDestPath !== null
                        ? Date.now()
                        : (existing.exportedAt ?? null),
                };
            }
            await saveApplePhotosIndex(index);
            thumbnailCache.delete(filePath);
            if (cleanupDir) {
                await cleanupTempDir(cleanupDir);
            }
            return { success: true, destPath: exportedDestPath ?? filePath };
        }
        const settings = await ensureSettingsLoaded();
        // Use configured base location (iCloud or local Documents)
        const baseDir = path.join(getOrganizedBaseDir(settings), normalizedAlbumName);
        // Determine target directory based on file type
        const targetDir = isScreenshot
            ? path.join(baseDir, "Screenshots")
            : path.join(baseDir, "Recordings");
        // Create directory if it doesn't exist
        await fs.mkdir(targetDir, { recursive: true });
        const fileName = path.basename(filePath);
        let destPath = path.join(targetDir, fileName);
        // Handle duplicate names
        if (await fs
            .access(destPath)
            .then(() => true)
            .catch(() => false)) {
            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            let counter = 1;
            while (await fs
                .access(destPath)
                .then(() => true)
                .catch(() => false)) {
                destPath = path.join(targetDir, `${base}_${counter}${ext}`);
                counter++;
            }
        }
        // Move the file
        await fs.rename(filePath, destPath);
        // Clear cache for this file
        thumbnailCache.delete(filePath);
        return { success: true, destPath };
    }
    catch (error) {
        safeError("Error moving file:", error);
        return { success: false, error: String(error) };
    }
});
// Scan organized files from album folders
electron_1.ipcMain.handle("scan-organized-files", async () => {
    try {
        const settings = await ensureSettingsLoaded();
        const organizedFiles = [];
        const primaryBaseDir = getOrganizedBaseDir(settings);
        const legacyDirs = getLegacyOrganizedDirs(settings);
        const baseDirs = [primaryBaseDir, ...legacyDirs].filter((dir, index, list) => list.indexOf(dir) === index);
        const albumByName = new Map();
        const getOrCreateAlbum = (album) => {
            const existing = albumByName.get(album);
            if (existing)
                return existing;
            const created = {
                album,
                screenshots: [],
                recordings: [],
                _seenScreenshotPaths: new Set(),
                _seenRecordingPaths: new Set(),
            };
            albumByName.set(album, created);
            return created;
        };
        for (const baseDir of baseDirs) {
            const albumDirs = await getAlbumDirectories(baseDir);
            for (const albumPath of albumDirs) {
                const relative = path.relative(baseDir, albumPath);
                const albumName = normalizeAlbumName(relative);
                if (!albumName)
                    continue;
                const albumData = getOrCreateAlbum(albumName);
                const screenshotsDir = path.join(albumPath, "Screenshots");
                try {
                    const files = await fs.readdir(screenshotsDir);
                    for (const file of files) {
                        if (file.startsWith("."))
                            continue;
                        const filePath = path.join(screenshotsDir, file);
                        try {
                            const stats = await fs.stat(filePath);
                            if (stats.isFile() &&
                                !albumData._seenScreenshotPaths.has(filePath)) {
                                albumData._seenScreenshotPaths.add(filePath);
                                albumData.screenshots.push({
                                    path: filePath,
                                    name: file,
                                    size: stats.size,
                                    modified: stats.mtime,
                                });
                            }
                        }
                        catch { }
                    }
                }
                catch { }
                const recordingsDir = path.join(albumPath, "Recordings");
                try {
                    const files = await fs.readdir(recordingsDir);
                    for (const file of files) {
                        if (file.startsWith("."))
                            continue;
                        const filePath = path.join(recordingsDir, file);
                        try {
                            const stats = await fs.stat(filePath);
                            if (stats.isFile() &&
                                !albumData._seenRecordingPaths.has(filePath)) {
                                albumData._seenRecordingPaths.add(filePath);
                                albumData.recordings.push({
                                    path: filePath,
                                    name: file,
                                    size: stats.size,
                                    modified: stats.mtime,
                                });
                            }
                        }
                        catch { }
                    }
                }
                catch { }
            }
        }
        if (settings.applePhotosEnabled) {
            const index = await loadApplePhotosIndex();
            for (const item of Object.values(index.items)) {
                if (!item.album)
                    continue;
                if (item.exportedPath)
                    continue;
                const albumData = getOrCreateAlbum(item.album);
                const modified = tryParsePhotosDate(item.date);
                const isScreenshot = inferIsScreenshotFromPhotosIndex(item);
                const mediaType = isScreenshot
                    ? "screenshot"
                    : item.kind === "video"
                        ? "video"
                        : "photo";
                const recordPath = `${APPLE_PHOTOS_URI_PREFIX}${item.id}`;
                const record = {
                    path: recordPath,
                    name: item.name || item.id,
                    size: 0,
                    modified,
                    mediaType,
                    isLivePhoto: item.isLivePhoto,
                };
                if (mediaType !== "video") {
                    if (!albumData._seenScreenshotPaths.has(recordPath)) {
                        albumData._seenScreenshotPaths.add(recordPath);
                        albumData.screenshots.push(record);
                    }
                }
                else {
                    if (!albumData._seenRecordingPaths.has(recordPath)) {
                        albumData._seenRecordingPaths.add(recordPath);
                        albumData.recordings.push(record);
                    }
                }
            }
        }
        for (const albumData of albumByName.values()) {
            if (albumData.screenshots.length > 0 ||
                albumData.recordings.length > 0) {
                organizedFiles.push({
                    album: albumData.album,
                    screenshots: albumData.screenshots,
                    recordings: albumData.recordings,
                });
            }
        }
        return organizedFiles;
    }
    catch (error) {
        safeError("Error scanning organized files:", error);
        return [];
    }
});
// Generate video thumbnail
electron_1.ipcMain.handle("generate-video-thumbnail", async (_event, videoPath) => {
    try {
        const applePhotosId = videoPath.startsWith(APPLE_PHOTOS_URI_PREFIX)
            ? videoPath.slice(APPLE_PHOTOS_URI_PREFIX.length)
            : null;
        if (applePhotosId) {
            const cached = await tryReadCachedApplePhotosPreviewDataUrl(applePhotosId, "video");
            if (cached) {
                thumbnailCache.set(videoPath, {
                    data: cached,
                    timestamp: Date.now(),
                });
                return cached;
            }
        }
        // Check cache first
        const cached = thumbnailCache.get(videoPath);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        let resolvedVideoPath = videoPath;
        let cleanupDir = null;
        if (applePhotosId) {
            const localFallbackPath = await resolveApplePhotosLocalFallbackPath(applePhotosId);
            if (localFallbackPath) {
                resolvedVideoPath = localFallbackPath;
            }
            else {
                const photoKitThumb = await tryPhotoKitThumbnailDataUrl(applePhotosId, 720);
                if (photoKitThumb) {
                    thumbnailCache.set(videoPath, {
                        data: photoKitThumb,
                        timestamp: Date.now(),
                    });
                    void tryWriteCachedApplePhotosPreviewDataUrl(applePhotosId, "video", photoKitThumb);
                    return photoKitThumb;
                }
                const tempFile = await resolveApplePhotosItemToTempFile(applePhotosId, {
                    timeoutMs: 45000,
                    forPreview: true,
                    allowPhotosAppLaunch: true,
                });
                if (!tempFile)
                    return null;
                resolvedVideoPath = tempFile;
                cleanupDir = getManagedApplePhotosTempDirFromPath(tempFile);
            }
        }
        // Check if video file exists
        try {
            await fs.access(resolvedVideoPath);
        }
        catch {
            return null;
        }
        // Prefer QuickLook thumbnails (more reliable than ffmpeg for many formats).
        const quickLookThumb = await quickLookThumbnailDataUrl(resolvedVideoPath, 720);
        if (quickLookThumb) {
            thumbnailCache.set(videoPath, {
                data: quickLookThumb,
                timestamp: Date.now(),
            });
            if (videoPath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
                const id = videoPath.slice(APPLE_PHOTOS_URI_PREFIX.length);
                void tryWriteCachedApplePhotosPreviewDataUrl(id, "video", quickLookThumb);
            }
            if (cleanupDir) {
                scheduleApplePhotosTempDirCleanup(cleanupDir);
            }
            return quickLookThumb;
        }
        const tempDir = electron_1.app.getPath("temp");
        const thumbnailPath = path.join(tempDir, `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        // Use queued ffmpeg to limit concurrent processes
        try {
            await queueFfmpeg(() => execFileAsync("ffmpeg", [
                "-i",
                resolvedVideoPath,
                "-ss",
                "00:00:00.5",
                "-vframes",
                "1",
                "-f",
                "image2",
                "-vf",
                "scale='min(320,iw)':'min(240,ih)':force_original_aspect_ratio=decrease",
                "-y",
                thumbnailPath,
            ], { timeout: 15000 }));
        }
        catch (error) {
            safeError("FFmpeg thumbnail generation failed:", {
                videoPath,
                resolvedVideoPath,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
        // Wait a bit for file system to sync
        await new Promise((resolve) => setTimeout(resolve, 150));
        // Check if file exists before reading
        try {
            await fs.access(thumbnailPath);
        }
        catch {
            safeError("Thumbnail file not created:", thumbnailPath);
            return null;
        }
        // Read the thumbnail as base64
        const thumbnailData = await fs.readFile(thumbnailPath);
        const base64 = thumbnailData.toString("base64");
        const dataUrl = `data:image/jpeg;base64,${base64}`;
        // Store in cache
        thumbnailCache.set(videoPath, {
            data: dataUrl,
            timestamp: Date.now(),
        });
        if (videoPath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
            const id = videoPath.slice(APPLE_PHOTOS_URI_PREFIX.length);
            void tryWriteCachedApplePhotosPreviewDataUrl(id, "video", dataUrl);
        }
        // Clean up - check if file still exists before deleting
        try {
            await fs.access(thumbnailPath);
            await fs.unlink(thumbnailPath);
        }
        catch (cleanupError) {
            // File already deleted or doesn't exist, that's fine
        }
        if (cleanupDir) {
            scheduleApplePhotosTempDirCleanup(cleanupDir);
        }
        return dataUrl;
    }
    catch (error) {
        safeError("Error generating video thumbnail:", error);
        return null;
    }
});
// Resolve a playable video URL (local or Apple Photos temp export)
electron_1.ipcMain.handle("get-video-playback-url", async (_event, videoPath) => {
    try {
        const applePhotosId = videoPath.startsWith(APPLE_PHOTOS_URI_PREFIX)
            ? videoPath.slice(APPLE_PHOTOS_URI_PREFIX.length)
            : null;
        let resolvedVideoPath = videoPath;
        let cleanupDir = null;
        if (applePhotosId) {
            const localFallbackPath = await resolveApplePhotosLocalFallbackPath(applePhotosId);
            if (localFallbackPath) {
                resolvedVideoPath = localFallbackPath;
            }
            else {
                const tempFile = await resolveApplePhotosItemToTempFile(applePhotosId, {
                    timeoutMs: 120000,
                    forPreview: true,
                    allowPhotosAppLaunch: true,
                });
                if (!tempFile)
                    return null;
                resolvedVideoPath = tempFile;
                cleanupDir = getManagedApplePhotosTempDirFromPath(tempFile);
            }
        }
        try {
            await fs.access(resolvedVideoPath);
        }
        catch {
            return null;
        }
        if (cleanupDir) {
            scheduleApplePhotosTempDirCleanup(cleanupDir, 300000);
        }
        return (0, url_1.pathToFileURL)(resolvedVideoPath).toString();
    }
    catch (error) {
        safeWarn("Failed to resolve video playback url:", error);
        return null;
    }
});
electron_1.ipcMain.handle("get-live-photo-video-url", async (_event, photoPath) => {
    try {
        if (!photoPath.startsWith(APPLE_PHOTOS_URI_PREFIX))
            return null;
        const id = photoPath.slice(APPLE_PHOTOS_URI_PREFIX.length);
        if (!id)
            return null;
        const tempDir = path.join(electron_1.app.getPath("temp"), `maczen-live-photo-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(tempDir, { recursive: true });
        const liveVideoPath = await tryPhotoKitLiveVideoPath(id, {
            outDir: tempDir,
            timeoutMs: 120000,
        });
        if (!liveVideoPath) {
            await cleanupTempDir(tempDir);
            return null;
        }
        try {
            await fs.access(liveVideoPath);
        }
        catch {
            await cleanupTempDir(tempDir);
            return null;
        }
        scheduleApplePhotosTempDirCleanup(tempDir, 300000);
        return (0, url_1.pathToFileURL)(liveVideoPath).toString();
    }
    catch (error) {
        safeWarn("Failed to resolve Live Photo video url:", error);
        return null;
    }
});
// Get file as data URL (with thumbnail generation for images)
electron_1.ipcMain.handle("get-file-data-url", async (_event, filePath) => {
    try {
        const cacheKey = filePath;
        // Check cache first
        const cached = thumbnailCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
        }
        let resolvedFilePath = filePath;
        let cleanupDir = null;
        if (filePath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
            const id = filePath.slice(APPLE_PHOTOS_URI_PREFIX.length);
            // Disk-backed preview cache for Photos items (avoids re-exporting on scroll).
            const diskCached = await tryReadCachedApplePhotosPreviewDataUrl(id, "image");
            if (diskCached) {
                thumbnailCache.set(cacheKey, {
                    data: diskCached,
                    timestamp: Date.now(),
                });
                return diskCached;
            }
            const photoKitThumb = await tryPhotoKitThumbnailDataUrl(id, 720);
            if (photoKitThumb) {
                thumbnailCache.set(cacheKey, {
                    data: photoKitThumb,
                    timestamp: Date.now(),
                });
                void tryWriteCachedApplePhotosPreviewDataUrl(id, "image", photoKitThumb);
                return photoKitThumb;
            }
            const localFallbackPath = await resolveApplePhotosLocalFallbackPath(id);
            if (localFallbackPath) {
                resolvedFilePath = localFallbackPath;
            }
            else {
                const tempFile = await resolveApplePhotosItemToTempFile(id, {
                    timeoutMs: 45000,
                    forPreview: true,
                    allowPhotosAppLaunch: true,
                });
                if (!tempFile)
                    return null;
                resolvedFilePath = tempFile;
                cleanupDir = getManagedApplePhotosTempDirFromPath(tempFile);
            }
        }
        // Check if file exists
        try {
            await fs.access(resolvedFilePath);
        }
        catch {
            safeError("File not found:", resolvedFilePath);
            return null;
        }
        const ext = path.extname(resolvedFilePath).toLowerCase();
        let dataUrl = null;
        const isApplePhotosItem = filePath.startsWith(APPLE_PHOTOS_URI_PREFIX);
        // For images, generate a resized thumbnail using sips (macOS).
        if (RESIZE_IMAGE_EXTENSIONS.has(ext)) {
            if (isApplePhotosItem) {
                dataUrl = await quickLookThumbnailDataUrl(resolvedFilePath, 720);
            }
            if (!dataUrl) {
                const tempDir = electron_1.app.getPath("temp");
                const thumbnailPath = path.join(tempDir, `thumb-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
                try {
                    const sipsTimeout = ext === ".heic" || ext === ".heif" ? 20000 : 5000;
                    const resizeLimit = isApplePhotosItem ? 720 : 720;
                    // Use sips to resize while maintaining aspect ratio.
                    await execFileAsync("sips", [
                        "-Z",
                        String(resizeLimit),
                        "-s",
                        "format",
                        "jpeg",
                        "-s",
                        "formatOptions",
                        "70",
                        resolvedFilePath,
                        "--out",
                        thumbnailPath,
                    ], { timeout: sipsTimeout });
                    try {
                        await fs.access(thumbnailPath);
                    }
                    catch {
                        throw new Error("sips did not create thumbnail output");
                    }
                    const thumbnailData = await fs.readFile(thumbnailPath);
                    dataUrl = `data:image/jpeg;base64,${thumbnailData.toString("base64")}`;
                    // Clean up temp file
                    try {
                        await fs.unlink(thumbnailPath);
                    }
                    catch { }
                }
                catch (sipsError) {
                    // Fallback: use QuickLook thumbnailing (more reliable for HEIC/Photos exports).
                    if (!isApplePhotosItem) {
                        const ql = await quickLookThumbnailDataUrl(resolvedFilePath, 720);
                        if (ql)
                            dataUrl = ql;
                    }
                    if (!dataUrl) {
                        // Last resort: only return formats Chromium reliably renders.
                        if (ext === ".png") {
                            const data = await fs.readFile(resolvedFilePath);
                            dataUrl = `data:image/png;base64,${data.toString("base64")}`;
                        }
                        else if (ext === ".jpg" || ext === ".jpeg") {
                            const data = await fs.readFile(resolvedFilePath);
                            dataUrl = `data:image/jpeg;base64,${data.toString("base64")}`;
                        }
                        else if (ext === ".webp") {
                            const data = await fs.readFile(resolvedFilePath);
                            dataUrl = `data:image/webp;base64,${data.toString("base64")}`;
                        }
                        else {
                            return null;
                        }
                    }
                }
            }
        }
        else if (ext === ".gif") {
            // GIFs: read directly (don't resize to preserve animation)
            const data = await fs.readFile(resolvedFilePath);
            dataUrl = `data:image/gif;base64,${data.toString("base64")}`;
        }
        else {
            // Other files: read directly
            const data = await fs.readFile(resolvedFilePath);
            let mimeType = "application/octet-stream";
            if (ext === ".mov")
                mimeType = "video/quicktime";
            else if (ext === ".mp4")
                mimeType = "video/mp4";
            dataUrl = `data:${mimeType};base64,${data.toString("base64")}`;
        }
        if (!dataUrl)
            return null;
        // Store in cache
        thumbnailCache.set(cacheKey, {
            data: dataUrl,
            timestamp: Date.now(),
        });
        if (filePath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
            const id = filePath.slice(APPLE_PHOTOS_URI_PREFIX.length);
            void tryWriteCachedApplePhotosPreviewDataUrl(id, "image", dataUrl);
        }
        if (cleanupDir) {
            scheduleApplePhotosTempDirCleanup(cleanupDir);
        }
        return dataUrl;
    }
    catch (error) {
        safeError("Error reading file:", error);
        return null;
    }
});
// Delete file (move to trash)
electron_1.ipcMain.handle("delete-file", async (_event, filePath) => {
    try {
        if (filePath.startsWith(APPLE_PHOTOS_URI_PREFIX)) {
            const id = filePath.slice(APPLE_PHOTOS_URI_PREFIX.length);
            const index = await loadApplePhotosIndex();
            if (index.items[id]) {
                delete index.items[id];
                await saveApplePhotosIndex(index);
            }
            thumbnailCache.delete(filePath);
            return { success: true };
        }
        const { shell } = require("electron");
        await shell.trashItem(filePath);
        // Clear cache for this file
        thumbnailCache.delete(filePath);
        return { success: true };
    }
    catch (error) {
        safeError("Error deleting file:", error);
        return { success: false, error: String(error) };
    }
});
// Rename album folder
electron_1.ipcMain.handle("rename-album", async (_event, oldName, newName) => {
    try {
        const settings = await ensureSettingsLoaded();
        const normalizedOldName = normalizeAlbumName(oldName);
        const normalizedNewName = normalizeAlbumName(newName);
        const baseDir = getOrganizedBaseDir(settings);
        const oldAlbumPath = path.join(baseDir, normalizedOldName);
        const newAlbumPath = path.join(baseDir, normalizedNewName);
        await fs.access(oldAlbumPath);
        await fs.mkdir(path.dirname(newAlbumPath), { recursive: true });
        await fs.rename(oldAlbumPath, newAlbumPath);
        if (settings.applePhotosEnabled) {
            const index = await loadApplePhotosIndex();
            let updated = false;
            for (const item of Object.values(index.items)) {
                if (item.album === normalizedOldName) {
                    item.album = normalizedNewName;
                    updated = true;
                }
            }
            if (updated) {
                await saveApplePhotosIndex(index);
            }
        }
        return { success: true };
    }
    catch (error) {
        safeError("Error renaming album:", error);
        return { success: false, error: String(error) };
    }
});
// Window controls
electron_1.ipcMain.handle("minimize-window", () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
electron_1.ipcMain.handle("close-window", () => {
    if (mainWindow) {
        mainWindow.close();
    }
});
// Cancel auto-organize
electron_1.ipcMain.handle("cancel-auto-organize", () => {
    if (autoOrganizeAbortController) {
        autoOrganizeAbortController.abort();
        autoOrganizeAbortController = null;
    }
    return { success: true };
});
// Auto-organize with AI via API server
electron_1.ipcMain.handle("auto-organize", async (event, files) => {
    try {
        // Create new abort controller for this request
        autoOrganizeAbortController = new AbortController();
        const signal = autoOrganizeAbortController.signal;
        const settings = await ensureSettingsLoaded();
        const screenshotsDir = getOrganizedBaseDir(settings);
        const existingAlbums = await getAlbumNames(settings);
        // Phase 1: Analyze existing albums with vision
        event.sender.send("auto-organize-progress", {
            suggestions: [],
            complete: false,
            progress: { processed: 0, total: files.length },
            phase: "analyzing_albums",
            phaseMessage: "Analyzing existing album contents...",
        });
        // Get album samples with actual image data for vision analysis
        const albumSamples = [];
        try {
            const albumDirs = await fs.readdir(screenshotsDir);
            for (const albumName of albumDirs.slice(0, 5)) {
                const albumPath = path.join(screenshotsDir, albumName);
                const stats = await fs.stat(albumPath);
                if (stats.isDirectory() && !albumName.startsWith(".")) {
                    const screenshotsPath = path.join(albumPath, "Screenshots");
                    const filesList = [];
                    const sampleImages = [];
                    // Get sample files and images from Screenshots
                    try {
                        const screenshots = await fs.readdir(screenshotsPath);
                        const imageFiles = screenshots.filter((f) => /\.(png|jpg|jpeg|gif)$/i.test(f));
                        filesList.push(...screenshots.slice(0, 5).map((f) => `Screenshot: ${f}`));
                        // Load up to 2 sample images per album for vision context
                        for (const imgFile of imageFiles.slice(0, 2)) {
                            try {
                                const imgPath = path.join(screenshotsPath, imgFile);
                                const tempDir = electron_1.app.getPath("temp");
                                const thumbnailPath = path.join(tempDir, `sample-${Date.now()}-${Math.random()
                                    .toString(36)
                                    .slice(2)}.jpg`);
                                // Resize for vision API (smaller = fewer tokens)
                                await execAsync(`sips -Z 256 -s format jpeg -s formatOptions 60 "${imgPath}" --out "${thumbnailPath}"`, { timeout: 5000 });
                                const imgData = await fs.readFile(thumbnailPath);
                                sampleImages.push(`data:image/jpeg;base64,${imgData.toString("base64")}`);
                                // Cleanup
                                try {
                                    await fs.unlink(thumbnailPath);
                                }
                                catch { }
                            }
                            catch {
                                // Skip failed images
                            }
                        }
                    }
                    catch { }
                    // Get sample files from Recordings
                    try {
                        const recordingsPath = path.join(albumPath, "Recordings");
                        const recordings = await fs.readdir(recordingsPath);
                        filesList.push(...recordings.slice(0, 3).map((f) => `Recording: ${f}`));
                    }
                    catch { }
                    if (filesList.length > 0) {
                        albumSamples.push({
                            projectName: albumName,
                            files: filesList,
                            sampleImages,
                        });
                    }
                }
            }
        }
        catch {
            safeLog("No existing albums found, will suggest new ones");
        }
        // Phase 2: Process files in batches via API
        const totalFiles = files.length;
        const BATCH_SIZE = 5;
        const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        let allSuggestions = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const model = "gpt-4o";
        // Helper to load image for API
        const loadImageForApi = async (filePath) => {
            try {
                const tempDir = electron_1.app.getPath("temp");
                const thumbnailPath = path.join(tempDir, `file-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
                // Resize to reduce payload size
                await execAsync(`sips -Z 400 -s format jpeg -s formatOptions 70 "${filePath}" --out "${thumbnailPath}"`, { timeout: 5000 });
                const imgData = await fs.readFile(thumbnailPath);
                const dataUrl = `data:image/jpeg;base64,${imgData.toString("base64")}`;
                try {
                    await fs.unlink(thumbnailPath);
                }
                catch { }
                return dataUrl;
            }
            catch {
                // Fallback to reading raw file
                try {
                    const data = await fs.readFile(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
                    return `data:${mimeType};base64,${data.toString("base64")}`;
                }
                catch {
                    return null;
                }
            }
        };
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            if (signal.aborted) {
                throw new Error("CANCELLED");
            }
            const startIdx = batchIndex * BATCH_SIZE;
            const batchFiles = files.slice(startIdx, startIdx + BATCH_SIZE);
            // Send phase update
            event.sender.send("auto-organize-progress", {
                suggestions: allSuggestions,
                complete: false,
                progress: {
                    processed: startIdx,
                    total: totalFiles,
                },
                phase: "analyzing_files",
                phaseMessage: `Analyzing batch ${batchIndex + 1} of ${totalBatches}...`,
                cost: {
                    inputTokens: totalInputTokens,
                    outputTokens: totalOutputTokens,
                    totalTokens: totalInputTokens + totalOutputTokens,
                    estimatedCost: 0,
                    model,
                },
            });
            // Prepare files with image data for API
            const filesWithImages = await Promise.all(batchFiles.map(async (file) => ({
                name: file.name,
                isScreenshot: file.isScreenshot,
                imageData: file.isScreenshot
                    ? await loadImageForApi(file.path)
                    : undefined,
            })));
            try {
                const response = await fetch(`${API_SERVER_URL}/api/organize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        files: filesWithImages,
                        albumSamples,
                        existingAlbums,
                        batchIndex,
                        totalBatches,
                    }),
                    signal,
                });
                if (!response.ok) {
                    const errorData = (await response.json().catch(() => ({})));
                    throw new Error(errorData.error || `API error: ${response.status}`);
                }
                const result = (await response.json());
                if (!result.success) {
                    throw new Error(result.error || "API returned unsuccessful");
                }
                // Merge suggestions
                const suggestionMap = new Map(allSuggestions.map((s) => [s.fileName, s]));
                for (const s of result.suggestions || []) {
                    suggestionMap.set(s.fileName, s);
                }
                allSuggestions = Array.from(suggestionMap.values());
                // Update token counts
                if (result.usage) {
                    totalInputTokens += result.usage.inputTokens || 0;
                    totalOutputTokens += result.usage.outputTokens || 0;
                }
                // Send progress update
                event.sender.send("auto-organize-progress", {
                    suggestions: allSuggestions,
                    complete: false,
                    progress: {
                        processed: startIdx + batchFiles.length,
                        total: totalFiles,
                    },
                    phase: "analyzing_files",
                    phaseMessage: `Processed ${startIdx + batchFiles.length} of ${totalFiles} files`,
                    cost: result.usage || {
                        inputTokens: totalInputTokens,
                        outputTokens: totalOutputTokens,
                        totalTokens: totalInputTokens + totalOutputTokens,
                        estimatedCost: 0,
                        model,
                    },
                });
            }
            catch (fetchError) {
                if (fetchError instanceof Error && fetchError.name === "AbortError") {
                    throw new Error("CANCELLED");
                }
                throw fetchError;
            }
        }
        if (allSuggestions.length === 0) {
            throw new Error("No suggestions received from API");
        }
        // Calculate final cost
        const COST_PER_1M_INPUT_TOKENS = 2.5;
        const COST_PER_1M_OUTPUT_TOKENS = 10.0;
        const inputCost = (totalInputTokens / 1000000) * COST_PER_1M_INPUT_TOKENS;
        const outputCost = (totalOutputTokens / 1000000) * COST_PER_1M_OUTPUT_TOKENS;
        const totalCost = inputCost + outputCost;
        // Send completion
        event.sender.send("auto-organize-progress", {
            suggestions: allSuggestions,
            complete: true,
            progress: {
                processed: totalFiles,
                total: totalFiles,
            },
            phase: "complete",
            phaseMessage: "Analysis complete!",
            cost: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                totalTokens: totalInputTokens + totalOutputTokens,
                estimatedCost: totalCost,
                model,
            },
        });
        return {
            success: true,
            suggestions: allSuggestions,
            cost: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                totalTokens: totalInputTokens + totalOutputTokens,
                estimatedCost: totalCost,
                model,
            },
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage === "CANCELLED") {
            return { success: false, error: "CANCELLED", cancelled: true };
        }
        safeError("Error in auto-organize:", error);
        event.sender.send("auto-organize-error", {
            error: "Organization Failed",
            message: errorMessage,
            details: {},
        });
        return { success: false, error: errorMessage };
    }
    finally {
        autoOrganizeAbortController = null;
    }
});
// License management
const DEV_LICENSE_KEY = (process.env.DEV_LICENSE_KEY?.trim().toUpperCase() ||
    "MCZN-DEAD-BEEF-CAFE-BABE");
// Get a unique machine ID for license activation
function getMachineId() {
    const { hostname, platform, arch } = require("os");
    const data = `${hostname()}-${platform()}-${arch()}`;
    return crypto
        .createHash("sha256")
        .update(data)
        .digest("hex")
        .substring(0, 16);
}
// License storage path
function getLicenseFilePath() {
    return path.join(electron_1.app.getPath("userData"), "license.json");
}
// Save license to disk
async function saveLicense(licenseKey, licenseData) {
    const filePath = getLicenseFilePath();
    await fs.writeFile(filePath, JSON.stringify({ key: licenseKey, ...licenseData }, null, 2));
}
// Load license from disk
async function loadLicense() {
    try {
        const filePath = getLicenseFilePath();
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
    }
    catch {
        return null;
    }
}
// Get current license status
electron_1.ipcMain.handle("get-license", async () => {
    const license = await loadLicense();
    if (!license) {
        return { valid: false, plan: "free" };
    }
    return license;
});
// Activate a license key
electron_1.ipcMain.handle("activate-license", async (_event, licenseKey) => {
    try {
        const normalizedKey = licenseKey.trim().toUpperCase();
        const machineId = getMachineId();
        if (isDevMode() && normalizedKey === DEV_LICENSE_KEY) {
            const data = {
                valid: true,
                plan: "pro",
                email: "dev@local",
                activatedAt: new Date().toISOString(),
                machineId,
            };
            await saveLicense(normalizedKey, data);
            return { success: true, valid: true, plan: "pro", email: "dev@local" };
        }
        const response = await fetch(`${API_SERVER_URL}/api/license?key=${encodeURIComponent(normalizedKey)}&machineId=${machineId}`);
        if (!response.ok) {
            const errorData = (await response.json());
            return {
                success: false,
                error: errorData.error || "Invalid license key",
            };
        }
        const data = (await response.json());
        if (data.valid) {
            await saveLicense(licenseKey, data);
            return { success: true, valid: true, plan: data.plan, email: data.email };
        }
        else {
            return { success: false, error: "Invalid license key" };
        }
    }
    catch (err) {
        safeError("License activation error:", err);
        return {
            success: false,
            error: "Failed to activate license. Please check your internet connection.",
        };
    }
});
// Deactivate license (remove from disk)
electron_1.ipcMain.handle("deactivate-license", async () => {
    try {
        const filePath = getLicenseFilePath();
        await fs.unlink(filePath);
        return { success: true };
    }
    catch {
        return { success: true }; // Already deactivated
    }
});
// Open upgrade URL in browser
electron_1.ipcMain.handle("open-upgrade-url", async () => {
    const upgradeUrl = `${API_SERVER_URL}/subscribe`;
    await electron_1.shell.openExternal(upgradeUrl);
    return { success: true };
});
electron_1.ipcMain.handle("request-photos-access", async () => {
    try {
        await requestPhotoKitAccess();
        await electron_1.shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Photos");
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// Hide window (for capture mode) - hides whichever window is active
electron_1.ipcMain.handle("hide-window", () => {
    if (mainWindow) {
        mainWindow.hide();
        isWindowVisible = false;
    }
});
// Show window
electron_1.ipcMain.handle("show-window", () => {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        isWindowVisible = true;
    }
});
// Get Screenshots folder path
const getScreenshotsFolderPath = () => {
    const desktopPath = path.join(electron_1.app.getPath("home"), "Desktop");
    return desktopPath;
};
// Generate unique filename for captures
const generateCaptureFilename = (type, extension) => {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const prefix = type === "screenshot" ? "Screenshot" : "Screen Recording";
    return `${prefix} ${dateStr}.${extension}`;
};
// Capture fullscreen screenshot using macOS screencapture
electron_1.ipcMain.handle("capture-fullscreen-screenshot", async () => {
    if (process.platform !== "darwin") {
        return { success: false, error: "Screenshots are only supported on macOS" };
    }
    try {
        // Hide the window before capturing
        const wasVisible = mainWindow?.isVisible();
        if (mainWindow) {
            mainWindow.hide();
            isWindowVisible = false;
        }
        // Wait for window to hide
        await new Promise((resolve) => setTimeout(resolve, 200));
        const filename = generateCaptureFilename("screenshot", "png");
        const outputPath = path.join(getScreenshotsFolderPath(), filename);
        // Use macOS screencapture command for fullscreen
        await execAsync(`screencapture -x "${outputPath}"`);
        // Show window again
        if (wasVisible && mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: true, path: outputPath };
    }
    catch (error) {
        safeError("Error capturing fullscreen screenshot:", error);
        // Show window on error
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: false, error: String(error) };
    }
});
// Capture area screenshot using macOS screencapture interactive mode
electron_1.ipcMain.handle("capture-area-screenshot", async () => {
    if (process.platform !== "darwin") {
        return { success: false, error: "Screenshots are only supported on macOS" };
    }
    try {
        // Hide the window before capturing
        const wasVisible = mainWindow?.isVisible();
        if (mainWindow) {
            mainWindow.hide();
            isWindowVisible = false;
        }
        // Wait for window to hide
        await new Promise((resolve) => setTimeout(resolve, 200));
        const filename = generateCaptureFilename("screenshot", "png");
        const outputPath = path.join(getScreenshotsFolderPath(), filename);
        // Use macOS screencapture command with -i for interactive selection
        // -s for selection, -i for interactive (allows window selection too)
        await execAsync(`screencapture -i "${outputPath}"`);
        // Check if file was created (user might have cancelled)
        const fileCreated = await fileExists(outputPath);
        // Show window again
        if (wasVisible && mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        if (fileCreated) {
            return { success: true, path: outputPath };
        }
        else {
            return { success: false, cancelled: true };
        }
    }
    catch (error) {
        safeError("Error capturing area screenshot:", error);
        // Show window on error
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: false, error: String(error) };
    }
});
// Video recording state
let currentVideoProcess = null;
let currentVideoPath = null;
// Capture fullscreen video using macOS screencapture
electron_1.ipcMain.handle("capture-fullscreen-video", async () => {
    if (process.platform !== "darwin") {
        return {
            success: false,
            error: "Video recording is only supported on macOS",
        };
    }
    if (currentVideoProcess) {
        return { success: false, error: "A recording is already in progress" };
    }
    try {
        // Hide the window before capturing
        if (mainWindow) {
            mainWindow.hide();
            isWindowVisible = false;
        }
        // Wait for window to hide
        await new Promise((resolve) => setTimeout(resolve, 200));
        const filename = generateCaptureFilename("recording", "mov");
        const outputPath = path.join(getScreenshotsFolderPath(), filename);
        currentVideoPath = outputPath;
        // Use macOS screencapture command with -v for video, -V for audio
        // The process will run until we kill it
        currentVideoProcess = (0, child_process_1.exec)(`screencapture -v -V "Microphone" "${outputPath}"`, (error) => {
            if (error && !error.killed) {
                safeError("Video recording error:", error);
            }
            currentVideoProcess = null;
            currentVideoPath = null;
        });
        return { success: true, path: outputPath, recording: true };
    }
    catch (error) {
        safeError("Error starting fullscreen video:", error);
        currentVideoProcess = null;
        currentVideoPath = null;
        // Show window on error
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: false, error: String(error) };
    }
});
// Capture area video using macOS screencapture interactive mode
electron_1.ipcMain.handle("capture-area-video", async () => {
    if (process.platform !== "darwin") {
        return {
            success: false,
            error: "Video recording is only supported on macOS",
        };
    }
    if (currentVideoProcess) {
        return { success: false, error: "A recording is already in progress" };
    }
    try {
        // Hide the window before capturing
        if (mainWindow) {
            mainWindow.hide();
            isWindowVisible = false;
        }
        // Wait for window to hide
        await new Promise((resolve) => setTimeout(resolve, 200));
        const filename = generateCaptureFilename("recording", "mov");
        const outputPath = path.join(getScreenshotsFolderPath(), filename);
        currentVideoPath = outputPath;
        // Use macOS screencapture command with -v for video, -V for audio, -R for rectangle selection
        // -R requires x,y,width,height - we'll use -v which allows interactive selection
        // Actually, screencapture -v alone prompts for area selection
        currentVideoProcess = (0, child_process_1.exec)(`screencapture -v -V "Microphone" "${outputPath}"`, (error) => {
            if (error && !error.killed) {
                safeError("Video recording error:", error);
            }
            currentVideoProcess = null;
            currentVideoPath = null;
        });
        return { success: true, path: outputPath, recording: true };
    }
    catch (error) {
        safeError("Error starting area video:", error);
        currentVideoProcess = null;
        currentVideoPath = null;
        // Show window on error
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: false, error: String(error) };
    }
});
// Stop video recording
electron_1.ipcMain.handle("stop-video-recording", async () => {
    if (!currentVideoProcess) {
        return { success: false, error: "No recording in progress" };
    }
    try {
        const outputPath = currentVideoPath;
        // Send Ctrl+C to stop the recording gracefully
        currentVideoProcess.kill("SIGINT");
        // Wait for the process to finish
        await new Promise((resolve) => setTimeout(resolve, 500));
        currentVideoProcess = null;
        currentVideoPath = null;
        // Show window again
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        if (outputPath && (await fileExists(outputPath))) {
            return { success: true, path: outputPath };
        }
        else {
            return { success: true, cancelled: true };
        }
    }
    catch (error) {
        safeError("Error stopping video recording:", error);
        currentVideoProcess = null;
        currentVideoPath = null;
        // Show window on error
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            isWindowVisible = true;
        }
        return { success: false, error: String(error) };
    }
});
// Check if a recording is in progress
electron_1.ipcMain.handle("is-recording", () => {
    return { recording: currentVideoProcess !== null, path: currentVideoPath };
});
