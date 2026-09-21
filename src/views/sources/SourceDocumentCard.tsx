import { Card, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { hitsFor, type SearchHit } from '../../components';
import type { SourceDocument } from '../../model';
import { SourceExcerpt } from './SourceExcerpt';
import { documentDomId } from './ids';
import { documentSubtitle, isOwnDocument, OWN_DOCUMENT_NO_LINK } from './origin';

type SourceDocumentCardProps = {
  /** Named `source`, not `document`: the DOM global is used in this view. */
  source: SourceDocument;
  /** What to call the corpus this answer came from, in the link texts. */
  corpusName: string;
  /** Ids of the excerpts that are currently open. */
  openExcerptIds: ReadonlySet<string>;
  onExcerptOpenChange: (excerptId: string, open: boolean) => void;
  hits: SearchHit[];
  currentHit?: SearchHit;
  /** `citationNumber` of the excerpt a `[n]` marker in the answer points at. */
  activeCitationNumber?: number;
  /**
   * Moves focus back to the marker the reader came from.
   *
   * Handed only to the excerpt that marker points at, which is why it arrives
   * here rather than being decided per excerpt: the card is where the active
   * number is already compared.
   */
  onReturnToAnswer?: () => void;
};

/**
 * One document with every excerpt taken from it (answer 57).
 *
 * Grouping is what `Card` plus `Card.Block` is for: the blocks are separated
 * by rules inside one card, which is the shape Figma draws, and the document
 * title is written once instead of once per excerpt.
 *
 * The document link deliberately sits in its own block and NOT inside the
 * heading. `Card` delegates a click anywhere on the card to the first link it
 * finds inside a heading (card.tsx:52-70), and a card full of `Details`
 * toggles is the last place that belongs. Keeping the link out of the heading
 * is the documented way to switch the delegation off.
 */
export function SourceDocumentCard({
  source,
  corpusName,
  openExcerptIds,
  onExcerptOpenChange,
  hits,
  currentHit,
  activeCitationNumber,
  onReturnToAnswer,
}: SourceDocumentCardProps) {
  const subtitle = documentSubtitle(source);
  const own = isOwnDocument(source);

  return (
    <Card
      // Neutral surface, like the answer card. Without it the card
      // inherits accent from the root and turns marine in dark mode.
      data-color="neutral"
      className="source-document ds-focus"
      id={documentDomId(source.id)}
      tabIndex={-1}
    >
      <Card.Block className="source-document__head">
        <Heading level={3} data-size="xs">
          {source.title}
        </Heading>
        {subtitle !== '' && (
          <Paragraph data-size="xs" className="source-document__subtitle">
            {subtitle}
          </Paragraph>
        )}
        <Paragraph data-size="xs" className="source-document__count">
          {source.excerpts.length} utdrag
        </Paragraph>
      </Card.Block>

      {source.excerpts.map((excerpt, index) => {
        const active =
          excerpt.citationNumber !== undefined && excerpt.citationNumber === activeCitationNumber;

        return (
          <SourceExcerpt
            key={excerpt.id}
            excerpt={excerpt}
            documentTitle={source.title}
            corpusName={corpusName}
            // The place in the document, for naming an excerpt the answer
            // never cited: the same count the card prints above them.
            position={index + 1}
            total={source.excerpts.length}
            open={openExcerptIds.has(excerpt.id)}
            onOpenChange={(open) => onExcerptOpenChange(excerpt.id, open)}
            hits={hitsFor(hits, excerpt.id)}
            currentHit={currentHit?.itemId === excerpt.id ? currentHit : undefined}
            active={active}
            // Only the excerpt the marker points at gets a way back, because
            // it is the only one the reader was sent to.
            onReturnToAnswer={active ? onReturnToAnswer : undefined}
          />
        );
      })}

      <Card.Block className="source-document__foot">
        {own ? (
          // The reader's own file. It never had a public address, which is the
          // normal state for it — see `origin.ts` for why this is not the same
          // sentence as the folder-corpus one below.
          <Paragraph data-size="xs">{OWN_DOCUMENT_NO_LINK}</Paragraph>
        ) : source.url === undefined ? (
          // Normal, not an error: folder-based corpora have no public URL.
          // Saying so beats a dead link or an unexplained missing one.
          <Paragraph data-size="xs">Dokumentet har ingen offentlig lenke.</Paragraph>
        ) : (
          <Link href={source.url} target="_blank" rel="noreferrer" data-size="sm">
            Les dokumentet på {corpusName}
            {/* The title, because every document card ends in these same
                words: without it a screen reader listing the panel's links
                reads them once per document and cannot tell which one leads
                where (WCAG 2.4.9, KA CC on #70).

                Designsystemet also says not to mark an external link with an
                icon alone, so leaving the app is said in words too.

                The computed name comes out as «… på Kudos , Årsrapport …»:
                accname joins a text node and an element with a space, and the
                only way to drop it is to make the whole name one `aria-label`.
                Measured with CDP 2026-09-17. It is silent in speech, so it
                stays — and this note is here so nobody chases it twice. */}
            <span className="ds-sr-only">
              {', '}
              {source.title} (åpnes i ny fane)
            </span>
          </Link>
        )}
      </Card.Block>
    </Card>
  );
}
