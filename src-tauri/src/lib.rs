mod backup;
mod downloader;
mod steam;
mod vault;
mod vdf;

use backup::{BackupEntry, BackupManager};
use downloader::{DowngradePlan, DownloaderManager};
use steam::{ScanResult, SteamManager};
use vault::{VaultManager, VaultProfile};

#[tauri::command]
async fn scan_steam_games(custom_paths: Vec<String>) -> Result<ScanResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SteamManager::scan_all(&custom_paths)
    })
    .await
    .map_err(|e| format!("Scan error: {e}"))
}

#[tauri::command]
async fn browse_directory(path: Option<String>) -> Result<steam::DirectoryListing, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SteamManager::browse_directory(path.as_deref())
    })
    .await
    .map_err(|e| format!("Browse error: {e}"))?
}

#[tauri::command]
async fn get_steam_patch_notes(appid: u32, language: Option<String>) -> Result<Vec<steam::SteamPatchNote>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SteamManager::fetch_patch_notes(appid, language.as_deref())
    })
    .await
    .map_err(|e| format!("Task execution error: {e}"))?
}

#[tauri::command]
async fn resolve_steam_apps_metadata(appids: Vec<u32>) -> Result<Vec<steam::SteamAppMetadata>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SteamManager::resolve_multiple_steam_apps(appids)
    })
    .await
    .map_err(|e| format!("Metadata error: {e}"))
}

#[tauri::command]
async fn fetch_depot_manifests(appid: u32, depot_id: String) -> Result<Vec<steam::BuildVersion>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        SteamManager::fetch_depot_manifests(appid, &depot_id)
    })
    .await
    .map_err(|e| format!("Task execution error: {e}"))?
}

#[tauri::command]
fn register_installed_game(
    library_path: String,
    appid: u32,
    game_name: String,
    install_dir: String,
    build_id: String,
    depot_id: String,
    manifest_id: String,
) -> Result<String, String> {
    SteamManager::register_installed_game(
        &library_path,
        appid,
        &game_name,
        &install_dir,
        &build_id,
        &depot_id,
        &manifest_id,
    )
}

#[tauri::command]
fn create_backup(
    appid: u32,
    game_name: String,
    game_path: String,
    backup_type: String,
    custom_path: Option<String>,
    steam_path: Option<String>,
) -> Result<BackupEntry, String> {
    BackupManager::create_backup(
        appid,
        &game_name,
        &game_path,
        &backup_type,
        custom_path.as_deref(),
        steam_path.as_deref(),
    )
}

#[tauri::command]
fn list_backups(appid: Option<u32>) -> Vec<BackupEntry> {
    BackupManager::list_backups(appid)
}

#[tauri::command]
fn restore_backup(backup_id: String, appid: u32) -> Result<String, String> {
    BackupManager::restore_backup(&backup_id, appid)
}

#[tauri::command]
fn delete_backup(backup_id: String, appid: u32) -> Result<(), String> {
    BackupManager::delete_backup(&backup_id, appid)
}

#[tauri::command]
fn create_downgrade_plan(
    appid: u32,
    depot_id: String,
    manifest_id: String,
    game_path: String,
    steam_path: Option<String>,
    username: Option<String>,
) -> DowngradePlan {
    DownloaderManager::create_plan(
        appid,
        &depot_id,
        &manifest_id,
        &game_path,
        steam_path.as_deref(),
        username.as_deref(),
    )
}

#[tauri::command]
fn check_depot_downloader(custom_path: Option<String>) -> Result<String, String> {
    DownloaderManager::check_depot_downloader(custom_path.as_deref())
}

#[tauri::command]
async fn get_depot_downloader_status(custom_path: Option<String>) -> Result<downloader::DepotDownloaderStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        DownloaderManager::get_depot_downloader_status(custom_path.as_deref())
    })
    .await
    .map_err(|e| format!("Task execution error: {e}"))
}

#[tauri::command]
fn install_depot_downloader_tool() -> Result<String, String> {
    DownloaderManager::install_depot_downloader_tool()
}

#[tauri::command]
fn start_automated_downgrade(
    app: tauri::AppHandle,
    state: tauri::State<downloader::DownloadStateHandle>,
    options: downloader::AutomatedDowngradeOptions,
) -> Result<(), String> {
    DownloaderManager::start_automated_downgrade(app, (*state).clone(), options)
}

#[tauri::command]
fn submit_depot_downloader_2fa(
    state: tauri::State<downloader::DownloadStateHandle>,
    code: String,
) -> Result<(), String> {
    DownloaderManager::submit_depot_2fa((*state).clone(), &code)
}

#[tauri::command]
fn cancel_automated_downgrade(
    state: tauri::State<downloader::DownloadStateHandle>,
) -> Result<(), String> {
    DownloaderManager::cancel_automated_downgrade((*state).clone())
}

#[tauri::command]
fn check_downloaded_depot(steam_path: String, appid: u32, depot_id: String) -> bool {
    DownloaderManager::check_downloaded_depot(&steam_path, appid, &depot_id).is_some()
}

#[tauri::command]
fn get_downloaded_depot_path(steam_path: String, appid: u32, depot_id: String) -> Option<String> {
    DownloaderManager::check_downloaded_depot(&steam_path, appid, &depot_id)
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn apply_downloaded_depot(
    steam_path: String,
    appid: u32,
    depot_id: String,
    game_path: String,
) -> Result<String, String> {
    DownloaderManager::apply_downloaded_depot(&steam_path, appid, &depot_id, &game_path)
}

#[tauri::command]
fn list_vault_profiles(library_path: String, appid: u32, game_path: Option<String>) -> Vec<VaultProfile> {
    if let Some(gp) = &game_path {
        VaultManager::list_profiles_for_game(&library_path, gp, appid)
    } else {
        VaultManager::list_profiles(&library_path, appid)
    }
}

#[tauri::command]
async fn snapshot_current_build(
    app: tauri::AppHandle,
    library_path: String,
    appid: u32,
    game_path: String,
    version_name: String,
    build_id: String,
    depot_id: String,
    manifest_id: String,
) -> Result<VaultProfile, String> {
    tauri::async_runtime::spawn_blocking(move || {
        VaultManager::snapshot_current_build(
            &library_path,
            appid,
            &game_path,
            &version_name,
            &build_id,
            &depot_id,
            &manifest_id,
            Some(&app),
        )
    })
    .await
    .map_err(|e| format!("Task execution error: {e}"))?
}

#[tauri::command]
fn import_downloaded_to_vault(
    library_path: String,
    content_dir_path: String,
    appid: u32,
    version_name: String,
    build_id: String,
    depot_id: String,
    manifest_id: String,
) -> Result<VaultProfile, String> {
    VaultManager::import_downloaded_to_vault(
        &library_path,
        &content_dir_path,
        appid,
        &version_name,
        &build_id,
        &depot_id,
        &manifest_id,
    )
}

#[tauri::command]
async fn switch_build_profile(
    app: tauri::AppHandle,
    library_path: String,
    appid: u32,
    game_path: String,
    target_profile_id: String,
) -> Result<VaultProfile, String> {
    tauri::async_runtime::spawn_blocking(move || {
        VaultManager::switch_profile(
            &library_path,
            appid,
            &game_path,
            &target_profile_id,
            Some(&app),
        )
    })
    .await
    .map_err(|e| format!("Task execution error: {e}"))?
}

#[tauri::command]
fn delete_vault_profile(
    library_path: String,
    appid: u32,
    profile_id: String,
) -> Result<(), String> {
    VaultManager::delete_profile(&library_path, appid, &profile_id)
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let resolved_path = if p.is_relative() {
        if let Ok(abs) = std::fs::canonicalize(p) {
            abs.to_string_lossy().to_string()
        } else {
            path.clone()
        }
    } else {
        path.clone()
    };

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        if std::path::Path::new("/mnt/c/Windows/explorer.exe").exists() {
            let win_path = if resolved_path.starts_with("/mnt/") && resolved_path.len() >= 7 {
                let drive_letter = resolved_path.chars().nth(5).unwrap_or('c').to_ascii_uppercase();
                let sub_path = &resolved_path[6..].replace('/', "\\");
                format!("{drive_letter}:{sub_path}")
            } else {
                resolved_path.clone()
            };
            if std::process::Command::new("/mnt/c/Windows/explorer.exe")
                .arg(&win_path)
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }
        std::process::Command::new("xdg-open")
            .arg(&resolved_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_steam_console() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        crate::downloader::create_hidden_command("cmd")
            .args(["/c", "start", "steam://open/console"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("steam://open/console")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        if std::path::Path::new("/mnt/c/Windows/System32/cmd.exe").exists() {
            let _ = std::process::Command::new("/mnt/c/Windows/System32/cmd.exe")
                .args(["/c", "start", "steam://open/console"])
                .spawn();
            return Ok(());
        }
        std::process::Command::new("xdg-open")
            .arg("steam://open/console")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn launch_steam_game(appid: u32) -> Result<(), String> {
    let steam_url = format!("steam://run/{appid}");
    #[cfg(target_os = "windows")]
    {
        crate::downloader::create_hidden_command("cmd")
            .args(["/c", "start", &steam_url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&steam_url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        if std::path::Path::new("/mnt/c/Windows/System32/cmd.exe").exists() {
            let _ = std::process::Command::new("/mnt/c/Windows/System32/cmd.exe")
                .args(["/c", "start", &steam_url])
                .spawn();
            return Ok(());
        }
        std::process::Command::new("xdg-open")
            .arg(&steam_url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

use std::sync::Mutex;
use tauri::{PhysicalPosition, PhysicalSize};

#[derive(Clone, Copy)]
struct SavedWindowBounds {
    pos: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
}

static LAST_UNMAXIMIZED_BOUNDS: Mutex<Option<SavedWindowBounds>> = Mutex::new(None);
static IS_CUSTOM_MAXIMIZED: Mutex<bool> = Mutex::new(false);

#[tauri::command]
fn app_window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_window_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    let custom_max = {
        let mut guard = IS_CUSTOM_MAXIMIZED.lock().unwrap_or_else(|e| e.into_inner());
        let val = *guard;
        if val {
            *guard = false;
        }
        val
    };
    let native_max = window.is_maximized().unwrap_or(false);

    if custom_max || native_max {
        if native_max {
            let _ = window.unmaximize();
        }
        if let Ok(mut guard) = LAST_UNMAXIMIZED_BOUNDS.lock() {
            if let Some(bounds) = guard.take() {
                let _ = window.set_position(tauri::Position::Physical(bounds.pos));
                let _ = window.set_size(tauri::Size::Physical(bounds.size));
            }
        }
        Ok(false)
    } else {
        // Record pre-maximize position and size
        if let (Ok(current_pos), Ok(current_size)) = (window.outer_position(), window.outer_size()) {
            if let Ok(mut guard) = LAST_UNMAXIMIZED_BOUNDS.lock() {
                *guard = Some(SavedWindowBounds {
                    pos: current_pos,
                    size: current_size,
                });
            }
        }

        // Determine target monitor: check current_monitor() or locate which monitor bounds contain the window center
        let target_monitor = if let Ok(Some(m)) = window.current_monitor() {
            Some(m)
        } else if let (Ok(outer_pos), Ok(outer_size), Ok(monitors)) = (
            window.outer_position(),
            window.outer_size(),
            window.available_monitors(),
        ) {
            let cx = outer_pos.x + (outer_size.width as i32) / 2;
            let cy = outer_pos.y + (outer_size.height as i32) / 2;
            monitors.into_iter().find(|m| {
                let p = m.position();
                let s = m.size();
                cx >= p.x && cx < (p.x + s.width as i32) && cy >= p.y && cy < (p.y + s.height as i32)
            })
        } else {
            None
        };

        if let Some(monitor) = target_monitor {
            let m_pos = monitor.position();
            let m_size = monitor.size();

            // On secondary monitors (or under WSLg/Weston compositor), calling native maximize causes
            // the window manager to ignore the secondary screen and throw the window onto the primary display.
            // Explicitly setting the position and size to match monitor bounds keeps it reliably on the current screen.
            let is_secondary = m_pos.x != 0 || m_pos.y != 0;

            if is_secondary {
                let _ = window.set_position(tauri::Position::Physical(*m_pos));
                let _ = window.set_size(tauri::Size::Physical(*m_size));
                if let Ok(mut guard) = IS_CUSTOM_MAXIMIZED.lock() {
                    *guard = true;
                }
                return Ok(true);
            } else {
                let _ = window.set_position(tauri::Position::Physical(*m_pos));
                window.maximize().map_err(|e| e.to_string())?;
                return Ok(true);
            }
        }

        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[tauri::command]
fn app_window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_window_is_maximized(window: tauri::Window) -> Result<bool, String> {
    let custom_max = *IS_CUSTOM_MAXIMIZED.lock().unwrap_or_else(|e| e.into_inner());
    let native_max = window.is_maximized().unwrap_or(false);
    Ok(custom_max || native_max)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK under WSL2, VMs, and certain Mesa drivers fails to create EGL/Zink
        // accelerated contexts ("failed to get driver name for fd -1", "ZINK: failed to choose pdev").
        // Disabling DMABUF renderer and compositing mode forces clean software rendering via Cairo.
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
        if std::env::var("WEBKIT_DISABLE_COMPOSITING_MODE").is_err() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            }
        }
    }

    tauri::Builder::default()
        .manage(downloader::init_download_state())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            scan_steam_games,
            resolve_steam_apps_metadata,
            browse_directory,
            get_steam_patch_notes,
            fetch_depot_manifests,
            register_installed_game,
            create_backup,
            list_backups,
            restore_backup,
            delete_backup,
            create_downgrade_plan,
            check_depot_downloader,
            get_depot_downloader_status,
            install_depot_downloader_tool,
            start_automated_downgrade,
            submit_depot_downloader_2fa,
            cancel_automated_downgrade,
            check_downloaded_depot,
            get_downloaded_depot_path,
            apply_downloaded_depot,
            list_vault_profiles,
            snapshot_current_build,
            import_downloaded_to_vault,
            switch_build_profile,
            delete_vault_profile,
            open_folder,
            open_steam_console,
            launch_steam_game,
            app_window_minimize,
            app_window_toggle_maximize,
            app_window_close,
            app_window_is_maximized
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
