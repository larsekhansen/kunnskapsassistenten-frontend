import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { SidebarFooter } from './SidebarFooter';

/*
 * Det hele appen trenger og jsdom ikke har. Samme to som i src/App.test.tsx,
 * og av samme grunn: chatvisningen måler sin egen høyde, og Designsystemet
 * spør dokumentet om animasjonene sine.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
document.getAnimations ??= () => [];

/**
 * Issue 85c: de tre sidene fra den gamle Kunnskapsassistenten skal
 * være å nå fra foten av navigasjonspanelet.
 */
function open(at: string) {
  render(
    <MemoryRouter initialEntries={[at]}>
      <SidebarFooter />
    </MemoryRouter>,
  );
}

const links = () => screen.getByRole('list', { name: 'Om Kunnskapsassistenten' });

describe('SidebarFooter', () => {
  it('har de tre sidene, i rekkefølgen fra den gamle, med adressene deres', () => {
    open('/');

    const found = within(links())
      .getAllByRole('link')
      .map((link) => [link.textContent, link.getAttribute('href')]);

    expect(found).toEqual([
      ['Onboarding', '/onboarding'],
      ['Endringslogg', '/endringslogg'],
      ['Om prosjektet', '/om-prosjektet'],
    ]);
  });

  it('merker siden som er åpen, og bare den', () => {
    open('/endringslogg');

    const current = within(links())
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current.map((link) => link.textContent)).toEqual(['Endringslogg']);
  });

  it('merker ingen av dem når leseren står i en tråd', () => {
    open('/threads/42');

    expect(within(links()).queryByRole('link', { current: 'page' })).toBeNull();
  });

  it('har «Innstillinger» under lenkene, ikke over', () => {
    open('/');

    const foot = links().parentElement;
    const settings = screen.getByRole('link', { name: 'Innstillinger' });

    // `compareDocumentPosition` sier hva som kommer først i lesrekkefølgen,
    // som er det denne påstanden handler om.
    expect(foot?.contains(settings)).toBe(true);
    expect(
      links().compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  /*
   * Lenka skriver bare hashen, så menyen åpnes over den sida leseren står på.
   * Sto den utenfor lista, ville den vært en side om prosjektet.
   */
  it('lar «Innstillinger» stå utenfor lista over sider, og beholder sida', () => {
    open('/om-prosjektet');

    const settings = screen.getByRole('link', { name: 'Innstillinger' });

    expect(links().contains(settings)).toBe(false);
    expect(settings.getAttribute('href')).toBe('/om-prosjektet#innstillinger');
  });

  it('har ingen fargevelger igjen i foten', () => {
    open('/');

    expect(screen.queryByRole('group', { name: 'Fargemodus' })).toBeNull();
  });
});

/*
 * Lenka står på alle rutene, også de tre sidene om prosjektet, der ingen
 * chatvisning er montert. Menyen mountes derfor i skallet (Shell.tsx): sto den
 * i chatvisningen, åpnet lenka ingenting her.
 */
describe('veien inn i innstillingene, fra en side uten samtale', () => {
  it('åpner menyen på /om-prosjektet, og blir på sida', () => {
    render(
      <MemoryRouter initialEntries={['/om-prosjektet']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('dialog', { name: 'Innstillinger' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Innstillinger' }));

    const dialog = screen.getByRole('dialog', { name: 'Innstillinger' });
    expect(within(dialog).getByRole('group', { name: 'Fargemodus' })).toBeTruthy();
    // Sida står der den sto: bare hashen ble skrevet.
    expect(screen.getByRole('heading', { level: 1, name: 'Om prosjektet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Innstillinger' }).getAttribute('href')).toBe(
      '/om-prosjektet#innstillinger',
    );
  });
});
