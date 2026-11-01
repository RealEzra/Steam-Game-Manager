use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupEntry {
    pub id: String,
    pub appid: u32,
    pub game_name: String,
    pub backup_type: String, // "saves" | "full" | "custom"
    pub original_path: String,
    pub backup_path: String,
    pub size_bytes: u64,
    pub created_at: String,
    pub files_count: usize,
}

pub struct BackupManager;

impl BackupManager {
    /// Gets base directory for backups
    pub fn get_backups_root() -> PathBuf {
        let base = if let Ok(custom) = std::env::var("STEAM_DOWNGRADER_BACKUP_DIR") {
            PathBuf::from(custom)
        } else if let Ok(home) = std::env::var("HOME") {
            PathBuf::from(home).join(".local/share/steam-downgrader-gui/backups")
        } else {
            PathBuf::from("./backups")
        };

        let _ = fs::create_dir_all(&base);
        base
    }

    /// Finds potential save locations for a given game
    pub fn detect_save_locations(game_full_path: &str, steam_path: Option<&str>, appid: u32) -> Vec<PathBuf> {
        let mut candidates = Vec::new();
        let game_dir = Path::new(game_full_path);

        // 1. Common save folder names inside the game's own directory
        let common_save_names = [
            "saves", "save", "Save", "Saves", "SavedGames", "saved_games",
            "SaveData", "savedata", "UserData", "userdata", "profile", "profiles",
            "config", "Settings", "settings",
        ];

        for name in common_save_names {
            let p = game_dir.join(name);
            if p.exists() {
                candidates.push(p);
            }
        }

        // 2. Steam userdata folder (<steam_path>/userdata/<user_id>/<appid>)
        if let Some(sp) = steam_path {
            let userdata_dir = Path::new(sp).join("userdata");
            if userdata_dir.exists() {
                if let Ok(users) = fs::read_dir(&userdata_dir) {
                    for user in users.flatten() {
                        let user_app_dir = user.path().join(appid.to_string());
                        if user_app_dir.exists() {
                            candidates.push(user_app_dir);
                        }
                    }
                }
            }
        }

        // 3. Linux Steam compatdata / Proton Wine prefix
        let compatdata_dir = game_dir
            .parent() // common
            .and_then(|p| p.parent()) // steamapps
            .map(|p| p.join("compatdata").join(appid.to_string()).join("pfx"));

        if let Some(pfx) = compatdata_dir {
            if pfx.exists() {
                // Check users/steamuser/AppData/Local and users/steamuser/Documents
                let appdata = pfx.join("drive_c/users/steamuser/AppData");
                if appdata.exists() {
                    candidates.push(appdata);
                }
            }
        }

        candidates
    }

    /// Creates a backup
    pub fn create_backup(
        appid: u32,
        game_name: &str,
        game_full_path: &str,
        backup_type: &str, // "saves" | "full" | "custom"
        custom_source_path: Option<&str>,
        steam_path: Option<&str>,
    ) -> Result<BackupEntry, String> {
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let timestamp_str = format!("{now}");
        let backup_id = format!("{appid}_{now}_{backup_type}");
        let app_backup_dir = Self::get_backups_root().join(appid.to_string()).join(&backup_id);
        fs::create_dir_all(&app_backup_dir).map_err(|e| format!("Failed to create backup dir: {e}"))?;

        let source_paths = match backup_type {
            "full" => vec![PathBuf::from(game_full_path)],
            "custom" => {
                if let Some(custom) = custom_source_path {
                    vec![PathBuf::from(custom)]
                } else {
                    return Err("Custom path not provided".to_string());
                }
            }
            _ => {
                // saves only
                let detected = Self::detect_save_locations(game_full_path, steam_path, appid);
                if detected.is_empty() {
                    // Fall back to game dir if no specific subfolder found
                    vec![PathBuf::from(game_full_path)]
                } else {
                    detected
                }
            }
        };

        let mut total_bytes = 0u64;
        let mut total_files = 0usize;

        for src in &source_paths {
            if !src.exists() {
                continue;
            }

            let folder_name = src.file_name().unwrap_or_default();
            let dest = app_backup_dir.join(folder_name);

            let (files, bytes) = Self::copy_recursive(src, &dest)?;
            total_files += files;
            total_bytes += bytes;
        }

        let entry = BackupEntry {
            id: backup_id.clone(),
            appid,
            game_name: game_name.to_string(),
            backup_type: backup_type.to_string(),
            original_path: game_full_path.to_string(),
            backup_path: app_backup_dir.to_string_lossy().to_string(),
            size_bytes: total_bytes,
            created_at: timestamp_str,
            files_count: total_files,
        };

        // Save metadata file
        let meta_file = app_backup_dir.join("backup_meta.json");
        if let Ok(json) = serde_json::to_string_pretty(&entry) {
            let _ = fs::write(meta_file, json);
        }

        Ok(entry)
    }

    /// List backups, optionally filtered by appid
    pub fn list_backups(filter_appid: Option<u32>) -> Vec<BackupEntry> {
        let root = Self::get_backups_root();
        let mut backups = Vec::new();

        let app_dirs = match fs::read_dir(&root) {
            Ok(dirs) => dirs,
            Err(_) => return backups,
        };

        for app_dir in app_dirs.flatten() {
            let app_path = app_dir.path();
            if !app_path.is_dir() {
                continue;
            }

            if let Some(target) = filter_appid {
                if let Some(dir_name) = app_path.file_name().and_then(|n| n.to_str()) {
                    if dir_name != target.to_string() {
                        continue;
                    }
                }
            }

            if let Ok(backup_dirs) = fs::read_dir(&app_path) {
                for b_entry in backup_dirs.flatten() {
                    let b_path = b_entry.path();
                    let meta_file = b_path.join("backup_meta.json");
                    if meta_file.exists() {
                        if let Ok(content) = fs::read_to_string(&meta_file) {
                            if let Ok(entry) = serde_json::from_str::<BackupEntry>(&content) {
                                backups.push(entry);
                            }
                        }
                    }
                }
            }
        }

        backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        backups
    }

    /// Restore a backup
    pub fn restore_backup(backup_id: &str, appid: u32) -> Result<String, String> {
        let app_backup_dir = Self::get_backups_root().join(appid.to_string()).join(backup_id);
        if !app_backup_dir.exists() {
            return Err("Backup directory does not exist".to_string());
        }

        let meta_file = app_backup_dir.join("backup_meta.json");
        let meta: BackupEntry = if meta_file.exists() {
            let content = fs::read_to_string(&meta_file).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).map_err(|e| e.to_string())?
        } else {
            return Err("Backup metadata file not found".to_string());
        };

        let target_root = Path::new(&meta.original_path);
        if !target_root.exists() {
            let _ = fs::create_dir_all(target_root);
        }

        // Copy files from backup directory back to target_root
        let entries = fs::read_dir(&app_backup_dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = match path.file_name() {
                Some(n) => n,
                None => continue,
            };

            if file_name == "backup_meta.json" {
                continue;
            }

            let dest = target_root.join(file_name);
            Self::copy_recursive(&path, &dest)?;
        }

        Ok(format!("Restored backup {} to {}", backup_id, meta.original_path))
    }

    /// Delete a backup
    pub fn delete_backup(backup_id: &str, appid: u32) -> Result<(), String> {
        let app_backup_dir = Self::get_backups_root().join(appid.to_string()).join(backup_id);
        if app_backup_dir.exists() {
            fs::remove_dir_all(&app_backup_dir).map_err(|e| format!("Failed to delete backup: {e}"))?;
        }
        Ok(())
    }

    fn copy_recursive(src: &Path, dest: &Path) -> Result<(usize, u64), String> {
        let mut count = 0;
        let mut total_bytes = 0;

        if src.is_file() {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let bytes = fs::copy(src, dest).map_err(|e| format!("Failed to copy file: {e}"))?;
            return Ok((1, bytes));
        }

        if src.is_dir() {
            let _ = fs::create_dir_all(dest);
            let entries = fs::read_dir(src).map_err(|e| format!("Failed to read dir: {e}"))?;
            for entry in entries.flatten() {
                let child_src = entry.path();
                let child_dest = dest.join(entry.file_name());
                let (c, b) = Self::copy_recursive(&child_src, &child_dest)?;
                count += c;
                total_bytes += b;
            }
        }

        Ok((count, total_bytes))
    }
}

