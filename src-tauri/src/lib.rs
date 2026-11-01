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
fn scan_steam_games(custom_paths: Vec<String>) -> ScanResult {
    SteamManager::scan_all(&custom_paths)
}

#[tauri::command]
fn browse_directory(path: Option<String>) -> Result<steam::DirectoryListing, String> {
    SteamManager::browse_directory(path.as_deref())
}

#[tauri::command]
fn get_steam_patch_notes(appid: u32, language: Option<String>) -> Result<Vec<steam::SteamPatchNote>, String> {
    SteamManager::fetch_patch_notes(appid, language.as_deref())
}

#[tauri::command]
fn resolve_steam_apps_metadata(appids: Vec<u32>) -> Vec<steam::SteamAppMetadata> {
    SteamManager::resolve_multiple_steam_apps(appids)
}

#[tauri::command]
fn fetch_depot_manifests(appid: u32, depot_id: String) -> Result<Vec<steam::BuildVersion>, String> {
    SteamManager::fetch_depot_manifests(appid, &depot_id)
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
fn list_vault_profiles(library_path: String, appid: u32) -> Vec<VaultProfile> {
    VaultManager::list_profiles(&library_path, appid)
}

#[tauri::command]
fn snapshot_current_build(
    library_path: String,
    appid: u32,
    game_path: String,
    version_name: String,
    build_id: String,
    depot_id: String,
    manifest_id: String,
) -> Result<VaultProfile, String> {
    VaultManager::snapshot_current_build(
        &library_path,
        appid,
        &game_path,
        &version_name,
        &build_id,
        &depot_id,
        &manifest_id,
    )
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
fn switch_build_profile(
    library_path: String,
    appid: u32,
    game_path: String,
    target_profile_id: String,
) -> Result<VaultProfile, String> {
    VaultManager::switch_profile(
        &library_path,
        appid,
        &game_path,
        &target_profile_id,
    )
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
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn open_steam_console() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
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
        std::process::Command::new("xdg-open")
            .arg("steam://open/console")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn app_window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn app_window_toggle_maximize(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
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
    window.is_maximized().map_err(|e| e.to_string())
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
            app_window_minimize,
            app_window_toggle_maximize,
            app_window_close,
            app_window_is_maximized
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
