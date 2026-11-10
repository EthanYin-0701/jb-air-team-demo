import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ThemeToggle from '@/app/components/ThemeToggle';
import { resolveInitialTheme, THEME_STORAGE_KEY } from '@/lib/theme';

function mockPrefersDark(matches: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));
}

describe('ATD-4: light / dark theme toggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    mockPrefersDark(false);
  });

  it('renders a toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).not.toBeNull();
  });

  it('switches between light and dark and persists the choice', async () => {
    render(<ThemeToggle />);
    const button = screen.getByTestId('theme-toggle');
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      fireEvent.click(button);
    });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      fireEvent.click(button);
    });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a saved theme on load', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: /switch to light theme/i })).not.toBeNull();
  });

  it('falls back to the OS preference when nothing is saved', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
    expect(resolveInitialTheme(null, false)).toBe('light');
    expect(resolveInitialTheme('bogus', true)).toBe('dark');
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('defines a dark palette and pins the toggle to the top-right corner', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('[data-theme="dark"]');
    const toggleRule = css.slice(css.indexOf('.theme-toggle {'));
    expect(toggleRule).toMatch(/position:\s*fixed/);
    expect(toggleRule).toMatch(/top:/);
    expect(toggleRule).toMatch(/right:/);
  });
});
