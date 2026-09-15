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
 * How wide a slot is. Three modes, because the shell has three kinds of slot:
 * one sidebar holds its width, one gives way, and the answer column takes
 * what remains within bounds.
 *
 * Widths are the width the slot OCCUPIES, in CSS pixels, padding included,
 * written into CSS custom properties by the shell. They are numbers rather
 * than `--ds-size-*` tokens because none of them sit on Designsystemet's
 * spacing scale: they are measurements from the page template. Padding and
 * gaps do use the tokens.
 *
 * A drag handle, when it arrives, writes `width` here and changes nothing
 * else. That is the whole point of putting the numbers in the model.
 */
export type SlotSizing =
  /**
   * Has a width of its own, between a floor and a ceiling. Both sidebars.
   *
   * `width` is what the slot asks for; `minWidth` and `maxWidth` are the
   * bounds a drag may not leave, and the floor the window may squeeze it to.
   * It was two modes until 2026-09-15 — one that held its width and one that
   * gave way — and the drag handle collapsed them into one: a panel the user
   * has widened DOES give way, back to the width it had before.
   *
   * Which of the two gives first is a rule rather than a mode, and it is
   * written out in `fittedWidths` below, where it can be read and tested.
   */
  | { mode: 'sized'; width: number; minWidth: number; maxWidth: number; collapsedWidth: number }
  /** Takes what is left, between bounds. The answer column, and only it. */
  | { mode: 'flexible'; minWidth: number; maxWidth: number };

/**
 * The narrowest a slot can be drawn while open, which is what the breakpoint
 * below is summed from.
 */
export function slotFloor(sizing: SlotSizing): number {
  return sizing.minWidth;
}

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
 * How wide a collapsed sidebar is: a rail holding its toggle button, and
 * nothing else.
 *
 * Decided 2026-09-15, after Lars looked at the collapsed navigation panel in
 * dark mode and said the hidden column did not read as hidden. It was 236 px
 * of empty surface with one button at the top, and the point of collapsing a
 * panel is to give the space back.
 *
 * Derived from the button, the way 198 and 236 were derived from theirs:
 *
 *   42  the toggle button once it is icon-only. Designsystemet draws a
 *       `data-size="sm"` Button with `icon` as a 42 px square — that is
 *       `min-inline-size: 42px`, border included. Measured in the built app,
 *       2026-09-15, not taken from the token scale.
 *   +24 `--ds-size-3` on each side, so the button sits clear of both edges.
 *   + 1 the rail's own border against the answer column. `box-sizing:
 *       border-box` takes it out of the content box, and forgetting that term
 *       is exactly what made 232 draw a two-line label on 2026-09-14.
 *   = 67
 *
 * The same number for both sidebars, which needs the border on both: the
 * navigation panel already had one, the sources panel gets one when it is a
 * rail. Two rails of different widths would read as a mistake rather than as
 * a pair.
 *
 * The CSS that draws this is in global.css and has to agree; the numbers live
 * here and tests/e2e/layout.spec.ts measures what is actually drawn.
 */
export const railWidth = 67;

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
      // Every width here is what the slot OCCUPIES, padding included, because
      // the CSS is border-box. 400 = the 328 inner width Lars settled on
      // 2026-09-11 (answer 59b) plus the 36 px padding on each side, and 400
      // is also what the page template draws the navigation panel at.
      //
      // Collapsed, this slot is a rail; see `railWidth`. It was 236 until
      // 2026-09-15, wide enough to draw «Vis tråder og filter» on one line,
      // which turned out to be the wrong thing to be wide enough for.
      //
      // The bounds are the drag handle's, added 2026-09-15 (rolle-5i). 400 is
      // the floor as well as the default: the panel may be widened and never
      // narrowed, because 328 inner is what the filter controls were drawn
      // for. 480 is the ceiling Lars set — 408 inner, room for a longer
      // document title on one line, and still short of the answer column's
      // own 640 floor at 1280 with the sources panel railed
      // (480 + 32 + 640 + 67 = 1219).
      sizing: {
        mode: 'sized',
        width: 400,
        minWidth: 400,
        maxWidth: 480,
        collapsedWidth: railWidth,
      },
    },
    main: {
      slot: 'main',
      views: ['chat'],
      activeView: 'chat',
      collapsed: false,
      // 640 is a hard floor, not a preference: the sources must be readable
      // beside the answer (answers 46, 49 and 59).
      //
      // It briefly had a second, lower floor of 618, for the one state that
      // did not fit at 1280 — navigation panel open, sources panel collapsed,
      // 400 + 32 + 640 + 32 + 198 = 1302. The rail removed the reason: that
      // state is now 400 + 32 + 640 + 64 = 1136, so the floor holds
      // everywhere and there is nothing left to make an exception for.
      // Decision 2026-09-15.
      sizing: { mode: 'flexible', minWidth: 640, maxWidth: 800 },
    },
    'secondary-sidebar': {
      slot: 'secondary-sidebar',
      // The tools menu and notes arrive as views here later, in this same
      // slot as sources (answers 22, 49 and 52). Not in the first version.
      views: ['sources'],
      activeView: 'sources',
      collapsed: true,
      // Collapsed, this slot is a rail; see `railWidth`. The page template
      // draws it at 198, wide enough for «Vis kilder» on one line, and that
      // is what 2026-09-15 replaced.
      //
      // The open width is a range, not a number, and that is the decision of
      // 2026-09-14 (option A): this is the one slot that gives way when the
      // window runs short. 432 preferred, 336 at its narrowest.
      //
      //   432  sits inside both organism frames — 410–560 px for `kilder`,
      //        434–466 px for `right-sidebar` — which are the only widths
      //        that exist for it; the page template draws this column
      //        collapsed only and never measures it open.
      //        400 + 32 + 640 + 32 + 432 = 1536, the narrowest window where
      //        all three slots are open at their preferred widths with the
      //        answer column still on its 640 floor, and the common laptop
      //        width exactly.
      //   336  what is left at 1440, the width every frame in
      //        design/omraader/ is drawn at:
      //        1440 − 400 − 32 − 640 − 32 = 336. It is also the floor of the
      //        `kilder` organism minus its own padding, so an excerpt card
      //        still has room to be read.
      //
      // Below 1440 both sidebars can no longer be open at once, and
      // LayoutProvider collapses this one. See `bothSidebarsMinViewport`.
      //
      // Figma's 514 is not used. It comes from a frame under
      // design/omraader/september-2026/brukes-ikke/, it disagrees with the
      // `right-sidebar` organism it instantiates, and it sums to 1471 inside
      // its own 1440 px frame.
      //
      // 560 is the ceiling, and it is the top of the `kilder` organism frame
      // quoted above — the widest this column is drawn anywhere in the
      // design. The floor stays 336, which is both the drag's floor and the
      // width the window may squeeze it to.
      sizing: {
        mode: 'sized',
        width: 432,
        minWidth: 336,
        maxWidth: 560,
        collapsedWidth: railWidth,
      },
    },
  },
};

/** Slots in the order the layout wants to render them. */
export const slotOrder: Slot[] = ['primary-sidebar', 'main', 'secondary-sidebar'];

/**
 * The gap between an OPEN panel and the answer column, in CSS pixels.
 *
 * Only between open panels. A collapsed sidebar is a rail and sits flush
 * against the answer column, with no gap at all (decision 2026-09-15): a
 * rail already reads as an edge, and 32 px of tinted page beside a 67 px
 * rail reads as the hole Lars saw rather than as a collapsed column.
 *
 * It mirrors `--ka-slot-gap` in src/styles/global.css, which is
 * `var(--ds-size-8)` — 32 px. The number has to exist twice because the
 * breakpoint below is arithmetic and CSS cannot hand a number to JavaScript.
 * It is not taken on trust: tests/e2e/layout.spec.ts loads the shell at
 * exactly `bothSidebarsMinViewport` and fails the moment the two drift apart.
 */
export const slotGap = 32;

/**
 * The narrowest window where both sidebars can be open at the same time.
 *
 * Not a device width and not a round number: it is the sum of what the three
 * slots need when none of them has any room to spare — the navigation panel
 * at its only width, the answer column on its 640 px floor, the sources panel
 * squeezed to its 336 px minimum, and a gap between each pair.
 *
 *   400 + 32 + 640 + 32 + 336 = 1440
 *
 * That it lands on 1440, the width every frame in design/omraader/ is drawn
 * at, is a coincidence worth noticing and not the reason for the number.
 *
 * Both sidebars OPEN is the only state this is about, so both gaps are real
 * here and the rail does not come into it. The rail is what makes every
 * OTHER state fit at 1280 — the widest is now the navigation panel open with
 * the sources panel railed, 400 + 32 + 640 + 67 = 1139.
 *
 * Below it, LayoutProvider keeps one sidebar open at a time — decision
 * 2026-09-14, option B. It is summed from `defaultLayout` rather than written
 * down so that changing a width moves the breakpoint with it; a breakpoint
 * that disagrees with the widths it is supposed to protect is worse than none.
 */
export const bothSidebarsMinViewport =
  slotFloor(defaultLayout.slots['primary-sidebar'].sizing) +
  slotGap +
  slotFloor(defaultLayout.slots.main.sizing) +
  slotGap +
  slotFloor(defaultLayout.slots['secondary-sidebar'].sizing);

/**
 * True while the window is too narrow for both sidebars at once.
 *
 * Range syntax rather than `(max-width: 1439px)`. The rule is «narrower than
 * the sum», and `max-width` cannot say that without subtracting one first —
 * which leaves the fractional widths a zoomed or scaled window produces
 * (1439.5) on the wrong side of a rule that was meant to exclude them.
 */
export const narrowViewportQuery = `(width < ${bothSidebarsMinViewport}px)`;

/** The two slots that can be collapsed, in layout order. */
export const sidebarSlots = ['primary-sidebar', 'secondary-sidebar'] as const;

export type SidebarSlot = (typeof sidebarSlots)[number];

/**
 * The sidebar that gives way when only one of the two can be open.
 *
 * The sources panel, for the same reason it is the slot that shrinks: it is
 * the one a user opens for a moment to check a citation, while the navigation
 * panel is where the conversation is steered from. Decision 2026-09-14.
 */
export const yieldingSidebar: SidebarSlot = 'secondary-sidebar';

export function otherSidebar(slot: SidebarSlot): SidebarSlot {
  return slot === 'primary-sidebar' ? 'secondary-sidebar' : 'primary-sidebar';
}

/**
 * Keep at most one sidebar open, and keep `keepOpen` if a choice has to be
 * made. The rule that applies below `bothSidebarsMinViewport`.
 *
 * There are only two callers and they differ in exactly this argument: a user
 * opening a sidebar keeps the one they opened, and a window shrinking past
 * the breakpoint keeps the navigation panel, because `yieldingSidebar` is the
 * other one.
 *
 * A no-op unless both are open, so it is safe to run after every change
 * rather than only at the moments somebody remembered to.
 */
export function withOneSidebarOpen(layout: Layout, keepOpen: SidebarSlot): Layout {
  if (layout.slots[keepOpen].collapsed) return layout;
  return withCollapsed(layout, otherSidebar(keepOpen), true);
}

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

/**
 * Resize a slot. The answer column ignores it — it has no width of its own to
 * set — and a slot that may shrink is not allowed to be dragged below the
 * floor it would have shrunk to anyway.
 */
export function withWidth(layout: Layout, slot: Slot, width: number): Layout {
  const state = layout.slots[slot];
  if (state.sizing.mode === 'flexible') return layout;

  // The model's own bounds, and they are a backstop rather than the rule the
  // drag follows: what fits in THIS window is narrower, and `widthRange` in
  // resize.ts works it out. This is what stops a stored number nobody can
  // produce any more — an old `ka.layout.v1`, a hand-edited one — from
  // reaching the layout.
  const clamped = Math.min(
    Math.max(Math.round(width), state.sizing.minWidth),
    state.sizing.maxWidth,
  );
  if (state.sizing.width === clamped) return layout;

  return {
    ...layout,
    slots: { ...layout.slots, [slot]: { ...state, sizing: { ...state.sizing, width: clamped } } },
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

/** What a slot takes up on the row right now, collapsed or open. */
export function slotOccupied(state: SlotState): number {
  const sizing = state.sizing;
  if (sizing.mode === 'flexible') return slotFloor(sizing);
  return state.collapsed ? sizing.collapsedWidth : sizing.width;
}

/** The gap this slot puts between itself and the answer column. A rail has none. */
export function slotGapFor(state: SlotState): number {
  return state.collapsed ? 0 : slotGap;
}

/**
 * The widths the sidebars are actually DRAWN at in a window this wide.
 *
 * The model holds what the reader asked for. This is what fits, and the two
 * are the same number until the reader has dragged a panel wider than the
 * window can hold — which a window they then shrink, or a second panel they
 * open, can both produce.
 *
 * Somebody has to give, and the order is the decision of 2026-09-14 (option A
 * in design/visjon-og-beslutninger.md) with the drag handle's addition:
 *
 *   1. the answer column, down to its 640 px floor. That is CSS, not here:
 *      it grows from a zero basis and never shrinks, so it simply takes what
 *      is left. This function reserves the floor and no more.
 *   2. the sources panel, down to 336. It is the panel a reader opens to
 *      check a citation, while the navigation panel is where the
 *      conversation is steered from.
 *   3. the navigation panel, down to 400 — the width it had before anybody
 *      dragged it. Nothing gives below its floor, and a window narrower than
 *      the floors is the undesigned range under 1280.
 *
 * It is pure, and it is what `aria-valuenow` on the separator reports: a
 * value that says 480 while the panel is drawn at 400 is a lie told to the
 * one reader who cannot see the difference.
 */
export function fittedWidths(layout: Layout, viewport: number): Record<SidebarSlot, number> {
  const fitted = {} as Record<SidebarSlot, number>;
  for (const slot of sidebarSlots) fitted[slot] = slotOccupied(layout.slots[slot]);

  let over =
    fitted['primary-sidebar'] +
    fitted['secondary-sidebar'] +
    slotGapFor(layout.slots['primary-sidebar']) +
    slotGapFor(layout.slots['secondary-sidebar']) +
    slotFloor(layout.slots.main.sizing) -
    viewport;

  // `yieldingSidebar` first and the other after it, which is the rule above
  // read off the model rather than written out again.
  for (const slot of [yieldingSidebar, otherSidebar(yieldingSidebar)]) {
    if (over <= 0) break;
    const state = layout.slots[slot];
    if (state.collapsed || state.sizing.mode === 'flexible') continue;

    const give = Math.min(over, fitted[slot] - state.sizing.minWidth);
    if (give <= 0) continue;
    fitted[slot] -= give;
    over -= give;
  }

  return fitted;
}

/**
 * The slot widths as CSS custom properties, for the shell's inline style.
 * A collapsed slot reports its collapsed width, so CSS never has to know
 * which state the slot is in.
 *
 * `viewport` is the window's inner width, because an open panel's width is no
 * longer a property of the layout alone: see `fittedWidths`.
 */
export function layoutStyle(layout: Layout, viewport: number): Record<string, string> {
  const style: Record<string, string> = {};
  const fitted = fittedWidths(layout, viewport);

  // The answer column and the sidebars separately, rather than one loop over
  // `slotOrder`: `flexible` is the answer column's mode and `sized` is the
  // sidebars', the model says so in `defaultLayout`, and a loop that pretends
  // otherwise only makes the types lie about which slot can be collapsed.
  const main = layout.slots.main.sizing;
  if (main.mode === 'flexible') {
    style['--ka-main-min-width'] = `${main.minWidth}px`;
    style['--ka-main-max-width'] = `${main.maxWidth}px`;
  }

  for (const slot of sidebarSlots) {
    const state = layout.slots[slot];
    const sizing = state.sizing;
    if (sizing.mode === 'flexible') continue;

    style[`--ka-${slot}-width`] = `${state.collapsed ? sizing.collapsedWidth : fitted[slot]}px`;
    // Collapsed, the floor is the collapsed width itself. A button is not
    // something to squeeze: the slot stops giving the moment it is down to
    // the one control it still shows.
    style[`--ka-${slot}-min-width`] =
      `${state.collapsed ? sizing.collapsedWidth : sizing.minWidth}px`;
  }

  return style;
}
