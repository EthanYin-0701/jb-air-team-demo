'use client';

import { useSyncExternalStore } from 'react';
import { applyTheme, isTheme, resolveInitialTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme';

function readSavedTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

// The active theme lives on <html data-theme>, set before hydration by themeInitScript.
function getThemeSnapshot(): Theme {
  const current = document.documentElement.dataset.theme;
  if (isTheme(current)) return current;
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveInitialTheme(readSavedTheme(), prefersDark);
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, getThemeSnapshot, () => 'light');

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this page.
    }
  };

  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
  return (
    <button
      type="button"
      className="theme-toggle"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
