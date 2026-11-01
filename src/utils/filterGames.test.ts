import { describe, expect, it } from 'bun:test';
import { isGameVisible } from './filterGames';

describe('isGameVisible filter logic', () => {
  const installedNormal = { appid: 1, is_installed: true };
  const installedHidden = { appid: 2, is_installed: true };
  const uninstalledNormal = { appid: 3, is_installed: false };
  const uninstalledHidden = { appid: 4, is_installed: false };

  const hiddenSet = new Set([2, 4]);

  it('shows normal installed games by default when all filters are off', () => {
    expect(isGameVisible(installedNormal, hiddenSet, false, false)).toBe(true);
    expect(isGameVisible(installedHidden, hiddenSet, false, false)).toBe(false);
    expect(isGameVisible(uninstalledNormal, hiddenSet, false, false)).toBe(false);
    expect(isGameVisible(uninstalledHidden, hiddenSet, false, false)).toBe(false);
  });

  it('does NOT show hidden games in uninstalled when showHidden is off', () => {
    // Uninstalled normal shows
    expect(isGameVisible(uninstalledNormal, hiddenSet, true, false)).toBe(true);
    // Uninstalled hidden must NOT show in uninstalled if showHidden is false
    expect(isGameVisible(uninstalledHidden, hiddenSet, true, false)).toBe(false);
    // Hidden installed still hidden
    expect(isGameVisible(installedHidden, hiddenSet, true, false)).toBe(false);
  });

  it('only shows installed hidden games when showHidden is on (uninstalled stay hidden)', () => {
    // Uninstalled hidden does not show without showUninstalled
    expect(isGameVisible(uninstalledHidden, hiddenSet, false, true)).toBe(false);
    // Installed hidden shows
    expect(isGameVisible(installedHidden, hiddenSet, false, true)).toBe(true);
    // Uninstalled normal still hidden
    expect(isGameVisible(uninstalledNormal, hiddenSet, false, true)).toBe(false);
  });

  it('shows uninstalled and hidden games when both filters are on', () => {
    expect(isGameVisible(uninstalledHidden, hiddenSet, true, true)).toBe(true);
    expect(isGameVisible(installedHidden, hiddenSet, true, true)).toBe(true);
    expect(isGameVisible(uninstalledNormal, hiddenSet, true, true)).toBe(true);
    expect(isGameVisible(installedNormal, hiddenSet, true, true)).toBe(true);
  });
});

