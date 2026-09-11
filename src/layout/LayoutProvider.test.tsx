import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { LayoutProvider } from './LayoutProvider';
import { useLayout } from './useLayout';

/**
 * Reads the signal a view uses to decide whether to take focus on mount, and
 * exposes the switch so a test can pull it.
 */
function Probe() {
  const { isSwitchedByUser, setActiveView, layout } = useLayout();
  return (
    <>
      <output data-testid="active">{layout.slots['primary-sidebar'].activeView}</output>
      <output data-testid="switched">{String(isSwitchedByUser('primary-sidebar'))}</output>
      <button type="button" onClick={() => setActiveView('primary-sidebar', 'threads')}>
        Tråder
      </button>
      <button type="button" onClick={() => setActiveView('primary-sidebar', 'sources')}>
        Kilder
      </button>
    </>
  );
}

const read = (id: string) => screen.getByTestId(id).textContent;

describe('isSwitchedByUser', () => {
  it('is false on a page load, so nothing is taken from the skip link', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    // defaultLayout opens the primary sidebar on filters (answer 1). A view
    // that mounts for that reason was not asked for by anybody.
    expect(read('active')).toBe('filters');
    expect(read('switched')).toBe('false');
  });

  it('is true for the view the user switched to', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    act(() => screen.getByRole('button', { name: 'Tråder' }).click());

    expect(read('active')).toBe('threads');
    expect(read('switched')).toBe('true');
  });

  it('stays false when the request changed nothing', () => {
    render(
      <LayoutProvider>
        <Probe />
      </LayoutProvider>,
    );

    // `sources` does not sit in the primary sidebar, so the switch is ignored
    // and no view mounted that could claim focus.
    act(() => screen.getByRole('button', { name: 'Kilder' }).click());

    expect(read('active')).toBe('filters');
    expect(read('switched')).toBe('false');
  });
});
