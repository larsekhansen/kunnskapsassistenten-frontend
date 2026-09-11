/**
 * The view model for the layout: slots, views, and which view sits where.
 *
 * Naming follows the rule Lars set on 2026-09-11 (design/_briefs/bygg/regler.md):
 * code is English, everything the user sees or hears is Norwegian. Slots are
 * named after position, views after content — the same split VS Code makes.
 *
 *   Slot   a place in the layout. Fixed, three of them.
 *   View   content that can be moved between slots.
 *
 * A slot never carries a fixed accessible name. The name comes from the views
 * that currently sit in it, which is why `slotLabel()` derives it. Moving
 * SourcesView into the primary sidebar must move its name with it, otherwise
 * the accessible name lies to a screen reader user.
 *
 * This file is the abstraction only (answers 10 and 48 in
 * design/skal-dette-implementeres.md). There is deliberately no UI for
 * switching layouts, no drag handles and no persistence yet. The abstraction
 * comes first because slot content, slot width and the mode switching in both
 * sidebars are the same problem; solved once, four open questions disappear.
 * LayoutProvider holds the state and the operations a future UI would call.
 */

/** A place in the layout. Named after position, never after content. */
export type Slot = 'primary-sidebar' | 'main' | 'secondary-sidebar';

/** Content that can be moved between slots. Named after content. */
export type ViewId = 'threads' | 'filters' | 'chat' | 'sources';

export type View = {
  id: ViewId;
  /**
   * Norwegian. User-visible: used as the heading in the slot and as the
   * source of the slot's accessible name. Never hardcode this in markup.
   */
  label: string;
};

/** Every view in the product, with its Norwegian label. */
export const views: Record<ViewId, View> = {
  threads: { id: 'threads', label: 'Tråder' },
  filters: { id: 'filters', label: 'Filter' },
  chat: { id: 'chat', label: 'Chat' },
  sources: { id: 'sources', label: 'Kilder' },
};

/**
 * How wide a slot is. Two modes, because the design has two kinds of slot:
 * sidebars hold a width, the answer column takes what remains within bounds.
 *
 * Widths are content widths in CSS pixels, written into CSS custom properties
 * by the shell. They are numbers rather than `--ds-size-*` tokens because
 * none of them sit on Designsystemet's spacing scale: they are measurements
 * from the page template. Padding and gaps do use the tokens.
 *
 * A drag handle, when it arrives, writes `width` here and changes nothing
 * else. That is the whole point of putting the numbers in the model.
 */
export type SlotSizing =
  | { mode: 'fixed'; width: number; collapsedWidth: number }
  | { mode: 'flexible'; minWidth: number; maxWidth: number };

/**
 * What the shell hands a view. Every view takes the same props, so a view can
 * be mounted in any slot without the shell knowing what it is.
 *
 * The slot owns collapsed/open, not the view: a view that hid itself would
 * leave the toggle button lying about its own state. The view asks with
 * `onCollapsedChange`.
 */
export type SlotViewProps = {
  /** Which view the shell is rendering. A view may ignore it. */
  view: ViewId;
  /** Whether the slot this view sits in is collapsed. */
  collapsed: boolean;
  /** Ask the slot to collapse or open. */
  onCollapsedChange: (collapsed: boolean) => void;
  /**
   * The citation the user last asked to see, for a view that shows sources.
   * Undefined until someone activates a `[n]` marker.
   */
  activeCitationNumber?: number;
  /**
   * Counts up on every request, including a repeat of the same number, so a
   * view can react to being asked twice for the same citation.
   */
  activeCitationNonce?: number;
  /**
   * The other views in the same slot, in declared order. The primary sidebar
   * shows filters or threads, and this is how a view knows the other one is
   * there to switch to.
   */
  siblingViews: ViewId[];
  /** Switch the slot to another view it holds. */
  onShowView: (view: ViewId) => void;
  /**
   * True when the user switched to this view, false when the page simply
   * opened on it.
   *
   * Two views in one slot are modes of one panel: switching unmounts the view
   * the button stood in, and focus falls to `document.body`. The view that
   * mounts has to claim it back. But a view cannot tell «the user switched to
   * me» from «the page just loaded» on its own, since both are a first mount
   * and `defaultLayout` opens on filters (answer 1). Claiming focus on a page
   * load would jump the user past the skip link.
   *
   * Only the layout knows the difference, because only the layout is told to
   * switch. Read it on mount and move focus when it is true.
   */
  switchedByUser: boolean;
};

export type SlotState = {
  slot: Slot;
  /**
   * Views placed in this slot. More than one means the user switches between
   * them; the primary sidebar shows either threads or filters, never both.
   */
  views: ViewId[];
  /** The view currently shown. Must be one of `views`. */
  activeView: ViewId;
  /** Collapsed to a single button? */
  collapsed: boolean;
  sizing: SlotSizing;
};

export type Layout = {
  id: string;
  /** Norwegian, for a future layout switcher. */
  label: string;
  slots: Record<Slot, SlotState>;
};

/**
 * The default layout, which is what the design shows today.
 *
 * The secondary sidebar starts collapsed and opens once the conversation has
 * produced sources worth citing.
 */
export const defaultLayout: Layout = {
  id: 'default',
  label: 'Standard',
  slots: {
    'primary-sidebar': {
      slot: 'primary-sidebar',
      // Order matters: `views` is the declared set, and slotLabel() joins the
      // labels in this order, so this is what produces «Tråder og filter».
      // Which one is shown is `activeView`, not the array order.
      views: ['threads', 'filters'],
      // A first-time user lands on filters, not on the thread list (answer 1).
      activeView: 'filters',
      collapsed: false,
      // 328 is the inner width Lars settled on 2026-09-11 (answer 59b).
      // The collapsed width is not drawn anywhere; 198 matches the collapsed
      // secondary sidebar in the page template, so both collapse to the same
      // width and the shell stays symmetric. Revisit when it is drawn.
      sizing: { mode: 'fixed', width: 328, collapsedWidth: 198 },
    },
    main: {
      slot: 'main',
      views: ['chat'],
      activeView: 'chat',
      collapsed: false,
      // 640 is a hard floor, not a preference: the sources must be readable
      // beside the answer (answers 46, 49 and 59).
      sizing: { mode: 'flexible', minWidth: 640, maxWidth: 800 },
    },
    'secondary-sidebar': {
      slot: 'secondary-sidebar',
      // The tools menu and notes arrive as views here later, in this same
      // slot as sources (answers 22, 49 and 52). Not in the first version.
      views: ['sources'],
      activeView: 'sources',
      collapsed: true,
      // 198 collapsed comes from the page template. The open width is still
      // Lars's to settle (question 26), and the template does not measure it:
      // it draws the sources column collapsed only. The organism frames are
      // the only numbers that exist, 410–560 px for `kilder` and 434–466 px
      // for `right-sidebar`, and 432 sits inside both.
      //
      // What that buys: 328 + 32 + 640 + 32 + 432 = 1464 px is the narrowest
      // window where all three slots are open with the answer column still at
      // its 640 px floor. A 1536 px laptop has 72 px left over, and the answer
      // column takes it, because it is the only flexible slot.
      //
      // Figma's 514 is not used. It comes from a frame under
      // design/omraader/september-2026/brukes-ikke/, it disagrees with the
      // `right-sidebar` organism it instantiates, and it sums to 1471 inside
      // its own 1440 px frame.
      sizing: { mode: 'fixed', width: 432, collapsedWidth: 198 },
    },
  },
};

/** Slots in the order the layout wants to render them. */
export const slotOrder: Slot[] = ['primary-sidebar', 'main', 'secondary-sidebar'];

/**
 * The accessible name for a slot, in Norwegian, derived from the views in it.
 *
 * Joined with « og », and only the first label keeps its capital letter,
 * because that is how Norwegian works: «Tråder og filter», not
 * «Tråder og Filter».
 *
 * Returns undefined for a slot that needs no accessible name. `<main>` is
 * unique on the page, so naming it adds noise for a screen reader user.
 */
export function slotLabel(layout: Layout, slot: Slot): string | undefined {
  if (slot === 'main') return undefined;

  const labels = layout.slots[slot].views.map((id) => views[id].label);
  if (labels.length === 0) return undefined;

  return labels
    .map((label, index) => (index === 0 ? label : label.toLocaleLowerCase('nb-NO')))
    .join(' og ');
}

/** The slot a view currently sits in, or undefined if it sits nowhere. */
export function slotOf(layout: Layout, view: ViewId): Slot | undefined {
  return slotOrder.find((slot) => layout.slots[slot].views.includes(view));
}

/** Show `view` in its slot. No-op if the view is not in that slot. */
export function withActiveView(layout: Layout, slot: Slot, view: ViewId): Layout {
  const state = layout.slots[slot];
  if (!state.views.includes(view) || state.activeView === view) return layout;
  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, activeView: view } },
  };
}

export function withCollapsed(layout: Layout, slot: Slot, collapsed: boolean): Layout {
  const state = layout.slots[slot];
  if (state.collapsed === collapsed) return layout;
  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, collapsed } },
  };
}

/** Resize a slot. Clamped by the sizing mode; flexible slots ignore it. */
export function withWidth(layout: Layout, slot: Slot, width: number): Layout {
  const state = layout.slots[slot];
  if (state.sizing.mode !== 'fixed' || state.sizing.width === width) return layout;
  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, sizing: { ...state.sizing, width } } },
  };
}

/**
 * Move a view to another slot. There is no UI for this yet; it exists so the
 * model can carry the feature the day the UI arrives (answers 10 and 48).
 *
 * A slot that loses its active view falls back to the first view it still
 * has, and a slot with no views remaining is collapsed — an empty slot has nothing to
 * name itself after, and an unnamed landmark is worse than no landmark.
 */
export function withViewMoved(layout: Layout, view: ViewId, target: Slot): Layout {
  const source = slotOf(layout, view);
  if (!source || source === target) return layout;

  const from = layout.slots[source];
  const remaining = from.views.filter((id) => id !== view);
  const to = layout.slots[target];

  return {
    ...layout,
    slots: {
      ...layout.slots,
      [source]: {
        ...from,
        views: remaining,
        activeView: remaining[0] ?? from.activeView,
        collapsed: remaining.length === 0 ? true : from.collapsed,
      },
      [target]: {
        ...to,
        views: [...to.views, view],
        activeView: view,
        collapsed: false,
      },
    },
  };
}

/**
 * The slot widths as CSS custom properties, for the shell's inline style.
 * A collapsed slot reports its collapsed width, so CSS never has to know
 * which state the slot is in.
 */
export function layoutStyle(layout: Layout): Record<string, string> {
  const style: Record<string, string> = {};
  for (const slot of slotOrder) {
    const state = layout.slots[slot];
    if (state.sizing.mode === 'fixed') {
      const width = state.collapsed ? state.sizing.collapsedWidth : state.sizing.width;
      style[`--ka-${slot}-width`] = `${width}px`;
    } else {
      style[`--ka-${slot}-min-width`] = `${state.sizing.minWidth}px`;
      style[`--ka-${slot}-max-width`] = `${state.sizing.maxWidth}px`;
    }
  }
  return style;
}
