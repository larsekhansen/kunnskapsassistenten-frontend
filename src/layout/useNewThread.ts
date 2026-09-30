import { use, useCallback, type MouseEvent } from 'react';
import { emptyFilterSelection } from '../model';
import { FilterContext } from './filterContext';
import { LayoutContext } from './layoutContext';
import { useDrawerMode } from './useDrawerMode';
import type { Slot } from './viewModel';

/**
 * «Ny tråd» as the whole action, and not only the link to `/` (Simen's issue
 * 114): an empty conversation, an empty filter, the drawer out of the way and
 * the keyboard in the compose field. The link still does the navigating, so
 * it stays a real link — middle-click and «open in new tab» work, and a
 * screen reader says «lenke». The conversation is emptied by the navigation
 * itself; see the key in ChatSlotView.tsx.
 *
 * The rest is done on the click, before the link navigates:
 *
 *   - The filter is emptied. A new thread starts from the whole corpus, which
 *     is what the reader expects to see (Simen, 114). The reader's own choice
 *     goes, not only the lock: the lock goes by itself when the thread does.
 *   - An open drawer is closed. Below the drawer breakpoint the list is a
 *     modal over the conversation, and the new one would start behind it.
 *     Only then: beside the answer column the panel is not in the way, and
 *     closing it would be closing something the reader opened.
 *   - The compose field is asked for, and the chat slot gives it focus when
 *     the new conversation has mounted — after the drawer has shut and the
 *     browser has handed focus back to the rail button. See
 *     `takeComposerFocusRequest`.
 *
 * A click that opens a new tab or window changes nothing here: this page is
 * not the one the reader is going to.
 *
 * Both contexts are read without requiring them, so a view mounted on its own
 * — every view test — keeps working; there is simply nothing to empty or to
 * close there.
 */
export function useNewThread(): (event: MouseEvent<HTMLAnchorElement>) => void {
  const filter = use(FilterContext);
  const layout = use(LayoutContext);
  const drawer = useDrawerMode();

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      filter?.setSelection(emptyFilterSelection);

      if (drawer && layout) {
        for (const slot of sidebars) {
          if (!layout.layout.slots[slot].collapsed) layout.setCollapsed(slot, true);
        }
      }

      composerFocusRequested = true;
    },
    [drawer, filter, layout],
  );
}

const sidebars: Slot[] = ['primary-sidebar', 'secondary-sidebar'];

/**
 * Whether «Ny tråd» asked for the compose field, and the answer only once.
 *
 * A module variable and not router state. State lives in `history.state`,
 * which survives a reload, and the next page load would take the focus away
 * from the skip link. Nothing here outlives the page, which is right: the
 * request is about the navigation that is happening now.
 */
let composerFocusRequested = false;

export function takeComposerFocusRequest(): boolean {
  const requested = composerFocusRequested;
  composerFocusRequested = false;
  return requested;
}
