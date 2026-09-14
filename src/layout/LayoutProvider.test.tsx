import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultViewportWidth, setViewportWidth } from '../test/matchMedia';
import { LayoutProvider } from './LayoutProvider';
import { useCitation } from './useCitation';
import { useLayout } from './useLayout';
import { bothSidebarsMinViewport, defaultLayout, withCollapsed, type Layout } from './viewModel';

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

/**
 * Rule B, decided 2026-09-14: below `bothSidebarsMinViewport` the two
 * sidebars cannot both be open, so the provider keeps one.
 *
 * These test the provider and not the CSS. That the widths actually add up to
 * a window is measured against a real browser in tests/e2e/layout.spec.ts;
 * what is in question here is which panel is open, which is state.
 */
function Sidebars() {
  const { layout, setCollapsed } = useLayout();
  const { showCitation } = useCitation();

  return (
    <>
      <output data-testid="primary">
        {layout.slots['primary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <output data-testid="secondary">
        {layout.slots['secondary-sidebar'].collapsed ? 'kollapset' : 'åpen'}
      </output>
      <button type="button" onClick={() => setCollapsed('primary-sidebar', false)}>
        Vis tråder og filter
      </button>
      <button type="button" onClick={() => setCollapsed('secondary-sidebar', false)}>
        Vis kilder
      </button>
      <button type="button" onClick={() => showCitation(1)}>
        Kilde 1
      </button>
    </>
  );
}

/** Both sidebars open, which `defaultLayout` is not: sources starts collapsed. */
const bothSidebarsOpen = withCollapsed(defaultLayout, 'secondary-sidebar', false);

const click = (name: string) => act(() => screen.getByRole('button', { name }).click());

function renderSidebars(initialLayout?: Layout) {
  return render(
    <LayoutProvider initialLayout={initialLayout}>
      <Sidebars />
    </LayoutProvider>,
  );
}

describe('én åpen sidekolonne under brytepunktet', () => {
  beforeEach(() => setViewportWidth(defaultViewportWidth));

  it('lar begge stå åpne på brytepunktet', () => {
    // Exactly at the breakpoint everything fits, to the pixel. The rule is
    // «narrower than», not «narrower than or equal to», and 1440 is the one
    // width where that distinction is the whole design.
    setViewportWidth(bothSidebarsMinViewport);
    renderSidebars();

    click('Vis kilder');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });

  it('kollapser navigasjonspanelet når kildepanelet åpnes under brytepunktet', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();

    click('Vis kilder');

    // The slot the user asked for wins; the other one gives.
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet når navigasjonspanelet åpnes under brytepunktet', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars(bothSidebarsOpen);

    click('Vis tråder og filter');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet når vinduet krymper forbi brytepunktet', () => {
    renderSidebars();
    click('Vis kilder');
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');

    act(() => setViewportWidth(bothSidebarsMinViewport - 1));

    // Nobody asked for anything, so the panel that gives is the one decided
    // in advance: the sources panel.
    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('kollapser kildepanelet med én gang på et vindu som alt er for smalt', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);

    // A layout handed in from outside knows nothing about the window it is
    // about to be drawn in, so the rule cannot wait for a change to react to.
    renderSidebars(bothSidebarsOpen);

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('kollapset');
  });

  it('lar en kildehenvisning følge samme regel', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();

    // A `[n]` in the answer is a request to open the sources panel, and it
    // has to cost the same as pressing the button does.
    click('Kilde 1');

    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
  });

  it('åpner ingenting av seg selv når vinduet vokser igjen', () => {
    setViewportWidth(bothSidebarsMinViewport - 1);
    renderSidebars();
    click('Vis kilder');
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');

    act(() => setViewportWidth(bothSidebarsMinViewport));

    // The rule takes a panel away when there is no room. It does not hand one
    // back: a panel that opened itself because the window grew would undo a
    // choice the user made, and the user is the only one who collapses things
    // on purpose.
    expect(screen.getByTestId('primary').textContent).toBe('kollapset');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });
});

describe('over brytepunktet', () => {
  beforeEach(() => setViewportWidth(defaultViewportWidth));

  it('rører ingenting', () => {
    setViewportWidth(bothSidebarsMinViewport + 96);
    renderSidebars();

    click('Vis kilder');

    expect(screen.getByTestId('primary').textContent).toBe('åpen');
    expect(screen.getByTestId('secondary').textContent).toBe('åpen');
  });
});
