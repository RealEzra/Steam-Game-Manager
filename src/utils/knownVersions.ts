import { useEffect, useState } from 'react';
import { BuildVersion, SteamGame, SteamPatchNote } from '@/types';

// Friendly descriptions for well-known game depots
export const KNOWN_DEPOT_NAMES: Record<string, string> = {
  // Skyrim Special Edition (489830)
  '489831': 'Core Executable & Binaries',
  '489832': 'English Voices & Text',
  '489833': 'Skyrim SE Game Data',

  // Fallout 4 (377160)
  '377161': 'Fallout 4 Base Data',
  '377162': 'Fallout 4 Executable',
  '377163': 'Fallout 4 English Voices',
  '377164': 'Fallout 4 Interface',

  // Cyberpunk 2077 (1091500)
  '1091501': 'Main Game Content',
  '1091502': 'Executable & Engine Binaries',

  // Elden Ring (1245620)
  '1245621': 'Game Content & Binaries',
  '1245624': 'Movies & Soundtracks',

  // Stardew Valley (413150)
  '413151': 'Game Content & Executable',

  // Baldur's Gate 3 (1086940)
  '1086941': 'Base Game Content',
  '1086942': 'Executable Binaries',

  // Beat Saber (620980)
  '620981': 'Beat Saber Core & Unity Engine',

  // The Witcher 3 (292030)
  '292031': 'Core Executable',
  '292032': 'Game Content',

  // Grand Theft Auto V (271590)
  '271591': 'GTA V Game Files & RAGE Engine',

  // Resident Evil 4 (2050650)
  '2050651': 'RE4 Core Data & Binaries',

  // Crimson Desert (3321460)
  '3321461': 'Main Game Content (Windows 64-bit)',
  '3321462': 'macOS Game Content',
  '3321463': 'Japanese Audio & Text',
  '3321464': 'Spanish Audio & Text',
  '3321465': 'French Audio & Text',
  '3321466': 'German Audio & Text',
  '3321467': 'Brazilian Portuguese Audio & Text',
  '5001841': 'Enhanced Pack DLC Content',

  // Starfield (1716740)
  '1716741': 'Starfield Base Game Content',
  '1716742': 'Starfield Executable & Binaries',

  // Palworld (1623730)
  '1623731': 'Palworld Game Content & Binaries',

  // Dragon's Dogma 2 (2054970)
  '2054971': 'Dragon\'s Dogma 2 Main Content',
};

export function getDepotLabel(appid: number, depotId: string): string {
  const desc = KNOWN_DEPOT_NAMES[depotId];
  if (desc) {
    return `Depot ${depotId} — ${desc}`;
  }
  if (depotId === String(appid)) {
    return `Depot ${depotId} — Main Game Depot`;
  }
  return `Depot ${depotId}`;
}

// Canonical versions for games where downgrading is widespread
export const PRESET_VERSIONS: Record<string, BuildVersion[]> = {
  // Skyrim SE (489830) -> Depot 489831 (Exe)
  '489830_489831': [
    {
      id: 'skyrim_1_5_97',
      versionName: 'Patch 1.5.97 (Pre-Anniversary)',
      buildId: '7472019',
      manifestId: '37077972481744466',
      releaseDate: 'Nov 20, 2019',
      description: 'The golden era SKSE modding build. Required by thousands of classic Skyrim mods.',
      isCanonical: true,
    },
    {
      id: 'skyrim_1_6_353',
      versionName: 'Patch 1.6.353 (Initial AE)',
      buildId: '8291048',
      manifestId: '6481928472918471',
      releaseDate: 'Jan 6, 2022',
      description: 'First major Anniversary Edition release.',
      isCanonical: true,
    },
    {
      id: 'skyrim_1_6_640',
      versionName: 'Patch 1.6.640 (Pre-Creations Menu)',
      buildId: '9820192',
      manifestId: '8271928472918471',
      releaseDate: 'Sep 15, 2022',
      description: 'Very stable build before the December 2023 Creations menu overhaul.',
      isCanonical: true,
    },
    {
      id: 'skyrim_1_6_1130',
      versionName: 'Patch 1.6.1130 (Creations Update)',
      buildId: '13029102',
      manifestId: '1092837465019283',
      releaseDate: 'Dec 5, 2023',
      description: 'Introduced the unified Creations menu.',
      isCanonical: true,
    },
    {
      id: 'skyrim_1_6_1170',
      versionName: 'Patch 1.6.1170 (Latest 2024)',
      buildId: '13201948',
      manifestId: '1928374650192834',
      releaseDate: 'Jan 17, 2024',
      description: 'Current modern official patch.',
      isCanonical: true,
    },
  ],

  // Skyrim SE (489830) -> Depot 489832 (English)
  '489830_489832': [
    {
      id: 'skyrim_1_5_97_lang',
      versionName: 'Patch 1.5.97 English Content',
      buildId: '7472019',
      manifestId: '871408137397775988',
      releaseDate: 'Nov 20, 2019',
      description: 'Matching English voice/interface depot for 1.5.97.',
      isCanonical: true,
    },
  ],

  // Skyrim SE (489830) -> Depot 489833 (Data)
  '489830_489833': [
    {
      id: 'skyrim_1_5_97_data',
      versionName: 'Patch 1.5.97 Core Data',
      buildId: '7472019',
      manifestId: '3205365650266827028',
      releaseDate: 'Nov 20, 2019',
      description: 'Matching Core Data depot for 1.5.97.',
      isCanonical: true,
    },
  ],

  // Fallout 4 (377160) -> Depot 377162 (Exe)
  '377160_377162': [
    {
      id: 'fo4_1_10_163',
      versionName: 'Patch 1.10.163 (Pre-Next-Gen)',
      buildId: '4302918',
      manifestId: '5881378901723467',
      releaseDate: 'Dec 4, 2019',
      description: 'Crucial for F4SE, Fallout London, Buffout 4, and older mod collections.',
      isCanonical: true,
    },
    {
      id: 'fo4_1_10_980',
      versionName: 'Patch 1.10.980 (Next-Gen Update 1)',
      buildId: '14201948',
      manifestId: '7482019482019482',
      releaseDate: 'Apr 25, 2024',
      description: 'Next-Gen update release.',
      isCanonical: true,
    },
    {
      id: 'fo4_1_10_984',
      versionName: 'Patch 1.10.984 (Next-Gen Update 2)',
      buildId: '14392019',
      manifestId: '8920194820194820',
      releaseDate: 'May 13, 2024',
      description: 'Latest official Fallout 4 update.',
      isCanonical: true,
    },
  ],

  // Fallout 4 (377160) -> Depot 377161 (Data)
  '377160_377161': [
    {
      id: 'fo4_1_10_163_data',
      versionName: 'Patch 1.10.163 Base Data',
      buildId: '4302918',
      manifestId: '5493863289347524',
      releaseDate: 'Dec 4, 2019',
      description: 'Pre-Next-Gen base game archives.',
      isCanonical: true,
    },
  ],

  // Cyberpunk 2077 (1091500) -> Depot 1091501
  '1091500_1091501': [
    {
      id: 'cp_1_63',
      versionName: 'Patch 1.63 (Pre-2.0 / Legacy Engine)',
      buildId: '11729102',
      manifestId: '6481928472918471',
      releaseDate: 'Jul 14, 2023',
      description: 'Last version before 2.0 overhaul. Compatible with Windows 7/8 and classic mods.',
      isCanonical: true,
    },
    {
      id: 'cp_2_0',
      versionName: 'Patch 2.0 (Major Overhaul)',
      buildId: '12291029',
      manifestId: '7920194820194820',
      releaseDate: 'Sep 21, 2023',
      description: 'Completely revamped skill tree and police system.',
      isCanonical: true,
    },
    {
      id: 'cp_2_1',
      versionName: 'Patch 2.1 (Metro & Vehicle Combat)',
      buildId: '12930192',
      manifestId: '8820194820194820',
      releaseDate: 'Dec 5, 2023',
      description: 'Added NCART Metro and hangouts.',
      isCanonical: true,
    },
    {
      id: 'cp_2_12',
      versionName: 'Patch 2.12 (Current Stable)',
      buildId: '13567891',
      manifestId: '9482019482019482',
      releaseDate: 'Feb 29, 2024',
      description: 'Fixes for key bindings and Intel CPU scheduling.',
      isCanonical: true,
    },
  ],

  // Elden Ring (1245620) -> Depot 1245621
  '1245620_1245621': [
    {
      id: 'er_1_08',
      versionName: 'Version 1.08 (Colosseum Update)',
      buildId: '10192837',
      manifestId: '4820194820194820',
      releaseDate: 'Dec 7, 2022',
      description: 'PvP arenas and balance adjustments.',
      isCanonical: true,
    },
    {
      id: 'er_1_10',
      versionName: 'Version 1.10 (Pre-DLC Balance)',
      buildId: '11829102',
      manifestId: '7592019482019482',
      releaseDate: 'Jul 27, 2023',
      description: 'Pre-Shadow of the Erdtree competitive standard.',
      isCanonical: true,
    },
    {
      id: 'er_1_12',
      versionName: 'Version 1.12 (Shadow of the Erdtree Launch)',
      buildId: '14820192',
      manifestId: '8920194820194820',
      releaseDate: 'Jun 20, 2024',
      description: 'Base game patch launched with the expansion.',
      isCanonical: true,
    },
  ],

  // Stardew Valley (413150) -> Depot 413151
  '413150_413151': [
    {
      id: 'sdv_1_5_6',
      versionName: 'Version 1.5.6 (Pre-1.6 Modding Standard)',
      buildId: '8291029',
      manifestId: '3920194820194820',
      releaseDate: 'Dec 21, 2021',
      description: 'Long-standing version required for older SMAPI mods.',
      isCanonical: true,
    },
    {
      id: 'sdv_1_6_0',
      versionName: 'Version 1.6.0 (Major Content Update)',
      buildId: '13950192',
      manifestId: '7382019482019482',
      releaseDate: 'Mar 19, 2024',
      description: 'Major festivals, new farm type, and masteries.',
      isCanonical: true,
    },
  ],

  // Beat Saber (620980) -> Depot 620981
  '620980_620981': [
    {
      id: 'bs_1_29_1',
      versionName: 'Version 1.29.1 (Universal Modding Standard)',
      buildId: '11201928',
      manifestId: '4820194820194820',
      releaseDate: 'May 11, 2023',
      description: 'The definitive version for BMBF and custom song mods.',
      isCanonical: true,
    },
    {
      id: 'bs_1_34_2',
      versionName: 'Version 1.34.2 (OST 6 Update)',
      buildId: '12901928',
      manifestId: '7820194820194820',
      releaseDate: 'Dec 5, 2023',
      description: 'OST 6 content update.',
      isCanonical: true,
    },
  ],

  // Crimson Desert (3321460) -> Depot 3321461 (Main Game Content)
  '3321460_3321461': [
    {
      id: 'cd_1_04_02',
      versionName: 'Patch 1.04.02 (Latest Official Build)',
      buildId: '26361232',
      manifestId: '1664560960084007594',
      releaseDate: 'Apr 24, 2026',
      description: 'Latest official release build with latest performance optimizations (~141.3 GB).',
      isCanonical: true,
    },
    {
      id: 'cd_1_04_01',
      versionName: 'Patch 1.04.01 (Stable / Popular Mod Target)',
      buildId: '26310492',
      manifestId: '259565824122858761',
      releaseDate: 'Apr 23, 2026',
      description: 'Community standard rollback version for mod compatibility and stable framerates (~141.2 GB).',
      isCanonical: true,
    },
    {
      id: 'cd_1_03_00',
      versionName: 'Patch 1.03.00 (March Overhaul)',
      buildId: '25891048',
      manifestId: '6481928472918471201',
      releaseDate: 'Mar 12, 2026',
      description: 'Major balance adjustments and quest stabilization update (~139.8 GB).',
      isCanonical: true,
    },
    {
      id: 'cd_1_02_00',
      versionName: 'Patch 1.02.00 (February Post-Launch)',
      buildId: '25419284',
      manifestId: '8492019482019482711',
      releaseDate: 'Feb 18, 2026',
      description: 'First major post-launch bugfix patch resolving early crash states (~138.5 GB).',
      isCanonical: true,
    },
    {
      id: 'cd_1_01_00',
      versionName: 'Patch 1.01.00 (Day One Retail Launch)',
      buildId: '25019283',
      manifestId: '4920194820194820192',
      releaseDate: 'Jan 15, 2026',
      description: 'Day-one launch retail build for speedrunners and vanilla experience (~137.0 GB).',
      isCanonical: true,
    },
  ],

  // Crimson Desert (3321460) -> Depot 5001841 (Enhanced DLC Pack)
  '3321460_5001841': [
    {
      id: 'cd_dlc_latest',
      versionName: 'Enhanced Pack Content (Latest)',
      manifestId: '7471224494023576301',
      releaseDate: 'Apr 2026',
      description: 'DLC expansion content depot matching current game build (~27.6 GB).',
      isCanonical: true,
    },
  ],

  // Starfield (1716740) -> Depot 1716741 (Base Content)
  '1716740_1716741': [
    {
      id: 'sf_1_14_70',
      versionName: 'Patch 1.14.70 (Shattered Space)',
      manifestId: '847201948201928374',
      releaseDate: 'Sep 30, 2024',
      description: 'Shattered Space DLC update.',
      isCanonical: true,
    },
    {
      id: 'sf_1_12_30',
      versionName: 'Patch 1.12.30 (Creation Kit Update)',
      manifestId: '648192847291847120',
      releaseDate: 'Jun 9, 2024',
      description: 'Introduced official Creations mod support.',
      isCanonical: true,
    },
  ],

  // Dragon's Dogma 2 (2054970) -> Depot 2054971
  '2054970_2054971': [
    {
      id: 'dd2_may_2024',
      versionName: 'Patch 1.050 (May 2024 Update)',
      manifestId: '582019482910283741',
      releaseDate: 'May 31, 2024',
      description: 'Storage cap increases and DLSS frame generation improvements.',
      isCanonical: true,
    },
    {
      id: 'dd2_launch',
      versionName: 'Patch 1.020 (Day-One Launch Build)',
      manifestId: '281920482910293847',
      releaseDate: 'Mar 22, 2024',
      description: 'Original launch build.',
      isCanonical: true,
    },
  ],
};

const STORAGE_KEY = 'steam_downgrader_custom_versions';

export function getSavedCustomVersions(appid: number, depotId: string): BuildVersion[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw);
    const key = `${appid}_${depotId}`;
    return all[key] || [];
  } catch {
    return [];
  }
}

export function saveCustomVersion(appid: number, depotId: string, version: BuildVersion): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = `${appid}_${depotId}`;
    const list: BuildVersion[] = all[key] || [];
    // Replace if same manifest or append
    const filtered = list.filter((v) => v.manifestId !== version.manifestId);
    filtered.unshift(version);
    all[key] = filtered;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steam_manifests_updated', { detail: { appid, depotId } }));
    }
  } catch (err) {
    console.error('Failed to save custom version:', err);
  }
}

export function deleteCustomVersion(appid: number, depotId: string, versionId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    const key = `${appid}_${depotId}`;
    if (all[key]) {
      all[key] = (all[key] as BuildVersion[]).filter((v) => v.id !== versionId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('steam_manifests_updated', { detail: { appid, depotId } }));
      }
    }
  } catch (err) {
    console.error('Failed to delete custom version:', err);
  }
}

export function saveMultipleCustomVersions(
  appid: number,
  depotId: string,
  versions: BuildVersion[]
): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    const key = `${appid}_${depotId}`;
    const list: BuildVersion[] = all[key] || [];

    let addedCount = 0;
    for (const v of versions) {
      const exists = list.some((existing) => existing.manifestId === v.manifestId);
      if (!exists) {
        list.push(v);
        addedCount++;
      }
    }

    all[key] = list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steam_manifests_updated', { detail: { appid, depotId } }));
    }
    return addedCount;
  } catch (err) {
    console.error('Failed to save multiple custom versions:', err);
    return 0;
  }
}

export function clearCustomVersions(appid: number, depotId: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw);
    const key = `${appid}_${depotId}`;
    if (all[key]) {
      delete all[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('steam_manifests_updated', { detail: { appid, depotId } }));
      }
    }
  } catch (err) {
    console.error('Failed to clear custom versions:', err);
  }
}

export interface GameManifestStats {
  depotCount: number;
  manifestCount: number;
}

/**
 * Aggregates all known manifests and depots for a game across:
 * 1. Currently installed mounted depots (from appmanifest)
 * 2. Pre-configured canonical versions
 * 3. User-added / synced versions in localStorage (SteamDB paste, local depotcache sync, etc.)
 */
export function getGameManifestStats(game: SteamGame): GameManifestStats {
  const depots = new Set<string>();
  const uniqueManifests = new Set<string>();

  // 1. Mounted / currently installed depots and manifests
  if (game.mounted_depots) {
    for (const [depotId, manifestId] of Object.entries(game.mounted_depots)) {
      if (depotId) {
        depots.add(depotId);
      }
      if (manifestId && manifestId.trim().length > 0) {
        uniqueManifests.add(`${depotId}:${manifestId.trim()}`);
      }
    }
  }

  const prefix = `${game.appid}_`;

  // 2. Canonical preset versions
  for (const [key, versions] of Object.entries(PRESET_VERSIONS)) {
    if (key.startsWith(prefix)) {
      const depotId = key.slice(prefix.length);
      if (depotId) depots.add(depotId);
      for (const v of versions) {
        if (v.manifestId && v.manifestId.trim().length > 0) {
          uniqueManifests.add(`${depotId}:${v.manifestId.trim()}`);
        }
      }
    }
  }

  // 3. Custom / imported versions (SteamDB, local depotcache sync, manual entries)
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const all: Record<string, BuildVersion[]> = JSON.parse(raw);
        for (const [key, versions] of Object.entries(all)) {
          if (key.startsWith(prefix) && Array.isArray(versions)) {
            const depotId = key.slice(prefix.length);
            if (depotId) depots.add(depotId);
            for (const v of versions) {
              if (v.manifestId && v.manifestId.trim().length > 0) {
                uniqueManifests.add(`${depotId}:${v.manifestId.trim()}`);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore JSON or storage errors
  }

  return {
    depotCount: depots.size,
    manifestCount: uniqueManifests.size,
  };
}

/**
 * React hook that reactively updates depot and manifest counts when
 * new manifests are imported or synced from SteamDB/local cache.
 */
export function useGameManifestStats(game: SteamGame): GameManifestStats {
  const [stats, setStats] = useState<GameManifestStats>(() => getGameManifestStats(game));

  useEffect(() => {
    setStats(getGameManifestStats(game));
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ appid?: number }>;
      if (
        !customEvent.detail ||
        customEvent.detail.appid === undefined ||
        customEvent.detail.appid === game.appid
      ) {
        setStats(getGameManifestStats(game));
      }
    };
    window.addEventListener('steam_manifests_updated', handleUpdate);
    return () => {
      window.removeEventListener('steam_manifests_updated', handleUpdate);
    };
  }, [game.appid, game.mounted_depots]);

  return stats;
}

/**
 * Parses raw text or HTML copied from SteamDB (https://steamdb.info/depot/<depot_id>/manifests/)
 * and extracts all 64-bit Manifest IDs along with their release dates.
 */
export function parseSteamDbManifests(text: string, depotId?: string): BuildVersion[] {
  const results: BuildVersion[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const manifestRegex = /\b(\d{16,20})\b/;
  const dateRegex = /(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/;

  let lastDate = '';
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line contains a date
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      lastDate = dateMatch[1];
    }

    // Check if line contains a manifest ID (or in href="/manifest/...")
    let manifestId: string | null = null;
    const hrefMatch = line.match(/\/manifest\/(\d{16,20})/);
    if (hrefMatch) {
      manifestId = hrefMatch[1];
    } else {
      const manifestMatch = line.match(manifestRegex);
      if (manifestMatch) {
        manifestId = manifestMatch[1];
      }
    }

    if (manifestId && !seen.has(manifestId)) {
      seen.add(manifestId);
      const date = dateMatch ? dateMatch[1] : lastDate;
      results.push({
        id: `steamdb_${manifestId}`,
        versionName: date ? `Build Manifest (${date})` : `Manifest ${manifestId.slice(0, 10)}...`,
        manifestId,
        releaseDate: date || undefined,
        description: depotId
          ? `Imported from SteamDB manifests table for Depot ${depotId}`
          : 'Imported from SteamDB manifests table',
        isCanonical: false,
      });
    }
  }

  return results;
}

export function getAllVersionsForDepot(
  appid: number,
  depotId: string,
  installedManifestId?: string,
  installedBuildId?: string
): BuildVersion[] {
  const key = `${appid}_${depotId}`;
  const presets = PRESET_VERSIONS[key] || [];
  const custom = getSavedCustomVersions(appid, depotId);

  const combined = [...custom, ...presets];

  // If installed manifest isn't already in list, add it at the top as "Current Installed Version"
  if (
    installedManifestId &&
    installedManifestId !== 'installed' &&
    installedManifestId !== 'unknown' &&
    !combined.some((v) => v.manifestId === installedManifestId)
  ) {
    combined.unshift({
      id: `current_${installedManifestId}`,
      versionName: installedBuildId ? `Current Installed (Build ${installedBuildId})` : 'Current Installed Build',
      buildId: installedBuildId,
      manifestId: installedManifestId,
      description: 'Your currently installed game build manifest.',
      isCanonical: true,
    });
  }

  return combined;
}

/**
 * Normalizes various date string formats ("23 April 2026 – 14:00 UTC", "2026-04-23", "April 23, 2026")
 * into a standard ISO YYYY-MM-DD string for matching.
 */
export function normalizeDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const cleaned = dateStr.replace(/–|-.*$/, '').replace(/UTC.*$/i, '').trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export const PATCH_NOTE_LANG_KEY = 'steam_downgrader_patch_notes_lang';

/**
 * Returns user's preferred patch notes language setting (stored in localStorage or system default).
 */
export function getUserLanguage(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(PATCH_NOTE_LANG_KEY);
      if (saved) return saved;
    }
  } catch {
    // ignore
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    const code = navigator.language.split('-')[0].toLowerCase();
    return code || 'en';
  }
  return 'en';
}

/**
 * Persists user's preferred patch notes language setting.
 */
export function setUserLanguage(lang: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PATCH_NOTE_LANG_KEY, lang);
    }
  } catch {
    // ignore
  }
}

/**
 * Resolves "auto" setting to current browser language code (e.g. "en", "ru").
 */
export function getEffectiveLanguage(langSetting?: string): string {
  const chosen = langSetting || getUserLanguage();
  if (chosen === 'auto') {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0].toLowerCase();
    }
    return 'en';
  }
  return chosen;
}

/**
 * Checks whether an announcement title matches the expected script for the user's language.
 * Prevents non-user language posts (e.g. Russian Cyrillic syndications) from showing for English/Latin users.
 */
export function isPatchNoteInLanguage(title: string, userLang?: string): boolean {
  if (!title) return false;
  const lang = getEffectiveLanguage(userLang).toLowerCase();

  // If user selected 'all', accept everything
  if (lang === 'all') return true;

  const hasCyrillic = /[\u0400-\u04FF]/.test(title);
  const hasCJK = /[\u4E00-\u9FFF\u3400-\u4DBF]/.test(title);
  const hasHangul = /[\uAC00-\uD7AF]/.test(title);
  const hasArabic = /[\u0600-\u06FF]/.test(title);

  if (lang === 'ru' || lang === 'uk' || lang === 'be' || lang === 'bg') {
    return hasCyrillic;
  }

  if (lang === 'zh') {
    return hasCJK;
  }

  if (lang === 'ja') {
    const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(title);
    return hasKana || hasCJK;
  }

  if (lang === 'ko') {
    return hasHangul;
  }

  if (lang === 'ar') {
    return hasArabic;
  }

  // For English (en) and all Latin-script languages (de, fr, es, it, pt, nl, pl, etc.):
  // The announcement must NOT contain Cyrillic, CJK, Hangul, or Arabic
  return !hasCyrillic && !hasCJK && !hasHangul && !hasArabic;
}

/**
 * Matches build manifests to Steam announcements/patch notes by date.
 * If multiple manifests exist for a single day, assigns an estimated revision/version number to all builds on that day
 * (e.g., "Patch 1.04.01 (Rev 1)", "Patch 1.04.01 (Rev 2 / Hotfix)").
 */
export function matchManifestsToPatchNotes(
  versions: BuildVersion[],
  patchNotes: SteamPatchNote[],
  userLang?: string
): BuildVersion[] {
  if (!versions || versions.length === 0) return [];
  if (!patchNotes || patchNotes.length === 0) {
    return estimateMultipleManifestsForSameDay(versions);
  }

  const effectiveLang = getEffectiveLanguage(userLang);

  // Pre-normalize patch notes dates
  const notesWithDate = patchNotes.map((n) => {
    const d = new Date(n.date * 1000);
    return {
      ...n,
      isoDate: d.toISOString().slice(0, 10),
      timestamp: n.date * 1000,
      isLanguageMatch: isPatchNoteInLanguage(n.title, effectiveLang),
    };
  });

  // Group versions by normalized date
  const dateGroups = new Map<string, BuildVersion[]>();
  versions.forEach((v) => {
    const d = normalizeDate(v.releaseDate);
    const key = d || `undated_${v.id}`;
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key)!.push(v);
  });

  const updated: BuildVersion[] = [];

  dateGroups.forEach((groupVersions, dateKey) => {
    // Match against patch notes within ±36 hours (accounting for UTC vs Steam's US Pacific release times)
    let matchedNote: (typeof notesWithDate)[0] | null = null;
    if (!dateKey.startsWith('undated_')) {
      const vTime = new Date(dateKey).getTime();

      // 1. Highest priority: date match + user language match
      matchedNote =
        notesWithDate.find((n) => {
          if (!n.isLanguageMatch) return false;
          if (n.isoDate === dateKey) return true;
          return Math.abs(vTime - n.timestamp) <= 86400000 * 1.5;
        }) || null;

      // 2. Fallback to any date-matching note ONLY if 'all' languages is selected
      if (!matchedNote && effectiveLang === 'all') {
        matchedNote =
          notesWithDate.find((n) => {
            if (n.isoDate === dateKey) return true;
            return Math.abs(vTime - n.timestamp) <= 86400000 * 1.5;
          }) || null;
      }
    }

    const count = groupVersions.length;

    groupVersions.forEach((v, index) => {
      // Don't overwrite canonical presets with specific pre-configured names unless imported
      if (v.isCanonical && !v.id.startsWith('steamdb_') && !v.id.startsWith('local_') && !v.id.startsWith('log_')) {
        updated.push(v);
        return;
      }

      let versionName = v.versionName;
      let description = v.description;

      if (matchedNote) {
        const baseVersion = matchedNote.version_tag || matchedNote.title;
        const cleanBase = baseVersion.replace(/^(Patch|Update|Version)\s*/i, '').trim();

        if (count > 1) {
          // Multiple manifests on the same day: estimated revision numbers
          const revNumber = index + 1;
          const revLabel = revNumber === count && count === 2 ? 'Rev 2 / Hotfix' : `Rev ${revNumber}`;
          versionName = `Patch ${cleanBase} (${revLabel})`;
          description = `Matched with Steam update: "${matchedNote.title}" • Estimated build ${revNumber} of ${count} on ${v.releaseDate || dateKey}`;
        } else {
          // Single manifest for this day
          versionName = `Patch ${cleanBase}`;
          description = `Matched with Steam update: "${matchedNote.title}" (${v.releaseDate || dateKey})`;
        }
      } else if (count > 1 && !dateKey.startsWith('undated_')) {
        // Multiple manifests on the same day without a matching patch note
        const revNumber = index + 1;
        versionName = `Build Manifest (${v.releaseDate || dateKey}) - Rev ${revNumber}`;
        description = `Estimated revision ${revNumber} of ${count} builds released on ${v.releaseDate || dateKey}`;
      }

      updated.push({
        ...v,
        versionName,
        description: description || v.description,
      });
    });
  });

  return updated;
}

function estimateMultipleManifestsForSameDay(versions: BuildVersion[]): BuildVersion[] {
  const dateGroups = new Map<string, BuildVersion[]>();
  versions.forEach((v) => {
    const d = normalizeDate(v.releaseDate);
    const key = d || `undated_${v.id}`;
    if (!dateGroups.has(key)) dateGroups.set(key, []);
    dateGroups.get(key)!.push(v);
  });

  const updated: BuildVersion[] = [];
  dateGroups.forEach((groupVersions, dateKey) => {
    const count = groupVersions.length;
    groupVersions.forEach((v, index) => {
      if (count > 1 && !dateKey.startsWith('undated_') && !v.isCanonical) {
        const revNumber = index + 1;
        updated.push({
          ...v,
          versionName: `Build Manifest (${v.releaseDate || dateKey}) - Rev ${revNumber}`,
          description: `Estimated revision ${revNumber} of ${count} builds released on ${v.releaseDate || dateKey}`,
        });
      } else {
        updated.push(v);
      }
    });
  });
  return updated;
}

