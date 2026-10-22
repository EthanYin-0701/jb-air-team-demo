export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pawgroove-theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** Resolves the initial theme: saved preference first, then the OS preference. */
export function resolveInitialTheme(saved: string | null, prefersDark: boolean): Theme {
  if (isTheme(saved)) return saved;
  return prefersDark ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

/** Inline script run before hydration so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
