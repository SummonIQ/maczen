import { FileItem } from "../types";

const VIDEO_EXTENSIONS = [
  ".mov",
  ".mp4",
  ".m4v",
  ".avi",
  ".mkv",
  ".webm",
];

const SCREEN_RECORDING_PREFIXES = [
  "screen recording",
  "screenrecording",
  "screen rec",
  "grabación",
];

const hasVideoExtension = (name: string) => {
  const lower = name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const isScreenRecordingName = (name: string) => {
  const lower = name.toLowerCase();
  return SCREEN_RECORDING_PREFIXES.some((prefix) =>
    lower.startsWith(prefix),
  );
};

export type MediaPresentation = {
  label: "Screenshot" | "Photo" | "Video" | "Screen Recording" | "Live Photo";
  isVideo: boolean;
  isScreenRecording: boolean;
  isScreenshot: boolean;
  isImage: boolean;
};

export const getMediaPresentation = (
  file: FileItem,
  isScreenshotFallback?: boolean,
): MediaPresentation => {
  const name = file.name || "";
  const mediaType = file.mediaType;
  const isVideo = mediaType
    ? mediaType === "video" || mediaType === "screen_recording"
    : hasVideoExtension(name);
  const isScreenRecording =
    mediaType === "screen_recording" ||
    (isVideo && isScreenRecordingName(name));
  const isScreenshot = mediaType
    ? mediaType === "screenshot"
    : Boolean(isScreenshotFallback);
  const isLivePhoto = !isVideo && Boolean(file.isLivePhoto);
  const label: MediaPresentation["label"] = isVideo
    ? isScreenRecording
      ? "Screen Recording"
      : "Video"
    : isLivePhoto
      ? "Live Photo"
      : isScreenshot
        ? "Screenshot"
        : "Photo";

  return {
    label,
    isVideo,
    isScreenRecording,
    isScreenshot,
    isImage: !isVideo,
  };
};
