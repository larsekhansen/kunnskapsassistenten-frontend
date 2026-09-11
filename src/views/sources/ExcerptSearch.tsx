import { Button, Label, Paragraph, Search } from '@digdir/designsystemet-react';
import { MIN_QUERY_LENGTH } from './search';

const FIELD_ID = 'kilder-sok';
const DESCRIPTION_ID = 'kilder-sok-beskrivelse';

/**
 * The Kudos disclaimer.
 *
 * Question 25 is still open, and the two Figma panels word it differently.
 * Choice made here: the wording from the newer of the two Figma panels, which
 * is also the one the curated September page shows.
 * Written down so the next person does not have to re-derive it.
 */
const KUDOS_DISCLAIMER =
  'All tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig intelligens.';

type ExcerptSearchProps = {
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
 * `Search` rather than a hand-drawn field: Figma draws the field and the clear
 * cross by hand, and `Search.Input` plus `Search.Clear` is the same thing with
 * a working `aria-label` on the cross («Tøm», Norwegian by default) and the
 * correct `type='search'` semantics. `Search.Clear` is `type='reset'`, which is
 * why there is a real `<form>` around it.
 *
 * Previous/next move up and down through a vertical text, not sideways through
 * pages, so this is not `Pagination` — `search-excerpts.md` makes the same
 * point.
 *
 * The counter is a live region. Without it the search is silent for a screen
 * reader user: `<mark>` is not announced, so «1 av 26 treff» is the only thing
 * that says the search did anything.
 */
export function ExcerptSearch({
  query,
  onQueryChange,
  hitCount,
  currentHitIndex,
  onStep,
}: ExcerptSearchProps) {
  const searching = query.trim().length >= MIN_QUERY_LENGTH;
  const status = !searching
    ? ''
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
        <Label htmlFor={FIELD_ID}>Søk i kildene</Label>
        <Paragraph id={DESCRIPTION_ID} data-size="xs" className="sources-search__description">
          {KUDOS_DISCLAIMER}
        </Paragraph>

        <Search>
          <Search.Input
            id={FIELD_ID}
            name="kilder-sok"
            aria-describedby={DESCRIPTION_ID}
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

          <div className="sources-search__steps">
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              aria-label="Forrige treff"
              disabled={hitCount === 0}
              onClick={() => onStep(-1)}
            >
              Forrige
            </Button>
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              aria-label="Neste treff"
              disabled={hitCount === 0}
              onClick={() => onStep(1)}
            >
              Neste
            </Button>
          </div>
        </div>
      </form>
    </search>
  );
}
