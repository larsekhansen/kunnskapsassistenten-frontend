import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { PanelSeparator } from './PanelSeparator';
import { LAYOUT_STORAGE_KEY } from './persistence';
import { defaultLayout, withCollapsed, type Layout, type SidebarSlot } from './viewModel';

/**
 * The keyboard half of the drag handle.
 *
 * WCAG 2.5.7 asks that anything done by dragging can be done without it, and
 * these are the keys that do it. The pointer half is measured in the browser,
 * in tests/e2e/resize.spec.ts, because jsdom does no layout and a drag over a
 * page with no widths would prove nothing.
 */
const bothOpen: Layout = withCollapsed(defaultLayout, 'secondary-sidebar', false);

type Options = {
  /** The window to draw in. 1920 has room for anything the design asks for. */
  width?: number;
  /**
   * Hand the provider no layout at all, so it restores from `localStorage`
   * the way a reload does. Every other case says what it wants to see, which
   * is what `initialLayout` is for.
   */
  restore?: boolean;
};

function open(slot: SidebarSlot, { width = 1920, restore = false }: Options = {}) {
  setViewportWidth(width);
  render(
    <LayoutProvider initialLayout={restore ? undefined : bothOpen}>
      <PanelSeparator slot={slot} />
    </LayoutProvider>,
  );
  return screen.getByRole('separator');
}

const width = (separator: HTMLElement) => Number(separator.getAttribute('aria-valuenow'));

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('the separator as a control', () => {
  it('is named after the views in the panel it resizes, in Norwegian', () => {
    // Not «navigasjonspanelet»: a slot's accessible name comes from what sits
    // in it, so a view moved to the other sidebar takes its name along. Same
    // rule the collapse button follows — «Skjul tråder og filter».
    expect(open('primary-sidebar').getAttribute('aria-label')).toBe(
      'Endre bredde på tråder og filter',
    );
    document.body.innerHTML = '';
    expect(open('secondary-sidebar').getAttribute('aria-label')).toBe('Endre bredde på kilder');
  });

  it('reports where it is and how far it can go, in pixels', () => {
    const separator = open('primary-sidebar');

    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(width(separator)).toBe(400);
    expect(separator.getAttribute('aria-valuemin')).toBe('400');
    expect(separator.getAttribute('aria-valuemax')).toBe('480');
  });

  it('says what the number is, since a separator carries no unit', () => {
    // Without `aria-valuetext` a screen reader reads «400» and the reader has
    // to guess at what. KA CC, reviewing PR #50.
    const separator = open('primary-sidebar');
    expect(separator.getAttribute('aria-valuetext')).toBe('400 piksler');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator.getAttribute('aria-valuetext')).toBe('416 piksler');
  });

  it('is a tab stop while there is something to do, and not while there is not', () => {
    expect(open('primary-sidebar').getAttribute('tabindex')).toBe('0');
    document.body.innerHTML = '';

    // 1440 is the three slots at their floors exactly. Every key on the
    // separator then does nothing, and a tab stop that cannot do anything is
    // a tab stop in the way — the rule the shell already keeps about a
    // collapsed panel. The line stays drawn: the edge is still there.
    const stuck = open('primary-sidebar', { width: 1440 });
    expect(stuck.getAttribute('tabindex')).toBe('-1');
    expect(stuck.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('the arrow keys', () => {
  it('moves the edge 16 px, and 64 with Shift held', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(480);

    fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(width(separator)).toBe(400);
  });

  it('moves the edge the way the key points, so the panel after the answer column narrows', () => {
    // The key is about the edge and not about the panel: pressing the key
    // that points at the inline end moves the edge that way, whichever panel
    // is on the other side of it. Anything else has the edge walking against
    // the finger.
    const separator = open('secondary-sidebar');
    expect(width(separator)).toBe(432);

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width(separator)).toBe(416);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(width(separator)).toBe(432);
  });

  it('stops at the bounds instead of running past them', () => {
    const separator = open('primary-sidebar');

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    }
    expect(width(separator)).toBe(480);

    for (let press = 0; press < 20; press += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowLeft', shiftKey: true });
    }
    expect(width(separator)).toBe(400);
  });

  it('keeps the page still: the browser must not scroll on an arrow key here', () => {
    const separator = open('primary-sidebar');
    const handled = fireEvent.keyDown(separator, { key: 'ArrowRight' });

    // fireEvent returns false when a handler called preventDefault.
    expect(handled).toBe(false);
  });

  it('leaves keys it has no business with alone', () => {
    const separator = open('primary-sidebar');
    expect(fireEvent.keyDown(separator, { key: 'Tab' })).toBe(true);
    expect(width(separator)).toBe(400);
  });
});

describe('Home, End and Enter', () => {
  it('goes to the narrowest and the widest the panel may be', () => {
    // About the VALUE and not about the screen, which is the reading a person
    // who cannot see the edge can act on: Home is the smallest number the
    // separator reports, wherever on the row the panel sits.
    const separator = open('secondary-sidebar');

    fireEvent.keyDown(separator, { key: 'End' });
    expect(width(separator)).toBe(Number(separator.getAttribute('aria-valuemax')));

    fireEvent.keyDown(separator, { key: 'Home' });
    expect(width(separator)).toBe(336);
  });

  it('puts the edge back where the design draws it', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight', shiftKey: true });
    expect(width(separator)).toBe(464);

    fireEvent.keyDown(separator, { key: 'Enter' });
    expect(width(separator)).toBe(400);
  });

  it('forgets a width that is back at the default', () => {
    const separator = open('primary-sidebar');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').widths).toEqual({
      'primary-sidebar': 416,
    });

    fireEvent.keyDown(separator, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem(LAYOUT_STORAGE_KEY) ?? '{}').widths).toEqual({});
  });
});

describe('a window with no room in it', () => {
  it('reports one number for the floor, the ceiling and where it is', () => {
    // 1440 is the three slots at their floors exactly. There is nothing to
    // drag, and saying so is better than moving an edge that springs back.
    const separator = open('primary-sidebar', { width: 1440 });

    expect(separator.getAttribute('aria-valuemin')).toBe('400');
    expect(separator.getAttribute('aria-valuemax')).toBe('400');
    expect(width(separator)).toBe(400);

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(width(separator)).toBe(400);
  });

  it('reports the width on screen, not the one the reader asked for elsewhere', () => {
    // Widened in a window with room, then met at 1440. `aria-valuenow` is the
    // only thing that tells a screen reader user where the edge is; a value
    // that says 480 over a panel drawn at 400 is a lie told to the one reader
    // who cannot see the difference.
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        collapsed: { 'secondary-sidebar': false },
        widths: { 'primary-sidebar': 480 },
        sourcesDismissed: false,
      }),
    );

    // 480 + 32 + 640 + 32 + 432 is 1616 and the window is 1440: the sources
    // panel gives 96 and this panel the last 80, so what is drawn is 400.
    const separator = open('primary-sidebar', { restore: true, width: 1440 });
    expect(width(separator)).toBe(400);
    expect(separator.getAttribute('aria-valuemax')).toBe('400');
  });
});
