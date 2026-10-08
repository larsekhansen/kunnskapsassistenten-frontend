import { Button, Details, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { HighlightedText, type SearchHit } from '../../components';
import { BackIcon } from '../../components/icons';
import { excerptDomId, type Excerpt } from '../../model';
import { kudosLinkLabel, reachesPage } from './kudosLink';
import { excerptName } from './excerptName';

type SourceExcerptProps = {
  excerpt: Excerpt;
  /** The document this excerpt came from, for the accessible names. */
  documentTitle: string;
  /** What to call the corpus, or undefined when nothing names it. */
  corpusName: string | undefined;
  /** 1-based place of this excerpt among the document's, for naming it. */
  position: number;
  /** How many excerpts the document has, for naming an uncited one. */
  total: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Search hits inside this excerpt, in position order. */
  hits: SearchHit[];
  currentHit?: SearchHit;
  /** True while this is the excerpt a `[n]` marker in the answer points at. */
  active: boolean;
  /**
   * Moves focus back to the marker the reader came from, when there is one.
   *
   * Absent for an excerpt the reader opened themselves: a way back to a place
   * they never came from is a control that does nothing.
   */
  onReturnToAnswer?: () => void;
};

/**
 * Where the quote would have been, when its text could not be fetched.
 *
 * It does not offer the way on: «Les dokumentet på Kudos» is the last line of
 * the same document, and repeating it here is noise.
 *
 * It says the excerpt is unavailable, not that it is empty. The chunk was
 * retrieved and the answer may cite it; it is the passage lookup that failed.
 */
export const EXCERPT_UNAVAILABLE = 'Utdraget er ikke tilgjengelig.';

/**
 * One excerpt, Figma's `chunk`: a white box inside its document, with its
 * number and the toggle on one row and the quote under them.
 *
 * `citationNumber` is the number of the `[n]` marker in the answer and the
 * scroll target. It sits in a heading, so a screen reader user can reach it by
 * navigating headings. Figma has a relevance tag there, but the backend gives
 * no score, only an order, so the excerpt is named «Utdrag N» instead.
 *
 * An excerpt can arrive without a number: the search finds more than the
 * answer cites. It is still shown, with no scroll target, and says on the same
 * row that the answer did not use it.
 *
 * Closed, the row is all there is.
 *
 * The excerpt the reader was sent to offers two ways back to the marker:
 * Escape anywhere inside it, and a visible control after the quote for those
 * who do not know that. Without them, getting back took many Shift+Tab.
 *
 * Open and close is `Details`, which comes with `aria-expanded` and keyboard
 * support. It is controlled, because the search has to open excerpts the
 * reader never clicked, and the type then requires `onToggle`.
 *
 * The heading is not in the summary: a heading inside a summary is a heading
 * inside a button to some screen readers, and this heading is what they
 * navigate by. So the two share a grid cell, drawn as Figma's one row, and the
 * order in the document is still heading, toggle, quote. See
 * `.source-excerpt` in sources.css.
 */
export function SourceExcerpt({
  excerpt,
  documentTitle,
  corpusName,
  position,
  total,
  open,
  onOpenChange,
  hits,
  currentHit,
  active,
  onReturnToAnswer,
}: SourceExcerptProps) {
  const { citationNumber, heading, text, page, kudosUrl, textUnavailable } = excerpt;
  const cited = citationNumber !== undefined;

  // Unique per excerpt, so a screen reader reading the list of controls does
  // not meet five buttons called «Åpne». See `excerptName.ts` for why a cited
  // and an uncited excerpt are named by different numbers.
  const name = excerptName(citationNumber, position, total);

  /*
    A link of its own only when it goes further than the document's, which is
    at the end of the document. In live and bff mode `kudosUrl` is the
    document's address, and repeating it under every quote is noise. A file URL
    with `#page=N` opens the page the quote is on. See `kudosLink.ts`.
  */
  const pageLink =
    kudosUrl !== undefined && page !== undefined && reachesPage(kudosUrl, page)
      ? kudosUrl
      : undefined;

  return (
    /*
      The keydown sits on the box, so Escape gets the reader back from anywhere
      in the excerpt: the box itself, where a marker puts the focus, and the
      controls inside it. The rule below guards against giving an element
      without a role the behaviour of a control. Nothing is pressed on the box;
      it only listens to what bubbles up, like the form in AnswerSearch.tsx.
    */
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="source-excerpt ds-focus"
      // Only a cited excerpt is a scroll target: the id is the one the `[n]`
      // marker links to, and an excerpt with no number has no marker.
      id={cited ? excerptDomId(citationNumber) : undefined}
      data-active={active ? 'true' : undefined}
      data-uncited={cited ? undefined : 'true'}
      // -1 so the panel can move focus here when the answer points at it.
      // Focus, not only scroll: focus is what tells a screen reader user that
      // something happened, and it puts the keyboard where the eye is.
      tabIndex={cited ? -1 : undefined}
      /*
        Escape returns to the marker. Scoped to this box, so it cannot take
        Escape from the search field, where `type='search'` clears the query.
        `stopPropagation`, because Escape means «out of the thing I am in» to
        anything further up, and this is that thing.
      */
      onKeyDown={
        onReturnToAnswer === undefined
          ? undefined
          : (event) => {
              if (event.key !== 'Escape') return;
              event.stopPropagation();
              onReturnToAnswer();
            }
      }
    >
      <div className="source-excerpt__head">
        <Heading level={4} data-size="2xs" className="source-excerpt__number">
          {cited ? `Utdrag ${citationNumber}` : 'Utdrag'}
        </Heading>
        {!cited && (
          <Paragraph data-size="xs" className="source-excerpt__uncited">
            Ikke vist til i svaret
          </Paragraph>
        )}
      </div>

      <Details
        className="source-excerpt__details"
        open={open}
        onToggle={(event) => onOpenChange((event.target as HTMLDetailsElement).open)}
      >
        <Details.Summary>
          {open ? 'Lukk' : 'Åpne'}
          {/* The visible label is the one word Figma uses; the accessible name
              says which excerpt it belongs to. */}
          <span className="ds-sr-only"> {name}</span>
        </Details.Summary>
        <Details.Content>
          {/* The first line of the quote in Figma: the section heading from
              the source document, in bold, with the page after it. */}
          {(heading !== undefined || page !== undefined) && (
            <Paragraph data-size="xs" className="source-excerpt__quote-heading">
              {heading !== undefined && <strong>{heading}</strong>}
              {heading !== undefined && page !== undefined && ' · '}
              {page !== undefined && <span className="source-excerpt__page">side {page}</span>}
            </Paragraph>
          )}

          {/* The passage is looked up apart from the answer, so it can be
              missing while the excerpt is real and cited. A heading drawn
              around a blank space reads as a rendering fault, so it is said. */}
          {textUnavailable ? (
            <Paragraph
              data-size="sm"
              variant="long"
              className="source-excerpt__quote source-excerpt__quote--unavailable"
            >
              {EXCERPT_UNAVAILABLE}
            </Paragraph>
          ) : (
            <Paragraph data-size="sm" variant="long" className="source-excerpt__quote">
              <HighlightedText
                text={text}
                hits={hits}
                currentHit={currentHit}
                markClassName="sources-mark"
              />
            </Paragraph>
          )}

          {pageLink !== undefined && (
            <Link
              href={pageLink}
              target="_blank"
              rel="noreferrer"
              data-size="sm"
              className="source-link"
            >
              {kudosLinkLabel(pageLink, page, corpusName)}
              {/* These links can say the same visible words, so the
                  accessible name carries which excerpt and which document
                  (WCAG 2.4.9). The excerpt first, since that is where the
                  reader is. accname joins the text and this span with a space,
                  «… på Kudos , utdrag 1 …»; it is silent in speech. */}
              <span className="ds-sr-only">
                {', '}
                {name}, {documentTitle} (åpnes i ny fane)
              </span>
              {/* Decorative: «åpnes i ny fane» says it in words. Last, where
                  Designsystemet's link gives an icon its gap. */}
              <ExternalLinkIcon aria-hidden />
            </Link>
          )}

          {/* A button, styled as a link, because it navigates nowhere: it moves
              focus back to an element with no id, and a fragment would be a
              route change that remounts the chat slot (see the marker in
              Markdown.tsx). Last, after the quote, where the reader is when
              they want it. */}
          {onReturnToAnswer !== undefined && (
            <Button
              type="button"
              variant="tertiary"
              data-size="sm"
              className="source-excerpt__back"
              onClick={onReturnToAnswer}
            >
              <BackIcon aria-hidden />
              Tilbake til svaret
            </Button>
          )}
        </Details.Content>
      </Details>
    </div>
  );
}
