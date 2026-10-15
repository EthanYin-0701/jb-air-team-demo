import Link from 'next/link';

export default function SiteHeader() {
  return (
    <header className="site-header" data-testid="site-header">
      <Link href="/" className="site-header__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pets/paw.svg" alt="" className="site-header__logo" aria-hidden="true" />
        <span className="site-header__title">PawGroove</span>
      </Link>
      <p className="site-header__tagline">Turn your furry friend into a dancing star</p>
    </header>
  );
}
