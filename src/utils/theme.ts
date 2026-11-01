import { useEffect, useState } from 'react';

export type AccentColor = 'blue' | 'purple' | 'emerald' | 'orange' | 'crimson' | 'cyan' | 'pink';

export interface AccentThemeConfig {
  id: AccentColor;
  name: string;
  colorHex: string;
  gradient: string;
  chakraColorPalette: string;
}

export const ACCENT_THEMES: AccentThemeConfig[] = [
  {
    id: 'blue',
    name: 'Steam Blue',
    colorHex: '#3b82f6',
    gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    chakraColorPalette: 'blue',
  },
  {
    id: 'purple',
    name: 'Cyberpunk Purple',
    colorHex: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7, #7e22ce)',
    chakraColorPalette: 'purple',
  },
  {
    id: 'emerald',
    name: 'Neon Emerald',
    colorHex: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    chakraColorPalette: 'green',
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    colorHex: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0e7490)',
    chakraColorPalette: 'cyan',
  },
  {
    id: 'orange',
    name: 'Solar Amber',
    colorHex: '#f97316',
    gradient: 'linear-gradient(135deg, #f97316, #c2410c)',
    chakraColorPalette: 'orange',
  },
  {
    id: 'crimson',
    name: 'Valkyrie Crimson',
    colorHex: '#ef4444',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    chakraColorPalette: 'red',
  },
  {
    id: 'pink',
    name: 'Rose Neon',
    colorHex: '#f43f5e',
    gradient: 'linear-gradient(135deg, #f43f5e, #be123c)',
    chakraColorPalette: 'pink',
  },
];

const THEME_ACCENT_KEY = 'steam_game_manager_accent_theme';

export function getSavedAccent(): AccentColor {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(THEME_ACCENT_KEY) as AccentColor;
      if (saved && ACCENT_THEMES.some((t) => t.id === saved)) {
        return saved;
      }
    }
  } catch {
    // ignore
  }
  return 'blue';
}

export function saveAccent(accent: AccentColor): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_ACCENT_KEY, accent);
    }
    applyAccentToDocument(accent);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('steam_theme_accent_updated', { detail: { accent } }));
    }
  } catch {
    // ignore
  }
}

export function applyAccentToDocument(accent: AccentColor): void {
  if (typeof document === 'undefined') return;
  const cfg = ACCENT_THEMES.find((t) => t.id === accent) || ACCENT_THEMES[0];
  document.documentElement.style.setProperty('--app-accent', cfg.colorHex);
  document.documentElement.style.setProperty('--app-accent-gradient', cfg.gradient);
  document.documentElement.setAttribute('data-accent-color', accent);
}

export function useAppAccent() {
  const [accent, setAccentState] = useState<AccentColor>(getSavedAccent);

  useEffect(() => {
    applyAccentToDocument(accent);
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ accent?: AccentColor }>;
      if (customEvent.detail?.accent) {
        setAccentState(customEvent.detail.accent);
      } else {
        setAccentState(getSavedAccent());
      }
    };
    window.addEventListener('steam_theme_accent_updated', handleUpdate);
    return () => window.removeEventListener('steam_theme_accent_updated', handleUpdate);
  }, [accent]);

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    saveAccent(newAccent);
  };

  const currentTheme = ACCENT_THEMES.find((t) => t.id === accent) || ACCENT_THEMES[0];

  return {
    accent,
    setAccent,
    themes: ACCENT_THEMES,
    palette: currentTheme.chakraColorPalette,
    colorHex: currentTheme.colorHex,
    gradient: currentTheme.gradient,
    themeConfig: currentTheme,
  };
}

