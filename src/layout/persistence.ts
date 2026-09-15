/**
 * What the layout remembers from one visit to the next.
 *
 * Until now `localStorage` held one thing, the colour scheme, and everything
 * else started over on every reload: collapse a panel, tick three filters,
 * press F5, and all of it is back to `defaultLayout`. Finding in reise 16 of
 * design/brukerreiser-2026-09-15.md, punkt 9 on the ranked list. The vision is
 * a workspace where the reader decides what sits where (answers 10 and 48),
 * and that starts with the choice surviving a reload.
 *
 * Two keys, both carrying a version, because the two hold different kinds of
 * thing and go stale for different reasons:
 *
 *   ka.layout.v1  which sidebars are collapsed, and whether the reader has
 *                 said no to the sources panel. Shaped by the slots, which
 *                 change when the layout model changes.
 *   ka.filter.v1  the document filter. Shaped by the CORPUS: the values are
 *                 the keys the backend filters on, so a new corpus can make
 *                 every stored value meaningless. Bump the version then.
 *
 * `ka.color-scheme` in colorScheme.ts is the third and stays where it is: it
 * is applied before React exists, by an inline script in index.html.
 *
 * Every access is guarded, the same way and for the same reason as the colour
 * scheme: `localStorage` throws outright in Safari's private mode and with
 * site data blocked, and can hold anything at all, since the reader is free to
 * edit it. A remembered panel is never worth a blank page, so a bad value is
 * dropped and the app opens on its defaults.
 *
 * Widths are deliberately not here. Nothing can change them yet — the drag
 * handle is answer 10's «later» — and remembering a number no one can produce
 * only makes something to migrate the day the handle arrives.
 */

import { emptyFilterSelection, type FilterDimension, type FilterSelection } from '../model';
import { sidebarSlots, withCollapsed, type Layout, type SidebarSlot } from './viewModel';

export const LAYOUT_STORAGE_KEY = 'ka.layout.v1';
export const FILTER_STORAGE_KEY = 'ka.filter.v1';

/** The layout state worth remembering. Everything else is derived or fixed. */
export type StoredLayout = {
  /** Per sidebar. A slot missing here simply keeps whatever the default says. */
  collapsed: Partial<Record<SidebarSlot, boolean>>;
  /**
   * Has the reader said, in so many words, that they do not want the sources
   * panel?
   *
   * It has to be stored next to `collapsed` and not derived from it, because
   * collapsed is also the default. Without it, «I closed this» is
   * indistinguishable from «I have not opened it yet» after a reload, and the
   * first answer with sources would push the panel back in the face of
   * somebody who had just shut it. See LayoutProvider.
   */
  sourcesDismissed: boolean;
};

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    // Unreadable or not JSON at all. Either way there is nothing to restore.
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignored on purpose: the choice still holds for this page load.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the remembered layout, or undefined when there is nothing usable.
 *
 * Every field is checked rather than trusted. This is a string the reader can
 * edit by hand, and a `collapsed` that is the number 3 would otherwise reach
 * `aria-expanded`.
 */
export function readStoredLayout(): StoredLayout | undefined {
  const value = readJson(LAYOUT_STORAGE_KEY);
  if (!isRecord(value)) return undefined;

  const stored = isRecord(value.collapsed) ? value.collapsed : {};
  const collapsed: Partial<Record<SidebarSlot, boolean>> = {};
  for (const slot of sidebarSlots) {
    if (typeof stored[slot] === 'boolean') collapsed[slot] = stored[slot];
  }

  return { collapsed, sourcesDismissed: value.sourcesDismissed === true };
}

export function writeStoredLayout(layout: Layout, sourcesDismissed: boolean): void {
  const collapsed: Partial<Record<SidebarSlot, boolean>> = {};
  for (const slot of sidebarSlots) collapsed[slot] = layout.slots[slot].collapsed;
  writeJson(LAYOUT_STORAGE_KEY, { collapsed, sourcesDismissed });
}

/**
 * Apply what was remembered to a layout.
 *
 * Only collapse, and only for the slots that were stored. The rest of the
 * layout — which views exist, which one is active, the widths — comes from
 * the code, so a stored value can never resurrect a slot that has been
 * removed or a view that has been renamed.
 *
 * It can produce a layout that breaks rule B, with both sidebars open in a
 * window too narrow for them. That is fine and is not fixed here:
 * `LayoutProvider` applies the rule on the first render precisely because
 * `initialLayout` cannot be assumed to know about the window.
 */
export function withStoredCollapse(layout: Layout, stored: StoredLayout | undefined): Layout {
  if (!stored) return layout;

  let next = layout;
  for (const slot of sidebarSlots) {
    const collapsed = stored.collapsed[slot];
    if (collapsed !== undefined) next = withCollapsed(next, slot, collapsed);
  }
  return next;
}

/** The dimensions, from the empty selection, so there is one list of them. */
const dimensions = Object.keys(emptyFilterSelection) as FilterDimension[];

/**
 * Read the remembered filter.
 *
 * A dimension that is missing or malformed comes back empty, which is the
 * same as «no restriction on this dimension». Values are not checked against
 * the corpus: the facets are loaded asynchronously by the filter view, they
 * differ between mock and live, and a selection the current corpus has no
 * documents for is a real, honest state — the counts say zero.
 */
export function readStoredFilter(): FilterSelection | undefined {
  const value = readJson(FILTER_STORAGE_KEY);
  if (!isRecord(value)) return undefined;

  const selection: FilterSelection = { ...emptyFilterSelection };
  for (const dimension of dimensions) {
    const values = value[dimension];
    if (Array.isArray(values) && values.every((entry) => typeof entry === 'string')) {
      selection[dimension] = values;
    }
  }
  return selection;
}

export function writeStoredFilter(selection: FilterSelection): void {
  writeJson(FILTER_STORAGE_KEY, selection);
}
