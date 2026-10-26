import { act, fireEvent, render, screen } from '@testing-library/react';
import SiteHeader from '@/app/components/SiteHeader';
import { LanguageProvider, LOCALE_STORAGE_KEY, LOCALES, MESSAGES } from '@/lib/i18n';

function renderHeader() {
  return render(
    <LanguageProvider>
      <SiteHeader />
    </LanguageProvider>
  );
}

describe('ATD-3: multi-language UI', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows a language menu in the header offering English, Chinese and Japanese', () => {
    renderHeader();

    const header = screen.getByTestId('site-header');
    const toggle = screen.getByRole('button', { name: 'Language' });
    expect(header.contains(toggle)).toBe(true);
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(toggle);

    const options = screen.getAllByRole('menuitemradio').map((o) => o.textContent);
    expect(options).toEqual(['English', '中文', '日本語']);
  });

  it.each([
    ['中文', 'zh', '让你的毛孩子变身舞蹈明星', 'zh-CN'],
    ['日本語', 'ja', 'あなたのペットをダンススターに', 'ja'],
  ])('switches the UI to %s and remembers the choice', (label, code, tagline, htmlLang) => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: label }));

    expect(screen.getByText(tagline)).not.toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(code);
    expect(document.documentElement.lang).toBe(htmlLang);
  });

  it('restores a previously stored language', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ja');
    await act(async () => {
      renderHeader();
    });
    expect(screen.getByText('あなたのペットをダンススターに')).not.toBeNull();
  });

  it('ignores an unknown stored language', async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'xx');
    await act(async () => {
      renderHeader();
    });
    expect(screen.getByText('Turn your furry friend into a dancing star')).not.toBeNull();
  });

  it('provides a non-empty translation for every key in every language', () => {
    const keys = Object.keys(MESSAGES.en);
    for (const locale of LOCALES) {
      expect(Object.keys(MESSAGES[locale]).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(MESSAGES[locale][key as keyof typeof MESSAGES.en].trim()).not.toBe('');
      }
    }
  });
});
