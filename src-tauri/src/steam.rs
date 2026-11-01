use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use crate::vdf::{VdfParser, VdfValue};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    pub appid: u32,
    pub name: String,
    pub install_dir: String,
    pub full_path: String,
    pub library_path: String,
    pub size_on_disk: u64,
    pub build_id: String,
    pub last_updated: u64,
    pub mounted_depots: HashMap<String, String>,
    pub cover_image: String,
    pub header_image: String,
    pub hero_image: String,
    pub steamdb_url: String,
    pub is_installed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamLibrary {
    pub path: String,
    pub label: String,
    pub total_games: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub libraries: Vec<SteamLibrary>,
    pub games: Vec<SteamGame>,
    pub steam_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamPatchNote {
    pub gid: String,
    pub title: String,
    pub url: String,
    pub date: u64,
    pub version_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAppMetadata {
    pub appid: u32,
    pub name: String,
    pub header_image: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AppInfoEntry {
    pub name: String,
    pub app_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildVersion {
    pub id: String,
    pub version_name: String,
    pub manifest_id: String,
    pub build_id: Option<String>,
    pub release_date: Option<String>,
    pub description: Option<String>,
    pub is_canonical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_steam_library: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryListing {
    pub current_path: String,
    pub parent_path: Option<String>,
    pub items: Vec<DirectoryItem>,
    pub drives: Vec<DirectoryItem>,
}

pub struct SteamManager;

impl SteamManager {
    /// Extracts a version number like "1.5.97", "v2.12", or "1.63" from patch title
    pub fn extract_version_from_title(title: &str) -> Option<String> {
        for word in title.split(|c: char| c.is_whitespace() || c == '(' || c == ')' || c == '[' || c == ']' || c == '—' || c == '-') {
            let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.');
            let lower = cleaned.to_lowercase();
            let num_part = lower.strip_prefix('v').unwrap_or(&lower);
            let dot_count = num_part.chars().filter(|&c| c == '.').count();
            if dot_count >= 1 && num_part.chars().any(|c| c.is_ascii_digit()) {
                // Ensure it's not a URL or date like "2024.08"
                if !num_part.contains("http") && num_part.len() <= 12 {
                    return Some(cleaned.to_string());
                }
            }
        }
        None
    }

    /// Checks whether the text script matches the specified language code
    pub fn matches_language_script(text: &str, lang: &str) -> bool {
        if lang == "all" {
            return true;
        }

        let has_cyrillic = text.chars().any(|c| ('\u{0400}'..='\u{04FF}').contains(&c));
        let has_cjk = text.chars().any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c) || ('\u{3400}'..='\u{4DBF}').contains(&c));
        let has_hangul = text.chars().any(|c| ('\u{AC00}'..='\u{D7AF}').contains(&c));
        let has_arabic = text.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c));

        match lang {
            "ru" | "uk" | "be" | "bg" => has_cyrillic,
            "zh" => has_cjk,
            "ja" => {
                let has_kana = text.chars().any(|c| ('\u{3040}'..='\u{309F}').contains(&c) || ('\u{30A0}'..='\u{30FF}').contains(&c));
                has_kana || has_cjk
            }
            "ko" => has_hangul,
            "ar" => has_arabic,
            // For English (en) and all Latin-based languages (de, fr, es, it, pt, nl, pl, etc.)
            _ => !has_cyrillic && !has_cjk && !has_hangul && !has_arabic,
        }
    }

    /// Fetches official Steam patch notes / announcements for the app
    pub fn fetch_patch_notes(appid: u32, preferred_lang: Option<&str>) -> Result<Vec<SteamPatchNote>, String> {
        let url = format!(
            "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid={appid}&count=100&maxlength=200&feeds=steam_community_announcements"
        );

        let output = std::process::Command::new("curl")
            .args(["-s", "--connect-timeout", "6", &url])
            .output()
            .map_err(|e| format!("Failed to execute curl: {e}"))?;

        if !output.status.success() {
            return Err("Curl request to Steam News API failed".to_string());
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse Steam news JSON: {e}"))?;

        let lang_code = preferred_lang
            .unwrap_or("en")
            .split('-')
            .next()
            .unwrap_or("en")
            .to_lowercase();

        let mut notes = Vec::new();
        if let Some(items) = parsed.get("appnews").and_then(|a| a.get("newsitems")).and_then(|n| n.as_array()) {
            for item in items {
                let feedname = item.get("feedname").and_then(|f| f.as_str()).unwrap_or("");
                // Strictly filter to official Steam Community Announcements posted by developers
                if feedname != "steam_community_announcements" {
                    continue;
                }

                let gid = item.get("gid").and_then(|g| g.as_str()).unwrap_or("").to_string();
                let title = item.get("title").and_then(|t| t.as_str()).unwrap_or("").to_string();
                let url = item.get("url").and_then(|u| u.as_str()).unwrap_or("").to_string();
                let date = item.get("date").and_then(|d| d.as_u64()).unwrap_or(0);

                let version_tag = Self::extract_version_from_title(&title);

                notes.push(SteamPatchNote {
                    gid,
                    title,
                    url,
                    date,
                    version_tag,
                });
            }
        }

        // Prioritize notes matching the user's language script
        notes.sort_by_key(|n| {
            if Self::matches_language_script(&n.title, &lang_code) {
                0
            } else {
                1
            }
        });

        Ok(notes)
    }

    /// Resolves official Steam store title and dynamic header artwork for an AppID
    pub fn resolve_steam_app_metadata(appid: u32) -> Option<SteamAppMetadata> {
        // 1. Check local appinfo.vdf cache first if Steam is installed
        if let Some(sp) = Self::find_active_steam_path() {
            let local_info = Self::read_local_appinfo(&sp);
            if let Some(entry) = local_info.get(&appid) {
                return Some(SteamAppMetadata {
                    appid,
                    name: entry.name.clone(),
                    header_image: Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg")),
                });
            }
        }

        // 2. Query Steam store API with fast timeout
        let url = format!("https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic");
        let output = std::process::Command::new("curl")
            .args([
                "-s",
                "--connect-timeout",
                "2",
                "-m",
                "4",
                "-A",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                &url,
            ])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&json_str).ok()?;
        let app_obj = parsed.get(appid.to_string())?;
        if app_obj.get("success")?.as_bool()? {
            let data = app_obj.get("data")?;
            let name = data.get("name")?.as_str()?.to_string();
            let header_image = data.get("header_image").and_then(|h| h.as_str()).map(|s| s.to_string());
            return Some(SteamAppMetadata {
                appid,
                name,
                header_image,
            });
        }
        None
    }

    /// Resolves metadata for multiple Steam AppIDs concurrently without blocking the main event loop
    pub fn resolve_multiple_steam_apps(appids: Vec<u32>) -> Vec<SteamAppMetadata> {
        let mut results = Vec::new();
        let mut remaining = Vec::new();

        // 1. Resolve immediately from local appinfo.vdf cache (instant offline)
        if let Some(sp) = Self::find_active_steam_path() {
            let local_info = Self::read_local_appinfo(&sp);
            for appid in appids {
                if let Some(entry) = local_info.get(&appid) {
                    results.push(SteamAppMetadata {
                        appid,
                        name: entry.name.clone(),
                        header_image: Some(format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg")),
                    });
                } else {
                    remaining.push(appid);
                }
            }
        } else {
            remaining = appids;
        }

        // 2. Fetch any remaining unknown apps concurrently in background threads
        if !remaining.is_empty() {
            use std::sync::{Arc, Mutex};
            use std::thread;

            let shared_results = Arc::new(Mutex::new(results));
            let mut handles = Vec::new();

            for chunk in remaining.chunks(4) {
                let chunk_vec = chunk.to_vec();
                let res_ref = Arc::clone(&shared_results);
                let handle = thread::spawn(move || {
                    for aid in chunk_vec {
                        if let Some(meta) = Self::resolve_steam_app_metadata(aid) {
                            if let Ok(mut lock) = res_ref.lock() {
                                lock.push(meta);
                            }
                        }
                    }
                });
                handles.push(handle);
            }

            for handle in handles {
                let _ = handle.join();
            }

            if let Ok(lock) = shared_results.lock() {
                return lock.clone();
            }
            return Vec::new();
        }

        results
    }

    /// Fetches online manifest history from SteamCMD and SteamDB for the given depot
    pub fn fetch_depot_manifests(appid: u32, depot_id: &str) -> Result<Vec<BuildVersion>, String> {
        let mut versions = Vec::new();
        let mut seen = std::collections::HashSet::new();

        // 1. Query public SteamCMD info API: https://api.steamcmd.net/v1/info/{appid}
        let steamcmd_url = format!("https://api.steamcmd.net/v1/info/{appid}");
        if let Ok(output) = std::process::Command::new("curl")
            .args(["-s", "--connect-timeout", "6", &steamcmd_url])
            .output()
        {
            if output.status.success() {
                let json_str = String::from_utf8_lossy(&output.stdout);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if let Some(app_data) = val.get("data").and_then(|d| d.get(appid.to_string())) {
                        let global_build_id = app_data
                            .get("depots")
                            .and_then(|d| d.get("branches"))
                            .and_then(|b| b.get("public"))
                            .and_then(|p| p.get("buildid"))
                            .and_then(|b| b.as_str())
                            .map(|s| s.to_string());

                        // Check branches in depots
                        if let Some(depots) = app_data.get("depots").and_then(|d| d.as_object()) {
                            if let Some(depot_obj) = depots.get(depot_id) {
                                if let Some(manifests) = depot_obj.get("manifests").and_then(|m| m.as_object()) {
                                    for (branch_name, m_info) in manifests {
                                        if let Some(gid) = m_info.get("gid").and_then(|g| g.as_str()) {
                                            if !gid.is_empty() && seen.insert(gid.to_string()) {
                                                let size_mb = m_info
                                                    .get("size")
                                                    .and_then(|s| s.as_str())
                                                    .and_then(|s| s.parse::<u64>().ok())
                                                    .map(|b| format!(" (~{:.1} GB)", b as f64 / 1_073_741_824.0))
                                                    .unwrap_or_default();

                                                versions.push(BuildVersion {
                                                    id: format!("steamcmd_{gid}"),
                                                    version_name: format!("Steam Branch: {branch_name}{size_mb}"),
                                                    manifest_id: gid.to_string(),
                                                    build_id: global_build_id.clone(),
                                                    release_date: None,
                                                    description: Some(format!("Synced from Steam network metadata for depot {depot_id}")),
                                                    is_canonical: true,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Query SteamDB manifests page directly: https://steamdb.info/depot/{depot_id}/manifests/
        let steamdb_url = format!("https://steamdb.info/depot/{depot_id}/manifests/");
        if let Ok(output) = std::process::Command::new("curl")
            .args([
                "-s",
                "-L",
                "--connect-timeout",
                "6",
                "-A",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "-H",
                "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                &steamdb_url,
            ])
            .output()
        {
            if output.status.success() {
                let html = String::from_utf8_lossy(&output.stdout);
                if !html.contains("Checking your browser") && !html.contains("cf-error") {
                    // Extract manifest IDs from HTML links
                    for line in html.lines() {
                        let trimmed = line.trim();
                        if let Some(pos) = trimmed.find("/manifest/") {
                            let rest = &trimmed[pos + "/manifest/".len()..];
                            let manifest_id: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                            if manifest_id.len() >= 16 && seen.insert(manifest_id.clone()) {
                                versions.push(BuildVersion {
                                    id: format!("steamdb_{manifest_id}"),
                                    version_name: format!("SteamDB Manifest {}", &manifest_id[..manifest_id.len().min(10)]),
                                    manifest_id,
                                    build_id: None,
                                    release_date: None,
                                    description: Some("Scraped from SteamDB depot manifests".to_string()),
                                    is_canonical: false,
                                });
                            }
                        }
                    }
                }
            }
        }

        // 3. Scan local steamapps/depotcache for any manifests already on disk (Instant)
        for local_ver in Self::scan_local_depotcache(depot_id) {
            if seen.insert(local_ver.manifest_id.clone()) {
                versions.push(local_ver);
            }
        }

        // 4. Scan Steam's content_log.txt for historical manifest entries (Instant)
        for log_ver in Self::scan_steam_content_logs(appid, depot_id) {
            if seen.insert(log_ver.manifest_id.clone()) {
                versions.push(log_ver);
            }
        }

        Ok(versions)
    }

    /// Scans Steam logs/content_log.txt for any recorded manifest changes for this depot
    pub fn scan_steam_content_logs(appid: u32, depot_id: &str) -> Vec<BuildVersion> {
        let mut results = Vec::new();
        let mut seen = std::collections::HashSet::new();

        let appid_str = appid.to_string();
        for candidate in Self::get_candidate_paths() {
            let log_files = [
                candidate.join("logs").join("content_log.txt"),
                candidate.join("logs").join("content_log.previous.txt"),
            ];

            for log_file in log_files {
                if let Ok(content) = fs::read_to_string(&log_file) {
                    for line in content.lines() {
                        if line.contains(&appid_str) || line.contains(depot_id) {
                            // Extract date if present e.g. [2024-04-24 18:32:11]
                            let date_part = if line.starts_with('[') {
                                line.find(']').map(|end| line[1..end].to_string())
                            } else {
                                None
                            };

                            // Look for 16-20 digit manifest numbers
                            for word in line.split(|c: char| !c.is_ascii_digit()) {
                                if word.len() >= 16 && word.len() <= 20 {
                                    if seen.insert(word.to_string()) {
                                        results.push(BuildVersion {
                                            id: format!("log_{word}"),
                                            version_name: format!("Historical Log ({})", &word[..word.len().min(10)]),
                                            manifest_id: word.to_string(),
                                            build_id: None,
                                            release_date: date_part.clone(),
                                            description: Some("Discovered in Steam content_log.txt on your disk".to_string()),
                                            is_canonical: false,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        results
    }

    /// Scans local steamapps/depotcache folders for any existing downloaded .manifest files for this depot
    pub fn scan_local_depotcache(depot_id: &str) -> Vec<BuildVersion> {
        let mut results = Vec::new();
        let mut seen = std::collections::HashSet::new();

        let prefix = format!("{depot_id}_");
        for candidate in Self::get_candidate_paths() {
            let depotcache = candidate.join("steamapps").join("depotcache");
            if let Ok(entries) = fs::read_dir(&depotcache) {
                for entry in entries.flatten() {
                    let fname = entry.file_name().to_string_lossy().to_string();
                    if fname.starts_with(&prefix) && fname.ends_with(".manifest") {
                        let manifest_id = &fname[prefix.len()..fname.len() - ".manifest".len()];
                        if manifest_id.chars().all(|c| c.is_ascii_digit()) && seen.insert(manifest_id.to_string()) {
                            let mtime = entry.metadata().ok().and_then(|m| m.modified().ok());
                            let date_str = mtime.and_then(|t| {
                                t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                                    let secs = d.as_secs();
                                    format!("Local File ({secs})")
                                })
                            });

                            results.push(BuildVersion {
                                id: format!("local_{manifest_id}"),
                                version_name: format!("Local Manifest ({})", &manifest_id[..manifest_id.len().min(10)]),
                                manifest_id: manifest_id.to_string(),
                                build_id: None,
                                release_date: date_str,
                                description: Some(format!("Discovered in local Steam depotcache at {}", entry.path().display())),
                                is_canonical: false,
                            });
                        }
                    }
                }
            }
        }

        results
    }

    #[allow(dead_code)]
    pub fn windows_path_to_wsl(win_path: &str) -> Option<PathBuf> {
        let chars: Vec<char> = win_path.chars().collect();
        if chars.len() >= 2 && chars[1] == ':' {
            let drive = chars[0].to_ascii_lowercase();
            let slice_start = if chars.len() > 2 && (chars[2] == '\\' || chars[2] == '/') {
                3
            } else {
                2
            };
            let rest = win_path[slice_start..].replace('\\', "/");
            let candidate1 = PathBuf::from(format!("/mnt/{drive}/{rest}"));
            if candidate1.exists() {
                return Some(candidate1);
            }
            let candidate2 = PathBuf::from(format!("/mnt/{}/{}", drive.to_ascii_uppercase(), rest));
            if candidate2.exists() {
                return Some(candidate2);
            }
            // Return candidate1 as best effort even if not currently checked
            return Some(candidate1);
        }
        None
    }

    /// Computes a friendly, readable drive name for the UI dropdown
    pub fn compute_drive_label(path: &Path, vdf_label: Option<&str>) -> String {
        let path_str = path.to_string_lossy();

        let custom_tag = vdf_label
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| format!(" [{s}]"))
            .unwrap_or_default();

        // 1. Windows drive format: "C:\..." or "D:\SteamLibrary"
        let chars: Vec<char> = path_str.chars().collect();
        if chars.len() >= 2 && chars[1] == ':' {
            let drive = chars[0].to_ascii_uppercase();
            let folder = path.file_name().and_then(|n| n.to_str()).unwrap_or("Steam");
            return format!("Drive {drive}:{custom_tag} ({folder})");
        }

        // 2. WSL drive format: "/mnt/c/..." or "/mnt/d/..."
        if path_str.starts_with("/mnt/") {
            let after_mnt = &path_str["/mnt/".len()..];
            let parts: Vec<&str> = after_mnt.split('/').collect();
            if !parts.is_empty() && parts[0].len() == 1 {
                let drive = parts[0].to_ascii_uppercase();
                let folder = path.file_name().and_then(|n| n.to_str()).unwrap_or("Steam");
                return format!("Drive {drive}:{custom_tag} ({folder})");
            }
        }

        // 3. Linux /media/ or /run/media/ mounted drives
        if path_str.starts_with("/media/") || path_str.starts_with("/run/media/") {
            let components: Vec<&str> = path_str.split('/').filter(|s| !s.is_empty()).collect();
            if components.len() >= 3 {
                let drive_name = components[2];
                let folder = path.file_name().and_then(|n| n.to_str()).unwrap_or("Steam");
                return format!("Drive {drive_name}{custom_tag} ({folder})");
            }
        }

        // 4. Linux Home directory: "/home/username/..."
        if path_str.starts_with("/home/") {
            let folder = path.file_name().and_then(|n| n.to_str()).unwrap_or("Steam");
            return format!("Drive Home{custom_tag} ({folder})");
        }

        // Fallback
        let folder = path.file_name().and_then(|n| n.to_str()).unwrap_or("Library");
        format!("Drive {folder}{custom_tag}")
    }

    /// Fast-path primary Steam paths checked first (< 1ms)
    pub fn get_primary_steam_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(target_os = "windows")]
        {
            if let Ok(prog_files) = std::env::var("ProgramFiles(x86)") {
                paths.push(PathBuf::from(prog_files).join("Steam"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                paths.push(PathBuf::from(prog_files).join("Steam"));
            }
            paths.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));
            paths.push(PathBuf::from("C:\\Program Files\\Steam"));
            paths.push(PathBuf::from("C:\\Steam"));
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let home_path = PathBuf::from(home);
                paths.push(home_path.join(".steam/steam"));
                paths.push(home_path.join(".local/share/Steam"));
                paths.push(home_path.join(".steam/root"));
                paths.push(home_path.join(".var/app/com.valvesoftware.Steam/data/Steam"));
            }
            // WSL fast path
            paths.push(PathBuf::from("/mnt/c/Program Files (x86)/Steam"));
            paths.push(PathBuf::from("/mnt/c/Program Files/Steam"));
            paths.push(PathBuf::from("/mnt/c/Steam"));
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = std::env::var("HOME") {
                paths.push(PathBuf::from(home).join("Library/Application Support/Steam"));
            }
        }

        paths
    }

    /// Finds potential Steam roots and library paths across all drives (fallback search)
    pub fn get_candidate_paths() -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        // --- WINDOWS DRIVE LETTERS ---
        #[cfg(target_os = "windows")]
        {
            if let Ok(prog_files) = std::env::var("ProgramFiles(x86)") {
                candidates.push(PathBuf::from(prog_files).join("Steam"));
            }
            if let Ok(prog_files) = std::env::var("ProgramFiles") {
                candidates.push(PathBuf::from(prog_files).join("Steam"));
            }

            // Check drive letters C through Z
            for letter in b'C'..=b'Z' {
                let drive = format!("{}:\\", letter as char);
                let p = PathBuf::from(&drive);
                if p.exists() {
                    candidates.push(p.join("Program Files (x86)\\Steam"));
                    candidates.push(p.join("Program Files\\Steam"));
                    candidates.push(p.join("Steam"));
                    candidates.push(p.join("SteamLibrary"));
                    candidates.push(p.join("Games\\Steam"));
                    candidates.push(p.join("Games\\SteamLibrary"));
                    candidates.push(p.join("SteamGames"));
                }
            }
        }

        // --- LINUX & WSL ---
        #[cfg(target_os = "linux")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let home_path = PathBuf::from(home);
                candidates.push(home_path.join(".steam/steam"));
                candidates.push(home_path.join(".steam/root"));
                candidates.push(home_path.join(".local/share/Steam"));
                candidates.push(home_path.join(".var/app/com.valvesoftware.Steam/data/Steam"));
                candidates.push(home_path.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"));
                candidates.push(home_path.join("snap/steam/common/.local/share/Steam"));
                candidates.push(home_path.join("SteamLibrary"));
                candidates.push(home_path.join("Games/SteamLibrary"));
            }

            // Scan WSL drives mounted under /mnt/
            for letter in b'a'..=b'z' {
                let drive_str = format!("/mnt/{}", letter as char);
                let drive_path = PathBuf::from(&drive_str);
                if drive_path.exists() {
                    candidates.push(drive_path.join("Program Files (x86)/Steam"));
                    candidates.push(drive_path.join("Program Files/Steam"));
                    candidates.push(drive_path.join("Steam"));
                    candidates.push(drive_path.join("SteamLibrary"));
                    candidates.push(drive_path.join("Games/Steam"));
                    candidates.push(drive_path.join("Games/SteamLibrary"));
                    candidates.push(drive_path.join("SteamGames"));
                }
            }

            // Scan Linux /media and /run/media mounts
            for base_dir in &["/media", "/run/media", "/mnt"] {
                if let Ok(users) = fs::read_dir(base_dir) {
                    for user in users.flatten() {
                        let user_path = user.path();
                        if user_path.is_dir() {
                            candidates.push(user_path.join("SteamLibrary"));
                            candidates.push(user_path.join("Steam"));

                            if let Ok(drives) = fs::read_dir(&user_path) {
                                for drive in drives.flatten() {
                                    let dp = drive.path();
                                    if dp.is_dir() {
                                        candidates.push(dp.join("SteamLibrary"));
                                        candidates.push(dp.join("Steam"));
                                        candidates.push(dp.join("Games/SteamLibrary"));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- MACOS ---
        #[cfg(target_os = "macos")]
        {
            if let Ok(home) = std::env::var("HOME") {
                let home_path = PathBuf::from(home);
                candidates.push(home_path.join("Library/Application Support/Steam"));
                candidates.push(home_path.join("SteamLibrary"));
            }
            if let Ok(volumes) = fs::read_dir("/Volumes") {
                for vol in volumes.flatten() {
                    let vp = vol.path();
                    candidates.push(vp.join("SteamLibrary"));
                    candidates.push(vp.join("Steam"));
                }
            }
        }

        candidates
    }

    /// Finds the active main Steam installation path (checks primary paths first)
    pub fn find_active_steam_path() -> Option<PathBuf> {
        // 1. Try fast primary paths first (< 1ms)
        for path in Self::get_primary_steam_paths() {
            if path.exists() && (path.join("steamapps").exists() || path.join("config").exists()) {
                return Some(path);
            }
        }

        // 2. Fall back to deep candidate search across drives only if primary missed
        for path in Self::get_candidate_paths() {
            if path.exists() && (path.join("steamapps").exists() || path.join("config").exists()) {
                return Some(path);
            }
        }
        None
    }

    fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
        if needle.is_empty() || needle.len() > haystack.len() {
            return None;
        }
        haystack.windows(needle.len()).position(|window| window == needle)
    }

    /// Parses Steam's local binary appcache/appinfo.vdf to resolve game names offline in < 15ms
    pub fn parse_appinfo_data(data: &[u8]) -> HashMap<u32, AppInfoEntry> {
        let mut map = HashMap::new();
        if data.len() < 16 {
            return map;
        }

        let magic = u32::from_le_bytes([data[0], data[1], data[2], data[3]]);
        if magic != 0x07564427 && magic != 0x07564428 && magic != 0x07564429 {
            return map;
        }

        if magic >= 0x07564428 {
            let st_offset = u64::from_le_bytes([
                data[8], data[9], data[10], data[11],
                data[12], data[13], data[14], data[15],
            ]) as usize;

            if st_offset >= data.len() || st_offset < 16 {
                return map;
            }

            let st_slice = &data[st_offset..];
            if st_slice.len() < 4 {
                return map;
            }
            let num_strings = u32::from_le_bytes([st_slice[0], st_slice[1], st_slice[2], st_slice[3]]) as usize;

            let mut name_idx: Option<u32> = None;
            let mut type_idx: Option<u32> = None;
            let mut spos = 4;

            for i in 0..num_strings {
                if spos >= st_slice.len() {
                    break;
                }
                if let Some(null_rel) = st_slice[spos..].iter().position(|&b| b == 0) {
                    let null_pos = spos + null_rel;
                    if let Ok(s) = std::str::from_utf8(&st_slice[spos..null_pos]) {
                        if s == "name" && name_idx.is_none() {
                            name_idx = Some(i as u32);
                        } else if s == "type" && type_idx.is_none() {
                            type_idx = Some(i as u32);
                        }
                    }
                    spos = null_pos + 1;
                } else {
                    break;
                }
                if name_idx.is_some() && type_idx.is_some() {
                    break;
                }
            }

            let name_pattern = name_idx.map(|idx| {
                let mut p = Vec::with_capacity(5);
                p.push(1u8);
                p.extend_from_slice(&idx.to_le_bytes());
                p
            });

            let type_pattern = type_idx.map(|idx| {
                let mut p = Vec::with_capacity(5);
                p.push(1u8);
                p.extend_from_slice(&idx.to_le_bytes());
                p
            });

            let mut pos = 16;
            while pos + 8 < st_offset {
                let appid = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
                if appid == 0 {
                    break;
                }
                let size = u32::from_le_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]]) as usize;
                let entry_end = (pos + 8 + size).min(st_offset);
                if pos + 8 >= entry_end {
                    break;
                }
                let app_slice = &data[pos + 8..entry_end];

                let mut app_name: Option<String> = None;
                let mut app_type: Option<String> = None;

                if let Some(ref np) = name_pattern {
                    if let Some(idx) = Self::find_subslice(app_slice, np) {
                        let val_start = idx + np.len();
                        if let Some(end_rel) = app_slice[val_start..].iter().position(|&b| b == 0) {
                            let val_end = val_start + end_rel;
                            if let Ok(s) = std::str::from_utf8(&app_slice[val_start..val_end]) {
                                if !s.is_empty() {
                                    app_name = Some(s.to_string());
                                }
                            }
                        }
                    }
                }

                if let Some(ref tp) = type_pattern {
                    if let Some(idx) = Self::find_subslice(app_slice, tp) {
                        let val_start = idx + tp.len();
                        if let Some(end_rel) = app_slice[val_start..].iter().position(|&b| b == 0) {
                            let val_end = val_start + end_rel;
                            if let Ok(s) = std::str::from_utf8(&app_slice[val_start..val_end]) {
                                app_type = Some(s.to_string());
                            }
                        }
                    }
                }

                if let Some(name) = app_name {
                    map.insert(appid, AppInfoEntry {
                        name,
                        app_type: app_type.unwrap_or_else(|| "Game".to_string()),
                    });
                }

                pos = pos + 8 + size;
            }
        } else {
            let name_pattern = b"\x01name\x00";
            let type_pattern = b"\x01type\x00";
            let mut pos = 8;

            while pos + 8 < data.len() {
                let appid = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
                if appid == 0 {
                    break;
                }
                let size = u32::from_le_bytes([data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]]) as usize;
                let entry_end = (pos + 8 + size).min(data.len());
                if pos + 8 >= entry_end {
                    break;
                }
                let app_slice = &data[pos + 8..entry_end];

                let mut app_name: Option<String> = None;
                let mut app_type: Option<String> = None;

                if let Some(idx) = Self::find_subslice(app_slice, name_pattern) {
                    let val_start = idx + name_pattern.len();
                    if let Some(end_rel) = app_slice[val_start..].iter().position(|&b| b == 0) {
                        let val_end = val_start + end_rel;
                        if let Ok(s) = std::str::from_utf8(&app_slice[val_start..val_end]) {
                            if !s.is_empty() {
                                app_name = Some(s.to_string());
                            }
                        }
                    }
                }

                if let Some(idx) = Self::find_subslice(app_slice, type_pattern) {
                    let val_start = idx + type_pattern.len();
                    if let Some(end_rel) = app_slice[val_start..].iter().position(|&b| b == 0) {
                        let val_end = val_start + end_rel;
                        if let Ok(s) = std::str::from_utf8(&app_slice[val_start..val_end]) {
                            app_type = Some(s.to_string());
                        }
                    }
                }

                if let Some(name) = app_name {
                    map.insert(appid, AppInfoEntry {
                        name,
                        app_type: app_type.unwrap_or_else(|| "Game".to_string()),
                    });
                }

                pos = pos + 8 + size;
            }
        }

        map
    }

    /// Reads Steam's local appcache/appinfo.vdf
    pub fn read_local_appinfo(steam_path: &Path) -> HashMap<u32, AppInfoEntry> {
        let appinfo_path = steam_path.join("appcache").join("appinfo.vdf");
        if let Ok(data) = fs::read(&appinfo_path) {
            return Self::parse_appinfo_data(&data);
        }
        HashMap::new()
    }

    /// Parses libraryfolders.vdf and returns all library folders with their VDF labels
    pub fn get_library_folders(steam_path: &Path) -> Vec<(PathBuf, Option<String>)> {
        let mut libraries: Vec<(PathBuf, Option<String>)> = Vec::new();

        // Main steam path is library 0
        if steam_path.join("steamapps").exists() {
            libraries.push((steam_path.to_path_buf(), None));
        }

        let possible_vdf_locations = [
            steam_path.join("steamapps").join("libraryfolders.vdf"),
            steam_path.join("config").join("libraryfolders.vdf"),
        ];

        for vdf_path in &possible_vdf_locations {
            if !vdf_path.exists() {
                continue;
            }

            if let Ok(content) = fs::read_to_string(vdf_path) {
                let parsed = VdfParser::parse(&content);
                if let Some(folders_val) = parsed.get("libraryfolders").or_else(|| parsed.get("LibraryFolders")) {
                    if let VdfValue::Object(folders) = folders_val {
                        for (_k, v) in folders {
                            if let VdfValue::Object(folder_data) = v {
                                if let Some(path_val) = folder_data.get("path").or_else(|| folder_data.get("Path")) {
                                    if let VdfValue::String(raw_p) = path_val {
                                        let vdf_label = folder_data
                                            .get("label")
                                            .and_then(|l| match l {
                                                VdfValue::String(s) if !s.is_empty() => Some(s.clone()),
                                                _ => None,
                                            });

                                        #[allow(unused_mut)]
                                        let mut lib_buf = PathBuf::from(raw_p);

                                        // If running on Linux/WSL and the path is a Windows path (e.g. D:\SteamLibrary),
                                        // translate it to WSL path (/mnt/d/SteamLibrary)
                                        #[cfg(target_os = "linux")]
                                        {
                                            if !lib_buf.exists() {
                                                if let Some(wsl_path) = Self::windows_path_to_wsl(raw_p) {
                                                    if wsl_path.exists() {
                                                        lib_buf = wsl_path;
                                                    }
                                                }
                                            }
                                        }

                                        if lib_buf.exists() && !libraries.iter().any(|(p, _)| p == &lib_buf) {
                                            libraries.push((lib_buf, vdf_label));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        libraries
    }

    /// Scans a single library directory for game manifests
    pub fn scan_library_games(library_path: &Path) -> Vec<SteamGame> {
        let mut games = Vec::new();
        let steamapps_dir = if library_path.ends_with("steamapps") {
            library_path.to_path_buf()
        } else {
            library_path.join("steamapps")
        };

        if !steamapps_dir.exists() {
            return games;
        }

        let entries = match fs::read_dir(&steamapps_dir) {
            Ok(e) => e,
            Err(_) => return games,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with("appmanifest_") && file_name.ends_with(".acf") {
                    if let Some(game) = Self::parse_manifest_file(&path, library_path) {
                        // Skip Steamworks common redistributables and steam runtime tools
                        if game.appid != 228980 && game.appid != 1391110 {
                            games.push(game);
                        }
                    }
                }
            }
        }

        games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        games
    }

    /// Parses an appmanifest file extracting all metadata and depots (InstalledDepots & MountedDepots)
    pub fn parse_manifest_file(manifest_path: &Path, library_root: &Path) -> Option<SteamGame> {
        let content = fs::read_to_string(manifest_path).ok()?;
        let parsed = VdfParser::parse(&content);
        let app_state = parsed.get("AppState")?;

        let appid_str = app_state.get_str("appid")?;
        let appid: u32 = appid_str.parse().ok()?;
        let name = app_state.get_str("name").unwrap_or("Unknown Game").to_string();
        let install_dir = app_state.get_str("installdir").unwrap_or("").to_string();
        let size_on_disk: u64 = app_state
            .get_str("SizeOnDisk")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let build_id = app_state.get_str("buildid").unwrap_or("0").to_string();
        let last_updated: u64 = app_state
            .get_str("LastUpdated")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let mut mounted_depots: HashMap<String, String> = HashMap::new();

        // 1. Check InstalledDepots (Modern Steam client format where each depot is an object containing "manifest")
        if let Some(installed_map) = app_state.get_obj("InstalledDepots") {
            for (depot_id, val) in installed_map {
                match val {
                    VdfValue::Object(depot_obj) => {
                        let manifest = depot_obj
                            .get("manifest")
                            .or_else(|| depot_obj.get("Manifest"))
                            .and_then(|v| match v {
                                VdfValue::String(s) => Some(s.clone()),
                                _ => None,
                            })
                            .unwrap_or_default();
                        mounted_depots.insert(depot_id.clone(), manifest);
                    }
                    VdfValue::String(manifest) => {
                        mounted_depots.insert(depot_id.clone(), manifest.clone());
                    }
                }
            }
        }

        // 2. Check MountedDepots (Legacy or fallback format)
        if let Some(mounted_map) = app_state.get_obj("MountedDepots") {
            for (depot_id, val) in mounted_map {
                match val {
                    VdfValue::String(manifest) => {
                        mounted_depots.entry(depot_id.clone()).or_insert_with(|| manifest.clone());
                    }
                    VdfValue::Object(depot_obj) => {
                        let manifest = depot_obj
                            .get("manifest")
                            .or_else(|| depot_obj.get("Manifest"))
                            .and_then(|v| match v {
                                VdfValue::String(s) => Some(s.clone()),
                                _ => None,
                            })
                            .unwrap_or_default();
                        mounted_depots.entry(depot_id.clone()).or_insert(manifest);
                    }
                }
            }
        }

        // 3. Fallback: If no depots listed in manifest, use the game's AppID as the primary depot
        if mounted_depots.is_empty() {
            mounted_depots.insert(appid.to_string(), "installed".to_string());
        }

        let full_path = if library_root.ends_with("steamapps") {
            library_root.join("common").join(&install_dir)
        } else {
            library_root.join("steamapps").join("common").join(&install_dir)
        };

        // Steam CDN artwork
        let cover_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900.jpg");
        let header_image = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg");
        let hero_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_hero.jpg");
        let steamdb_url = format!("https://steamdb.info/app/{appid}/");

        Some(SteamGame {
            appid,
            name,
            install_dir,
            full_path: full_path.to_string_lossy().to_string(),
            library_path: library_root.to_string_lossy().to_string(),
            size_on_disk,
            build_id,
            last_updated,
            mounted_depots,
            cover_image,
            header_image,
            hero_image,
            steamdb_url,
            is_installed: true,
        })
    }

    /// Comprehensive scan across all drives, VDF libraries, and custom paths
    pub fn scan_all(custom_paths: &[String]) -> ScanResult {
        let mut all_games = Vec::new();
        let mut all_libraries = Vec::new();
        let mut library_paths_with_labels: Vec<(PathBuf, Option<String>)> = Vec::new();

        // 1. Search for active Steam path
        let steam_path = Self::find_active_steam_path();

        // 2. Discover libraries from Steam's libraryfolders.vdf
        if let Some(ref path) = steam_path {
            let found_libs = Self::get_library_folders(path);
            for (lib, label) in found_libs {
                if !library_paths_with_labels.iter().any(|(p, _)| p == &lib) {
                    library_paths_with_labels.push((lib, label));
                }
            }
        }

        // 3. Fallback: Only probe all candidate drives across the system if no libraries were found
        if library_paths_with_labels.is_empty() {
            for candidate in Self::get_candidate_paths() {
                if candidate.exists() && (candidate.join("steamapps").exists() || candidate.ends_with("steamapps")) {
                    if !library_paths_with_labels.iter().any(|(p, _)| p == &candidate) {
                        let sub_libs = Self::get_library_folders(&candidate);
                        if sub_libs.is_empty() {
                            library_paths_with_labels.push((candidate, None));
                        } else {
                            for (sub, label) in sub_libs {
                                if !library_paths_with_labels.iter().any(|(p, _)| p == &sub) {
                                    library_paths_with_labels.push((sub, label));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Add custom user-provided paths
        for custom in custom_paths {
            let p = PathBuf::from(custom);
            if p.exists() && !library_paths_with_labels.iter().any(|(existing, _)| existing == &p) {
                library_paths_with_labels.push((p, None));
            }
        }

        // 5. Scan each discovered library folder for games
        for (lib_path, vdf_label) in &library_paths_with_labels {
            let games = Self::scan_library_games(lib_path);
            let games_count = games.len();
            all_games.extend(games);

            // Compute human-readable drive label (e.g. "Drive C: (Steam)", "Drive D: [Games SSD] (SteamLibrary)")
            let label = Self::compute_drive_label(lib_path, vdf_label.as_deref());

            all_libraries.push(SteamLibrary {
                path: lib_path.to_string_lossy().to_string(),
                label,
                total_games: games_count,
            });
        }

        // 6. Discover uninstalled games (from userdata and popular community downgradeable catalog)
        let installed_appids: Vec<u32> = all_games.iter().map(|g| g.appid).collect();
        let default_lib = library_paths_with_labels
            .first()
            .map(|(p, _)| p.to_string_lossy().to_string())
            .or_else(|| steam_path.as_ref().map(|p| p.to_string_lossy().to_string()))
            .unwrap_or_else(|| "SteamLibrary".to_string());

        let uninstalled = Self::scan_uninstalled_games(steam_path.as_deref(), &installed_appids, &default_lib);
        all_games.extend(uninstalled);

        // 7. Deduplicate games by AppID (keeping installed version if both exist)
        all_games.sort_by(|a, b| {
            b.is_installed.cmp(&a.is_installed).then_with(|| a.appid.cmp(&b.appid))
        });
        all_games.dedup_by_key(|g| g.appid);
        all_games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        ScanResult {
            libraries: all_libraries,
            games: all_games,
            steam_path: steam_path.map(|p| p.to_string_lossy().to_string()),
        }
    }

    /// Returns available drive roots for fast navigation
    pub fn get_system_drives() -> Vec<DirectoryItem> {
        let mut drives = Vec::new();

        #[cfg(target_os = "windows")]
        {
            for letter in b'A'..=b'Z' {
                let drive_str = format!("{}:\\", letter as char);
                let p = PathBuf::from(&drive_str);
                if p.exists() {
                    let is_steam = p.join("SteamLibrary").exists() || p.join("Steam").exists();
                    drives.push(DirectoryItem {
                        name: format!("Drive {}:", letter as char),
                        path: drive_str,
                        is_dir: true,
                        is_steam_library: is_steam,
                    });
                }
            }
        }

        #[cfg(target_os = "linux")]
        {
            // WSL /mnt/ drives
            if let Ok(entries) = fs::read_dir("/mnt") {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() {
                        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        let is_steam = p.join("SteamLibrary").exists()
                            || p.join("Steam").exists()
                            || p.join("Program Files (x86)/Steam").exists();
                        drives.push(DirectoryItem {
                            name: format!("Drive {} (/mnt/{})", name.to_ascii_uppercase(), name),
                            path: p.to_string_lossy().to_string(),
                            is_dir: true,
                            is_steam_library: is_steam,
                        });
                    }
                }
            }

            // Linux /media mounts
            for base in &["/media", "/run/media"] {
                if let Ok(users) = fs::read_dir(base) {
                    for user in users.flatten() {
                        if let Ok(sub) = fs::read_dir(user.path()) {
                            for drive in sub.flatten() {
                                let p = drive.path();
                                if p.is_dir() {
                                    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                    let is_steam = p.join("SteamLibrary").exists() || p.join("Steam").exists();
                                    drives.push(DirectoryItem {
                                        name: format!("Removable: {name}"),
                                        path: p.to_string_lossy().to_string(),
                                        is_dir: true,
                                        is_steam_library: is_steam,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Home directory
            if let Ok(home) = std::env::var("HOME") {
                let hp = PathBuf::from(&home);
                if hp.exists() {
                    let is_steam = hp.join(".local/share/Steam").exists() || hp.join(".steam/steam").exists();
                    drives.push(DirectoryItem {
                        name: "Home Directory (~/)".to_string(),
                        path: home,
                        is_dir: true,
                        is_steam_library: is_steam,
                    });
                }
            }

            // Root /
            drives.push(DirectoryItem {
                name: "File System Root (/)".to_string(),
                path: "/".to_string(),
                is_dir: true,
                is_steam_library: false,
            });
        }

        #[cfg(target_os = "macos")]
        {
            if let Ok(volumes) = fs::read_dir("/Volumes") {
                for vol in volumes.flatten() {
                    let p = vol.path();
                    if p.is_dir() {
                        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                        let is_steam = p.join("SteamLibrary").exists() || p.join("Steam").exists();
                        drives.push(DirectoryItem {
                            name: format!("Volume: {name}"),
                            path: p.to_string_lossy().to_string(),
                            is_dir: true,
                            is_steam_library: is_steam,
                        });
                    }
                }
            }
            if let Ok(home) = std::env::var("HOME") {
                drives.push(DirectoryItem {
                    name: "Home (~/)".to_string(),
                    path: home,
                    is_dir: true,
                    is_steam_library: false,
                });
            }
        }

        drives
    }

    /// Browses subdirectories for adding libraries
    pub fn browse_directory(target_path: Option<&str>) -> Result<DirectoryListing, String> {
        let drives = Self::get_system_drives();

        let current_path_buf = match target_path.filter(|s| !s.trim().is_empty()) {
            Some(p) => {
                let candidate = PathBuf::from(p);
                if candidate.exists() {
                    candidate
                } else {
                    drives
                        .first()
                        .map(|d| PathBuf::from(&d.path))
                        .unwrap_or_else(|| PathBuf::from("/"))
                }
            }
            None => drives
                .first()
                .map(|d| PathBuf::from(&d.path))
                .unwrap_or_else(|| PathBuf::from("/")),
        };

        let current_path_str = current_path_buf.to_string_lossy().to_string();
        let parent_path = current_path_buf
            .parent()
            .map(|p| p.to_string_lossy().to_string());

        let mut items = Vec::new();
        if let Ok(entries) = fs::read_dir(&current_path_buf) {
            for entry in entries.flatten() {
                let p = entry.path();
                let file_name = match p.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                // Skip hidden folders starting with dot unless desired
                if file_name.starts_with('.') && file_name != ".local" && file_name != ".steam" {
                    continue;
                }

                if p.is_dir() {
                    let is_steam = p.join("steamapps").exists()
                        || file_name.eq_ignore_ascii_case("steamapps")
                        || file_name.eq_ignore_ascii_case("SteamLibrary")
                        || file_name.eq_ignore_ascii_case("Steam");

                    items.push(DirectoryItem {
                        name: file_name,
                        path: p.to_string_lossy().to_string(),
                        is_dir: true,
                        is_steam_library: is_steam,
                    });
                }
            }
        }

        // Sort items: Steam libraries first, then alphabetical
        items.sort_by(|a, b| {
            b.is_steam_library
                .cmp(&a.is_steam_library)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        Ok(DirectoryListing {
            current_path: current_path_str,
            parent_path,
            items,
            drives,
        })
    }

    /// Extracts AppIDs from a VDF config file (like localconfig.vdf or sharedconfig.vdf)
    /// Scoped strictly to the "apps" block to avoid picking up friend IDs, timestamps, or system settings
    fn extract_appids_from_vdf_file(vdf_path: &Path, seen: &mut std::collections::HashSet<u32>) {
        if let Ok(content) = fs::read_to_string(vdf_path) {
            let mut depth: i32 = 0;
            let mut apps_depth: Option<i32> = None;

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                if trimmed.starts_with('{') {
                    depth += 1;
                    continue;
                } else if trimmed.starts_with('}') {
                    if let Some(ad) = apps_depth {
                        if depth <= ad {
                            apps_depth = None;
                        }
                    }
                    depth = depth.saturating_sub(1);
                    continue;
                }

                // Check for apps section header, e.g. "apps" or "Apps"
                if trimmed.eq_ignore_ascii_case("\"apps\"") || trimmed.eq_ignore_ascii_case("apps") {
                    apps_depth = Some(depth + 1);
                    continue;
                }

                // Only extract keys that are direct children of the apps block
                if let Some(ad) = apps_depth {
                    if depth == ad && trimmed.starts_with('"') {
                        if let Some(end_quote) = trimmed[1..].find('"') {
                            let key = &trimmed[1..1 + end_quote];
                            if let Ok(appid) = key.parse::<u32>() {
                                // Exclude base redistributables and invalid IDs
                                if appid > 100 && appid != 228980 && appid != 250820 && appid != 1391110 {
                                    seen.insert(appid);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Scans for uninstalled games from Steam userdata and community downgradeable games
    pub fn scan_uninstalled_games(
        steam_path: Option<&Path>,
        installed_appids: &[u32],
        default_library_path: &str,
    ) -> Vec<SteamGame> {
        let mut uninstalled = Vec::new();
        let mut seen_appids = std::collections::HashSet::new();

        // 1. Read local appcache/appinfo.vdf for instant offline name resolution
        let mut appinfo_map = HashMap::new();
        if let Some(sp) = steam_path {
            appinfo_map = Self::read_local_appinfo(sp);
        }

        if let Some(sp) = steam_path {
            let userdata_dir = sp.join("userdata");
            if userdata_dir.exists() {
                if let Ok(user_dirs) = fs::read_dir(&userdata_dir) {
                    for user_entry in user_dirs.flatten() {
                        let user_path = user_entry.path();
                        if user_path.is_dir() {
                            let localconfig = user_path.join("config").join("localconfig.vdf");
                            if localconfig.exists() {
                                Self::extract_appids_from_vdf_file(&localconfig, &mut seen_appids);
                            }
                            let sharedconfig = user_path.join("7").join("remote").join("sharedconfig.vdf");
                            if sharedconfig.exists() {
                                Self::extract_appids_from_vdf_file(&sharedconfig, &mut seen_appids);
                            }
                        }
                    }
                }
            }
        }

        let known_games = [
            (1808500, "ARC Raiders", "ARC Raiders"),
            (1659040, "HITMAN World of Assassination", "HITMAN 3"),
            (489830, "The Elder Scrolls V: Skyrim Special Edition", "Skyrim Special Edition"),
            (377160, "Fallout 4", "Fallout 4"),
            (1091500, "Cyberpunk 2077", "Cyberpunk 2077"),
            (1716740, "Starfield", "Starfield"),
            (1086940, "Baldur's Gate 3", "Baldurs Gate 3"),
            (1245620, "Elden Ring", "ELDEN RING"),
            (292030, "The Witcher 3: Wild Hunt", "The Witcher 3"),
            (271590, "Grand Theft Auto V", "Grand Theft Auto V"),
            (1174180, "Red Dead Redemption 2", "Red Dead Redemption 2"),
            (22320, "The Elder Scrolls III: Morrowind", "Morrowind"),
            (22330, "The Elder Scrolls IV: Oblivion", "Oblivion"),
            (22380, "Fallout: New Vegas", "Fallout New Vegas"),
            (22370, "Fallout 3", "Fallout 3"),
            (413150, "Stardew Valley", "Stardew Valley"),
            (105600, "Terraria", "Terraria"),
            (582010, "Monster Hunter: World", "Monster Hunter World"),
            (814380, "Sekiro: Shadows Die Twice", "Sekiro"),
            (374320, "DARK SOULS III", "DARK SOULS III"),
            (211420, "DARK SOULS: Prepare To Die Edition", "Dark Souls Prepare to Die Edition"),
            (570940, "DARK SOULS: REMASTERED", "Dark Souls Remastered"),
            (1196590, "Resident Evil 4 (2023)", "RESIDENT EVIL 4"),
            (883710, "Resident Evil 2", "RESIDENT EVIL 2  BIOHAZARD RE2"),
            (952060, "Resident Evil 3", "RESIDENT EVIL 3  BIOHAZARD RE3"),
            (1190460, "DEATH STRANDING", "Death Stranding"),
            (1151640, "Horizon Zero Dawn Complete Edition", "Horizon Zero Dawn"),
            (1817070, "Marvel's Spider-Man Remastered", "Marvel's Spider-Man Remastered"),
            (1478220, "Puzzle Together Multiplayer Jigsaw Puzzles", "Puzzle Together"),
            (2483190, "Forza Horizon 6", "Forza Horizon 6"),
            (3892270, "Gamble With Your Friends", "Gamble With Your Friends"),
            (3321460, "Crimson Desert", "Crimson Desert"),
            (1551360, "Forza Horizon 5", "Forza Horizon 5"),
            (1293830, "Forza Horizon 4", "Forza Horizon 4"),
        ];

        for (appid, name, install_dir) in known_games {
            if !installed_appids.contains(&appid) && !uninstalled.iter().any(|g: &SteamGame| g.appid == appid) {
                let cover_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900.jpg");
                let header_image = if appid == 2483190 {
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2483190/bd1e762f4720cb68af365f2e41d002f14dd74fbf/header_alt_assets_5.jpg".to_string()
                } else if appid == 3892270 {
                    "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/3892270/395e6d7972474333a698b26f8aa5597bf38109a1/header.jpg".to_string()
                } else {
                    format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg")
                };
                let hero_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_hero.jpg");
                let steamdb_url = format!("https://steamdb.info/app/{appid}/");

                let full_path = if default_library_path.ends_with("steamapps") {
                    Path::new(default_library_path).join("common").join(install_dir)
                } else {
                    Path::new(default_library_path).join("steamapps").join("common").join(install_dir)
                };

                uninstalled.push(SteamGame {
                    appid,
                    name: name.to_string(),
                    install_dir: install_dir.to_string(),
                    full_path: full_path.to_string_lossy().to_string(),
                    library_path: default_library_path.to_string(),
                    size_on_disk: 0,
                    build_id: "None (Uninstalled)".to_string(),
                    last_updated: 0,
                    mounted_depots: HashMap::new(),
                    cover_image,
                    header_image,
                    hero_image,
                    steamdb_url,
                    is_installed: false,
                });
            }
        }

        for appid in seen_appids {
            if !installed_appids.contains(&appid) && !uninstalled.iter().any(|g: &SteamGame| g.appid == appid) {
                // Check local appinfo cache first for instant title and type filtering
                let (resolved_name, is_dlc_or_tool) = if let Some(entry) = appinfo_map.get(&appid) {
                    let is_dlc_or_tool = entry.app_type.eq_ignore_ascii_case("dlc")
                        || entry.app_type.eq_ignore_ascii_case("tool")
                        || entry.app_type.eq_ignore_ascii_case("music")
                        || entry.app_type.eq_ignore_ascii_case("config");
                    (Some(entry.name.clone()), is_dlc_or_tool)
                } else {
                    (None, false)
                };

                // Skip non-standalone game entities (DLC packs, soundtracks, internal tools)
                if is_dlc_or_tool {
                    continue;
                }

                let name = resolved_name.unwrap_or_else(|| format!("Steam Game #{appid}"));
                let install_dir = format!("game_{appid}");
                let cover_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_600x900.jpg");
                let header_image = format!("https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg");
                let hero_image = format!("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/{appid}/library_hero.jpg");
                let steamdb_url = format!("https://steamdb.info/app/{appid}/");

                let full_path = if default_library_path.ends_with("steamapps") {
                    Path::new(default_library_path).join("common").join(&install_dir)
                } else {
                    Path::new(default_library_path).join("steamapps").join("common").join(&install_dir)
                };

                uninstalled.push(SteamGame {
                    appid,
                    name,
                    install_dir,
                    full_path: full_path.to_string_lossy().to_string(),
                    library_path: default_library_path.to_string(),
                    size_on_disk: 0,
                    build_id: "None (Uninstalled)".to_string(),
                    last_updated: 0,
                    mounted_depots: HashMap::new(),
                    cover_image,
                    header_image,
                    hero_image,
                    steamdb_url,
                    is_installed: false,
                });
            }
        }

        uninstalled
    }

    /// Registers a game in Steam's library by creating appmanifest_<appid>.acf and common directory
    pub fn register_installed_game(
        library_path: &str,
        appid: u32,
        game_name: &str,
        install_dir: &str,
        build_id: &str,
        depot_id: &str,
        manifest_id: &str,
    ) -> Result<String, String> {
        let lib = Path::new(library_path);
        let steamapps_dir = if lib.ends_with("steamapps") {
            lib.to_path_buf()
        } else {
            lib.join("steamapps")
        };

        let _ = fs::create_dir_all(&steamapps_dir);
        let game_dir = steamapps_dir.join("common").join(install_dir);
        let _ = fs::create_dir_all(&game_dir);

        let manifest_path = steamapps_dir.join(format!("appmanifest_{appid}.acf"));
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let acf_content = format!(
            "\"AppState\"\n{{\n\t\"appid\"\t\t\"{appid}\"\n\t\"Universe\"\t\t\"1\"\n\t\"name\"\t\t\"{game_name}\"\n\t\"StateFlags\"\t\t\"4\"\n\t\"installdir\"\t\t\"{install_dir}\"\n\t\"LastUpdated\"\t\t\"{now}\"\n\t\"UpdateResult\"\t\t\"0\"\n\t\"SizeOnDisk\"\t\t\"0\"\n\t\"buildid\"\t\t\"{build_id}\"\n\t\"AutoUpdateBehavior\"\t\t\"1\"\n\t\"InstalledDepots\"\n\t{{\n\t\t\"{depot_id}\"\n\t\t{{\n\t\t\t\"manifest\"\t\t\"{manifest_id}\"\n\t\t\t\"size\"\t\t\"0\"\n\t\t}}\n\t}}\n}}\n"
        );

        fs::write(&manifest_path, acf_content).map_err(|e| format!("Failed to write manifest: {e}"))?;

        Ok(format!(
            "Registered {game_name} (AppID {appid}) at {}. Ready to install build {build_id}!",
            game_dir.display()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_uninstalled_games() {
        let installed = vec![489830]; // Skyrim is installed
        let uninstalled = SteamManager::scan_uninstalled_games(None, &installed, "/test/path");

        // Fallout 4 (377160) should be in uninstalled list
        assert!(uninstalled.iter().any(|g| g.appid == 377160 && !g.is_installed));
        // Skyrim (489830) should NOT be in uninstalled list
        assert!(!uninstalled.iter().any(|g| g.appid == 489830));
    }

    #[test]
    fn test_register_installed_game() {
        let temp_dir = std::env::temp_dir().join("steam_register_test");
        let _ = fs::remove_dir_all(&temp_dir);
        let _ = fs::create_dir_all(&temp_dir);

        let res = SteamManager::register_installed_game(
            &temp_dir.to_string_lossy(),
            489830,
            "Skyrim Special Edition",
            "Skyrim Special Edition",
            "9544384",
            "489831",
            "8475928374928",
        );
        assert!(res.is_ok());

        let manifest_path = temp_dir.join("steamapps").join("appmanifest_489830.acf");
        assert!(manifest_path.exists());

        let content = fs::read_to_string(&manifest_path).unwrap();
        assert!(content.contains("\"StateFlags\"\t\t\"4\""));
        assert!(content.contains("\"AutoUpdateBehavior\"\t\t\"1\""));
        assert!(content.contains("\"buildid\"\t\t\"9544384\""));
        assert!(content.contains("\"manifest\"\t\t\"8475928374928\""));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_matches_language_script() {
        let ru_text = "Ещё одна заплатка - для Crimson Desert вышел патч 2.04.05";
        let en_text = "Patch Notes Version 2.04.05";
        let zh_text = "1.0.21 版本更新说明";

        assert!(!SteamManager::matches_language_script(ru_text, "en"));
        assert!(SteamManager::matches_language_script(en_text, "en"));
        assert!(SteamManager::matches_language_script(ru_text, "ru"));
        assert!(!SteamManager::matches_language_script(zh_text, "en"));
        assert!(SteamManager::matches_language_script(zh_text, "zh"));

        // "all" accepts any
        assert!(SteamManager::matches_language_script(ru_text, "all"));
        assert!(SteamManager::matches_language_script(en_text, "all"));
    }

    #[test]
    fn test_extract_appids_scoped_to_apps() {
        let vdf_content = r#"
"UserLocalConfigStore"
{
	"friends"
	{
		"155019067"
		{
			"name" "Krispy"
		}
	}
	"Software"
	{
		"Valve"
		{
			"Steam"
			{
				"apps"
				{
					"1808500"
					{
						"cloud"
						{
							"quota_bytes" "12345678"
						}
					}
					"1659040"
					{
						"cloud"
						{
							"quota_bytes" "87654321"
						}
					}
				}
			}
		}
	}
}
"#;
        let temp_dir = std::env::temp_dir().join("test_vdf_extract");
        let _ = fs::create_dir_all(&temp_dir);
        let file_path = temp_dir.join("localconfig.vdf");
        fs::write(&file_path, vdf_content).unwrap();

        let mut seen = std::collections::HashSet::new();
        SteamManager::extract_appids_from_vdf_file(&file_path, &mut seen);

        assert!(seen.contains(&1808500));
        assert!(seen.contains(&1659040));
        // Must NOT contain friend ID 155019067 or quota_bytes
        assert!(!seen.contains(&155019067));
        assert!(!seen.contains(&12345678));
        assert!(!seen.contains(&87654321));

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_parse_appinfo_data_v29() {
        // Construct minimal valid v29 binary data
        let mut data = Vec::new();
        // Magic 0x07564429
        data.extend_from_slice(&0x07564429u32.to_le_bytes()); // 0..4
        // Universe 1
        data.extend_from_slice(&1u32.to_le_bytes()); // 4..8

        // Placeholder for string table offset at bytes 8..16
        data.extend_from_slice(&0u64.to_le_bytes()); // 8..16

        // App entry at offset 16:
        let appid = 1808500u32;
        data.extend_from_slice(&appid.to_le_bytes()); // pos 16..20

        // App slice: 1 byte type (1) + 4 bytes key_idx (0 for name) + "ARC Raiders\0"
        let mut slice = Vec::new();
        slice.push(1u8); // string type
        slice.extend_from_slice(&0u32.to_le_bytes()); // key index 0 ("name")
        slice.extend_from_slice(b"ARC Raiders\0");

        let size = slice.len() as u32;
        data.extend_from_slice(&size.to_le_bytes()); // pos 20..24
        data.extend_from_slice(&slice); // pos 24..41

        // String table starts here:
        let st_offset = data.len() as u64;
        data[8..16].copy_from_slice(&st_offset.to_le_bytes());

        // num_strings: 1
        data.extend_from_slice(&1u32.to_le_bytes());
        // string 0: "name\0"
        data.extend_from_slice(b"name\0");

        let parsed = SteamManager::parse_appinfo_data(&data);
        assert_eq!(parsed.get(&1808500).map(|e| e.name.as_str()), Some("ARC Raiders"));
    }
}
