import { useEffect, type RefObject } from 'react';

/** The key, written once. Shown to the reader and matched on here. */
export const COMPOSER_SHORTCUT_KEY = '/';

/**
 * Where the keystroke really came from.
 *
 * `event.target` is retargeted to the host element for anything inside a
 * shadow root, and this app has such fields: Designsystemet's `Suggestion`
 * puts its `input` in one, which is what the three filter dropdowns are made
 * of. Read off `target` alone, a reader typing «Årsrapport» into a filter
 * would see the caret jump to the compose field on the slash in a date. The
 * composed path starts at the real element.
 */
function innermostTarget(event: KeyboardEvent): EventTarget | null {
  return event.composedPath()[0] ?? event.target;
}

/**
 * Is the reader typing somewhere? Then the key is a character, not a command.
 *
 * `isContentEditable` covers rich text; `select` is in the list because a
 * select with an open list uses typed characters to jump between options.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * `/` puts the caret in the compose field.
 *
 * The field is tab stop 22 of 38 on a thread page — for the thing a reader
 * does most often (reise 7 and 15 in design/brukerreiser-2026-09-15.md). The
 * same key does the same thing in GitHub and Slack, so it is one fewer thing
 * to learn, and it needs no modifier, which is what keeps it out of the way of
 * the browser's own shortcuts.
 *
 * Three things it refuses to do. It does not fire while the reader is typing,
 * or `/` could never be written in a question. It does not fire with a
 * modifier held, so Ctrl+/ and Cmd+/ still belong to the browser and the
 * operating system. And it swallows the keystroke it acted on, so the slash
 * does not end up in the field it just moved to.
 *
 * The listener sits on the document because the point is to reach the field
 * from anywhere on the page — including from the sources panel, which is
 * where a reader is standing when they have just read something and want to
 * ask about it.
 */
export function useComposerShortcut(
  fieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== COMPOSER_SHORTCUT_KEY) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(innermostTarget(event))) return;

      const field = fieldRef.current;
      if (!field) return;

      event.preventDefault();
      field.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fieldRef]);
}
