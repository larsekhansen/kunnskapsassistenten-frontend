import { Skeleton } from '@digdir/designsystemet-react';

/** One block per document card the answer is likely to have. */
const DOCUMENT_PLACEHOLDERS = ['a', 'b', 'c', 'd'];

/**
 * `excerpts-placeholder` from Figma: the loading state for the panel, one
 * block per document card, so the layout does not jump when the sources come.
 *
 * `Skeleton` sets `aria-hidden` on itself, so a screen reader is told nothing
 * unless we say it, and in forced-colours mode the skeletons are invisible
 * too. Hence `aria-busy` on the region and a sentence in a live region.
 */
export function SourcesPlaceholder() {
  return (
    <div className="sources-placeholder" aria-busy="true">
      {/* `<output>` is the status live region; Skeleton is aria-hidden, so
          without this sentence a screen reader user is told nothing at all. */}
      <output className="ds-sr-only">Henter kilder …</output>

      <div className="sources-placeholder__documents">
        {DOCUMENT_PLACEHOLDERS.map((key) => (
          <Skeleton key={key} variant="rectangle" height="var(--ds-size-18)" />
        ))}
      </div>
    </div>
  );
}
