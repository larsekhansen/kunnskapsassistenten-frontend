import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { PanelSeparator } from './PanelSeparator';
import { PanelWidthButtons } from './PanelWidthButtons';
import { defaultLayout, withCollapsed, type Layout, type SidebarSlot } from './viewModel';

/**
 * The pointer path WCAG 2.5.7 Dragging Movements asks for.
 *
 * What is measured is that a single click changes the width — no press, no
 * travel, no release. The separator is rendered beside the buttons because it
 * is the honest way to read the width back: both controls move the same edge,
 * and if they ever disagreed, this is where it would show.
 */
const bothOpen: Layout = withCollapsed(defaultLayout, 'secondary-sidebar', false);

function open(slot: SidebarSlot, { width = 1920 } = {}) {
  setViewportWidth(width);
  render(
    <LayoutProvider initialLayout={bothOpen}>
      <PanelWidthButtons slot={slot} />
      <PanelSeparator slot={slot} />
    </LayoutProvider>,
  );
}

const width = () => Number(screen.getByRole('separator').getAttribute('aria-valuenow'));
const narrower = (panel: string) => screen.getByRole('button', { name: `Gjør ${panel} smalere` });
const wider = (panel: string) => screen.getByRole('button', { name: `Gjør ${panel} bredere` });

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('bredere og smalere med ett klikk', () => {
  it('endrer bredden 16 px per klikk, uten en eneste draging', () => {
    open('primary-sidebar');
    expect(width()).toBe(400);

    fireEvent.click(wider('tråder og filter'));
    expect(width()).toBe(416);

    fireEvent.click(wider('tråder og filter'));
    expect(width()).toBe(432);

    fireEvent.click(narrower('tråder og filter'));
    expect(width()).toBe(416);
  });

  it('gjør det samme for panelet på den andre sida av hovedkolonnen', () => {
    // «Bredere» er bredere for begge. Det er glyfen som snur, ikke handlingen.
    open('secondary-sidebar');
    expect(width()).toBe(432);

    fireEvent.click(wider('kilder'));
    expect(width()).toBe(448);

    fireEvent.click(narrower('kilder'));
    expect(width()).toBe(432);
  });

  it('er navngitt etter panelet, så to åpne paneler ikke gir to like knapper', () => {
    open('primary-sidebar');
    expect(wider('tråder og filter')).toBeDefined();
    expect(narrower('tråder og filter')).toBeDefined();
  });
});

describe('når kanten står på grensa', () => {
  it('sier aria-disabled i stedet for å forsvinne', () => {
    open('primary-sidebar');

    // Ned til gulvet med det samme: panelet står der alt.
    expect(narrower('tråder og filter').getAttribute('aria-disabled')).toBe('true');
    expect(wider('tråder og filter').getAttribute('aria-disabled')).toBeNull();

    // `disabled` ville sluppet fokus til body midt i en serie klikk på den
    // samme knappen. `aria-disabled` beholder tab-stoppet, og Designsystemet
    // tegner de to likt.
    expect(narrower('tråder og filter').hasAttribute('disabled')).toBe(false);
  });

  it('gjør ingenting når den blir klikket likevel', () => {
    open('primary-sidebar');

    fireEvent.click(narrower('tråder og filter'));
    expect(width()).toBe(400);
  });

  it('slår seg av i det taket nås', () => {
    open('primary-sidebar');

    for (let press = 0; press < 5; press += 1) fireEvent.click(wider('tråder og filter'));
    expect(width()).toBe(480);
    expect(wider('tråder og filter').getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(wider('tråder og filter'));
    expect(width()).toBe(480);
  });

  it('beholder tabbstoppet, for ett trykk på den andre knappen gjør den nyttig igjen', () => {
    // 1920: panelet står på 400, som er gulvet, men taket er 480. «Smalere»
    // sier fra at den ikke kan gå lenger — og blir stående i tab-rekkefølgen,
    // for et tabbstopp som forsvinner under fingeren tar leseren ut av
    // kontrollen de jobbet i.
    open('primary-sidebar');

    expect(narrower('tråder og filter').getAttribute('aria-disabled')).toBe('true');
    expect(narrower('tråder og filter').getAttribute('tabindex')).toBeNull();

    fireEvent.click(wider('tråder og filter'));
    expect(narrower('tråder og filter').getAttribute('aria-disabled')).toBeNull();
  });
});

describe('et vindu som ikke har noe å gi', () => {
  it('tegner ingen breddekontroller i det hele tatt', () => {
    // 1440: de tre plassene står på gulvet sitt og summen er vinduet. Ingen
    // av knappene kan gjøre noe herfra uansett hva leseren trykker på, og en
    // kontroll som aldri kan gjøre noe er ikke en kontroll på grensa — den
    // har ingen jobb i dette vinduet. Brukerblikk 3, funn 2: på 1440 × 900
    // sto alle fire varig avslått, og 1440 er bredden alle Figma-rammene er
    // tegnet i. Skillet går samme vei, så her er det ingen separator å lese
    // bredden av heller.
    open('primary-sidebar', { width: 1440 });

    expect(screen.queryByRole('button', { name: /Gjør .* smalere/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Gjør .* bredere/ })).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('gjør det for begge sidekolonnene', () => {
    // Kildepanelet står på sitt gulv på 336 på den samme bredden.
    open('secondary-sidebar', { width: 1440 });

    expect(screen.queryByRole('button', { name: /Gjør/ })).toBeNull();
    expect(screen.queryByRole('separator')).toBeNull();
  });

  it('tegner dem igjen når vinduet vokser', () => {
    open('primary-sidebar', { width: 1440 });
    expect(screen.queryByRole('button', { name: /Gjør/ })).toBeNull();

    act(() => setViewportWidth(1920));

    expect(wider('tråder og filter')).toBeDefined();
    expect(narrower('tråder og filter')).toBeDefined();
    expect(width()).toBe(400);
  });
});
