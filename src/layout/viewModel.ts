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
    },
    main: {
      slot: 'main',
      views: ['chat'],
      activeView: 'chat',
      collapsed: false,
    },
    'secondary-sidebar': {
      slot: 'secondary-sidebar',
      // The tools menu and notes arrive as views here later, in this same
      // slot as sources (answers 22, 49 and 52). Not in the first version.
      views: ['sources'],
      activeView: 'sources',
      collapsed: true,
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
