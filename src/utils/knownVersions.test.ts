import { describe, expect, it, beforeEach } from 'bun:test';
import {
  clearCustomVersions,
  getAllVersionsForDepot,
  getDepotLabel,
  getGameManifestStats,
  isPatchNoteInLanguage,
  matchManifestsToPatchNotes,
  normalizeDate,
  parseSteamDbManifests,
  saveMultipleCustomVersions,
} from './knownVersions';
import { BuildVersion, SteamGame, SteamPatchNote } from '@/types';

// In-memory localStorage polyfill for test environment
const store = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

describe('knownVersions', () => {
  it('loads preset versions for Crimson Desert depot 3321461', () => {
    const versions = getAllVersionsForDepot(3321460, '3321461');
    expect(versions.length).toBeGreaterThanOrEqual(5);

    // Verify key historical manifests exist
    const manifestIds = versions.map((v) => v.manifestId);
    expect(manifestIds).toContain('1664560960084007594'); // 1.04.02
    expect(manifestIds).toContain('259565824122858761');  // 1.04.01
    expect(manifestIds).toContain('6481928472918471201'); // 1.03.00
  });

  it('computes friendly depot label for Crimson Desert', () => {
    const label = getDepotLabel(3321460, '3321461');
    expect(label).toContain('Main Game Content (Windows 64-bit)');
  });

  it('parses copied SteamDB table rows into BuildVersions', () => {
    const rawText = `
Date	Manifest ID
24 April 2026 – 18:32:11 UTC	1664560960084007594
23 April 2026 – 14:20:10 UTC	259565824122858761
12 March 2026 – 09:15:00 UTC	6481928472918471201
`;
    const parsed = parseSteamDbManifests(rawText, '3321461');
    expect(parsed.length).toBe(3);
    expect(parsed[0].manifestId).toBe('1664560960084007594');
    expect(parsed[0].releaseDate).toBe('24 April 2026');
    expect(parsed[1].manifestId).toBe('259565824122858761');
    expect(parsed[1].releaseDate).toBe('23 April 2026');
  });

  it('parses HTML table snippets copied from SteamDB', () => {
    const html = `
    <tr>
      <td aria-label="Date">23 April 2026 – 14:20:10 UTC</td>
      <td aria-label="Manifest ID"><a href="/manifest/259565824122858761/">259565824122858761</a></td>
    </tr>
    `;
    const parsed = parseSteamDbManifests(html, '3321461');
    expect(parsed.length).toBe(1);
    expect(parsed[0].manifestId).toBe('259565824122858761');
    expect(parsed[0].releaseDate).toBe('23 April 2026');
  });

  it('prepends currently installed version when not in list', () => {
    const versions = getAllVersionsForDepot(9999999, '9999991', '12345678901234567', '8888');
    expect(versions.length).toBe(1);
    expect(versions[0].manifestId).toBe('12345678901234567');
    expect(versions[0].buildId).toBe('8888');
  });

  it('normalizes various date formats', () => {
    expect(normalizeDate('2026-04-23')).toBe('2026-04-23');
    expect(normalizeDate('23 April 2026 – 14:20:10 UTC')).toBe('2026-04-23');
    expect(normalizeDate('April 23, 2026')).toBe('2026-04-23');
  });

  it('matches single manifest to Steam patch note by date', () => {
    const versions: BuildVersion[] = [
      {
        id: 'steamdb_259565824122858761',
        versionName: 'Manifest 2595658241...',
        manifestId: '259565824122858761',
        releaseDate: '23 April 2026',
        isCanonical: false,
      },
    ];

    const patchNotes: SteamPatchNote[] = [
      {
        gid: 'note_1',
        title: 'Patch 1.04.01 is now live with stability fixes',
        url: 'https://steamcommunity.com',
        date: 1776945600, // Apr 23, 2026
        version_tag: '1.04.01',
      },
    ];

    const matched = matchManifestsToPatchNotes(versions, patchNotes);
    expect(matched.length).toBe(1);
    expect(matched[0].versionName).toContain('1.04.01');
    expect(matched[0].description).toContain('Patch 1.04.01 is now live');
  });

  it('assigns estimated version numbers when multiple manifests exist on the same day', () => {
    const versions: BuildVersion[] = [
      {
        id: 'steamdb_11111111111111111',
        versionName: 'Manifest 1111111111...',
        manifestId: '11111111111111111',
        releaseDate: '23 April 2026 – 10:00 UTC',
        isCanonical: false,
      },
      {
        id: 'steamdb_22222222222222222',
        versionName: 'Manifest 2222222222...',
        manifestId: '22222222222222222',
        releaseDate: '23 April 2026 – 18:00 UTC',
        isCanonical: false,
      },
    ];

    const patchNotes: SteamPatchNote[] = [
      {
        gid: 'note_1',
        title: 'Crimson Desert Update 1.04.01',
        url: 'https://steamcommunity.com',
        date: 1776945600, // Apr 23, 2026
        version_tag: '1.04.01',
      },
    ];

    const matched = matchManifestsToPatchNotes(versions, patchNotes);
    expect(matched.length).toBe(2);

    // Both should receive estimated versions for that day
    expect(matched[0].versionName).toContain('Rev 1');
    expect(matched[0].description).toContain('Estimated build 1 of 2');

    expect(matched[1].versionName).toContain('Rev 2 / Hotfix');
    expect(matched[1].description).toContain('Estimated build 2 of 2');
  });

  it('assigns estimated build numbers when multiple manifests exist without a patch note', () => {
    const versions: BuildVersion[] = [
      {
        id: 'steamdb_33333333333333333',
        versionName: 'Manifest 3333333333...',
        manifestId: '33333333333333333',
        releaseDate: '15 January 2026',
        isCanonical: false,
      },
      {
        id: 'steamdb_44444444444444444',
        versionName: 'Manifest 4444444444...',
        manifestId: '44444444444444444',
        releaseDate: '15 January 2026',
        isCanonical: false,
      },
    ];

    const matched = matchManifestsToPatchNotes(versions, []);
    expect(matched.length).toBe(2);
    expect(matched[0].versionName).toContain('Rev 1');
    expect(matched[1].versionName).toContain('Rev 2');
  });

  it('correctly filters patch notes by language script', () => {
    const ruTitle = 'Ещё одна заплатка - для Crimson Desert вышел патч 2.04.05';
    const enTitle = 'Patch Notes Version 2.04.05';
    const zhTitle = '1.0.21 版本更新说明';

    expect(isPatchNoteInLanguage(enTitle, 'en')).toBe(true);
    expect(isPatchNoteInLanguage(ruTitle, 'en')).toBe(false);
    expect(isPatchNoteInLanguage(zhTitle, 'en')).toBe(false);

    // Russian user
    expect(isPatchNoteInLanguage(ruTitle, 'ru')).toBe(true);

    // Chinese user
    expect(isPatchNoteInLanguage(zhTitle, 'zh')).toBe(true);

    // All languages
    expect(isPatchNoteInLanguage(ruTitle, 'all')).toBe(true);
    expect(isPatchNoteInLanguage(zhTitle, 'all')).toBe(true);
    expect(isPatchNoteInLanguage(enTitle, 'all')).toBe(true);
  });

  it('prioritizes English patch notes over Russian syndications for English users', () => {
    const versions: BuildVersion[] = [
      {
        id: 'steamdb_259565824122858761',
        versionName: 'Manifest 2595658241...',
        manifestId: '259565824122858761',
        releaseDate: '23 April 2026',
        isCanonical: false,
      },
    ];

    const patchNotes: SteamPatchNote[] = [
      {
        gid: 'note_ru',
        title: 'Ещё одна заплатка - для Crimson Desert вышел патч 2.04.05: он устраняет вылет в бою с Равоком и ошибки заданий',
        url: 'https://www.playground.ru/...',
        date: 1776945600, // Apr 23, 2026
        version_tag: '2.04.05',
      },
      {
        gid: 'note_en',
        title: 'Patch Notes Version 2.04.05',
        url: 'https://steamcommunity.com/...',
        date: 1776945600, // Apr 23, 2026
        version_tag: '2.04.05',
      },
    ];

    // For English user: matches English patch note even though Russian was listed first
    const matchedEn = matchManifestsToPatchNotes(versions, patchNotes, 'en');
    expect(matchedEn[0].versionName).toBe('Patch 2.04.05');
    expect(matchedEn[0].description).toContain('Patch Notes Version 2.04.05');
    expect(matchedEn[0].description).not.toContain('Ещё одна заплатка');

    // For Russian user: matches Russian patch note
    const matchedRu = matchManifestsToPatchNotes(versions, patchNotes, 'ru');
    expect(matchedRu[0].description).toContain('Ещё одна заплатка');
  });

  it('does not match foreign language patch notes when only foreign notes exist for English users', () => {
    const versions: BuildVersion[] = [
      {
        id: 'steamdb_259565824122858761',
        versionName: 'Manifest 2595658241...',
        manifestId: '259565824122858761',
        releaseDate: '23 April 2026',
        isCanonical: false,
      },
    ];

    const patchNotes: SteamPatchNote[] = [
      {
        gid: 'note_ru',
        title: 'Ещё одна заплатка - для Crimson Desert вышел патч 2.04.05',
        url: 'https://www.playground.ru/...',
        date: 1776945600,
        version_tag: '2.04.05',
      },
    ];

    // English user should not receive Russian patch note
    const matched = matchManifestsToPatchNotes(versions, patchNotes, 'en');
    expect(matched[0].description || '').not.toContain('Ещё одна заплатка');
  });

  describe('getGameManifestStats', () => {
    it('counts installed mounted depots and manifests', () => {
      const mockGame: SteamGame = {
        appid: 123456,
        name: 'Test Game',
        install_dir: 'test',
        full_path: '/path/test',
        library_path: '/path',
        size_on_disk: 1000,
        build_id: '100',
        last_updated: 0,
        mounted_depots: {
          '123457': '99900011122233344',
          '123458': '99900011122233355',
        },
        cover_image: '',
        header_image: '',
        hero_image: '',
        steamdb_url: '',
        is_installed: true,
      };

      const stats = getGameManifestStats(mockGame);
      expect(stats.depotCount).toBe(2);
      expect(stats.manifestCount).toBe(2);
    });

    it('aggregates manifests added from SteamDB or local depotcache in localStorage', () => {
      const appid = 888123;
      const depotId = '888124';
      clearCustomVersions(appid, depotId);

      const mockGame: SteamGame = {
        appid,
        name: 'Custom Depot Game',
        install_dir: 'custom',
        full_path: '/path/custom',
        library_path: '/path',
        size_on_disk: 1000,
        build_id: '100',
        last_updated: 0,
        mounted_depots: {
          [depotId]: '1111222233334444',
        },
        cover_image: '',
        header_image: '',
        hero_image: '',
        steamdb_url: '',
        is_installed: true,
      };

      // Before custom versions: 1 depot, 1 manifest
      const initialStats = getGameManifestStats(mockGame);
      expect(initialStats.depotCount).toBe(1);
      expect(initialStats.manifestCount).toBe(1);

      // Add 3 manifests from SteamDB / local depotcache
      saveMultipleCustomVersions(appid, depotId, [
        {
          id: 'steamdb_2222333344445555',
          versionName: 'Patch 1.1',
          manifestId: '2222333344445555',
        },
        {
          id: 'steamdb_3333444455556666',
          versionName: 'Patch 1.2',
          manifestId: '3333444455556666',
        },
        {
          id: 'local_4444555566667777',
          versionName: 'Local Cache Build',
          manifestId: '4444555566667777',
        },
      ]);

      const updatedStats = getGameManifestStats(mockGame);
      expect(updatedStats.depotCount).toBe(1);
      // 1 installed + 3 custom = 4 manifests
      expect(updatedStats.manifestCount).toBe(4);

      // Clean up
      clearCustomVersions(appid, depotId);
    });

    it('aggregates canonical preset versions for games with presets', () => {
      // Skyrim SE (489830) has multiple presets defined in PRESET_VERSIONS
      const skyrimGame: SteamGame = {
        appid: 489830,
        name: 'The Elder Scrolls V: Skyrim Special Edition',
        install_dir: 'Skyrim Special Edition',
        full_path: '/path/skyrim',
        library_path: '/path',
        size_on_disk: 12000000000,
        build_id: '999999',
        last_updated: 0,
        mounted_depots: {
          '489831': '9999999999999999', // Installed manifest
        },
        cover_image: '',
        header_image: '',
        hero_image: '',
        steamdb_url: '',
        is_installed: true,
      };

      const stats = getGameManifestStats(skyrimGame);
      // Presets exist for 489831
      expect(stats.manifestCount).toBeGreaterThan(3);
    });

    it('counts manifests for uninstalled games with 0 mounted depots', () => {
      const appid = 777123;
      const depotId = '777124';
      clearCustomVersions(appid, depotId);

      const uninstalledGame: SteamGame = {
        appid,
        name: 'Uninstalled Test Game',
        install_dir: 'uninstalled',
        full_path: '',
        library_path: '',
        size_on_disk: 0,
        build_id: '',
        last_updated: 0,
        mounted_depots: {},
        cover_image: '',
        header_image: '',
        hero_image: '',
        steamdb_url: '',
        is_installed: false,
      };

      expect(getGameManifestStats(uninstalledGame).manifestCount).toBe(0);

      // User pastes manifests from SteamDB for this uninstalled game
      saveMultipleCustomVersions(appid, depotId, [
        {
          id: 'steamdb_1010101010101010',
          versionName: 'Release 1.0',
          manifestId: '1010101010101010',
        },
      ]);

      const stats = getGameManifestStats(uninstalledGame);
      expect(stats.depotCount).toBe(1);
      expect(stats.manifestCount).toBe(1);

      clearCustomVersions(appid, depotId);
    });
  });
});
