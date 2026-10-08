import { Button, Label, Paragraph, Search } from '@digdir/designsystemet-react';
import { useId } from 'react';
import { MIN_QUERY_LENGTH } from '../../components';

type ExcerptSearchProps = {
  /**
   * The element this field is described by: the Kudos disclaimer.
   *
   * Passed in rather than owned here, because the disclaimer is drawn outside
   * the sticky head while the field is inside it. See `CorpusDisclaimer`.
   */
  descriptionId: string;
  query: string;
  onQueryChange: (query: string) => void;
  hitCount: number;
  /** Zero-based position in the hit list; the user reads it one-based. */
  currentHitIndex: number;
  onStep: (step: 1 | -1) => void;
};

/**
 * Search inside the excerpts, with a hit counter and previous/next.
 *
 * `Search` rather than a hand-drawn field: it gives the clear button an
 * `aria-label` («Tøm») and `type='search'` semantics. `Search.Clear` is
 * `type='reset'`, which is why there is a real `<form>` around it.
 *
 * Previous/next move through a vertical text, not through pages, so this is
 * not `Pagination`.
 *
 * The counter is a live region: `<mark>` is not announced, so «1 av 26 treff»
 * is the only thing that tells a screen reader user the search did anything.
 */
export function ExcerptSearch({
  query,
  onQueryChange,
  hitCount,
  currentHitIndex,
  onStep,
  descriptionId,
}: ExcerptSearchProps) {
  // Generated, not a module constant: two SourcesView in two slots would share
  // one id, and `htmlFor` would then point at the wrong field.
  const fieldId = useId();

  // The ends are ends: `stepHit` stops there, so the button that would do
  // nothing says so.
  //
  // `aria-disabled` and not `disabled`: the reader presses the same button over
  // and over, and a `disabled` button drops focus to the body the moment it
  // turns off. `aria-disabled` keeps the tab stop, and Designsystemet draws it
  // like `:disabled`. The click handler is what makes it inert, since the
  // browser still delivers the click.
  const atFirst = currentHitIndex === 0;
  const atLast = currentHitIndex >= hitCount - 1;

  const typed = query.trim().length;
  const status =
    typed === 0
      ? ''
      : typed < MIN_QUERY_LENGTH
        ? `Skriv minst ${MIN_QUERY_LENGTH} tegn`
        : hitCount === 0
          ? 'Ingen treff'
          : `${currentHitIndex + 1} av ${hitCount} treff`;

  return (
    // `<search>` is the landmark; the `<form>` inside it is what `Search.Clear`
    // needs, because it is a `type='reset'` button and a reset button outside a
    // form does nothing.
    <search className="sources-search">
      <form
        className="sources-search__form"
        // Nothing to submit: the search runs as the user types. Without this
        // the Enter key reloads the page.
        onSubmit={(event) => event.preventDefault()}
      >
        <Label htmlFor={fieldId}>Søk i kildene</Label>

        <Search>
          <Search.Input
            id={fieldId}
            name="kilder-sok"
            aria-describedby={descriptionId}
            placeholder="Søk"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
          {/* type='reset' clears the DOM value; the state it is bound to has to
              be cleared too, or React puts the old value straight back. */}
          <Search.Clear onClick={() => onQueryChange('')} />
        </Search>

        <div className="sources-search__results">
          <Paragraph data-size="xs" aria-live="polite" className="sources-search__count">
            {status}
          </Paragraph>

          {/* Previous/next exist only once there is something to step
              through, as in Figma's `results` variant. Left out rather than
              disabled: a control the reader has never been able to use only
              adds a tab stop and a question. */}
          {hitCount > 0 && (
            <div className="sources-search__steps">
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                aria-label="Forrige treff"
                aria-disabled={atFirst || undefined}
                onClick={() => !atFirst && onStep(-1)}
              >
                Forrige
              </Button>
              <Button
                type="button"
                variant="tertiary"
                data-size="sm"
                aria-label="Neste treff"
                aria-disabled={atLast || undefined}
                onClick={() => !atLast && onStep(1)}
              >
                Neste
              </Button>
            </div>
          )}
        </div>
      </form>
    </search>
  );
}
