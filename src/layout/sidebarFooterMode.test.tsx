import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetViewport, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { Shell } from './Shell';
import { resetFooterMode, setFooterMode } from './footerMode';

/**
 * Simens issue 123: foten festet under rullefeltet, eller sist inne i det og
 * rullende med lista. Her måles hvor den havner, ikke hvordan den ser ut —
 * tallene for begge står i PR-en.
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
  resetFooterMode();
  resetViewport();
});

describe('hvor foten står', () => {
  it('står utenfor rullefeltet som standard', () => {
    open();

    expect(foot()).not.toBeNull();
    expect(scroller()?.contains(foot()!)).toBe(false);
  });

  it('står sist inne i rullefeltet når valget er «ruller med»', () => {
    setFooterMode('scrolls');
    open();

    const region = scroller();
    expect(region?.contains(foot()!)).toBe(true);
    // Sist, ikke hvor som helst: den skal følge etter den siste tråden.
    expect(region?.lastElementChild).toBe(foot());
  });

  it('flytter seg når menyen endrer valget, uten at siden lastes på nytt', () => {
    open();
    expect(scroller()?.contains(foot()!)).toBe(false);

    act(() => {
      setFooterMode('scrolls');
    });

    expect(scroller()?.contains(foot()!)).toBe(true);
  });

  it('har de samme lenkene i begge, og bare ett sett', () => {
    setFooterMode('scrolls');
    open();

    const links = screen.getByRole('list', { name: 'Om Kunnskapsassistenten' });
    expect(within(links).getAllByRole('link')).toHaveLength(3);
    expect(screen.getAllByRole('group', { name: 'Fargemodus' })).toHaveLength(1);
  });

  it('står ikke på skinnen, uansett valg', () => {
    setFooterMode('scrolls');
    open();

    act(() => {
      screen.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    });

    // Skjult panel: innholdet er `hidden`, og da står ingenting å tabbe til.
    expect(scroller()?.hasAttribute('hidden')).toBe(true);
  });
});
