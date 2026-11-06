use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

/// Spawns a Command with CREATE_NO_WINDOW on Windows to prevent console flashing
pub fn create_hidden_command(program: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Returns the free disk space in bytes for the volume hosting the given path.
pub fn get_available_disk_space(path: &Path) -> Option<u64> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        type LPCWSTR = *const u16;
        type PULARGE_INTEGER = *mut u64;
        type BOOL = i32;

        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetDiskFreeSpaceExW(
                lpDirectoryName: LPCWSTR,
                lpFreeBytesAvailableToCaller: PULARGE_INTEGER,
                lpTotalNumberOfBytes: PULARGE_INTEGER,
                lpTotalNumberOfFreeBytes: PULARGE_INTEGER,
            ) -> BOOL;
        }

        // If path does not exist yet, find its nearest existing parent
        let mut check_path = path.to_path_buf();
        while !check_path.exists() {
            if let Some(parent) = check_path.parent() {
                check_path = parent.to_path_buf();
            } else {
                break;
            }
        }

        let wide_path: Vec<u16> = OsStr::new(&check_path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut free_available: u64 = 0;
        let mut total_bytes: u64 = 0;
        let mut total_free: u64 = 0;

        let success = unsafe {
            GetDiskFreeSpaceExW(
                wide_path.as_ptr(),
                &mut free_available as PULARGE_INTEGER,
                &mut total_bytes as PULARGE_INTEGER,
                &mut total_free as PULARGE_INTEGER,
            )
        };

        if success != 0 {
            Some(free_available)
        } else {
            None
        }
    }

    #[cfg(not(windows))]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        #[repr(C)]
        struct StatVfs {
            f_bsize: libc_ulong,
            f_frsize: libc_ulong,
            f_blocks: libc_fsblkcnt_t,
            f_bfree: libc_fsblkcnt_t,
            f_bavail: libc_fsblkcnt_t,
            f_files: libc_fsfilcnt_t,
            f_ffree: libc_fsfilcnt_t,
            f_favail: libc_fsfilcnt_t,
            f_fsid: libc_ulong,
            f_flag: libc_ulong,
            f_namemax: libc_ulong,
            __f_spare: [std::ffi::c_int; 6],
        }

        #[allow(non_camel_case_types)]
        type libc_ulong = std::ffi::c_ulong;
        #[allow(non_camel_case_types)]
        type libc_fsblkcnt_t = std::ffi::c_ulong;
        #[allow(non_camel_case_types)]
        type libc_fsfilcnt_t = std::ffi::c_ulong;

        unsafe extern "C" {
            fn statvfs(path: *const std::ffi::c_char, buf: *mut StatVfs) -> std::ffi::c_int;
        }

        let mut check_path = path.to_path_buf();
        while !check_path.exists() {
            if let Some(parent) = check_path.parent() {
                check_path = parent.to_path_buf();
            } else {
                break;
            }
        }

        if let Ok(c_path) = CString::new(check_path.as_os_str().as_bytes()) {
            let mut stat: StatVfs = unsafe { std::mem::zeroed() };
            let res = unsafe { statvfs(c_path.as_ptr(), &mut stat) };
            if res == 0 {
                let block_size = if stat.f_frsize != 0 {
                    stat.f_frsize
                } else {
                    stat.f_bsize
                };
                Some((stat.f_bavail as u64) * (block_size as u64))
            } else {
                None
            }
        } else {
            None
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DowngradePlan {
    pub appid: u32,
    pub depot_id: String,
    pub manifest_id: String,
    pub steam_console_command: String,
    pub depot_downloader_command: String,
    pub content_depot_path: Option<String>,
    pub game_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepotDownloaderStatus {
    pub is_installed: bool,
    pub executable_path: Option<String>,
    pub version_info: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutomatedDowngradeOptions {
    pub appid: u32,
    pub depot_id: String,
    pub manifest_id: String,
    pub current_manifest_id: Option<String>,
    pub current_build_id: Option<String>,
    pub game_path: String,
    pub steam_path: Option<String>,
    pub library_path: Option<String>,
    pub game_name: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub remember_password: bool,
    pub auto_backup: bool,
    pub auto_apply: bool,
    pub auto_lock: bool,
    pub custom_tool_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepotDownloadProgressEvent {
    pub appid: u32,
    pub depot_id: String,
    pub manifest_id: String,
    pub step: String, // "idle" | "backup" | "connecting" | "needs_2fa" | "downloading" | "applying" | "locking" | "finished" | "error" | "cancelled"
    pub percent: f32,
    pub message: String,
    pub speed_mb_s: Option<f32>,
    pub bytes_downloaded: Option<u64>,
    pub total_bytes: Option<u64>,
}

#[derive(Default)]
pub struct ActiveDownloadState {
    pub child_stdin: Option<std::process::ChildStdin>,
    pub child_pid: Option<u32>,
    pub is_running: bool,
    pub should_cancel: bool,
}

pub type DownloadStateHandle = Arc<Mutex<ActiveDownloadState>>;

pub fn init_download_state() -> DownloadStateHandle {
    Arc::new(Mutex::new(ActiveDownloadState::default()))
}

pub struct DownloaderManager;

impl DownloaderManager {
    /// Generates downgrade commands and paths
    pub fn create_plan(
        appid: u32,
        depot_id: &str,
        manifest_id: &str,
        game_path: &str,
        steam_path: Option<&str>,
        username: Option<&str>,
    ) -> DowngradePlan {
        let steam_console_cmd = format!("download_depot {appid} {depot_id} {manifest_id}");

        let user_flag = if let Some(u) = username.filter(|s| !s.is_empty()) {
            format!(" -username {u} -remember-password")
        } else {
            String::new()
        };

        let depot_downloader_cmd = format!(
            "DepotDownloader -app {appid} -depot {depot_id} -manifest {manifest_id}{user_flag} -dir \"{game_path}\" -validate"
        );

        let content_depot_path = steam_path.map(|sp| {
            Path::new(sp)
                .join("steamapps")
                .join("content")
                .join(format!("app_{appid}"))
                .join(format!("depot_{depot_id}"))
                .to_string_lossy()
                .to_string()
        });

        DowngradePlan {
            appid,
            depot_id: depot_id.to_string(),
            manifest_id: manifest_id.to_string(),
            steam_console_command: steam_console_cmd,
            depot_downloader_command: depot_downloader_cmd,
            content_depot_path,
            game_path: game_path.to_string(),
        }
    }

    /// Directory for downloaded helper tools (DepotDownloader)
    pub fn get_tools_dir() -> PathBuf {
        let base = if let Ok(custom) = std::env::var("STEAM_GAME_MANAGER_TOOLS_DIR") {
            PathBuf::from(custom)
        } else if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            PathBuf::from(local_app_data).join("steam-game-manager").join("tools")
        } else if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".local/share/steam-game-manager/tools")
        } else {
            PathBuf::from("./tools")
        };
        let _ = fs::create_dir_all(&base);
        base
    }

    /// Resolves the DepotDownloader executable path
    pub fn resolve_depot_downloader(custom_path: Option<&str>) -> Option<PathBuf> {
        // 1. Explicit custom path provided by user
        if let Some(cp) = custom_path.filter(|s| !s.trim().is_empty()) {
            let p = PathBuf::from(cp);
            if p.exists() {
                return Some(p);
            }
        }

        let bin_name = if cfg!(target_os = "windows") {
            "DepotDownloader.exe"
        } else {
            "DepotDownloader"
        };

        // 2. Tools directory in app data
        let tools_dir = Self::get_tools_dir();
        let in_tools = tools_dir.join(bin_name);
        if in_tools.exists() {
            return Some(in_tools);
        }

        // 3. Next to running executable or inside binaries/ folder
        if let Ok(curr_exe) = std::env::current_exe() {
            if let Some(parent) = curr_exe.parent() {
                let adjacent = parent.join(bin_name);
                if adjacent.exists() {
                    return Some(adjacent);
                }
                let in_binaries = parent.join("binaries").join(bin_name);
                if in_binaries.exists() {
                    return Some(in_binaries);
                }
            }
        }

        // 4. In system PATH (use create_hidden_command to prevent console window popup on Windows)
        if let Ok(out) = create_hidden_command(bin_name).arg("--version").output() {
            if out.status.success() || !out.stdout.is_empty() || !out.stderr.is_empty() {
                return Some(PathBuf::from(bin_name));
            }
        }
        if let Ok(out) = create_hidden_command("depotdownloader").arg("--version").output() {
            if out.status.success() || !out.stdout.is_empty() || !out.stderr.is_empty() {
                return Some(PathBuf::from("depotdownloader"));
            }
        }

        None
    }

    /// Gets status of DepotDownloader
    pub fn get_depot_downloader_status(custom_path: Option<&str>) -> DepotDownloaderStatus {
        if let Some(path) = Self::resolve_depot_downloader(custom_path) {
            let version = create_hidden_command(&path)
                .arg("--version")
                .output()
                .or_else(|_| create_hidden_command(&path).arg("-h").output())
                .ok()
                .and_then(|out| {
                    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
                    let combined = if !s.is_empty() { s } else { err };
                    combined.lines().next().map(|l| l.to_string())
                });

            DepotDownloaderStatus {
                is_installed: true,
                executable_path: Some(path.to_string_lossy().to_string()),
                version_info: version,
            }
        } else {
            DepotDownloaderStatus {
                is_installed: false,
                executable_path: None,
                version_info: None,
            }
        }
    }

    /// Backward-compatible check
    pub fn check_depot_downloader(custom_path: Option<&str>) -> Result<String, String> {
        let status = Self::get_depot_downloader_status(custom_path);
        if status.is_installed {
            Ok(status.executable_path.unwrap_or_else(|| "DepotDownloader".to_string()))
        } else {
            Err("DepotDownloader executable was not found.".to_string())
        }
    }

    /// 1-Click Install DepotDownloader tool from official GitHub releases
    pub fn install_depot_downloader_tool() -> Result<String, String> {
        let tools_dir = Self::get_tools_dir();
        let _ = fs::create_dir_all(&tools_dir);

        let is_win = cfg!(target_os = "windows");
        let is_mac = cfg!(target_os = "macos");

        let zip_name = if is_win {
            "DepotDownloader-windows-x64.zip"
        } else if is_mac {
            "DepotDownloader-osx-x64.zip"
        } else {
            "DepotDownloader-linux-x64.zip"
        };

        let url = format!("https://github.com/SteamRE/DepotDownloader/releases/latest/download/{zip_name}");
        let zip_path = tools_dir.join(zip_name);

        // Download archive using curl (available across Linux, macOS, and modern Windows)
        let download_res = create_hidden_command("curl")
            .args(["-L", "-f", "-s", "-S", "-o", &zip_path.to_string_lossy(), &url])
            .status();

        match download_res {
            Ok(status) if status.success() => {},
            _ => {
                return Err(format!(
                    "Failed to download DepotDownloader from {url}. Please ensure network is connected or install it manually."
                ));
            }
        }

        // Unpack archive
        let unpack_res = if is_win {
            create_hidden_command("tar")
                .args(["-xf", &zip_path.to_string_lossy(), "-C", &tools_dir.to_string_lossy()])
                .status()
        } else {
            let res = create_hidden_command("unzip")
                .args(["-o", &zip_path.to_string_lossy(), "-d", &tools_dir.to_string_lossy()])
                .status();
            if res.is_err() || !res.as_ref().unwrap().success() {
                create_hidden_command("tar")
                    .args(["-xf", &zip_path.to_string_lossy(), "-C", &tools_dir.to_string_lossy()])
                    .status()
            } else {
                res
            }
        };

        let _ = fs::remove_file(&zip_path);

        if let Ok(st) = unpack_res {
            if st.success() {
                let bin_name = if is_win { "DepotDownloader.exe" } else { "DepotDownloader" };
                let bin_path = tools_dir.join(bin_name);

                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if bin_path.exists() {
                        let _ = fs::set_permissions(&bin_path, fs::Permissions::from_mode(0o755));
                    }
                }

                if bin_path.exists() {
                    return Ok(bin_path.to_string_lossy().to_string());
                }
            }
        }

        Err("Failed to extract DepotDownloader archive.".to_string())
    }

    /// Checks if Steam console downloaded content exists for this app & depot
    pub fn check_downloaded_depot(steam_path: &str, appid: u32, depot_id: &str) -> Option<PathBuf> {
        let p = Path::new(steam_path)
            .join("steamapps")
            .join("content")
            .join(format!("app_{appid}"))
            .join(format!("depot_{depot_id}"));

        if p.exists() {
            Some(p)
        } else {
            None
        }
    }

    /// Moves or copies downloaded depot files from Steam's content folder to game common dir
    pub fn apply_downloaded_depot(
        steam_path: &str,
        appid: u32,
        depot_id: &str,
        game_path: &str,
    ) -> Result<String, String> {
        let content_dir = Path::new(steam_path)
            .join("steamapps")
            .join("content")
            .join(format!("app_{appid}"))
            .join(format!("depot_{depot_id}"));

        if !content_dir.exists() {
            return Err(format!(
                "Depot folder not found at: {}. Make sure Steam console has finished downloading.",
                content_dir.display()
            ));
        }

        let game_dir = Path::new(game_path);
        if !game_dir.exists() {
            return Err(format!("Game directory not found at: {}", game_path));
        }

        // Automatically back up game configs and saves before applying files
        let _ = crate::backup::BackupManager::create_backup(
            appid,
            "Game",
            game_path,
            "saves",
            None,
            Some(steam_path),
        );

        let mut copied_count = 0;
        let entries = fs::read_dir(&content_dir).map_err(|e| e.to_string())?;

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = match path.file_name() {
                Some(n) => n,
                None => continue,
            };

            let dest = game_dir.join(file_name);
            Self::copy_recursive(&path, &dest)?;
            copied_count += 1;
        }

        Ok(format!(
            "Successfully applied {copied_count} top-level items from depot {depot_id} to {game_path}"
        ))
    }

    pub fn copy_recursive(src: &Path, dest: &Path) -> Result<(), String> {
        Self::apply_recursive(src, dest, false)
    }

    /// Moves or copies files from staging to target game directory.
    /// When `move_files` is true, tries `fs::rename` first (0 extra disk space on same volume),
    /// falling back to unlink-then-copy and removing the source file.
    pub fn apply_recursive(src: &Path, dest: &Path, move_files: bool) -> Result<(), String> {
        if src.is_file() {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            // CRITICAL: Unlink dest before copying/moving!
            // If dest is a hardlink (to a Version Vault snapshot), overwriting it in-place
            // writes directly into the shared inode, mutating and corrupting the snapshot in the vault!
            if dest.exists() {
                let _ = fs::remove_file(dest);
            }

            if move_files {
                match fs::rename(src, dest) {
                    Ok(_) => return Ok(()),
                    Err(_) => {
                        fs::copy(src, dest).map_err(|e| format!("Failed to copy {}: {e}", src.display()))?;
                        let _ = fs::remove_file(src);
                        return Ok(());
                    }
                }
            } else {
                fs::copy(src, dest).map_err(|e| format!("Failed to copy {}: {e}", src.display()))?;
                return Ok(());
            }
        }

        if src.is_dir() {
            let _ = fs::create_dir_all(dest);
            let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
            for entry in entries.flatten() {
                let child_src = entry.path();
                let child_dest = dest.join(entry.file_name());
                Self::apply_recursive(&child_src, &child_dest, move_files)?;
            }
            if move_files {
                let _ = fs::remove_dir(src);
            }
        }

        Ok(())
    }

    /// Starts an automated download, safety backup, and version installation
    pub fn start_automated_downgrade(
        app_handle: tauri::AppHandle,
        state: DownloadStateHandle,
        options: AutomatedDowngradeOptions,
    ) -> Result<(), String> {
        // 1. Check if download already running
        {
            let mut st = state.lock().map_err(|e| e.to_string())?;
            if st.is_running {
                return Err("A downgrade or download process is already running.".to_string());
            }
            st.is_running = true;
            st.should_cancel = false;
            st.child_stdin = None;
            st.child_pid = None;
        }

        // 2. Resolve DepotDownloader executable
        let exe_path = match Self::resolve_depot_downloader(options.custom_tool_path.as_deref()) {
            Some(p) => p,
            None => {
                let mut st = state.lock().map_err(|e| e.to_string())?;
                st.is_running = false;
                return Err("DepotDownloader executable was not found. Please install it or specify its path in settings.".to_string());
            }
        };

        let state_clone = Arc::clone(&state);
        let app_clone = app_handle.clone();

        // 3. Pre-flight free disk space check
        let target_check_dir = options
            .library_path
            .as_deref()
            .map(Path::new)
            .unwrap_or_else(|| Path::new(&options.game_path));

        if let Some(free_space) = get_available_disk_space(target_check_dir) {
            // Check SizeOnDisk from appmanifest if available to estimate required headroom
            let estimated_required = if let Some(lib_path) = &options.library_path {
                let manifest_path = Path::new(lib_path)
                    .join("steamapps")
                    .join(format!("appmanifest_{}.acf", options.appid));
                if let Ok(content) = fs::read_to_string(&manifest_path) {
                    let vdf = crate::vdf::VdfParser::parse(&content);
                    vdf.get("AppState")
                        .and_then(|app_state| app_state.get_str("SizeOnDisk"))
                        .and_then(|s| s.parse::<u64>().ok())
                        .unwrap_or(0)
                } else {
                    0
                }
            } else {
                0
            };

            // If we have an estimated size, require at least 90% of it in free space before downloading.
            // Minimum safety threshold of 500 MB if size is unknown.
            let min_threshold = if estimated_required > 0 {
                (estimated_required as f64 * 0.90) as u64
            } else {
                500 * 1024 * 1024
            };

            if free_space < min_threshold {
                let mut st = state.lock().map_err(|e| e.to_string())?;
                st.is_running = false;
                let free_gb = free_space as f64 / (1024.0 * 1024.0 * 1024.0);
                let req_gb = min_threshold as f64 / (1024.0 * 1024.0 * 1024.0);
                return Err(format!(
                    "Insufficient disk space on {}: only {:.2} GB available, but this download requires at least ~{:.2} GB. Please free up space before proceeding.",
                    target_check_dir.display(),
                    free_gb,
                    req_gb
                ));
            }
        }

        // 4. Spawn background worker thread
        std::thread::spawn(move || {
            let appid = options.appid;
            let depot_id = options.depot_id.clone();
            let manifest_id = options.manifest_id.clone();

            // Helper to emit progress
            let emit_progress = |step: &str, percent: f32, msg: &str, speed: Option<f32>| {
                let _ = app_clone.emit(
                    "depot_download_progress",
                    DepotDownloadProgressEvent {
                        appid,
                        depot_id: depot_id.clone(),
                        manifest_id: manifest_id.clone(),
                        step: step.to_string(),
                        percent,
                        message: msg.to_string(),
                        speed_mb_s: speed,
                        bytes_downloaded: None,
                        total_bytes: None,
                    },
                );
            };

            // A. Optional Safety Backup (Pre-Version Change Snapshot & Saves/Configs Backup)
            if options.auto_backup {
                emit_progress(
                    "backup",
                    5.0,
                    "Backing up game configs & saves and creating safety snapshot...",
                    None,
                );

                // 1. Back up game configs and saves
                let _ = crate::backup::BackupManager::create_backup(
                    appid,
                    options.game_name.as_deref().unwrap_or("Game"),
                    &options.game_path,
                    "saves",
                    None,
                    options.steam_path.as_deref(),
                );

                // 2. Snapshot current build in Version Vault so user can revert instantly
                if let Some(lib_path) = &options.library_path {
                    let cur_manifest = options
                        .current_manifest_id
                        .as_deref()
                        .filter(|m| !m.is_empty() && *m != "unknown")
                        .unwrap_or("current");
                    let cur_build = options
                        .current_build_id
                        .as_deref()
                        .filter(|b| !b.is_empty() && *b != "0")
                        .unwrap_or("current");
                    let backup_label = format!("Pre-Switch Snapshot (Manifest {})", cur_manifest);
                    let _ = crate::vault::VaultManager::snapshot_current_build(
                        lib_path,
                        appid,
                        &options.game_path,
                        &backup_label,
                        cur_build,
                        &depot_id,
                        cur_manifest,
                        Some(&app_clone),
                    );
                }
            }

            // B. Prepare download staging directory
            let staging_dir = if let Some(lib) = &options.library_path {
                Path::new(lib)
                    .join("steamapps")
                    .join("depot_staging")
                    .join(format!("app_{appid}_depot_{depot_id}_{manifest_id}"))
            } else {
                Path::new(&options.game_path)
                    .join("..")
                    .join("depot_staging")
                    .join(format!("app_{appid}_depot_{depot_id}_{manifest_id}"))
            };

            let _ = fs::create_dir_all(&staging_dir);

            emit_progress(
                "connecting",
                12.0,
                "Launching DepotDownloader & connecting to Steam...",
                None,
            );

            // C. Build Command
            let mut cmd = create_hidden_command(&exe_path);
            cmd.arg("-app")
                .arg(appid.to_string())
                .arg("-depot")
                .arg(&depot_id)
                .arg("-manifest")
                .arg(&manifest_id)
                .arg("-dir")
                .arg(&staging_dir)
                .arg("-validate");

            if let Some(user) = &options.username.filter(|s| !s.trim().is_empty()) {
                cmd.arg("-username").arg(user);
                if options.remember_password {
                    cmd.arg("-remember-password");
                }
            }

            if let Some(pass) = &options.password.filter(|s| !s.trim().is_empty()) {
                cmd.arg("-password").arg(pass);
            }

            cmd.stdin(Stdio::piped());
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());

            let mut child = match cmd.spawn() {
                Ok(c) => c,
                Err(e) => {
                    if let Ok(mut st) = state_clone.lock() {
                        st.is_running = false;
                    }
                    emit_progress("error", 0.0, &format!("Failed to spawn DepotDownloader: {e}"), None);
                    return;
                }
            };

            let pid = child.id();
            let stdin = child.stdin.take();

            // Store child handles for 2FA submission & cancellation
            if let Ok(mut st) = state_clone.lock() {
                st.child_pid = Some(pid);
                st.child_stdin = stdin;
            }

            // Shared buffer to capture the most recent error/diagnostic output lines from DepotDownloader
            let last_output_lines = Arc::new(Mutex::new(Vec::<String>::new()));
            let last_output_clone = Arc::clone(&last_output_lines);

            let record_output = |lines_buf: &Arc<Mutex<Vec<String>>>, line: &str| {
                if let Ok(mut buf) = lines_buf.lock() {
                    if buf.len() >= 8 {
                        buf.remove(0);
                    }
                    buf.push(line.to_string());
                }
            };

            // Spawn stderr reader thread to catch any errors or prompts
            if let Some(mut stderr) = child.stderr.take() {
                let app_err = app_clone.clone();
                let depot_id_err = depot_id.clone();
                let manifest_id_err = manifest_id.clone();
                let last_out_err = Arc::clone(&last_output_lines);
                std::thread::spawn(move || {
                    let mut err_buf = [0u8; 1024];
                    while let Ok(n) = stderr.read(&mut err_buf) {
                        if n == 0 {
                            break;
                        }
                        let err_text = String::from_utf8_lossy(&err_buf[..n]);
                        let trimmed = err_text.trim();
                        if !trimmed.is_empty() {
                            if let Ok(mut buf) = last_out_err.lock() {
                                if buf.len() >= 8 {
                                    buf.remove(0);
                                }
                                buf.push(trimmed.to_string());
                            }
                            let lower = trimmed.to_lowercase();
                            let step = if lower.contains("steam guard")
                                || lower.contains("two-factor")
                                || lower.contains("2 factor")
                            {
                                "needs_2fa"
                            } else if lower.contains("password") {
                                "needs_password"
                            } else {
                                "connecting"
                            };
                            let _ = app_err.emit(
                                "depot_download_progress",
                                DepotDownloadProgressEvent {
                                    appid,
                                    depot_id: depot_id_err.clone(),
                                    manifest_id: manifest_id_err.clone(),
                                    step: step.to_string(),
                                    percent: 15.0,
                                    message: trimmed.to_string(),
                                    speed_mb_s: None,
                                    bytes_downloaded: None,
                                    total_bytes: None,
                                },
                            );
                        }
                    }
                });
            }

            // D. Stream stdout byte-by-byte / chunk-by-chunk to handle Console.Write prompts without \n
            let mut current_percent = 15.0f32;
            let mut current_speed: Option<f32> = None;

            if let Some(mut stdout) = child.stdout.take() {
                let mut buf = [0u8; 1024];
                let mut pending = String::new();

                while let Ok(n) = stdout.read(&mut buf) {
                    if n == 0 {
                        break;
                    }

                    // Check cancellation flag
                    if let Ok(mut st) = state_clone.lock() {
                        if st.should_cancel {
                            let _ = child.kill();
                            st.is_running = false;
                            emit_progress("cancelled", 0.0, "Downgrade cancelled by user.", None);
                            return;
                        }
                    }

                    let chunk = String::from_utf8_lossy(&buf[..n]);
                    pending.push_str(&chunk);

                    // Process complete lines
                    while let Some(pos) = pending.find('\n') {
                        let line = pending[..pos].trim().to_string();
                        pending = pending[pos + 1..].to_string();

                        if line.is_empty() {
                            continue;
                        }

                        record_output(&last_output_clone, &line);

                        let lower = line.to_lowercase();

                        // Check for 2FA / Steam Guard prompt
                        if lower.contains("steam guard")
                            || lower.contains("two-factor")
                            || lower.contains("2 factor")
                            || lower.contains("authentication code")
                            || lower.contains("enter the code")
                        {
                            emit_progress("needs_2fa", current_percent, &line, None);
                            continue;
                        }

                        // Check for Password prompt
                        if lower.contains("enter account password") || lower.contains("password:") {
                            emit_progress("needs_password", current_percent, &line, None);
                            continue;
                        }

                        // Parse percentage if present (e.g., " 45.2% " or " 45.20 % ")
                        if let Some(pct_pos) = line.find('%') {
                            let before = line[..pct_pos].trim_end();
                            if let Some(last_space) = before.rfind(|c: char| !c.is_numeric() && c != '.') {
                                if let Ok(val) = before[last_space + 1..].parse::<f32>() {
                                    if (0.0..=100.0).contains(&val) {
                                        current_percent = 15.0 + (val * 0.72);
                                    }
                                }
                            } else if let Ok(val) = before.parse::<f32>() {
                                if (0.0..=100.0).contains(&val) {
                                    current_percent = 15.0 + (val * 0.72);
                                }
                            }
                        }

                        // Parse speed if present (e.g., "24.5 MB/s")
                        if let Some(mb_pos) = lower.find("mb/s") {
                            let before = line[..mb_pos].trim_end();
                            if let Some(last_space) = before.rfind(|c: char| !c.is_numeric() && c != '.') {
                                if let Ok(spd) = before[last_space + 1..].parse::<f32>() {
                                    current_speed = Some(spd);
                                }
                            }
                        }

                        emit_progress("downloading", current_percent, &line, current_speed);
                    }

                    // Check for un-newline'd prompt waiting on stdin (Console.Write)
                    let trimmed_pending = pending.trim();
                    if !trimmed_pending.is_empty() {
                        let lower_pending = trimmed_pending.to_lowercase();
                        if lower_pending.contains("steam guard")
                            || lower_pending.contains("two-factor")
                            || lower_pending.contains("2 factor")
                            || lower_pending.contains("authentication code")
                            || lower_pending.contains("enter the code")
                        {
                            emit_progress("needs_2fa", current_percent, trimmed_pending, None);
                        } else if lower_pending.contains("enter account password")
                            || lower_pending.contains("password:")
                        {
                            emit_progress("needs_password", current_percent, trimmed_pending, None);
                        } else if lower_pending.contains("connecting")
                            || lower_pending.contains("logging")
                        {
                            emit_progress("connecting", current_percent, trimmed_pending, None);
                        }
                    }
                }
            }

            // E. Wait for process exit
            let status = child.wait();

            // Clear active child handles
            let cancelled = if let Ok(mut st) = state_clone.lock() {
                st.child_stdin = None;
                st.child_pid = None;
                st.is_running = false;
                st.should_cancel
            } else {
                false
            };

            if cancelled {
                emit_progress("cancelled", 0.0, "Downgrade cancelled by user.", None);
                return;
            }

            match status {
                Ok(exit_status) if exit_status.success() => {
                    // F. Auto-Apply Downloaded Files
                    if options.auto_apply {
                        emit_progress("applying", 90.0, "Applying downloaded files directly to game folder...", None);
                        let target_path = Path::new(&options.game_path);
                        // Move files directly from staging to target game folder:
                        // On the same drive, this executes instantaneous renames with 0 extra disk space!
                        if let Err(e) = Self::apply_recursive(&staging_dir, target_path, true) {
                            emit_progress("error", 0.0, &format!("Failed to apply files to game: {e}"), None);
                            return;
                        }
                        // Clean up temporary staging directory if any empty folders remain
                        let _ = fs::remove_dir_all(&staging_dir);
                    }

                    // G. Auto-Lock Steam Manifest
                    if options.auto_lock {
                        emit_progress("locking", 96.0, "Updating and locking Steam appmanifest...", None);
                        if let Some(lib_path) = &options.library_path {
                            let _ = crate::steam::SteamManager::register_installed_game(
                                lib_path,
                                appid,
                                options.game_name.as_deref().unwrap_or("Steam Game"),
                                Path::new(&options.game_path)
                                    .file_name()
                                    .map(|f| f.to_string_lossy().to_string())
                                    .unwrap_or_default()
                                    .as_str(),
                                &manifest_id,
                                &depot_id,
                                &manifest_id,
                            );
                        }
                    }

                    // H. Automatically register the newly downloaded & applied build into Version Vault!
                    // This allows consecutive version downloads to all be instantly switchable.
                    if let Some(lib_path) = &options.library_path {
                        let new_profile_name = format!("Build Manifest {}", manifest_id);
                        let _ = crate::vault::VaultManager::snapshot_current_build(
                            lib_path,
                            appid,
                            &options.game_path,
                            &new_profile_name,
                            &manifest_id,
                            &depot_id,
                            &manifest_id,
                            Some(&app_clone),
                        );
                    }

                    emit_progress(
                        "finished",
                        100.0,
                        "Version installed and saved to Version Vault! Ready to play.",
                        None,
                    );
                }
                Ok(exit_status) => {
                    let err_detail = if let Ok(buf) = last_output_lines.lock() {
                        if !buf.is_empty() {
                            format!("\nDetails: {}", buf.join("\n"))
                        } else {
                            String::new()
                        }
                    } else {
                        String::new()
                    };
                    emit_progress(
                        "error",
                        0.0,
                        &format!("DepotDownloader finished with non-zero exit code: {exit_status}{err_detail}"),
                        None,
                    );
                }
                Err(e) => {
                    emit_progress("error", 0.0, &format!("Error waiting for DepotDownloader: {e}"), None);
                }
            }
        });

        Ok(())
    }

    /// Sends 2FA / Steam Guard authentication code to the running process
    pub fn submit_depot_2fa(state: DownloadStateHandle, code: &str) -> Result<(), String> {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        if let Some(stdin) = st.child_stdin.as_mut() {
            let input = format!("{}\n", code.trim());
            stdin
                .write_all(input.as_bytes())
                .map_err(|e| format!("Failed to write to stdin: {e}"))?;
            stdin
                .flush()
                .map_err(|e| format!("Failed to flush stdin: {e}"))?;
            Ok(())
        } else {
            Err("No active process waiting for input.".to_string())
        }
    }

    /// Cancels currently running automated downgrade
    pub fn cancel_automated_downgrade(state: DownloadStateHandle) -> Result<(), String> {
        let mut st = state.lock().map_err(|e| e.to_string())?;
        st.should_cancel = true;

        if let Some(pid) = st.child_pid {
            if cfg!(target_os = "windows") {
                let _ = create_hidden_command("taskkill")
                    .args(["/PID", &pid.to_string(), "/F", "/T"])
                    .output();
            } else {
                let _ = create_hidden_command("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        }

        st.is_running = false;
        st.child_stdin = None;
        st.child_pid = None;

        Ok(())
    }
}
