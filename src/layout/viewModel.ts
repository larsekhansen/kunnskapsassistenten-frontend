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
   * Holds its width, and does not give when the window is short of room. The
   * navigation panel is 400 px or it is collapsed; there is nothing between.
   */
  | { mode: 'fixed'; width: number; collapsedWidth: number }
  /**
   * Holds a preferred width and gives down to `minWidth` when the window runs
   * out of room. The sources panel is the one slot that does — decision
   * 2026-09-14, option A in design/visjon-og-beslutninger.md.
   *
   * It gives AFTER the answer column has reached its own floor, and that
   * ordering is not coded anywhere: it falls out of the flexbox rules in
   * global.css, where the answer column grows from a zero basis and refuses
   * to shrink, and this slot starts at `width` and is the only item allowed
   * to shrink.
   */
  | { mode: 'shrinkable'; width: number; minWidth: number; collapsedWidth: number }
  /** Takes what is left, between bounds. The answer column, and only it. */
  | {
      mode: 'flexible';
      /**
       * The floor while the sources panel is open beside it. The reason for
       * the floor is that the sources have to be readable NEXT TO the answer
       * (answers 46, 49 and 59), so it is the state with something next to it
       * that the number was chosen for.
       */
      minWidth: number;
      /**
       * The floor when the secondary sidebar is collapsed, and there is
       * nothing beside the answer for the wider floor to be about.
       */
      minWidthAlone: number;
      maxWidth: number;
    };

/**
 * The narrowest a slot can be drawn while open, which is what the breakpoint
 * below is summed from. A slot that does not give reports the width it keeps.
 *
 * For the answer column this is `minWidth`, the floor that applies with the
 * sources panel open — which is the state `bothSidebarsMinViewport` is about.
 */
export function slotFloor(sizing: SlotSizing): number {
  return sizing.mode === 'fixed' ? sizing.width : sizing.minWidth;
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
      // The collapsed width is not drawn anywhere either, so it is derived
      // the same way the sources panel's 198 is: the button this slot
      // collapses to, plus everything the slot spends before reaching it.
      // Measured 2026-09-14 in the built app with Inter loaded.
      //
      //   195.78  the «Vis tråder og filter» button at its natural width:
      //           150.77 text + 21 icon + 7 gap + 28 padding + 2 border.
      //           The label on the OPEN panel reads «Skjul tråder og filter»
      //           and needs 208.77, but that is not the state being sized.
      //   + 36    the padding a collapsed slot keeps against the edge of the
      //           window; it carries none against the answer column.
      //   + 1     `border-inline-end`, which `box-sizing: border-box` takes
      //           out of the content box. The sources panel has no border and
      //           this term is why the two slots do not share an answer.
      //   = 232.78, so 233 is the floor and 236 is the number.
      //
      // 236 rather than 233 because 233 clears the text by 0.22 px, which is
      // not clearance: a fallback font before Inter lands, a later Inter, or
      // a reader's own minimum font size all move the label further than that.
      // 236 leaves 3.2 px, sits on Designsystemet's 4 px step, and stays
      // under the 240 px ceiling the 1280 guarantee sets — at 1280 with this
      // panel collapsed and the sources panel open, the sources panel gets
      // 1280 − 236 − 32 − 640 − 32 = 340, still above its 336 floor.
      //
      // The decision of 2026-09-14 says 232, from 196 + 36. 196 was the
      // content width measured on 2026-09-11, and the two terms it leaves out
      // are the border and the fraction. 232 draws the label on two lines,
      // which is the one thing the number was chosen to prevent; 236 is the
      // same derivation with every term in it.
      //
      // It was 198 before, borrowed from the sources panel so the two would
      // collapse to the same width. That symmetry cost the label three lines,
      // and a panel narrower than the only control it holds is not symmetry
      // worth having.
      sizing: { mode: 'fixed', width: 400, collapsedWidth: 236 },
    },
    main: {
      slot: 'main',
      views: ['chat'],
      activeView: 'chat',
      collapsed: false,
      // Two floors, because the floor has a reason and the reason is not
      // always in play. Decision 2026-09-14, the addendum to the layout brief.
      //
      //   640  with the sources panel open. Not a preference: the sources
      //        must be readable BESIDE the answer (answers 46, 49 and 59).
      //   618  with the sources panel collapsed, where nothing stands beside
      //        the answer for the 640 to be about. Derived, not picked:
      //        1280 − 400 − 32 − 32 − 198, which is what is left for the
      //        answer at 1280 with the navigation panel open and the sources
      //        panel collapsed — the state the app opens in.
      //
      // Without the second floor that state needed 1302 and the page scrolled
      // sideways at 1280 by 22 px. The three other terms in it cannot give:
      // the navigation panel holds its width by decision, and the collapsed
      // sources panel its 198 by the page template.
      //
      // `bothSidebarsMinViewport` is summed from 640, the floor that applies
      // when both sidebars are open, which is the state it is about.
      sizing: { mode: 'flexible', minWidth: 640, minWidthAlone: 618, maxWidth: 800 },
    },
    'secondary-sidebar': {
      slot: 'secondary-sidebar',
      // The tools menu and notes arrive as views here later, in this same
      // slot as sources (answers 22, 49 and 52). Not in the first version.
      views: ['sources'],
      activeView: 'sources',
      collapsed: true,
      // 198 collapsed comes from the page template.
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
      sizing: { mode: 'shrinkable', width: 432, minWidth: 336, collapsedWidth: 198 },
    },
  },
};

/** Slots in the order the layout wants to render them. */
export const slotOrder: Slot[] = ['primary-sidebar', 'main', 'secondary-sidebar'];

/**
 * The gap between two slots, in CSS pixels.
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

  const clamped =
    state.sizing.mode === 'shrinkable' ? Math.max(width, state.sizing.minWidth) : width;
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

/**
 * The slot widths as CSS custom properties, for the shell's inline style.
 * A collapsed slot reports its collapsed width, so CSS never has to know
 * which state the slot is in.
 */
export function layoutStyle(layout: Layout): Record<string, string> {
  const style: Record<string, string> = {};

  for (const slot of slotOrder) {
    const state = layout.slots[slot];
    const sizing = state.sizing;

    if (sizing.mode === 'flexible') {
      // Named slot, deliberately, and it is a limitation rather than a
      // design. The question the floor asks is whether anything is drawn
      // BESIDE the answer column, and in this layout the secondary sidebar is
      // the one slot that can be. It does not follow the sources view: move
      // sources into the primary sidebar and this still asks about the
      // secondary slot, which is then the wrong question. The day layouts can
      // really be rearranged, this has to ask about the neighbour instead of
      // about a slot by name.
      const alone = layout.slots['secondary-sidebar'].collapsed;
      style[`--ka-${slot}-min-width`] = `${alone ? sizing.minWidthAlone : sizing.minWidth}px`;
      style[`--ka-${slot}-max-width`] = `${sizing.maxWidth}px`;
      continue;
    }

    style[`--ka-${slot}-width`] = `${state.collapsed ? sizing.collapsedWidth : sizing.width}px`;

    if (sizing.mode === 'shrinkable') {
      // Collapsed, the floor is the collapsed width itself. A button is not
      // something to squeeze: the slot stops giving the moment it is down to
      // the one control it still shows.
      style[`--ka-${slot}-min-width`] =
        `${state.collapsed ? sizing.collapsedWidth : sizing.minWidth}px`;
    }
  }

  return style;
}
