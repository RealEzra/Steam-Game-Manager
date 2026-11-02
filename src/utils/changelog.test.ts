import { describe, expect, it } from 'bun:test';
import { EMBEDDED_CHANGELOG, getVersionChanges, parseChangelog } from './changelog';

describe('Changelog parser', () => {
  it('parses embedded changelog into versions correctly', () => {
    const versions = parseChangelog(EMBEDDED_CHANGELOG);
    expect(versions.length).toBeGreaterThanOrEqual(4);

    const v093 = versions.find((v) => v.version === '0.9.3');
    expect(v093).toBeDefined();
    expect(v093?.date).toBe('2026-11-01');
    expect(v093?.sections.length).toBeGreaterThan(0);

    const fixedSection = v093?.sections.find((s) => s.type === 'Fixed');
    expect(fixedSection).toBeDefined();
    expect(fixedSection?.items.length).toBe(4);

    // Verify sub-bullets were parsed
    const saveBackupItem = fixedSection?.items.find((i) =>
      i.title?.includes('Windows Save Backup Folder Resolution')
    );
    expect(saveBackupItem).toBeDefined();
    expect(saveBackupItem?.subItems?.length).toBe(2);
  });

  it('parses 0.9.2 with both Added and Fixed sections', () => {
    const versions = parseChangelog(EMBEDDED_CHANGELOG);
    const v092 = getVersionChanges(versions, '0.9.2');
    expect(v092).toBeDefined();
    expect(v092?.sections.map((s) => s.type)).toEqual(['Added', 'Fixed']);

    const added = v092?.sections.find((s) => s.type === 'Added');
    expect(added?.items.some((i) => i.title?.includes('Launch Game'))).toBe(true);
  });

  it('matches versions with or without "v" prefix', () => {
    const versions = parseChangelog(EMBEDDED_CHANGELOG);
    expect(getVersionChanges(versions, '0.9.3')?.version).toBe('0.9.3');
    expect(getVersionChanges(versions, 'v0.9.3')?.version).toBe('0.9.3');
  });
});

