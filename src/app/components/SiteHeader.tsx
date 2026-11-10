'use client';

import Link from 'next/link';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '@/lib/i18n';

export default function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="site-header" data-testid="site-header">
      <div className="site-header__top">
        <Link href="/" className="site-header__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pets/paw.svg" alt="" className="site-header__logo" aria-hidden="true" />
          <span className="site-header__title">PawGroove</span>
        </Link>
        <LanguageSwitcher />
      </div>
      <p className="site-header__tagline">{t('header.tagline')}</p>
    </header>
  );
}
