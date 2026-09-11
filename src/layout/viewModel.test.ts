import { describe, expect, it } from 'vitest';
import {
  defaultLayout,
  layoutStyle,
  slotLabel,
  slotOf,
  withCollapsed,
  withViewMoved,
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

  it('gives the flexible slot bounds rather than a width', () => {
    const style = layoutStyle(defaultLayout);
    expect(style['--ka-main-min-width']).toBe('640px');
    expect(style['--ka-main-max-width']).toBe('800px');
    expect(style['--ka-main-width']).toBeUndefined();
  });
});
