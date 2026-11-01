use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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

    /// Checks if DepotDownloader executable is available
    pub fn check_depot_downloader(custom_path: Option<&str>) -> Result<String, String> {
        let candidate = if let Some(p) = custom_path.filter(|s| !s.is_empty()) {
            p.to_string()
        } else {
            "DepotDownloader".to_string()
        };

        let output = Command::new(&candidate)
            .arg("--version")
            .output()
            .or_else(|_| Command::new(&candidate).arg("-h").output());

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{stdout} {stderr}");
                if combined.contains("DepotDownloader") || combined.contains("depot") || out.status.success() {
                    Ok(candidate)
                } else {
                    Err("Executable found but does not appear to be DepotDownloader".to_string())
                }
            }
            Err(e) => Err(format!("DepotDownloader not found: {e}")),
        }
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

    fn copy_recursive(src: &Path, dest: &Path) -> Result<(), String> {
        if src.is_file() {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            fs::copy(src, dest).map_err(|e| format!("Failed to copy {}: {e}", src.display()))?;
            return Ok(());
        }

        if src.is_dir() {
            let _ = fs::create_dir_all(dest);
            let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
            for entry in entries.flatten() {
                let child_src = entry.path();
                let child_dest = dest.join(entry.file_name());
                Self::copy_recursive(&child_src, &child_dest)?;
            }
        }

        Ok(())
    }
}

