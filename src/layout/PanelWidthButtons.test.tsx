import { fireEvent, render, screen } from '@testing-library/react';
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

  it('er av i begge ender når vinduet ikke har noe å gi', () => {
    // 1440: de tre plassene står på gulvet sitt og summen er vinduet.
    open('primary-sidebar', { width: 1440 });

    expect(narrower('tråder og filter').getAttribute('aria-disabled')).toBe('true');
    expect(wider('tråder og filter').getAttribute('aria-disabled')).toBe('true');
  });
});
