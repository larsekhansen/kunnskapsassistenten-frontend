import { useEffect, type RefObject } from 'react';

/** The key, written once. Shown to the reader and matched on here. */
export const COMPOSER_SHORTCUT_KEY = '/';

/**
 * Ctrl+/ — Cmd+/ on a Mac — puts the caret in the compose field.
 *
 * The field is deep in the tab order on a thread page, for the thing a
 * reader does most often. The mnemonic is GitHub's and Slack's, so it is one
 * fewer thing to learn.
 *
 * **The modifier is not decoration.** A shortcut bound to a single character
 * key is WCAG 2.1.4 Character Key Shortcuts, level A, and has to be
 * switchable, remappable, or limited to a focused component, and a plain `/`
 * is none of those. A shortcut that needs a modifier is outside 2.1.4
 * altogether, and the skip link straight to the field is the primary route in
 * any case.
 *
 * Shift is allowed through rather than rejected, and that is the whole reason
 * this is written out: on a Norwegian keyboard `/` IS Shift+7, so `shiftKey`
 * is always true when the key exists at all. Rejecting it would mean the
 * shortcut could never fire on the layout the app is written for.
 *
 * Alt is rejected. Ctrl+Alt is AltGr on Windows, which composes characters
 * rather than issuing commands, and Ctrl+Alt+/ is somebody else's shortcut.
 *
 * It fires from anywhere, including from a field the reader is typing in: the
 * modifier is what makes that unambiguous, since nobody holds Ctrl to write a
 * slash. And it swallows the keystroke, so the character does not land in the
 * field it just moved to.
 */
export function useComposerShortcut(
  fieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== COMPOSER_SHORTCUT_KEY) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;

      const field = fieldRef.current;
      if (!field) return;

      event.preventDefault();
      field.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fieldRef]);
}
