import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { resetViewport } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * The sidebars' scrolling region takes the keyboard while it scrolls (axe's
 * `scrollable-region-focusable`, found by KA CC in bff mode with no BFF).
 *
 * jsdom lays nothing out, so the two things the shell measures are handed to
 * it: whether the region is taller inside than it is drawn, and when the
 * observer fires. Everything else is the real shell under the real provider.
 */
const observers = new Set<() => void>();

class FakeResizeObserver {
  #callback: () => void;
  constructor(callback: () => void) {
    this.#callback = callback;
  }
  observe() {
    observers.add(this.#callback);
  }
  unobserve() {}
  disconnect() {
    observers.delete(this.#callback);
  }
}

const original = globalThis.ResizeObserver;
globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
afterAll(() => {
  globalThis.ResizeObserver = original;
  // Own properties on the prototype, so deleting them brings jsdom's back.
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollHeight');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

/** How tall the region's content is against the region, for the next measurement. */
let tall = false;
const isRegion = (element: Element) => element.classList.contains('sidebar-content');
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return isRegion(this) && tall ? 1200 : 600;
  },
});
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 600;
  },
});

function resize(scrolls: boolean) {
  tall = scrolls;
  act(() => {
    for (const measure of observers) measure();
  });
}

function open() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LayoutProvider>
        <Routes>
          <Route path="/" element={<Shell />} />
        </Routes>
      </LayoutProvider>
    </MemoryRouter>,
  );
}

const region = () => screen.queryByRole('group', { name: 'Tråder og filter' });

beforeEach(() => {
  localStorage.clear();
  resetViewport();
  observers.clear();
  tall = false;
});

describe('the navigation panel’s scrolling region', () => {
  it('is no tab stop while its content fits', () => {
    open();

    expect(region()).toBeNull();
    expect(
      document.querySelector('.primary-sidebar .sidebar-content')?.hasAttribute('tabindex'),
    ).toBe(false);
  });

  it('takes the keyboard, with the panel’s name, once it scrolls', () => {
    open();

    resize(true);

    expect(region()?.getAttribute('tabindex')).toBe('0');
  });

  it('keeps the focus it has when it stops scrolling, and lets go on blur', () => {
    open();
    resize(true);
    act(() => region()?.focus());

    resize(false);

    // Still focusable while it holds the focus: taking that away would hand
    // the focus to <body>.
    expect(document.activeElement).toBe(region());

    act(() => (document.activeElement as HTMLElement).blur());

    expect(region()).toBeNull();
  });
});
