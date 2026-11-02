export interface ChangelogItem {
  title?: string;
  description: string;
  subItems?: string[];
}

export interface ChangelogSection {
  type: 'Added' | 'Fixed' | 'Changed' | 'Removed' | 'Security' | 'Other';
  items: ChangelogItem[];
}

export interface ChangelogVersion {
  version: string;
  date?: string;
  sections: ChangelogSection[];
  rawText: string;
}

export const EMBEDDED_CHANGELOG = `# Changelog

All notable changes to **Steam Game Manager** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.4] - 2026-11-02

### Added
- **📋 Live GitHub Changelog Viewer**:
  - Integrated in-app changelog modal with live syncing directly from GitHub (\`CHANGELOG.md\`) and local fallback when offline.
  - Searchable release notes with categorized changes, release dates, and structured sub-bulleted details.
  - Direct access buttons added to the header navigation and the Settings modal.
- **🔍 Detailed In-App Update Notes**:
  - Automatically fetches and displays formatted release notes for incoming updates directly in the Settings update banner, replacing generic release notes with full changelog items.
- **📜 Persistent DepotDownloader Output & Full Log Viewer**:
  - Logs now persist across version switch completion, failure, and dialog closing.
  - Added an expandable terminal log box with line counts and a copyable log feed.
- **🔄 Background Version Switching**:
  - Modal dialog can be safely closed during downloads without interrupting tasks.
  - App-wide background completion and error toast alerts with direct 1-click "View Details" navigation.
- **🎨 Refreshed App Branding & Icons**:
  - Updated app icon with a sleek matte chassis, chamfered rim, and modern solid white monogram typography.

---

## [0.9.3] - 2026-11-01

### Fixed
- **Windows Save Backup Folder Resolution**:
  - Fixed game save backups on Windows falling back to relative \`./backups\` which caused Windows Explorer to launch the user's \`Documents\` folder instead of the actual backup location.
  - Now uses \`%LOCALAPPDATA%\\steam-game-manager\\backups\\\` (with canonical absolute path resolution in \`open_folder\`).
- **Pre-Switch Safety Snapshot Manifest ID**:
  - Fixed pre-switch snapshots incorrectly saving under the incoming target manifest ID instead of the build/manifest currently installed on disk at the time of backup.
- **Duplicate Save Backups**:
  - Eliminated redundant secondary save backup triggered inside \`VaultManager::switch_profile\`, ensuring clean single backups per version change.
- **DepotDownloader Error Diagnostics**:
  - Enhanced error capture when DepotDownloader exits with non-zero status, surfacing the exact terminal output/diagnostics in the UI banner.

---

## [0.9.2] - 2026-11-01

### Added
- **🎮 Launch Game**: Added a direct 1-click **"Launch Game"** button inside the Game Detail modal header to run games immediately via Steam.
- **Windows Registry Steam Detection**: Instantaneous Steam path discovery querying \`HKCU\\Software\\Valve\\Steam\\SteamPath\` in under 1ms.

### Fixed
- **Windows 10-Second Startup Freeze**:
  - Replaced synchronous full-system drive scans (\`C:\\\` through \`Z:\\\`) with instant Windows registry lookup, eliminating drive timeout delays caused by disconnected USB/optical drives.
  - Converted \`scan_steam_games\`, \`resolve_steam_apps_metadata\`, and \`browse_directory\` to non-blocking async tasks running on background threads.

---

## [0.9.1] - 2026-11-01

### Fixed
- **Version Vault Data Corruption Fix**:
  - Replaced the previous indiscriminate directory wipe with differential orphan cleanup during profile switches. Common game assets, secondary depot files (40GB+ textures, meshes, audio), mod directories, and user configurations are now safely preserved.
  - Added protection for save games and user config directories (\`saves\`, \`Saved\`, \`UserData\`, \`.ini\`, \`.cfg\`).
- **Hardlink Snapshot Mutation Fix**:
  - Fixed an issue where applying downloaded files directly overwrote existing hardlinked files in-place, which mutated the shared inode and corrupted snapshots in the Version Vault. Now unlinks destination files prior to copying.
- **GUI Freeze & Lag Fix**:
  - Added responsive client-side pagination (25 versions per page) to the Version Browser to eliminate UI rendering freezes when managing depots with 100+ historical SteamDB manifests.
  - Added a search filter across version names, manifest IDs, build IDs, dates, and modding notes.
  - Converted Steam patch notes and online manifest IPC lookups to non-blocking async tasks (\`tauri::async_runtime::spawn_blocking\`).
- **Windows Console Window Popups**:
  - Added \`CREATE_NO_WINDOW\` (\`0x08000000\`) flag to all background tool executions (\`DepotDownloader.exe\`, \`curl\`, \`tar\`, \`cmd\`) on Windows to prevent flashing terminal boxes and conhost execution delays.

---

## [0.9.0] - 2026-11-01

### Added
- **⚡ Version Vault**: Zero-space snapshotting and millisecond version switching leveraging OS hardlinks (NTFS, ext4, Btrfs).
- **Automated 1-Click Downgrading**: Integrated managed DepotDownloader runner with live transfer speed (MB/s), download percentages, and in-app Steam Guard 2FA prompts.
- **Manifest Discovery & Clipboard Importer**: 1-click clipboard parsing for SteamDB depot tables, SteamCMD branch syncing, and auto-matching patch notes to manifests.
- **Automated Safety Backups**: Automated game saves and configuration backups created before version changes and depot installations.
- **Auto-Update Engine**: Native signed app updater built with Tauri v2 updater.
- **Steam Manifest Lock**: Automated \`appmanifest_<appid>.acf\` patching to lock Steam games against forced background updates.
`;

const GITHUB_CHANGELOG_URL =
  'https://raw.githubusercontent.com/RealEzra/Steam-Game-Manager/main/CHANGELOG.md';

/**
 * Parses markdown Keep a Changelog content into structured versions
 */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const versions: ChangelogVersion[] = [];
  const lines = markdown.split(/\r?\n/);

  let currentVersion: ChangelogVersion | null = null;
  let currentSection: ChangelogSection | null = null;
  let currentItem: ChangelogItem | null = null;
  let rawVersionLines: string[] = [];

  const finalizeItem = () => {
    if (currentItem && currentSection) {
      currentSection.items.push(currentItem);
      currentItem = null;
    }
  };

  const finalizeSection = () => {
    finalizeItem();
    if (currentSection && currentVersion) {
      currentVersion.sections.push(currentSection);
      currentSection = null;
    }
  };

  const finalizeVersion = () => {
    finalizeSection();
    if (currentVersion) {
      currentVersion.rawText = rawVersionLines.join('\n').trim();
      versions.push(currentVersion);
      currentVersion = null;
      rawVersionLines = [];
    }
  };

  for (const line of lines) {
    // Matches: ## [0.9.3] - 2026-11-01 or ## 0.9.3 - 2026-11-01 or ## [v0.9.3]
    const versionMatch = line.match(/^##\s+\[?v?([0-9]+\.[0-9]+\.[0-9]+[^\]]*)\]?(?:\s*-\s*([0-9]{4}-[0-9]{2}-[0-9]{2}))?/i);
    if (versionMatch) {
      finalizeVersion();
      currentVersion = {
        version: versionMatch[1].trim(),
        date: versionMatch[2] ? versionMatch[2].trim() : undefined,
        sections: [],
        rawText: '',
      };
      rawVersionLines.push(line);
      continue;
    }

    if (currentVersion) {
      rawVersionLines.push(line);

      // Matches section headings: ### Added, ### Fixed, ### Changed, etc.
      const sectionMatch = line.match(/^###\s+([A-Za-z]+)/);
      if (sectionMatch) {
        finalizeSection();
        const header = sectionMatch[1];
        let type: ChangelogSection['type'] = 'Other';
        if (['Added', 'Fixed', 'Changed', 'Removed', 'Security'].includes(header)) {
          type = header as ChangelogSection['type'];
        }
        currentSection = {
          type,
          items: [],
        };
        continue;
      }

      // Sub-bullet under an item: "  - Sub-detail text" or "    * detail"
      const subBulletMatch = line.match(/^\s{2,}[-*]\s+(.+)$/);
      if (subBulletMatch && currentItem) {
        if (!currentItem.subItems) {
          currentItem.subItems = [];
        }
        currentItem.subItems.push(subBulletMatch[1].trim());
        continue;
      }

      // Top bullet under a section: "- **Title**: Description" or "- **Title**:" or "- Normal item"
      const itemMatch = line.match(/^[-*]\s+(.+)$/);
      if (itemMatch) {
        finalizeItem();
        const fullItemText = itemMatch[1].trim();
        // Check if there is bold title like **Title**: Description or **Title**:
        const boldTitleMatch = fullItemText.match(/^\*\*([^*]+)\*\*:(?:\s*(.+))?$/);
        if (boldTitleMatch) {
          currentItem = {
            title: boldTitleMatch[1].trim(),
            description: boldTitleMatch[2] ? boldTitleMatch[2].trim() : '',
          };
        } else {
          currentItem = {
            description: fullItemText,
          };
        }
        continue;
      }
    }
  }

  finalizeVersion();
  return versions;
}

let cachedChangelog: { versions: ChangelogVersion[]; raw: string } | null = null;

/**
 * Fetches the latest CHANGELOG.md from GitHub raw, falling back to local embedded copy.
 */
export async function getChangelog(forceRefresh = false): Promise<{
  versions: ChangelogVersion[];
  raw: string;
  isOnline: boolean;
}> {
  if (cachedChangelog && !forceRefresh) {
    return { ...cachedChangelog, isOnline: true };
  }

  try {
    const res = await fetch(GITHUB_CHANGELOG_URL, {
      cache: 'no-cache',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const versions = parseChangelog(text);
    if (versions.length > 0) {
      cachedChangelog = { versions, raw: text };
      return { versions, raw: text, isOnline: true };
    }
  } catch (err) {
    console.warn('Could not fetch remote CHANGELOG from GitHub, using embedded copy:', err);
  }

  const fallbackVersions = parseChangelog(EMBEDDED_CHANGELOG);
  return { versions: fallbackVersions, raw: EMBEDDED_CHANGELOG, isOnline: false };
}

/**
 * Finds the changelog entries for a specific version number.
 */
export function getVersionChanges(
  versions: ChangelogVersion[],
  targetVersion: string
): ChangelogVersion | undefined {
  const cleanTarget = targetVersion.replace(/^v/, '').trim();
  return versions.find((v) => v.version.replace(/^v/, '').trim() === cleanTarget);
}
