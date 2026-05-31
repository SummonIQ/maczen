import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Video,
  Square,
  Maximize,
  X,
  Circle,
  StopCircle,
} from "lucide-react";
import clsx from "clsx";

interface CaptureModeProps {
  onClose: () => void;
  onCaptureComplete?: (path: string) => void;
}

type KeySequence = "s+f" | "s+a" | "v+f" | "v+a" | null;

export function CaptureMode({ onClose, onCaptureComplete }: CaptureModeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [keySequence, setKeySequence] = useState<KeySequence>(null);
  const keyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  // Check if already recording on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isRecording().then((result) => {
        if (result.recording) {
          setIsRecording(true);
        }
      });
    }
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if input is focused
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Clear timeout on new key press
      if (keyTimeoutRef.current) {
        clearTimeout(keyTimeoutRef.current);
      }

      // Check for second key in sequence
      if (lastKeyRef.current === "s" && (key === "f" || key === "a")) {
        e.preventDefault();
        const sequence = `s+${key}` as KeySequence;
        setKeySequence(sequence);
        lastKeyRef.current = null;

        // Execute the capture
        if (sequence === "s+f") {
          handleFullscreenScreenshot();
        } else if (sequence === "s+a") {
          handleAreaScreenshot();
        }
        return;
      }

      if (lastKeyRef.current === "v" && (key === "f" || key === "a")) {
        e.preventDefault();
        const sequence = `v+${key}` as KeySequence;
        setKeySequence(sequence);
        lastKeyRef.current = null;

        // Execute the capture
        if (sequence === "v+f") {
          handleFullscreenVideo();
        } else if (sequence === "v+a") {
          handleAreaVideo();
        }
        return;
      }

      // First key of sequence
      if (key === "s" || key === "v") {
        e.preventDefault();
        lastKeyRef.current = key;
        setKeySequence(null);

        // Clear after 500ms if no second key
        keyTimeoutRef.current = setTimeout(() => {
          lastKeyRef.current = null;
        }, 500);
        return;
      }

      // Escape to close
      if (key === "escape") {
        e.preventDefault();
        if (isRecording) {
          handleStopRecording();
        } else {
          onClose();
        }
        return;
      }

      // Reset sequence on any other key
      lastKeyRef.current = null;
      setKeySequence(null);
    },
    [isRecording, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (keyTimeoutRef.current) {
        clearTimeout(keyTimeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  // Clear key sequence after showing
  useEffect(() => {
    if (keySequence) {
      const timer = setTimeout(() => setKeySequence(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [keySequence]);

  const handleFullscreenScreenshot = async () => {
    if (!window.electronAPI) return;
    setCaptureStatus("Capturing fullscreen screenshot...");

    try {
      const result = await window.electronAPI.captureFullscreenScreenshot();
      if (result.success && result.path) {
        setCaptureStatus("Screenshot saved!");
        onCaptureComplete?.(result.path);
        setTimeout(() => {
          setCaptureStatus(null);
          onClose();
        }, 1000);
      } else {
        setCaptureStatus(result.error || "Failed to capture screenshot");
        setTimeout(() => setCaptureStatus(null), 2000);
      }
    } catch (error) {
      setCaptureStatus("Error capturing screenshot");
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  };

  const handleAreaScreenshot = async () => {
    if (!window.electronAPI) return;
    setCaptureStatus("Select area to capture...");

    try {
      const result = await window.electronAPI.captureAreaScreenshot();
      if (result.success && result.path) {
        setCaptureStatus("Screenshot saved!");
        onCaptureComplete?.(result.path);
        setTimeout(() => {
          setCaptureStatus(null);
          onClose();
        }, 1000);
      } else if (result.cancelled) {
        setCaptureStatus(null);
      } else {
        setCaptureStatus(result.error || "Failed to capture screenshot");
        setTimeout(() => setCaptureStatus(null), 2000);
      }
    } catch (error) {
      setCaptureStatus("Error capturing screenshot");
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  };

  const handleFullscreenVideo = async () => {
    if (!window.electronAPI) return;
    if (isRecording) {
      handleStopRecording();
      return;
    }

    setCaptureStatus("Starting fullscreen recording...");

    try {
      const result = await window.electronAPI.captureFullscreenVideo();
      if (result.success && result.recording) {
        setIsRecording(true);
        setCaptureStatus("Recording... Press ESC or click Stop to finish");
      } else {
        setCaptureStatus(result.error || "Failed to start recording");
        setTimeout(() => setCaptureStatus(null), 2000);
      }
    } catch (error) {
      setCaptureStatus("Error starting recording");
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  };

  const handleAreaVideo = async () => {
    if (!window.electronAPI) return;
    if (isRecording) {
      handleStopRecording();
      return;
    }

    setCaptureStatus("Starting area recording...");

    try {
      const result = await window.electronAPI.captureAreaVideo();
      if (result.success && result.recording) {
        setIsRecording(true);
        setCaptureStatus("Recording... Press ESC or click Stop to finish");
      } else {
        setCaptureStatus(result.error || "Failed to start recording");
        setTimeout(() => setCaptureStatus(null), 2000);
      }
    } catch (error) {
      setCaptureStatus("Error starting recording");
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  };

  const handleStopRecording = async () => {
    if (!window.electronAPI || !isRecording) return;
    setCaptureStatus("Stopping recording...");

    try {
      const result = await window.electronAPI.stopVideoRecording();
      setIsRecording(false);

      if (result.success && result.path) {
        setCaptureStatus("Recording saved!");
        onCaptureComplete?.(result.path);
        setTimeout(() => {
          setCaptureStatus(null);
          onClose();
        }, 1000);
      } else if (result.cancelled) {
        setCaptureStatus("Recording cancelled");
        setTimeout(() => setCaptureStatus(null), 1000);
      } else {
        setCaptureStatus(result.error || "Failed to save recording");
        setTimeout(() => setCaptureStatus(null), 2000);
      }
    } catch (error) {
      setIsRecording(false);
      setCaptureStatus("Error stopping recording");
      setTimeout(() => setCaptureStatus(null), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => {
        if (!isRecording) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
        className="bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-neutral-800/90 bg-neutral-950/70">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-neutral-400" />
              Capture
            </h2>
            <button
              onClick={isRecording ? handleStopRecording : onClose}
              className="text-neutral-400 hover:text-white transition-colors"
              title={isRecording ? "Stop recording" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Take screenshots or record your screen
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {/* Key sequence indicator */}
          <AnimatePresence>
            {keySequence && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3 rounded-lg border border-blue-500/30 bg-blue-500/20 px-3 py-1.5 text-center"
              >
                <span className="text-sm font-mono text-blue-400">
                  {keySequence}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Status message */}
          <AnimatePresence>
            {captureStatus && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-lg border border-neutral-700/50 bg-neutral-800/50 p-3"
              >
                <p className="text-sm text-center text-neutral-300">
                  {captureStatus}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recording indicator */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4"
            >
              <div className="flex items-center justify-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  <Circle className="w-4 h-4 text-red-500 fill-red-500" />
                </motion.div>
                <span className="text-red-400 font-medium">Recording...</span>
              </div>
            </motion.div>
          )}

          {/* Capture options */}
          <div className="grid grid-cols-2 gap-3">
            {/* Screenshot buttons */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1">
                Screenshot
              </h3>

              <button
                onClick={handleFullscreenScreenshot}
                disabled={isRecording}
                className={clsx(
                  "w-full p-4 rounded-xl border transition-all",
                  "flex flex-col items-center gap-2",
                  isRecording
                    ? "bg-neutral-800/30 border-neutral-700/30 cursor-not-allowed opacity-50"
                    : "bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-700/50 hover:border-neutral-600",
                )}
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-sky-400" />
                  <Maximize className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-sm font-medium text-white">
                  Fullscreen
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  S + F
                </span>
              </button>

              <button
                onClick={handleAreaScreenshot}
                disabled={isRecording}
                className={clsx(
                  "w-full p-4 rounded-xl border transition-all",
                  "flex flex-col items-center gap-2",
                  isRecording
                    ? "bg-neutral-800/30 border-neutral-700/30 cursor-not-allowed opacity-50"
                    : "bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-700/50 hover:border-neutral-600",
                )}
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-sky-400" />
                  <Square className="w-4 h-4 text-neutral-400" />
                </div>
                <span className="text-sm font-medium text-white">Area</span>
                <span className="text-xs text-neutral-500 font-mono">
                  S + A
                </span>
              </button>
            </div>

            {/* Video buttons */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1">
                Video
              </h3>

              <button
                onClick={isRecording ? handleStopRecording : handleFullscreenVideo}
                className={clsx(
                  "w-full p-4 rounded-xl border transition-all",
                  "flex flex-col items-center gap-2",
                  isRecording
                    ? "bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
                    : "bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-700/50 hover:border-neutral-600",
                )}
              >
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <StopCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <>
                      <Video className="w-5 h-5 text-purple-400" />
                      <Maximize className="w-4 h-4 text-neutral-400" />
                    </>
                  )}
                </div>
                <span className="text-sm font-medium text-white">
                  {isRecording ? "Stop" : "Fullscreen"}
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  {isRecording ? "ESC" : "V + F"}
                </span>
              </button>

              <button
                onClick={isRecording ? handleStopRecording : handleAreaVideo}
                className={clsx(
                  "w-full p-4 rounded-xl border transition-all",
                  "flex flex-col items-center gap-2",
                  isRecording
                    ? "bg-red-500/20 border-red-500/30 hover:bg-red-500/30"
                    : "bg-neutral-800/50 border-neutral-700/50 hover:bg-neutral-700/50 hover:border-neutral-600",
                )}
              >
                <div className="flex items-center gap-2">
                  {isRecording ? (
                    <StopCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <>
                      <Video className="w-5 h-5 text-purple-400" />
                      <Square className="w-4 h-4 text-neutral-400" />
                    </>
                  )}
                </div>
                <span className="text-sm font-medium text-white">
                  {isRecording ? "Stop" : "Area"}
                </span>
                <span className="text-xs text-neutral-500 font-mono">
                  {isRecording ? "ESC" : "V + A"}
                </span>
              </button>
            </div>
          </div>

          {/* Keyboard hints */}
          <div className="mt-5 border-t border-neutral-800 pt-4">
            <p className="text-xs text-center text-neutral-500">
              Press keys in sequence:{" "}
              <span className="font-mono text-neutral-400">S</span> then{" "}
              <span className="font-mono text-neutral-400">F/A</span> for
              screenshot,{" "}
              <span className="font-mono text-neutral-400">V</span> then{" "}
              <span className="font-mono text-neutral-400">F/A</span> for video
            </p>
            <p className="text-xs text-center text-neutral-600 mt-1">
              <span className="font-mono">ESC</span> to close or stop recording
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-800">
          <button
            onClick={isRecording ? handleStopRecording : onClose}
            className="w-full py-2 px-4 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-semibold transition-colors"
          >
            {isRecording ? "Stop Recording" : "Close"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CaptureMode;
