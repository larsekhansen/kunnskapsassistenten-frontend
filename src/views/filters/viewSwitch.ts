/**
 * Who asked for the view that is about to mount.
 *
 * The two views in the primary sidebar are modes of one panel: pressing
 * «Filtrer dokumenter» or «Tråder» unmounts the whole view the button sits
 * in, and focus then falls to `document.body`. The new view has to claim it.
 *
 * A view cannot tell «the user switched to me» from «the page just loaded»
 * on its own — both look like a first mount, and `defaultLayout` opens on
 * filters (answer 1). Claiming focus on a page load would jump the user past
 * the skip link, so the difference matters. The button records the request
 * here before the switch, and the view that mounts consumes it.
 *
 * A module variable and not state: nothing renders from it, it is read once
 * in an effect, and the two views may not import each other's state. It
 * belongs in `LayoutProvider` once that owns the switch — the role brief says
 * the layout state moves there — and this is its local home until then.
 */
let requested: 'threads' | 'filters' | undefined;

/** Called from the button that switches view, before `onShowView`. */
export function requestViewFocus(view: 'threads' | 'filters'): void {
  requested = view;
}

/**
 * True once if this view was switched to by the user. Always false on a page
 * load, so a view can call it on mount without stealing focus.
 */
export function takeViewFocus(view: 'threads' | 'filters'): boolean {
  if (requested !== view) return false;
  requested = undefined;
  return true;
}
