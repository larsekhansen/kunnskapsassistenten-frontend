import { describe, expect, it } from 'vitest';
import {
  bothSidebarsMinViewport,
  defaultLayout,
  layoutStyle,
  narrowViewportQuery,
  otherSidebar,
  slotLabel,
  slotOf,
  withCollapsed,
  withOneSidebarOpen,
  withViewMoved,
  withWidth,
} from './viewModel';

describe('slotLabel', () => {
  it('names a slot after the views in it, in Norwegian', () => {
    expect(slotLabel(defaultLayout, 'primary-sidebar')).toBe('Tråder og filter');
    expect(slotLabel(defaultLayout, 'secondary-sidebar')).toBe('Kilder');
  });

  it('leaves main unnamed, because it is unique on the page', () => {
    expect(slotLabel(defaultLayout, 'main')).toBeUndefined();
  });
});

describe('withViewMoved', () => {
  it('moves the name with the view', () => {
    const moved = withViewMoved(defaultLayout, 'sources', 'primary-sidebar');

    expect(slotOf(moved, 'sources')).toBe('primary-sidebar');
    expect(slotLabel(moved, 'primary-sidebar')).toBe('Tråder og filter og kilder');
    expect(slotLabel(moved, 'secondary-sidebar')).toBeUndefined();
  });

  it('collapses a slot with no views remaining', () => {
    const moved = withViewMoved(defaultLayout, 'sources', 'main');
    expect(moved.slots['secondary-sidebar'].collapsed).toBe(true);
  });

  it('keeps the layout untouched when the view is already there', () => {
    expect(withViewMoved(defaultLayout, 'sources', 'secondary-sidebar')).toBe(defaultLayout);
  });
});

describe('layoutStyle', () => {
  it('reports the collapsed width for a collapsed slot', () => {
    expect(layoutStyle(defaultLayout)['--ka-secondary-sidebar-width']).toBe('198px');

    const open = withCollapsed(defaultLayout, 'secondary-sidebar', false);
    expect(layoutStyle(open)['--ka-secondary-sidebar-width']).toBe('432px');
  });

  it('gives the sources panel a floor to shrink to, and none when collapsed', () => {
    const open = withCollapsed(defaultLayout, 'secondary-sidebar', false);
    expect(layoutStyle(open)['--ka-secondary-sidebar-min-width']).toBe('336px');

    // Collapsed, the floor is the collapsed width: there is one button left
    // in the panel and it is not something to squeeze.
    expect(layoutStyle(defaultLayout)['--ka-secondary-sidebar-min-width']).toBe('198px');
  });

  it('gives the navigation panel no floor, because it never gives way', () => {
    expect(layoutStyle(defaultLayout)['--ka-primary-sidebar-min-width']).toBeUndefined();

    // 400 open, 236 collapsed: «Vis tråder og filter» is a 195.78 px button,
    // the slot keeps 36 px against the edge of the window and spends 1 px on
    // its own border. tests/e2e/layout.spec.ts measures the label itself.
    expect(layoutStyle(defaultLayout)['--ka-primary-sidebar-width']).toBe('400px');
    const collapsed = withCollapsed(defaultLayout, 'primary-sidebar', true);
    expect(layoutStyle(collapsed)['--ka-primary-sidebar-width']).toBe('236px');
  });

  it('gives the flexible slot bounds rather than a width', () => {
    const style = layoutStyle(defaultLayout);
    expect(style['--ka-main-max-width']).toBe('800px');
    expect(style['--ka-main-width']).toBeUndefined();
  });

  it('lowers the answer column floor when nothing stands beside it', () => {
    // 640 exists so the sources can be read next to the answer. With the
    // sources panel collapsed there is nothing next to it, and 618 is what
    // 1280 leaves once the navigation panel and the collapsed sources panel
    // have taken theirs. Decision 2026-09-14.
    expect(layoutStyle(defaultLayout)['--ka-main-min-width']).toBe('618px');

    const open = withCollapsed(defaultLayout, 'secondary-sidebar', false);
    expect(layoutStyle(open)['--ka-main-min-width']).toBe('640px');
  });
});

describe('bothSidebarsMinViewport', () => {
  it('is the three slots at their floors plus the two gaps', () => {
    // 400 + 32 + 640 + 32 + 336. Written out here as the number a person can
    // check against the decision, while the constant itself is summed from
    // the widths so the two cannot drift apart unnoticed.
    //
    // 640 and not the 618 the answer column may fall to: this is the width
    // where both sidebars are open, and the lower floor only applies with the
    // sources panel collapsed.
    expect(bothSidebarsMinViewport).toBe(1440);
  });

  it('asks «narrower than», so the breakpoint width itself still fits', () => {
    expect(narrowViewportQuery).toBe('(width < 1440px)');
  });
});

describe('withOneSidebarOpen', () => {
  const bothOpen = withCollapsed(defaultLayout, 'secondary-sidebar', false);

  it('collapses the sidebar that is not the one to keep', () => {
    expect(
      withOneSidebarOpen(bothOpen, 'secondary-sidebar').slots['primary-sidebar'].collapsed,
    ).toBe(true);
    expect(
      withOneSidebarOpen(bothOpen, 'primary-sidebar').slots['secondary-sidebar'].collapsed,
    ).toBe(true);
  });

  it('does nothing when the one to keep is collapsed itself', () => {
    // Otherwise collapsing the navigation panel would close the sources panel
    // with it and leave the user with neither.
    const onlySources = withCollapsed(bothOpen, 'primary-sidebar', true);
    expect(withOneSidebarOpen(onlySources, 'primary-sidebar')).toBe(onlySources);
  });

  it('does nothing when only one is open already', () => {
    expect(withOneSidebarOpen(defaultLayout, 'primary-sidebar')).toBe(defaultLayout);
  });

  it('pairs the two sidebars', () => {
    expect(otherSidebar('primary-sidebar')).toBe('secondary-sidebar');
    expect(otherSidebar('secondary-sidebar')).toBe('primary-sidebar');
  });
});

describe('withWidth', () => {
  it('will not drag the sources panel below the width it may shrink to', () => {
    const narrower = withWidth(defaultLayout, 'secondary-sidebar', 200);
    expect(narrower.slots['secondary-sidebar'].sizing).toMatchObject({ width: 336 });
  });

  it('ignores the answer column, which has no width of its own', () => {
    expect(withWidth(defaultLayout, 'main', 700)).toBe(defaultLayout);
  });
});
