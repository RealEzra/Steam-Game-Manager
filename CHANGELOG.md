# Changelog

All notable changes to **Steam Game Manager** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.3] - 2026-11-01

### Fixed
- **Windows Save Backup Folder Resolution**:
  - Fixed game save backups on Windows falling back to relative `./backups` which caused Windows Explorer to launch the user's `Documents` folder instead of the actual backup location.
  - Now uses `%LOCALAPPDATA%\steam-game-manager\backups\` (with canonical absolute path resolution in `open_folder`).
- **Pre-Switch Safety Snapshot Manifest ID**:
  - Fixed pre-switch snapshots incorrectly saving under the incoming target manifest ID instead of the build/manifest currently installed on disk at the time of backup.
- **Duplicate Save Backups**:
  - Eliminated redundant secondary save backup triggered inside `VaultManager::switch_profile`, ensuring clean single backups per version change.
- **DepotDownloader Error Diagnostics**:
  - Enhanced error capture when DepotDownloader exits with non-zero status, surfacing the exact terminal output/diagnostics in the UI banner.

---

## [0.9.2] - 2026-11-01

### Added
- **🎮 Launch Game**: Added a direct 1-click **"Launch Game"** button inside the Game Detail modal header to run games immediately via Steam.
- **Windows Registry Steam Detection**: Instantaneous Steam path discovery querying `HKCU\Software\Valve\Steam\SteamPath` in under 1ms.

### Fixed
- **Windows 10-Second Startup Freeze**:
  - Replaced synchronous full-system drive scans (`C:\` through `Z:\`) with instant Windows registry lookup, eliminating drive timeout delays caused by disconnected USB/optical drives.
  - Converted `scan_steam_games`, `resolve_steam_apps_metadata`, and `browse_directory` to non-blocking async tasks running on background threads.

---

## [0.9.1] - 2026-11-01

### Fixed
- **Version Vault Data Corruption Fix**:
  - Replaced the previous indiscriminate directory wipe with differential orphan cleanup during profile switches. Common game assets, secondary depot files (40GB+ textures, meshes, audio), mod directories, and user configurations are now safely preserved.
  - Added protection for save games and user config directories (`saves`, `Saved`, `UserData`, `.ini`, `.cfg`).
- **Hardlink Snapshot Mutation Fix**:
  - Fixed an issue where applying downloaded files directly overwrote existing hardlinked files in-place, which mutated the shared inode and corrupted snapshots in the Version Vault. Now unlinks destination files prior to copying.
- **GUI Freeze & Lag Fix**:
  - Added responsive client-side pagination (25 versions per page) to the Version Browser to eliminate UI rendering freezes when managing depots with 100+ historical SteamDB manifests.
  - Added a search filter across version names, manifest IDs, build IDs, dates, and modding notes.
  - Converted Steam patch notes and online manifest IPC lookups to non-blocking async tasks (`tauri::async_runtime::spawn_blocking`).
- **Windows Console Window Popups**:
  - Added `CREATE_NO_WINDOW` (`0x08000000`) flag to all background tool executions (`DepotDownloader.exe`, `curl`, `tar`, `cmd`) on Windows to prevent flashing terminal boxes and conhost execution delays.

---

## [0.9.0] - 2026-11-01

### Added
- **⚡ Version Vault**: Zero-space snapshotting and millisecond version switching leveraging OS hardlinks (NTFS, ext4, Btrfs).
- **Automated 1-Click Downgrading**: Integrated managed DepotDownloader runner with live transfer speed (MB/s), download percentages, and in-app Steam Guard 2FA prompts.
- **Manifest Discovery & Clipboard Importer**: 1-click clipboard parsing for SteamDB depot tables, SteamCMD branch syncing, and auto-matching patch notes to manifests.
- **Automated Safety Backups**: Automated game saves and configuration backups created before version changes and depot installations.
- **Auto-Update Engine**: Native signed app updater built with Tauri v2 updater.
- **Steam Manifest Lock**: Automated `appmanifest_<appid>.acf` patching to lock Steam games against forced background updates.
