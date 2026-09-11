/**
 * DOM ids used as scroll targets inside the panel.
 *
 * They are part of the seam with the main column: a `[n]` marker in the answer
 * scrolls to `#kilde-utdrag-n` (answer 19). Keeping them in one file means the
 * main column can import the helper instead of guessing the string.
 *
 * The id strings are Norwegian because they end up in the address bar as
 * fragments, which the user can see and share.
 */

/** The panel itself, so the collapse button can point `aria-controls` at it. */
export const SOURCES_PANEL_ID = 'kildepanel';

/** Scroll target for the excerpt a `[n]` marker points at. */
export function excerptDomId(citationNumber: number): string {
  return `kilde-utdrag-${citationNumber}`;
}

/** Scroll target for a document card, used by the shortcut list. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}
