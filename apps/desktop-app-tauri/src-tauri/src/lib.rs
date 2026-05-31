use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};
use once_cell::sync::Lazy;

static VIDEO_RECORDING_STATE: Lazy<Mutex<VideoRecordingState>> = Lazy::new(|| {
    Mutex::new(VideoRecordingState::default())
});

#[derive(Serialize)]
struct NativeBridgeInvokeResponse {
    success: bool,
    data: Option<Value>,
    error: Option<Value>,
    timing_ms: Option<i64>,
}

#[derive(Serialize)]
struct FileMoveResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    dest_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct FileDeleteResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct FileRenameResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    dest_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct FinderResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize, Clone)]
struct MediaFileItem {
    path: String,
    name: String,
    size: u64,
    modified_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    media_type: Option<String>,
}

#[derive(Serialize)]
struct ScanFilesResponse {
    screenshots: Vec<MediaFileItem>,
    recordings: Vec<MediaFileItem>,
}

#[derive(Serialize)]
struct OrganizedAlbumResponse {
    album: String,
    screenshots: Vec<MediaFileItem>,
    recordings: Vec<MediaFileItem>,
}

#[derive(Serialize)]
struct DirectorySelectionResponse {
    cancelled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
}

#[derive(Default)]
struct VideoRecordingState {
    child: Option<Child>,
    path: Option<String>,
}

#[derive(Serialize)]
struct CaptureImageResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct CaptureVideoResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    recording: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cancelled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct RecordingStatusResponse {
    recording: bool,
    path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    apple_photos_enabled: bool,
    apple_photos_import_all: bool,
    apple_photos_lookback_days: i64,
    apple_photos_organize_export_to_folder: bool,
    apple_photos_organize_delete_from_photos: bool,
    apple_photos_organize_tag_in_photos: bool,
    apple_photos_organize_use_mac_zen_folder: bool,
    use_icloud_destination: bool,
    icloud_destination_path: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            apple_photos_enabled: true,
            apple_photos_import_all: false,
            apple_photos_lookback_days: 30,
            apple_photos_organize_export_to_folder: false,
            apple_photos_organize_delete_from_photos: false,
            apple_photos_organize_tag_in_photos: false,
            apple_photos_organize_use_mac_zen_folder: true,
            use_icloud_destination: false,
            icloud_destination_path: String::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsUpdatePayload {
    apple_photos_enabled: Option<bool>,
    apple_photos_import_all: Option<bool>,
    apple_photos_lookback_days: Option<i64>,
    apple_photos_organize_export_to_folder: Option<bool>,
    apple_photos_organize_delete_from_photos: Option<bool>,
    apple_photos_organize_tag_in_photos: Option<bool>,
    apple_photos_organize_use_mac_zen_folder: Option<bool>,
    use_icloud_destination: Option<bool>,
    icloud_destination_path: Option<String>,
}

#[tauri::command]
fn native_bridge_invoke(
    app: AppHandle,
    command: String,
    payload: Option<Value>,
) -> NativeBridgeInvokeResponse {
    let bridge_path = match resolve_bridge_binary_path(&app) {
        Ok(path) => path,
        Err(error) => {
            return NativeBridgeInvokeResponse {
                success: false,
                data: None,
                timing_ms: None,
                error: Some(serde_json::json!({ "message": error })),
            }
        }
    };

    let request = serde_json::json!({
        "id": "tauri-invoke",
        "command": command,
        "payload": payload.unwrap_or_else(|| serde_json::json!({}))
    });

    let mut child = match Command::new(&bridge_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return NativeBridgeInvokeResponse {
                success: false,
                data: None,
                timing_ms: None,
                error: Some(serde_json::json!({
                    "message": format!(
                        "Failed to launch native bridge at {}: {}",
                        bridge_path.display(),
                        error
                    )
                })),
            }
        }
    };

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(format!("{request}\n").as_bytes());
    }

    let output = match child.wait_with_output() {
        Ok(output) => output,
        Err(error) => {
            return NativeBridgeInvokeResponse {
                success: false,
                data: None,
                timing_ms: None,
                error: Some(serde_json::json!({
                    "message": format!("Failed waiting for native bridge: {}", error)
                })),
            }
        }
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let line = stdout
        .lines()
        .map(str::trim)
        .find(|entry| !entry.is_empty())
        .unwrap_or("");

    if line.is_empty() {
        return NativeBridgeInvokeResponse {
            success: false,
            data: None,
            timing_ms: None,
            error: Some(serde_json::json!({
                "message": if stderr.trim().is_empty() {
                    "Native bridge returned no output".to_string()
                } else {
                    stderr.trim().to_string()
                }
            })),
        };
    }

    match serde_json::from_str::<Value>(line) {
        Ok(value) => NativeBridgeInvokeResponse {
            success: value
                .get("success")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            data: value.get("data").cloned(),
            timing_ms: value.get("timing_ms").and_then(Value::as_i64),
            error: value.get("error").cloned(),
        },
        Err(error) => NativeBridgeInvokeResponse {
            success: false,
            data: None,
            timing_ms: None,
            error: Some(serde_json::json!({
                "message": format!("Invalid native bridge response: {}", error)
            })),
        },
    }
}

#[tauri::command]
fn get_file_data_url(file_path: String) -> Option<String> {
    let bytes = fs::read(&file_path).ok()?;
    let mime = mime_from_path(&file_path);
    Some(format!("data:{};base64,{}", mime, BASE64.encode(bytes)))
}

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    load_settings(&app).unwrap_or_default()
}

#[tauri::command]
fn update_settings(app: AppHandle, updates: SettingsUpdatePayload) -> AppSettings {
    let mut settings = load_settings(&app).unwrap_or_default();
    apply_settings_updates(&mut settings, updates);
    let _ = save_settings(&app, &settings);
    settings
}

#[tauri::command]
fn move_file(
    app: AppHandle,
    file_path: String,
    album_name: String,
    is_screenshot: bool,
) -> FileMoveResponse {
    let src_path = PathBuf::from(&file_path);
    if !src_path.exists() {
        return FileMoveResponse {
            success: false,
            dest_path: None,
            error: Some("Source file does not exist".to_string()),
        };
    }

    let file_name = match src_path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_string(),
        None => {
            return FileMoveResponse {
                success: false,
                dest_path: None,
                error: Some("Invalid source file name".to_string()),
            };
        }
    };

    let settings = load_settings(&app).unwrap_or_default();
    let destination_dir = get_organized_base_dir(&settings)
        .join(album_name)
        .join(if is_screenshot { "Screenshots" } else { "Recordings" });
    if let Err(error) = fs::create_dir_all(&destination_dir) {
        return FileMoveResponse {
            success: false,
            dest_path: None,
            error: Some(format!("Failed to create destination directory: {}", error)),
        };
    }

    let destination_path = unique_destination_path(destination_dir.join(file_name));
    match fs::rename(&src_path, &destination_path) {
        Ok(_) => FileMoveResponse {
            success: true,
            dest_path: Some(destination_path.to_string_lossy().to_string()),
            error: None,
        },
        Err(error) => FileMoveResponse {
            success: false,
            dest_path: None,
            error: Some(format!("Failed to move file: {}", error)),
        },
    }
}

#[tauri::command]
fn undo_move_file(file_path: String, current_path: String, _is_screenshot: bool) -> FileMoveResponse {
    let original_path = PathBuf::from(&file_path);
    let current = PathBuf::from(&current_path);
    if !current.exists() {
        return FileMoveResponse {
            success: false,
            dest_path: None,
            error: Some("Current file path does not exist".to_string()),
        };
    }

    let target_path = if original_path.exists() {
        unique_destination_path(original_path)
    } else {
        original_path
    };

    if let Some(parent) = target_path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return FileMoveResponse {
                success: false,
                dest_path: None,
                error: Some(format!("Failed to create target directory: {}", error)),
            };
        }
    }

    match fs::rename(&current, &target_path) {
        Ok(_) => FileMoveResponse {
            success: true,
            dest_path: Some(target_path.to_string_lossy().to_string()),
            error: None,
        },
        Err(error) => FileMoveResponse {
            success: false,
            dest_path: None,
            error: Some(format!("Failed to undo file move: {}", error)),
        },
    }
}

#[tauri::command]
fn delete_file(file_path: String) -> FileDeleteResponse {
    match fs::remove_file(&file_path) {
        Ok(_) => FileDeleteResponse {
            success: true,
            error: None,
        },
        Err(error) => FileDeleteResponse {
            success: false,
            error: Some(format!("Failed to delete file: {}", error)),
        },
    }
}

#[tauri::command]
fn rename_file(file_path: String, new_name: String) -> FileRenameResponse {
    let src_path = PathBuf::from(&file_path);
    if !src_path.exists() {
        return FileRenameResponse {
            success: false,
            dest_path: None,
            file_name: None,
            error: Some("Source file does not exist".to_string()),
        };
    }

    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty() {
        return FileRenameResponse {
            success: false,
            dest_path: None,
            file_name: None,
            error: Some("New file name cannot be empty".to_string()),
        };
    }

    let parent = match src_path.parent() {
        Some(parent) => parent.to_path_buf(),
        None => {
            return FileRenameResponse {
                success: false,
                dest_path: None,
                file_name: None,
                error: Some("Invalid source path".to_string()),
            };
        }
    };

    let extension = src_path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
    let resolved_name = if Path::new(trimmed_name).extension().is_some() || extension.is_empty() {
        trimmed_name.to_string()
    } else {
        format!("{}.{}", trimmed_name, extension)
    };

    let destination_path = unique_destination_path(parent.join(&resolved_name));
    match fs::rename(&src_path, &destination_path) {
        Ok(_) => FileRenameResponse {
            success: true,
            dest_path: Some(destination_path.to_string_lossy().to_string()),
            file_name: destination_path
                .file_name()
                .and_then(|name| name.to_str())
                .map(str::to_string),
            error: None,
        },
        Err(error) => FileRenameResponse {
            success: false,
            dest_path: None,
            file_name: None,
            error: Some(format!("Failed to rename file: {}", error)),
        },
    }
}

#[tauri::command]
fn reveal_in_finder(file_path: String) -> FinderResponse {
    let status = Command::new("/usr/bin/open")
        .arg("-R")
        .arg(file_path)
        .status();

    match status {
        Ok(exit_status) if exit_status.success() => FinderResponse {
            success: true,
            error: None,
        },
        Ok(_) => FinderResponse {
            success: false,
            error: Some("Finder reveal command failed".to_string()),
        },
        Err(error) => FinderResponse {
            success: false,
            error: Some(format!("Failed to reveal file in Finder: {}", error)),
        },
    }
}

#[tauri::command]
fn select_directory(title: Option<String>, _default_path: Option<String>) -> DirectorySelectionResponse {
    let prompt = title.unwrap_or_else(|| "Choose a folder".to_string());
    let script = format!("POSIX path of (choose folder with prompt \"{}\")", escape_applescript_string(&prompt));
    let output = Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(script)
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let path = String::from_utf8_lossy(&result.stdout).trim().to_string();
            if path.is_empty() {
                DirectorySelectionResponse {
                    cancelled: true,
                    path: None,
                }
            } else {
                DirectorySelectionResponse {
                    cancelled: false,
                    path: Some(path),
                }
            }
        }
        _ => DirectorySelectionResponse {
            cancelled: true,
            path: None,
        },
    }
}

#[tauri::command]
fn capture_fullscreen_screenshot() -> CaptureImageResponse {
    let output_path = temp_capture_path("png");
    let status = Command::new("/usr/sbin/screencapture")
        .arg("-x")
        .arg(&output_path)
        .status();

    match status {
        Ok(result) if result.success() => CaptureImageResponse {
            success: true,
            path: Some(output_path),
            cancelled: None,
            error: None,
        },
        Ok(_) => CaptureImageResponse {
            success: false,
            path: None,
            cancelled: Some(false),
            error: Some("screencapture failed".to_string()),
        },
        Err(error) => CaptureImageResponse {
            success: false,
            path: None,
            cancelled: Some(false),
            error: Some(format!("Failed to capture screenshot: {}", error)),
        },
    }
}

#[tauri::command]
fn capture_area_screenshot() -> CaptureImageResponse {
    let output_path = temp_capture_path("png");
    let status = Command::new("/usr/sbin/screencapture")
        .arg("-i")
        .arg("-x")
        .arg(&output_path)
        .status();

    match status {
        Ok(result) if result.success() => CaptureImageResponse {
            success: true,
            path: Some(output_path),
            cancelled: Some(false),
            error: None,
        },
        Ok(_) => CaptureImageResponse {
            success: false,
            path: None,
            cancelled: Some(true),
            error: Some("Screenshot capture cancelled or failed".to_string()),
        },
        Err(error) => CaptureImageResponse {
            success: false,
            path: None,
            cancelled: Some(false),
            error: Some(format!("Failed to capture area screenshot: {}", error)),
        },
    }
}

#[tauri::command]
fn capture_fullscreen_video(app: AppHandle) -> CaptureVideoResponse {
    start_video_recording(&app, false)
}

#[tauri::command]
fn capture_area_video(app: AppHandle) -> CaptureVideoResponse {
    start_video_recording(&app, true)
}

#[tauri::command]
fn stop_video_recording() -> CaptureVideoResponse {
    let mut state = match VIDEO_RECORDING_STATE.lock() {
        Ok(state) => state,
        Err(_) => {
            return CaptureVideoResponse {
                success: false,
                path: None,
                recording: Some(false),
                cancelled: Some(false),
                error: Some("Recording state lock poisoned".to_string()),
            };
        }
    };

    let mut child = match state.child.take() {
        Some(child) => child,
        None => {
            return CaptureVideoResponse {
                success: false,
                path: state.path.clone(),
                recording: Some(false),
                cancelled: Some(true),
                error: Some("No active recording".to_string()),
            };
        }
    };

    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
    }
    let _ = child.wait();

    let path = state.path.take();
    CaptureVideoResponse {
        success: true,
        path,
        recording: Some(false),
        cancelled: Some(false),
        error: None,
    }
}

#[tauri::command]
fn is_recording() -> RecordingStatusResponse {
    let mut state = match VIDEO_RECORDING_STATE.lock() {
        Ok(state) => state,
        Err(_) => {
            return RecordingStatusResponse {
                recording: false,
                path: None,
            };
        }
    };

    if let Some(child) = state.child.as_mut() {
        match child.try_wait() {
            Ok(Some(_)) => {
                state.child = None;
                RecordingStatusResponse {
                    recording: false,
                    path: state.path.clone(),
                }
            }
            Ok(None) => RecordingStatusResponse {
                recording: true,
                path: state.path.clone(),
            },
            Err(_) => RecordingStatusResponse {
                recording: false,
                path: state.path.clone(),
            },
        }
    } else {
        RecordingStatusResponse {
            recording: false,
            path: state.path.clone(),
        }
    }
}

#[tauri::command]
fn scan_files() -> ScanFilesResponse {
    let desktop_path = match home_dir() {
        Some(home) => home.join("Desktop"),
        None => {
            return ScanFilesResponse {
                screenshots: vec![],
                recordings: vec![],
            }
        }
    };

    let entries = match fs::read_dir(&desktop_path) {
        Ok(entries) => entries,
        Err(_) => {
            return ScanFilesResponse {
                screenshots: vec![],
                recordings: vec![],
            }
        }
    };

    let mut screenshots = Vec::new();
    let mut recordings = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = match path.file_name().and_then(|value| value.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };
        let name_lower = name.to_ascii_lowercase();
        let classification = classify_desktop_capture(&name_lower);
        if classification.is_none() {
            continue;
        }

        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(system_time_to_epoch_ms)
            .unwrap_or(0);
        let item = MediaFileItem {
            path: path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
            modified_ms,
            media_type: Some(match classification.unwrap_or("screenshot") {
                "recording" => "screen_recording".to_string(),
                _ => "screenshot".to_string(),
            }),
        };

        if classification == Some("recording") {
            recordings.push(item);
        } else {
            screenshots.push(item);
        }
    }

    ScanFilesResponse {
        screenshots,
        recordings,
    }
}

#[tauri::command]
fn scan_organized_files(app: AppHandle) -> Vec<OrganizedAlbumResponse> {
    let settings = load_settings(&app).unwrap_or_default();
    let mut albums = Vec::new();
    let mut album_dirs = Vec::new();
    let mut roots = vec![get_organized_base_dir(&settings)];
    roots.extend(get_legacy_organized_dirs(&settings));
    roots.sort();
    roots.dedup();

    for root in roots {
        if !root.exists() {
            continue;
        }
        collect_album_dirs(&root, &root, &mut album_dirs);
    }

    for (album_name, album_path) in album_dirs {
        let screenshots = collect_media_items(
            &album_path.join("Screenshots"),
            Some("screenshot".to_string()),
        );
        let recordings = collect_media_items(
            &album_path.join("Recordings"),
            Some("screen_recording".to_string()),
        );

        if screenshots.is_empty() && recordings.is_empty() {
            continue;
        }

        albums.push(OrganizedAlbumResponse {
            album: album_name,
            screenshots,
            recordings,
        });
    }

    albums
}

#[tauri::command]
fn get_albums(app: AppHandle) -> Vec<String> {
    let settings = load_settings(&app).unwrap_or_default();
    let mut roots = vec![get_organized_base_dir(&settings)];
    roots.extend(get_legacy_organized_dirs(&settings));
    roots.sort();
    roots.dedup();

    let has_any_root = roots.iter().any(|root| root.exists());
    if !has_any_root {
        return vec!["Personal".to_string(), "Work".to_string(), "Archive".to_string()];
    }

    let mut album_dirs = Vec::new();
    for root in roots {
        if !root.exists() {
            continue;
        }
        collect_album_dirs(&root, &root, &mut album_dirs);
    }
    let mut names: Vec<String> = album_dirs.into_iter().map(|(name, _)| name).collect();
    names.sort();
    names.dedup();
    if names.is_empty() {
        return vec!["Personal".to_string(), "Work".to_string(), "Archive".to_string()];
    }
    names
}

#[tauri::command]
fn create_album(app: AppHandle, album_name: String) -> FinderResponse {
    let normalized = normalize_album_name(&album_name);
    if normalized.is_empty() {
        return FinderResponse {
            success: false,
            error: Some("Album name is required.".to_string()),
        };
    }

    let settings = load_settings(&app).unwrap_or_default();
    let root = get_organized_base_dir(&settings);

    let base_dir = root.join(&normalized);
    let screenshots_dir = base_dir.join("Screenshots");
    let recordings_dir = base_dir.join("Recordings");
    if let Err(error) = fs::create_dir_all(&screenshots_dir) {
        return FinderResponse {
            success: false,
            error: Some(format!("Failed to create album: {}", error)),
        };
    }
    if let Err(error) = fs::create_dir_all(&recordings_dir) {
        return FinderResponse {
            success: false,
            error: Some(format!("Failed to create album: {}", error)),
        };
    }

    FinderResponse {
        success: true,
        error: None,
    }
}

#[tauri::command]
fn delete_album(app: AppHandle, album_name: String) -> FinderResponse {
    let normalized = normalize_album_name(&album_name);
    if normalized.is_empty() {
        return FinderResponse {
            success: false,
            error: Some("Album name is required.".to_string()),
        };
    }

    let settings = load_settings(&app).unwrap_or_default();
    let root = get_organized_base_dir(&settings);
    let target = root.join(normalized);
    match fs::remove_dir_all(&target) {
        Ok(_) => FinderResponse {
            success: true,
            error: None,
        },
        Err(error) => FinderResponse {
            success: false,
            error: Some(format!("Failed to delete album: {}", error)),
        },
    }
}

#[tauri::command]
fn rename_album(app: AppHandle, old_name: String, new_name: String) -> FinderResponse {
    let old_normalized = normalize_album_name(&old_name);
    let new_normalized = normalize_album_name(&new_name);
    if old_normalized.is_empty() || new_normalized.is_empty() {
        return FinderResponse {
            success: false,
            error: Some("Both old and new album names are required.".to_string()),
        };
    }

    let settings = load_settings(&app).unwrap_or_default();
    let root = get_organized_base_dir(&settings);

    let old_path = root.join(old_normalized);
    let target_path = unique_destination_path(root.join(new_normalized));
    if let Some(parent) = target_path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return FinderResponse {
                success: false,
                error: Some(format!("Failed to create target directory: {}", error)),
            };
        }
    }

    match fs::rename(old_path, target_path) {
        Ok(_) => FinderResponse {
            success: true,
            error: None,
        },
        Err(error) => FinderResponse {
            success: false,
            error: Some(format!("Failed to rename album: {}", error)),
        },
    }
}

fn resolve_bridge_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(explicit) = env::var("MACZEN_BRIDGE_PATH") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "MACZEN_BRIDGE_PATH does not exist: {}",
            path.display()
        ));
    }

    let mut candidates = vec![];
    let debug_candidates = [
        PathBuf::from("../macos-bridge/.build/debug/MacZenBridgeCLI"),
        PathBuf::from("../../macos-bridge/.build/debug/MacZenBridgeCLI"),
        PathBuf::from("../../../macos-bridge/.build/debug/MacZenBridgeCLI"),
    ];

    if cfg!(debug_assertions) {
        candidates.extend(debug_candidates.iter().cloned());
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join("MacZenBridgeCLI"));
            candidates.push(exe_dir.join("MacZenBridgeCLI-aarch64-apple-darwin"));
            candidates.push(exe_dir.join("MacZenBridgeCLI-x86_64-apple-darwin"));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("MacZenBridgeCLI"));
        candidates.push(resource_dir.join("MacZenBridgeCLI-aarch64-apple-darwin"));
        candidates.push(resource_dir.join("MacZenBridgeCLI-x86_64-apple-darwin"));
    }

    candidates.extend([
        PathBuf::from("src-tauri/binaries/MacZenBridgeCLI-aarch64-apple-darwin"),
        PathBuf::from("src-tauri/binaries/MacZenBridgeCLI-x86_64-apple-darwin"),
        PathBuf::from("../src-tauri/binaries/MacZenBridgeCLI-aarch64-apple-darwin"),
        PathBuf::from("../src-tauri/binaries/MacZenBridgeCLI-x86_64-apple-darwin"),
    ]);

    if !cfg!(debug_assertions) {
        candidates.extend(debug_candidates.iter().cloned());
    }

    candidates
        .into_iter()
        .find(|path| Path::new(path).exists())
        .ok_or_else(|| "Unable to locate MacZenBridgeCLI; set MACZEN_BRIDGE_PATH".to_string())
}

fn resolve_ffmpeg_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(explicit) = env::var("MACZEN_FFMPEG_PATH") {
        let path = PathBuf::from(explicit);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "MACZEN_FFMPEG_PATH does not exist: {}",
            path.display()
        ));
    }

    let mut candidates = vec![];

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join("ffmpeg"));
            candidates.push(exe_dir.join("ffmpeg-aarch64-apple-darwin"));
            candidates.push(exe_dir.join("ffmpeg-x86_64-apple-darwin"));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("ffmpeg"));
        candidates.push(resource_dir.join("ffmpeg-aarch64-apple-darwin"));
        candidates.push(resource_dir.join("ffmpeg-x86_64-apple-darwin"));
    }

    candidates.extend([
        PathBuf::from("src-tauri/binaries/ffmpeg-aarch64-apple-darwin"),
        PathBuf::from("src-tauri/binaries/ffmpeg-x86_64-apple-darwin"),
        PathBuf::from("../src-tauri/binaries/ffmpeg-aarch64-apple-darwin"),
        PathBuf::from("../src-tauri/binaries/ffmpeg-x86_64-apple-darwin"),
    ]);

    candidates
        .into_iter()
        .find(|path| Path::new(path).exists())
        .ok_or_else(|| "Bundled ffmpeg binary not found".to_string())
}

fn mime_from_path(path: &str) -> &'static str {
    let ext = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "mp4" => "video/mp4",
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        "m4v" => "video/x-m4v",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn classify_desktop_capture(name_lower: &str) -> Option<&'static str> {
    let is_recording_prefix = name_lower.starts_with("screen recording")
        || name_lower.starts_with("screenrecording")
        || name_lower.starts_with("grabación")
        || name_lower.starts_with("screen rec");
    if is_recording_prefix
        && (name_lower.ends_with(".mov")
            || name_lower.ends_with(".mp4")
            || name_lower.ends_with(".avi")
            || name_lower.ends_with(".mkv"))
    {
        return Some("recording");
    }

    let is_screenshot_prefix = name_lower.starts_with("screenshot")
        || name_lower.starts_with("screen shot")
        || name_lower.starts_with("captura");
    if is_screenshot_prefix
        && (name_lower.ends_with(".png")
            || name_lower.ends_with(".jpg")
            || name_lower.ends_with(".jpeg")
            || name_lower.ends_with(".gif"))
    {
        return Some("screenshot");
    }

    None
}

fn system_time_to_epoch_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH).ok().map(|duration| duration.as_millis() as u64)
}

fn home_dir() -> Option<PathBuf> {
    env::var_os("HOME").map(PathBuf::from)
}

fn legacy_electron_settings_path() -> Option<PathBuf> {
    home_dir().map(|home| {
        home.join("Library")
            .join("Application Support")
            .join("@maczen")
            .join("desktop-app")
            .join("settings.json")
    })
}

fn settings_path(app: &AppHandle) -> Option<PathBuf> {
    if let Some(legacy_path) = legacy_electron_settings_path() {
        if legacy_path.exists() {
            return Some(legacy_path);
        }
    }
    let app_data = app.path().app_data_dir().ok()?;
    Some(app_data.join("settings.json"))
}

fn load_settings(app: &AppHandle) -> Option<AppSettings> {
    let path = settings_path(app)?;
    let contents = fs::read_to_string(path).ok()?;
    serde_json::from_str::<AppSettings>(&contents).ok()
}

fn save_settings(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app).ok_or_else(|| "Unable to resolve settings path".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create settings directory: {}", error))?;
    }
    let serialized = serde_json::to_string_pretty(settings)
        .map_err(|error| format!("Failed to serialize settings: {}", error))?;
    fs::write(path, serialized).map_err(|error| format!("Failed to write settings: {}", error))
}

fn apply_settings_updates(settings: &mut AppSettings, updates: SettingsUpdatePayload) {
    if let Some(value) = updates.apple_photos_enabled {
        settings.apple_photos_enabled = value;
    }
    if let Some(value) = updates.apple_photos_import_all {
        settings.apple_photos_import_all = value;
    }
    if let Some(value) = updates.apple_photos_lookback_days {
        settings.apple_photos_lookback_days = value.max(1);
    }
    if let Some(value) = updates.apple_photos_organize_export_to_folder {
        settings.apple_photos_organize_export_to_folder = value;
    }
    if let Some(value) = updates.apple_photos_organize_delete_from_photos {
        settings.apple_photos_organize_delete_from_photos = value;
    }
    if let Some(value) = updates.apple_photos_organize_tag_in_photos {
        settings.apple_photos_organize_tag_in_photos = value;
    }
    if let Some(value) = updates.apple_photos_organize_use_mac_zen_folder {
        settings.apple_photos_organize_use_mac_zen_folder = value;
    }
    if let Some(value) = updates.use_icloud_destination {
        settings.use_icloud_destination = value;
    }
    if let Some(value) = updates.icloud_destination_path {
        settings.icloud_destination_path = value.trim().to_string();
    }
}

fn get_organized_base_dir(settings: &AppSettings) -> PathBuf {
    let configured_root = if settings.use_icloud_destination
        && !settings.icloud_destination_path.trim().is_empty()
    {
        PathBuf::from(settings.icloud_destination_path.trim())
    } else {
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Documents")
    };

    let already_maczen = configured_root
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("MacZen"))
        .unwrap_or(false);

    if already_maczen {
        configured_root
    } else {
        configured_root.join("MacZen")
    }
}

fn get_legacy_organized_dirs(settings: &AppSettings) -> Vec<PathBuf> {
    vec![
        get_organized_base_dir(settings).join("Screenshots"),
        get_organized_base_dir(settings).join("MacZen"),
        home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("MacZen"),
    ]
}

fn normalize_album_name(input: &str) -> String {
    let cleaned = input.replace('\\', "/");
    cleaned
        .split('/')
        .map(str::trim)
        .filter(|part| !part.is_empty() && *part != "." && *part != "..")
        .collect::<Vec<_>>()
        .join("/")
}

fn collect_album_dirs(base_root: &Path, current: &Path, output: &mut Vec<(String, PathBuf)>) {
    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let name = entry.file_name();
        let name = match name.to_str() {
            Some(name) => name,
            None => continue,
        };
        if name == "Screenshots" || name == "Recordings" {
            continue;
        }

        let rel = match path.strip_prefix(base_root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        let album_name = normalize_album_name(&rel.to_string_lossy());
        if !album_name.is_empty() {
            output.push((album_name, path.clone()));
        }

        collect_album_dirs(base_root, &path, output);
    }
}

fn collect_media_items(dir: &Path, media_type: Option<String>) -> Vec<MediaFileItem> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return vec![],
    };

    let mut items = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let metadata = match fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let name = match path.file_name().and_then(|value| value.to_str()) {
            Some(name) => name.to_string(),
            None => continue,
        };
        let modified_ms = metadata
            .modified()
            .ok()
            .and_then(system_time_to_epoch_ms)
            .unwrap_or(0);

        items.push(MediaFileItem {
            path: path.to_string_lossy().to_string(),
            name,
            size: metadata.len(),
            modified_ms,
            media_type: media_type.clone(),
        });
    }
    items
}

fn unique_destination_path(base_path: PathBuf) -> PathBuf {
    if !base_path.exists() {
        return base_path;
    }

    let parent = base_path.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
    let stem = base_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = base_path.extension().and_then(|value| value.to_str());

    for index in 1..10_000 {
        let candidate_name = match extension {
            Some(ext) if !ext.is_empty() => format!("{} ({}).{}", stem, index, ext),
            _ => format!("{} ({})", stem, index),
        };
        let candidate = parent.join(candidate_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    base_path
}

fn temp_capture_path(extension: &str) -> String {
    let mut base = env::temp_dir();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    base.push(format!("maczen-capture-{}.{}", stamp, extension));
    base.to_string_lossy().to_string()
}

fn start_video_recording(app: &AppHandle, _interactive: bool) -> CaptureVideoResponse {
    let mut state = match VIDEO_RECORDING_STATE.lock() {
        Ok(state) => state,
        Err(_) => {
            return CaptureVideoResponse {
                success: false,
                path: None,
                recording: Some(false),
                cancelled: Some(false),
                error: Some("Recording state lock poisoned".to_string()),
            };
        }
    };

    if state.child.is_some() {
        return CaptureVideoResponse {
            success: false,
            path: state.path.clone(),
            recording: Some(true),
            cancelled: Some(false),
            error: Some("A recording is already in progress".to_string()),
        };
    }

    let output_path = temp_capture_path("mp4");
    let ffmpeg_binary = resolve_ffmpeg_binary_path(app).unwrap_or_else(|_| PathBuf::from("ffmpeg"));
    let mut command = Command::new(&ffmpeg_binary);
    command
        .arg("-y")
        .arg("-f")
        .arg("avfoundation")
        .arg("-framerate")
        .arg("30")
        .arg("-i")
        .arg("1:none")
        .arg("-vcodec")
        .arg("libx264")
        .arg("-preset")
        .arg("ultrafast")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    match command.spawn() {
        Ok(child) => {
            state.child = Some(child);
            state.path = Some(output_path.clone());
            CaptureVideoResponse {
                success: true,
                path: Some(output_path),
                recording: Some(true),
                cancelled: Some(false),
                error: None,
            }
        }
        Err(error) => CaptureVideoResponse {
            success: false,
            path: None,
            recording: Some(false),
            cancelled: Some(false),
            error: Some(format!(
                "Failed to start video recording with {}: {}",
                ffmpeg_binary.to_string_lossy(),
                error
            )),
        },
    }
}

fn escape_applescript_string(input: &str) -> String {
    input.replace('\\', "\\\\").replace('"', "\\\"")
}

fn toggle_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn create_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let tray_icon = app.default_window_icon().cloned();

    let menu = MenuBuilder::new(app)
        .text("tray_toggle", "Toggle Visibility")
        .text("tray_screenshot", "Take Screenshot...")
        .text("tray_settings", "Settings")
        .separator()
        .text("tray_quit", "Quit MacZen")
        .build()?;

    let mut tray_builder = TrayIconBuilder::with_id("maczen-tray")
        .menu(&menu)
        .tooltip("MacZen")
        .show_menu_on_left_click(true)
        .icon_as_template(true)
        .on_menu_event(|app, event| {
            if event.id() == "tray_toggle" {
                toggle_main_window(app);
            } else if event.id() == "tray_screenshot" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                std::thread::sleep(Duration::from_millis(150));
                let _ = capture_area_screenshot();
            } else if event.id() == "tray_settings" {
                show_main_window(app);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.eval(
                        "window.dispatchEvent(new CustomEvent('maczen-open-settings'));",
                    );
                }
            } else if event.id() == "tray_quit" {
                app.exit(0);
            }
        });

    if let Some(icon) = tray_icon {
        tray_builder = tray_builder.icon(icon);
    }

    let _ = tray_builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main_window(app);
        }))
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_dock_visibility(true);
            }
            let _ = create_tray(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            native_bridge_invoke,
            get_file_data_url,
            get_settings,
            update_settings,
            scan_files,
            scan_organized_files,
            get_albums,
            create_album,
            delete_album,
            rename_album,
            move_file,
            undo_move_file,
            delete_file,
            rename_file,
            reveal_in_finder,
            select_directory,
            capture_fullscreen_screenshot,
            capture_area_screenshot,
            capture_fullscreen_video,
            capture_area_video,
            stop_video_recording,
            is_recording
        ])
        .run(tauri::generate_context!())
        .expect("error while running MacZen Tauri shell");
}
