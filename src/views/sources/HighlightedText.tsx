import { type SearchHit, splitByHits } from './search';

type HighlightedTextProps = {
  text: string;
  /** Hits inside this text, in position order. Empty renders plain text. */
  hits: SearchHit[];
  /** The hit the user is currently standing on, if it is in this text. */
  currentHit?: SearchHit;
};

/**
 * The quoted text with search matches wrapped in `<mark>`.
 *
 * `<mark>` rather than a styled span: it is the element that means «marked
 * because it is relevant to the user at this moment», which is exactly what a
 * search hit is. Screen readers do not announce it by default in most
 * browsers, which is why the counter «n av m treff» is a live region — the
 * counter is what tells a screen reader user that the search did anything.
 *
 * The current hit carries `data-current`, so the CSS can give it a stronger
 * surface than the rest without a second element.
 */
export function HighlightedText({ text, hits, currentHit }: HighlightedTextProps) {
  const runs = splitByHits(text, hits);

  return (
    <>
      {runs.map((run, index) =>
        run.hit ? (
          <mark
            // Runs have no identity of their own; position is the identity, and
            // the whole list is rebuilt whenever the query changes.
            key={index}
            className="sources-mark"
            data-current={run.hit === currentHit ? 'true' : undefined}
          >
            {run.text}
          </mark>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  );
}
