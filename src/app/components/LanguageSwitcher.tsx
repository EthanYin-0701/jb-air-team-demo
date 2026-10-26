'use client';

import { useEffect, useRef, useState } from 'react';
import { LOCALES, LOCALE_LABELS, useI18n } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="language-switcher" ref={rootRef} data-testid="language-switcher">
      <button
        type="button"
        className="language-switcher__button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('header.language')}
        onClick={() => setOpen((v) => !v)}
      >
        🌐 {LOCALE_LABELS[locale]} ▾
      </button>
      {open && (
        <ul className="language-switcher__menu" role="menu">
          {LOCALES.map((code) => (
            <li key={code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={code === locale}
                lang={code}
                className="language-switcher__item"
                onClick={() => {
                  setLocale(code);
                  setOpen(false);
                }}
              >
                {LOCALE_LABELS[code]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
