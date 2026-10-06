import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';

/**
 * Foten i navigasjonspanelet ruller med innholdet, sist i rullefeltet, og er
 * ikke festet nederst (digdir/kunnskapsassistenten#123). Her måles hvor den
 * havner, ikke hvordan den ser ut; skjermbildene står i PR-en.
 */
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function open(width = 1440) {
  setViewportWidth(width);
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

const foot = () => document.querySelector('.sidebar-footer');
const scroller = () => document.querySelector('.primary-sidebar .sidebar-content');

beforeEach(() => {
  localStorage.clear();
  resetViewport();
});

describe('foten i panelet', () => {
  it('står sist inne i rullefeltet, etter innholdet', () => {
    open();

    const region = scroller();
    expect(foot()).not.toBeNull();
    // Sist, ikke hvor som helst: den skal følge etter den siste tråden.
    expect(region?.lastElementChild).toBe(foot());
  });

  it('bryr seg ikke om et valg som ligger igjen i nettleseren', () => {
    // «Festet» var et valg i #innstillinger før #123. En nettleser kan ha det
    // lagret, og det skal ikke feste foten igjen.
    localStorage.setItem('ka.footer-mode', 'pinned');
    open();

    expect(scroller()?.lastElementChild).toBe(foot());
  });

  it('har lenkene og fargemodus, og bare ett sett', () => {
    open();

    const links = screen.getByRole('list', { name: 'Om Kunnskapsassistenten' });
    expect(within(links).getAllByRole('link')).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);
    expect(document.querySelectorAll('.sidebar-footer')).toHaveLength(1);
  });

  it('står ikke på skinnen', () => {
    open();

    act(() => {
      screen.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    });

    // Skjult panel: innholdet er `hidden`, og foten står i det.
    expect(scroller()?.hasAttribute('hidden')).toBe(true);
    expect(scroller()?.contains(foot()!)).toBe(true);
  });
});

/**
 * Skuffen, som er panelet under 1139. KA CC fant på #231 at alle testene var
 * grønne med foten tegnet to steder i skuffen, så antallet måles her.
 */
describe('foten i skuffen', () => {
  function openDrawer() {
    open(440);
    act(() => {
      screen.getByRole('button', { name: 'Vis tråder og filter' }).click();
    });
    return screen.getByRole('dialog', { name: 'Tråder og filter' });
  }

  it('står sist i rullefeltet i skuffen, og bare én gang', () => {
    const drawer = openDrawer();

    const region = drawer.querySelector('.sidebar-content');
    const inDrawer = drawer.querySelector('.sidebar-footer');
    expect(drawer.querySelectorAll('.sidebar-footer')).toHaveLength(1);
    expect(region?.lastElementChild).toBe(inDrawer);
    expect(within(drawer).getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);
  });
});
