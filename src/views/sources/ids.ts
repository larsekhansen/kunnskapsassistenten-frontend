/**
 * Scroll targets inside the panel that are not already defined by the model.
 *
 * `excerptDomId` is NOT here: it moved to `src/model/source.ts` when the
 * citation convention was settled, so the answer and the panel build the id
 * from the same function. Import it from the model, or from this view's
 * `index.ts`, which re-exports it for the main column.
 *
 * The id strings are Norwegian because they end up in the address bar as
 * fragments, which the user can see and share.
 */

/** Scroll target for a document card, used by the shortcut list. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}
