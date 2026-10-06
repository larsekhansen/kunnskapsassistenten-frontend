import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LayoutProvider } from '../layout/LayoutProvider';
import { Shell } from '../layout/Shell';
import { FLAGS_STORAGE_KEY, isFlagOn, resetFlags } from './flags';

/** Skriver adressen ut, så en test kan lese hva menyen og lenken gjorde med den. */
function Address() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="adresse">{pathname + search + hash}</p>;
}

/*
 * Menyen mountes i skallet (valgt 06.10), ikke i chatvisningen, fordi veien
 * inn i innstillingene står i foten på alle rutene og begge menyene åpnes av
 * adressen. Testene tegner derfor det ekte skallet.
 */
function openAt(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Shell />} />
          <Route path="/threads/:threadId" element={<Shell />} />
        </Routes>
        <Address />
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const switchName = /Panelene som en rad øverst på mobil/u;

beforeEach(() => {
  localStorage.clear();
  resetFlags();
});

describe('den skjulte menyen for funksjonsflagg', () => {
  it('finnes ikke uten adressen', () => {
    openAt('/');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Eksperimenter')).toBeNull();
  });

  it('åpnes av #feature-flags, slår på flagget, og flagget huskes etter en reload', () => {
    const first = openAt('/#feature-flags');

    expect(screen.getByRole('heading', { name: 'Eksperimenter' })).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: switchName }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(toggle.checked).toBe(true);
    expect(isFlagOn('mobile-top-row')).toBe(true);
    expect(localStorage.getItem(FLAGS_STORAGE_KEY)).toBe('["mobile-top-row"]');

    // A reload: the page goes, the module reads storage again.
    first.unmount();
    resetFlags();
    openAt('/#feature-flags');

    expect((screen.getByRole('switch', { name: switchName }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('lenker til issuen flagget gjelder', () => {
    openAt('/#feature-flags');

    // Norwegian like the rest of the menu, and it says that it opens a new tab.
    // Chromium names it «Sak 120 (åpnes i ny fane)»; jsdom drops the space
    // before the sr-only text, hence the optional one.
    const link = screen.getByRole('link', { name: /^Sak 120 ?\(åpnes i ny fane\)$/u });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('href')).toBe(
      'https://github.com/digdir/kunnskapsassistenten/issues/120',
    );
  });

  it('tar bare hashen ut når den lukkes, og lar tråden stå', () => {
    openAt('/threads/abc123#feature-flags');

    fireEvent.click(screen.getByRole('button', { name: 'Lukk' }));

    expect(screen.getByTestId('adresse').textContent).toBe('/threads/abc123');
    expect(screen.queryByText('Eksperimenter')).toBeNull();
  });

  it('står ved siden av innstillingene, ikke i dem', () => {
    openAt('/#innstillinger');

    expect(screen.getByRole('dialog', { name: 'Innstillinger' })).toBeTruthy();
    expect(screen.queryByText('Eksperimenter')).toBeNull();
  });
});

describe('lenken med ?flagg=', () => {
  it('slår på flagget, tar parameteren ut av adressen og viser menyen', async () => {
    openAt('/threads/abc123?flagg=mobile-top-row');

    expect(await screen.findByRole('heading', { name: 'Eksperimenter' })).toBeTruthy();
    expect(isFlagOn('mobile-top-row')).toBe(true);
    expect((screen.getByRole('switch', { name: switchName }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.getByTestId('adresse').textContent).toBe('/threads/abc123#feature-flags');
  });

  it('lar andre parametere stå', async () => {
    openAt('/?annet=1&flagg=mobile-top-row');

    await screen.findByRole('heading', { name: 'Eksperimenter' });
    expect(screen.getByTestId('adresse').textContent).toBe('/?annet=1#feature-flags');
  });

  it('slår ingenting på uten parameteren', () => {
    openAt('/threads/abc123');

    expect(isFlagOn('mobile-top-row')).toBe(false);
    expect(screen.getByTestId('adresse').textContent).toBe('/threads/abc123');
  });
});
