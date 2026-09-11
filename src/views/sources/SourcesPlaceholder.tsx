import { Heading, Skeleton } from '@digdir/designsystemet-react';

/** Widths of the fake shortcut lines. Varying them reads as text, not as bars. */
const SHORTCUT_WIDTHS = ['82%', '68%', '90%', '74%'];

/**
 * `excerpts-placeholder` from Figma: the loading state for the panel.
 *
 * It mirrors the shape of the real content — shortcut list first, then one
 * block per document card — so the layout does not jump when the sources
 * arrive.
 *
 * `Skeleton` sets `aria-hidden` on itself, always and in code. That means a
 * screen reader is told nothing at all unless we say it ourselves, and in
 * forced-colours mode the skeletons are invisible too. Hence `aria-busy` on
 * the region and a real sentence in a live region. The Designsystemet
 * documentation does not mention this; `skeleton.md` does.
 */
export function SourcesPlaceholder() {
  return (
    <div className="sources-placeholder" aria-busy="true">
      {/* `<output>` is the status live region; Skeleton is aria-hidden, so
          without this sentence a screen reader user is told nothing at all. */}
      <output className="ds-sr-only">Henter kilder …</output>

      <div className="sources-overview">
        {/* A `div`, not a labelled `section`, and no fixed id: the same two
            reasons as in SourcesOverview. A labelled section is a landmark,
            and a module-level id breaks the day two panels are on screen. */}
        <Heading level={3} data-size="xs">
          Snarveier til dokumentene
        </Heading>

        <div className="sources-placeholder__shortcuts">
          {SHORTCUT_WIDTHS.map((width) => (
            <div className="sources-placeholder__shortcut" key={width}>
              <Skeleton variant="circle" />
              <Skeleton variant="rectangle" width={width} height="var(--ds-size-5)" />
            </div>
          ))}
        </div>
      </div>

      <div className="sources-placeholder__documents">
        {SHORTCUT_WIDTHS.map((width) => (
          <Skeleton key={width} variant="rectangle" height="var(--ds-size-18)" />
        ))}
      </div>
    </div>
  );
}
