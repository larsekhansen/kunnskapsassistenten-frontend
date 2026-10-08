/**
 * Ids inside the panel that the model does not already define.
 *
 * `excerptDomId` is in `src/model/source.ts`, so the answer and the panel
 * build it from one function. Import it from the model, or from this view's
 * `index.ts`.
 *
 * `documentDomId` is Norwegian because a fragment can end up in the address
 * bar, where the reader sees it. `excerptDomId` is `excerpt-n`, and renaming
 * it would break links readers have copied.
 */

/** The id of a document card. */
export function documentDomId(documentId: string): string {
  return `kilde-dokument-${documentId}`;
}
