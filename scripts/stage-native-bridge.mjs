import { mkdir, copyFile, chmod } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const repoRoot = join(__dirname, "..");
const bridgeRoot = join(repoRoot, "macos-bridge");
const bridgeBinary = join(bridgeRoot, ".build", "debug", "MacZenBridgeCLI");
const ffmpegStaticPath = require("ffmpeg-static");
if (!ffmpegStaticPath) {
  throw new Error("Unable to resolve ffmpeg-static binary path");
}
const tauriTarget = join(
  repoRoot,
  "apps",
  "desktop-app-tauri",
  "src-tauri",
  "binaries",
  `MacZenBridgeCLI-${resolveDarwinTargetTriple(process.arch)}`
);
const ffmpegTarget = join(
  repoRoot,
  "apps",
  "desktop-app-tauri",
  "src-tauri",
  "binaries",
  `ffmpeg-${resolveDarwinTargetTriple(process.arch)}`
);

buildNativeBridge();
await stageBinary(tauriTarget);
await stageBinary(ffmpegTarget, ffmpegStaticPath);

console.log(`Staged native bridge for Tauri at ${tauriTarget}`);
console.log(`Staged ffmpeg for Tauri at ${ffmpegTarget}`);

function buildNativeBridge() {
  const result = spawnSync("swift", ["build"], {
    cwd: bridgeRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      SWIFTPM_CUSTOM_CACHE_PATH:
        process.env.SWIFTPM_CUSTOM_CACHE_PATH ?? "/tmp/swiftpm",
      CLANG_MODULE_CACHE_PATH:
        process.env.CLANG_MODULE_CACHE_PATH ?? "/tmp/clang-module-cache",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function stageBinary(targetPath, sourcePath = bridgeBinary) {
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
  await chmod(targetPath, 0o755);
}

function resolveDarwinTargetTriple(arch) {
  switch (arch) {
    case "arm64":
      return "aarch64-apple-darwin";
    case "x64":
      return "x86_64-apple-darwin";
    default:
      throw new Error(`Unsupported macOS architecture for native bridge: ${arch}`);
  }
}
