import { Button, Card, Details, Heading, Link, Paragraph, Tag } from '@digdir/designsystemet-react';
import { HighlightedText, type SearchHit } from '../../components';
import { BackIcon } from '../../components/icons';
import { excerptDomId, relevanceLabels, type Excerpt } from '../../model';
import { kudosLinkLabel } from './kudosLink';
import { relevanceTagColor } from './relevance';

/** How much of the quote is shown before the user opens it. */
const PREVIEW_LENGTH = 180;

/**
 * The first part of the quote, cut at a word boundary.
 *
 * Figma clips the closed excerpt at a fixed height and fades it out with a
 * gradient. We cut the string instead, for two reasons: a gradient hides text
 * without saying how much, and it has to be redrawn for dark mode. The
 * ellipsis says the same thing and costs nothing. `chunk.md` raises the same
 * objection to the gradient.
 */
function previewOf(text: string): string {
  if (text.length <= PREVIEW_LENGTH) return text;

  const cut = text.slice(0, PREVIEW_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');

  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

type SourceExcerptProps = {
  excerpt: Excerpt;
  /** The document this excerpt came from, for the toggle's accessible name. */
  documentTitle: string;
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
 * One excerpt: its number, how relevant it is, and the quote itself.
 *
 * The number is the whole point of this component. `citationNumber` is the
 * same number as the `[n]` marker in the answer (answer 19), it is the scroll
 * target, and it sits in a heading so a screen reader user can reach it by
 * navigating headings rather than by reading the panel top to bottom.
 *
 * An excerpt can arrive WITHOUT a number: the search finds more than the
 * answer cites, and the model marks `citationNumber` optional for exactly
 * that. Such an excerpt is still worth showing, it just has nothing pointing
 * at it, so it gets no scroll target and says plainly that the answer did not
 * use it.
 *
 * Getting here is one click on a `[n]` marker; getting back was eight
 * Shift+Tab that ended somewhere else entirely, and Escape did nothing
 * (design/brukerreiser-2026-09-15.md, punkt 4). So the excerpt the reader was
 * sent to offers both ways back: Escape anywhere inside it, and a visible
 * control at the end of the quote for everyone who does not know that.
 *
 * Open and close is `Details`, decided in answer 38: Figma builds the same
 * toggle by hand in three places (`chunk`, `blackbox`, `expandable`), and
 * `Details` is the one that ships `aria-expanded` and keyboard support for
 * free. It is controlled here because search has to be able to open an excerpt
 * the user never clicked, and the type then requires `onToggle`.
 *
 * The order follows `chunk.md`: relevance tag on the top line, the toggle above
 * the text, and the document's own section heading in bold as the first line of
 * the quote. One deviation, and it is forced: Figma puts the tag and «Åpne» on
 * the SAME line, but `Details.Summary` is a full-width row in Designsystemet,
 * and answer 38 says this has to be `Details`. Squeezing the summary onto the
 * tag line means drawing the toggle ourselves, which is the thing answer 38
 * rules out.
 */
export function SourceExcerpt({
  excerpt,
  documentTitle,
  open,
  onOpenChange,
  hits,
  currentHit,
  active,
  onReturnToAnswer,
}: SourceExcerptProps) {
  const { citationNumber, relevance, heading, text, page, kudosUrl } = excerpt;
  const cited = citationNumber !== undefined;

  // Unique per excerpt, so a screen reader reading the list of controls does
  // not meet five buttons called «Åpne». An uncited excerpt has no number to
  // name it by, so it is named by the document it came from.
  const excerptName = cited ? `utdrag ${citationNumber}` : `utdrag fra ${documentTitle}`;

  // The first line of the quote in Figma: the section heading from the source
  // document, in bold, with the page after it. Rendered in whichever of the two
  // branches below is on screen — never in both at once.
  const quoteHeading =
    heading === undefined && page === undefined ? null : (
      <Paragraph data-size="xs" className="source-excerpt__quote-heading">
        {heading !== undefined && <strong>{heading}</strong>}
        {heading !== undefined && page !== undefined && ' · '}
        {page !== undefined && <span className="source-excerpt__page">side {page}</span>}
      </Paragraph>
    );

  return (
    <Card.Block
      className="source-excerpt ds-focus"
      // Only a cited excerpt is a scroll target: the id is the one the `[n]`
      // marker links to, and an excerpt with no number has no marker.
      id={cited ? excerptDomId(citationNumber) : undefined}
      data-active={active ? 'true' : undefined}
      // -1 so the panel can move focus here when the answer points at it.
      // Focus, not only scroll: focus is what tells a screen reader user that
      // something happened, and it puts the keyboard where the eye is.
      tabIndex={cited ? -1 : undefined}
      /*
        Escape returns to the marker. Scoped to this card rather than to the
        panel, so it cannot take Escape from the search field, where the
        browser's own `type='search'` handling clears the query.

        `stopPropagation`, because Escape means «out of the thing I am in» to
        anything listening further up, and this is that thing.
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
        <Tag data-color={relevanceTagColor[relevance]} data-size="sm">
          {relevanceLabels[relevance]}
        </Tag>
      </div>

      {!cited && (
        <Paragraph data-size="xs" className="source-excerpt__uncited">
          Ikke vist til i svaret
        </Paragraph>
      )}

      <Details
        className="source-excerpt__details"
        open={open}
        onToggle={(event) => onOpenChange((event.target as HTMLDetailsElement).open)}
      >
        <Details.Summary>
          {open ? 'Lukk' : 'Åpne'}
          {/* The visible label is the one word Figma uses; the accessible name
              says which excerpt it belongs to. */}
          <span className="ds-sr-only"> {excerptName}</span>
        </Details.Summary>
        <Details.Content>
          {quoteHeading}
          <Paragraph data-size="sm" variant="long">
            <HighlightedText
              text={text}
              hits={hits}
              currentHit={currentHit}
              markClassName="sources-mark"
            />
          </Paragraph>

          {/* `kudosUrl` is absent for corpora without public URLs — the model
              says so plainly, and a link to nothing is worse than no link.

              The label comes from the address, not from the page number:
              Kudos's document page has no viewer and no page anchors, so only
              a file URL with `#page=N` can open a page. See `kudosLink.ts`. */}
          {kudosUrl !== undefined && (
            <Link href={kudosUrl} target="_blank" rel="noreferrer" data-size="sm">
              {kudosLinkLabel(kudosUrl, page)}
              <span className="ds-sr-only"> (åpnes i ny fane)</span>
            </Link>
          )}

          {/* A button, not a link, although the brief calls it a link and it is
              styled like one. It navigates nowhere: it moves focus back to an
              element that has no id to point at, and the one fragment we could
              build would be a real route change that remounts the chat slot
              (see the comment on the marker in Markdown.tsx). A control that
              acts on this page is a button, and the name says where it goes.

              Last in the content, because that is where the reader is by the
              time they want it — after the quote and after the Kudos link. */}
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

      {!open && (
        <div className="source-excerpt__preview">
          {quoteHeading}
          <Paragraph data-size="sm">{previewOf(text)}</Paragraph>
        </div>
      )}
    </Card.Block>
  );
}
