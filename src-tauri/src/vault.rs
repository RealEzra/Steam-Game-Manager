use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultProfile {
    pub id: String,
    pub appid: u32,
    pub version_name: String,
    pub build_id: String,
    pub depot_id: String,
    pub manifest_id: String,
    pub vault_path: String,
    pub is_active: bool,
    pub created_at: u64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VaultMeta {
    pub active_profile_id: Option<String>,
    pub profiles: Vec<VaultProfile>,
}

pub struct VaultManager;

impl VaultManager {
    /// Gets or creates the vault directory inside the game's Steam library
    /// `<library_path>/steamapps/version_vault/<appid>/`
    pub fn get_vault_dir(library_path: &str, appid: u32) -> PathBuf {
        let lib = Path::new(library_path);
        let steamapps = if lib.ends_with("steamapps") {
            lib.to_path_buf()
        } else {
            lib.join("steamapps")
        };
        let vault = steamapps.join("version_vault").join(appid.to_string());
        let _ = fs::create_dir_all(&vault);
        vault
    }

    fn get_meta_file(vault_dir: &Path) -> PathBuf {
        vault_dir.join("vault_meta.json")
    }

    fn read_meta(vault_dir: &Path) -> VaultMeta {
        let meta_file = Self::get_meta_file(vault_dir);
        if let Ok(content) = fs::read_to_string(&meta_file) {
            if let Ok(meta) = serde_json::from_str::<VaultMeta>(&content) {
                return meta;
            }
        }
        VaultMeta {
            active_profile_id: None,
            profiles: Vec::new(),
        }
    }

    fn write_meta(vault_dir: &Path, meta: &VaultMeta) {
        let meta_file = Self::get_meta_file(vault_dir);
        if let Ok(json) = serde_json::to_string_pretty(meta) {
            let _ = fs::write(meta_file, json);
        }
    }

    /// Lists all cached profiles in the vault for this game
    pub fn list_profiles(library_path: &str, appid: u32) -> Vec<VaultProfile> {
        let vault_dir = Self::get_vault_dir(library_path, appid);
        let meta = Self::read_meta(&vault_dir);
        let mut profiles = meta.profiles;
        for p in &mut profiles {
            p.is_active = meta.active_profile_id.as_deref() == Some(&p.id);
        }
        profiles.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        profiles
    }

    /// Snapshots the currently installed game folder into the vault
    pub fn snapshot_current_build(
        library_path: &str,
        appid: u32,
        game_path: &str,
        version_name: &str,
        build_id: &str,
        depot_id: &str,
        manifest_id: &str,
    ) -> Result<VaultProfile, String> {
        let vault_dir = Self::get_vault_dir(library_path, appid);
        let game_dir = Path::new(game_path);
        if !game_dir.exists() {
            return Err(format!("Game directory not found at: {game_path}"));
        }

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let clean_version = version_name
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>();
        let profile_id = format!("{clean_version}_{build_id}_{now}");
        let target_vault_path = vault_dir.join(&profile_id);
        let files_dir = target_vault_path.join("files");
        fs::create_dir_all(&files_dir).map_err(|e| format!("Failed to create vault dir: {e}"))?;

        // Fast link or copy game files into vault
        let (_count, total_bytes) = Self::sync_directory(game_dir, &files_dir, true)?;

        let profile = VaultProfile {
            id: profile_id.clone(),
            appid,
            version_name: version_name.to_string(),
            build_id: build_id.to_string(),
            depot_id: depot_id.to_string(),
            manifest_id: manifest_id.to_string(),
            vault_path: files_dir.to_string_lossy().to_string(),
            is_active: true,
            created_at: now,
            size_bytes: total_bytes,
        };

        let mut meta = Self::read_meta(&vault_dir);
        meta.profiles.retain(|p| p.id != profile_id);
        meta.profiles.push(profile.clone());
        meta.active_profile_id = Some(profile_id);
        Self::write_meta(&vault_dir, &meta);

        Ok(profile)
    }

    /// Imports a downloaded depot folder (from Steam content or DepotDownloader) into the vault
    pub fn import_downloaded_to_vault(
        library_path: &str,
        content_dir_path: &str,
        appid: u32,
        version_name: &str,
        build_id: &str,
        depot_id: &str,
        manifest_id: &str,
    ) -> Result<VaultProfile, String> {
        let vault_dir = Self::get_vault_dir(library_path, appid);
        let content_dir = Path::new(content_dir_path);
        if !content_dir.exists() {
            return Err(format!("Downloaded content directory not found at: {content_dir_path}"));
        }

        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let clean_version = version_name
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '_' })
            .collect::<String>();
        let profile_id = format!("{clean_version}_{build_id}_{now}");
        let target_vault_path = vault_dir.join(&profile_id);
        let files_dir = target_vault_path.join("files");
        fs::create_dir_all(&files_dir).map_err(|e| format!("Failed to create vault dir: {e}"))?;

        // Copy/link downloaded files into vault files dir
        let (_count, total_bytes) = Self::sync_directory(content_dir, &files_dir, true)?;

        let profile = VaultProfile {
            id: profile_id.clone(),
            appid,
            version_name: version_name.to_string(),
            build_id: build_id.to_string(),
            depot_id: depot_id.to_string(),
            manifest_id: manifest_id.to_string(),
            vault_path: files_dir.to_string_lossy().to_string(),
            is_active: false,
            created_at: now,
            size_bytes: total_bytes,
        };

        let mut meta = Self::read_meta(&vault_dir);
        meta.profiles.retain(|p| p.id != profile_id);
        meta.profiles.push(profile.clone());
        Self::write_meta(&vault_dir, &meta);

        Ok(profile)
    }

    /// Instantly switches the active game installation to the target vault profile
    pub fn switch_profile(
        library_path: &str,
        appid: u32,
        game_path: &str,
        target_profile_id: &str,
    ) -> Result<VaultProfile, String> {
        let vault_dir = Self::get_vault_dir(library_path, appid);
        let mut meta = Self::read_meta(&vault_dir);

        let target_profile = meta
            .profiles
            .iter()
            .find(|p| p.id == target_profile_id)
            .cloned()
            .ok_or_else(|| format!("Target profile {target_profile_id} not found in vault"))?;

        let game_dir = Path::new(game_path);
        let vault_files_dir = Path::new(&target_profile.vault_path);

        if !vault_files_dir.exists() {
            return Err(format!("Vault files not found at: {}", vault_files_dir.display()));
        }

        // 1. Clean existing game directory contents to prevent version/dll pollution,
        // then fast hardlink/copy sync: sync vault files into game directory.
        // Using hardlinks on the same filesystem takes ~100ms and 0 extra disk space.
        if game_dir.exists() {
            if let Ok(entries) = fs::read_dir(game_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        let _ = fs::remove_file(&path);
                    } else if path.is_dir() {
                        let _ = fs::remove_dir_all(&path);
                    }
                }
            }
        }
        let _ = fs::create_dir_all(game_dir);
        Self::sync_directory(vault_files_dir, game_dir, true)?;

        // 2. Update appmanifest_<appid>.acf so Steam recognizes this build ID and stops auto-updating
        let steamapps_dir = if Path::new(library_path).ends_with("steamapps") {
            PathBuf::from(library_path)
        } else {
            Path::new(library_path).join("steamapps")
        };
        let manifest_path = steamapps_dir.join(format!("appmanifest_{appid}.acf"));
        Self::update_appmanifest(
            &manifest_path,
            &target_profile.build_id,
            &target_profile.depot_id,
            &target_profile.manifest_id,
        )?;

        // 3. Update active profile in metadata
        meta.active_profile_id = Some(target_profile_id.to_string());
        Self::write_meta(&vault_dir, &meta);

        let mut updated = target_profile;
        updated.is_active = true;
        Ok(updated)
    }

    /// Deletes a profile from the vault
    pub fn delete_profile(library_path: &str, appid: u32, profile_id: &str) -> Result<(), String> {
        let vault_dir = Self::get_vault_dir(library_path, appid);
        let mut meta = Self::read_meta(&vault_dir);

        let profile_dir = vault_dir.join(profile_id);
        if profile_dir.exists() {
            let _ = fs::remove_dir_all(&profile_dir);
        }

        meta.profiles.retain(|p| p.id != profile_id);
        if meta.active_profile_id.as_deref() == Some(profile_id) {
            meta.active_profile_id = None;
        }
        Self::write_meta(&vault_dir, &meta);
        Ok(())
    }

    /// Updates appmanifest_<appid>.acf with buildid, manifest, and AutoUpdateBehavior = 1
    fn update_appmanifest(
        manifest_path: &Path,
        new_build_id: &str,
        depot_id: &str,
        new_manifest_id: &str,
    ) -> Result<(), String> {
        if !manifest_path.exists() {
            return Ok(());
        }

        let content = fs::read_to_string(manifest_path).map_err(|e| e.to_string())?;

        let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        let mut in_installed_depots = false;
        let mut in_target_depot = false;
        let mut auto_update_found = false;
        let mut insert_auto_update_idx = None;

        for (idx, line) in lines.iter_mut().enumerate() {
            let trimmed = line.trim().to_string();

            if trimmed.starts_with("\"buildid\"") {
                *line = format!("\t\"buildid\"\t\t\"{new_build_id}\"");
                if insert_auto_update_idx.is_none() {
                    insert_auto_update_idx = Some(idx + 1);
                }
            } else if trimmed.starts_with("\"AutoUpdateBehavior\"") {
                // Set to 1: Only update when launched
                *line = "\t\"AutoUpdateBehavior\"\t\t\"1\"".to_string();
                auto_update_found = true;
            }

            if trimmed == "\"InstalledDepots\"" || trimmed == "\"MountedDepots\"" {
                in_installed_depots = true;
            }

            if in_installed_depots {
                if trimmed.starts_with(&format!("\"{depot_id}\"")) {
                    in_target_depot = true;
                } else if in_target_depot {
                    if trimmed.starts_with("\"manifest\"") {
                        *line = format!("\t\t\t\"manifest\"\t\t\"{new_manifest_id}\"");
                        in_target_depot = false;
                    } else if trimmed == "}" {
                        in_target_depot = false;
                    }
                }
            }
        }

        // If AutoUpdateBehavior wasn't in the ACF, insert it right after buildid
        if !auto_update_found {
            if let Some(idx) = insert_auto_update_idx {
                lines.insert(idx, "\t\"AutoUpdateBehavior\"\t\t\"1\"".to_string());
            }
        }

        let new_content = lines.join("\n");
        fs::write(manifest_path, new_content).map_err(|e| format!("Failed to update appmanifest: {e}"))?;
        Ok(())
    }

    /// Fast recursive directory sync using hardlinks whenever possible
    fn sync_directory(src: &Path, dest: &Path, try_hardlinks: bool) -> Result<(usize, u64), String> {
        let mut count = 0;
        let mut total_bytes = 0;

        if src.is_file() {
            if let Some(parent) = dest.parent() {
                let _ = fs::create_dir_all(parent);
            }
            if dest.exists() {
                let _ = fs::remove_file(dest);
            }
            let bytes = if try_hardlinks {
                match fs::hard_link(src, dest) {
                    Ok(_) => src.metadata().map(|m| m.len()).unwrap_or(0),
                    Err(_) => fs::copy(src, dest).map_err(|e| format!("Copy failed: {e}"))?,
                }
            } else {
                fs::copy(src, dest).map_err(|e| format!("Copy failed: {e}"))?
            };
            return Ok((1, bytes));
        }

        if src.is_dir() {
            let _ = fs::create_dir_all(dest);
            let entries = fs::read_dir(src).map_err(|e| format!("Failed to read dir {}: {e}", src.display()))?;
            for entry in entries.flatten() {
                let child_src = entry.path();
                let child_dest = dest.join(entry.file_name());
                let (c, b) = Self::sync_directory(&child_src, &child_dest, try_hardlinks)?;
                count += c;
                total_bytes += b;
            }
        }

        Ok((count, total_bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_appmanifest() {
        let temp_dir = std::env::temp_dir().join("steam_vault_test_manifest");
        let _ = fs::create_dir_all(&temp_dir);
        let manifest_path = temp_dir.join("appmanifest_489830.acf");

        let sample_acf = r#""AppState"
{
	"appid"		"489830"
	"Universe"		"1"
	"name"		"Skyrim Special Edition"
	"buildid"		"9544384"
	"InstalledDepots"
	{
		"489831"
		{
			"manifest"		"8475928374928"
			"size"		"123456"
		}
	}
}"#;
        fs::write(&manifest_path, sample_acf).unwrap();

        VaultManager::update_appmanifest(&manifest_path, "324125", "489831", "999988887777").unwrap();

        let updated_content = fs::read_to_string(&manifest_path).unwrap();
        assert!(updated_content.contains("\"buildid\"\t\t\"324125\""));
        assert!(updated_content.contains("\"AutoUpdateBehavior\"\t\t\"1\""));
        assert!(updated_content.contains("\"manifest\"\t\t\"999988887777\""));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_vault_snapshot_and_switch() {
        let temp_dir = std::env::temp_dir().join("steam_vault_test_flow");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let lib_path = temp_dir.join("SteamLibrary");
        let steamapps = lib_path.join("steamapps");
        let game_dir = steamapps.join("common").join("TestGame");
        let _ = fs::create_dir_all(&game_dir);

        // Create initial game file (v1)
        let game_file = game_dir.join("game.txt");
        fs::write(&game_file, "version 1").unwrap();

        // Create manifest
        let manifest_path = steamapps.join("appmanifest_12345.acf");
        fs::write(
            &manifest_path,
            "\"AppState\"\n{\n\t\"appid\"\t\t\"12345\"\n\t\"buildid\"\t\t\"100\"\n}",
        )
        .unwrap();

        // Snapshot v1
        let v1_profile = VaultManager::snapshot_current_build(
            &lib_path.to_string_lossy(),
            12345,
            &game_dir.to_string_lossy(),
            "Version 1.0",
            "100",
            "12346",
            "manifest_v1",
        )
        .unwrap();

        assert_eq!(v1_profile.version_name, "Version 1.0");

        // Now modify game to v2 (simulating an update/file replacement by unlinking first)
        let _ = fs::remove_file(&game_file);
        fs::write(&game_file, "version 2").unwrap();

        // Snapshot v2
        let v2_profile = VaultManager::snapshot_current_build(
            &lib_path.to_string_lossy(),
            12345,
            &game_dir.to_string_lossy(),
            "Version 2.0",
            "200",
            "12346",
            "manifest_v2",
        )
        .unwrap();

        assert_eq!(v2_profile.version_name, "Version 2.0");

        // Verify profiles listed
        let profiles = VaultManager::list_profiles(&lib_path.to_string_lossy(), 12345);
        assert_eq!(profiles.len(), 2);

        // Switch back to v1
        let switched = VaultManager::switch_profile(
            &lib_path.to_string_lossy(),
            12345,
            &game_dir.to_string_lossy(),
            &v1_profile.id,
        )
        .unwrap();

        assert_eq!(switched.version_name, "Version 1.0");
        assert_eq!(fs::read_to_string(&game_file).unwrap(), "version 1");

        // Verify manifest updated
        let manifest_content = fs::read_to_string(&manifest_path).unwrap();
        assert!(manifest_content.contains("\"buildid\"\t\t\"100\""));
        assert!(manifest_content.contains("\"AutoUpdateBehavior\"\t\t\"1\""));

        let _ = fs::remove_dir_all(&temp_dir);
    }
}
