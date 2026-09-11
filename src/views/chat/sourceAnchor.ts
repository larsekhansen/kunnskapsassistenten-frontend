/**
 * The anchor a `[n]` marker in the answer points at.
 *
 * The contract with the sources panel: marker n links to the excerpt with
 * that citation number, whose element id is `kilde-utdrag-n`. That id is
 * produced by `excerptDomId` in `src/views/sources/ids.ts`.
 *
 * It is repeated here rather than imported because the sources panel is not
 * on main yet. One string is cheap to duplicate and easy to spot; the import
 * replaces this function the day that file lands.
 *
 * The link is also the fallback, not just the first step. When the shell
 * offers the citation event, activating a marker will open the panel through
 * that — but the anchor is what makes the marker work with the keyboard, in a
 * new tab, and in a printed page, so it stays.
 */
export function excerptAnchor(citationNumber: number): string {
  return `kilde-utdrag-${citationNumber}`;
}
