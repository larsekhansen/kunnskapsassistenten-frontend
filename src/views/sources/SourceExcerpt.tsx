import { Card, Details, Heading, Link, Paragraph, Tag } from '@digdir/designsystemet-react';
import { type Excerpt, relevanceLabels } from '../../model';
import { HighlightedText } from './HighlightedText';
import { excerptDomId } from './ids';
import { relevanceTagColor } from './relevance';
import type { SearchHit } from './search';

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Search hits inside this excerpt, in position order. */
  hits: SearchHit[];
  currentHit?: SearchHit;
  /** True while this is the excerpt a `[n]` marker in the answer points at. */
  active: boolean;
};

/**
 * One excerpt: its number, how relevant it is, and the quote itself.
 *
 * The number is the whole point of this component. `citationNumber` is the
 * same number as the `[n]` marker in the answer (answer 19), it is the scroll
 * target, and it sits in a heading so a screen reader user can reach it by
 * navigating headings rather than by reading the panel top to bottom.
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
  open,
  onOpenChange,
  hits,
  currentHit,
  active,
}: SourceExcerptProps) {
  const { citationNumber, relevance, heading, text, page, kudosUrl } = excerpt;

  // The first line of the quote in Figma: the section heading from the source
  // document, in bold, with the page after it. It goes in whichever of the two
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
      id={excerptDomId(citationNumber)}
      data-active={active ? 'true' : undefined}
      // -1 so the panel can move focus here when the answer points at it.
      // Focus, not only scroll: focus is what tells a screen reader user that
      // something happened, and it puts the keyboard where the eye is.
      tabIndex={-1}
    >
      <div className="source-excerpt__head">
        <Heading level={4} data-size="2xs" className="source-excerpt__number">
          Utdrag {citationNumber}
        </Heading>
        <Tag data-color={relevanceTagColor[relevance]} data-size="sm">
          {relevanceLabels[relevance]}
        </Tag>
      </div>

      <Details
        className="source-excerpt__details"
        open={open}
        onToggle={(event) => onOpenChange((event.target as HTMLDetailsElement).open)}
      >
        <Details.Summary>
          {open ? 'Lukk' : 'Åpne'}
          {/* The visible label is the one word Figma uses. The accessible name
              adds which excerpt it belongs to, so a screen reader user reading
              the list of controls does not meet five buttons called «Åpne». */}
          <span className="ds-sr-only"> utdrag {citationNumber}</span>
        </Details.Summary>
        <Details.Content>
          {quoteHeading}
          <Paragraph data-size="sm" variant="long">
            <HighlightedText text={text} hits={hits} currentHit={currentHit} />
          </Paragraph>

          {/* `kudosUrl` is absent for corpora without public URLs — the model
              says so plainly, and a link to nothing is worse than no link. */}
          {kudosUrl !== undefined && (
            <Link href={kudosUrl} target="_blank" rel="noreferrer" data-size="sm">
              {page === undefined ? 'Les utdraget på Kudos' : `Les side ${page} på Kudos`}
              <span className="ds-sr-only"> (åpnes i ny fane)</span>
            </Link>
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
