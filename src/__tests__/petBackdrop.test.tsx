import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import PetBackdrop from '@/app/components/PetBackdrop';
import SiteHeader from '@/app/components/SiteHeader';

const PUBLIC_PETS = path.join(process.cwd(), 'public', 'pets');

describe('ATD-1: pet-themed web UI', () => {
  it('renders decorative pet artwork in the backdrop', () => {
    render(<PetBackdrop />);

    const backdrop = screen.getByTestId('pet-backdrop');
    const images = backdrop.querySelectorAll('img');

    expect(images.length).toBeGreaterThan(0);
    const sources = Array.from(images).map((img) => img.getAttribute('src'));
    expect(sources).toEqual(expect.arrayContaining(['/pets/cat.svg', '/pets/dog.svg', '/pets/paw.svg']));
  });

  it('hides the decorative artwork from assistive technology', () => {
    render(<PetBackdrop />);

    const backdrop = screen.getByTestId('pet-backdrop');
    expect(backdrop.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the friendly brand header with a paw logo', () => {
    render(<SiteHeader />);

    expect(screen.getByText('PawGroove')).not.toBeNull();
    expect(screen.getByTestId('site-header').querySelector('img')?.getAttribute('src')).toBe(
      '/pets/paw.svg'
    );
  });

  it('serves every pet illustration from the local public folder', () => {
    render(<PetBackdrop />);

    const sources = Array.from(
      screen.getByTestId('pet-backdrop').querySelectorAll('img')
    ).map((img) => img.getAttribute('src') as string);

    for (const src of new Set(sources)) {
      expect(src.startsWith('/pets/')).toBe(true);
      expect(fs.existsSync(path.join(PUBLIC_PETS, path.basename(src)))).toBe(true);
    }
  });

  it('applies the PawGroove palette from the design plan', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8');

    expect(css).toContain('#f7f5f0');
    expect(css).toContain('#6d28d9');
    expect(css).toContain('#f0e8ff');
  });
});
