import { Card, Heading, Link, Paragraph } from '@digdir/designsystemet-react';
import { ExternalLinkIcon } from '@navikt/aksel-icons';
import { hitsFor, type SearchHit } from '../../components';
import type { SourceDocument } from '../../model';
import { SourceExcerpt } from './SourceExcerpt';
import { documentDomId } from './ids';
import { documentLinkLabel } from './kudosLink';
import { documentSubtitle, isOwnDocument, OWN_DOCUMENT_NO_LINK } from './origin';

type SourceDocumentCardProps = {
  /** Named `source`, not `document`: the DOM global is used in this view. */
  source: SourceDocument;
  /**
   * What the card calls the document: its title, and its number when another
   * document in the answer has the same title. From `distinctTitles`, which
   * «Kilder brukt i svaret» under the answer uses too, so the two say the same.
   */
  name: string;
  /** What to call the corpus, or undefined when nothing names it. */
  corpusName: string | undefined;
  /** Ids of the excerpts that are currently open. */
  openExcerptIds: ReadonlySet<string>;
  onExcerptOpenChange: (excerptId: string, open: boolean) => void;
  hits: SearchHit[];
  currentHit?: SearchHit;
  /** `citationNumber` of the excerpt a `[n]` marker in the answer points at. */
  activeCitationNumber?: number;
  /**
   * Moves focus back to the marker the reader came from. Handed on only to the
   * excerpt that marker points at, which the card already works out.
   */
  onReturnToAnswer?: () => void;
};

/**
 * One document with every excerpt taken from it, Figma's `document`: a blue
 * head with the title, and a grey body with the excerpts as white boxes, then
 * the way to the document itself.
 *
 * `Card` plus two `Card.Block`s, Designsystemet's shape for a box in parts.
 * The head is the title only, as in Figma; what the document is (type,
 * publisher, year) opens the body, in small print over its excerpts.
 *
 * The document's link is the last thing in the body, once per document. An
 * excerpt has a link of its own only when it opens the page the quote is on;
 * see `SourceExcerpt`.
 *
 * The link sits outside the heading on purpose. `Card` delegates a click
 * anywhere on the card to the first link inside a heading, and a card full of
 * `Details` toggles must not do that. Keeping the link out of the heading is
 * the documented way to switch the delegation off.
 */
export function SourceDocumentCard({
  source,
  name,
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
          {name}
        </Heading>
      </Card.Block>

      <Card.Block className="source-document__body">
        {subtitle !== '' && (
          <Paragraph data-size="xs" className="source-document__subtitle">
            {subtitle}
          </Paragraph>
        )}

        {source.excerpts.map((excerpt, index) => {
          const active =
            excerpt.citationNumber !== undefined && excerpt.citationNumber === activeCitationNumber;

          return (
            <SourceExcerpt
              key={excerpt.id}
              excerpt={excerpt}
              documentTitle={name}
              corpusName={corpusName}
              // The place in the document, for naming an excerpt the answer
              // never cited.
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

        {own ? (
          // The reader's own file never had a public address. See `origin.ts`
          // for why the sentence differs from the folder-corpus one below.
          <Paragraph data-size="xs" className="source-document__no-link">
            {OWN_DOCUMENT_NO_LINK}
          </Paragraph>
        ) : source.url === undefined ? (
          // Normal, not an error: folder-based corpora have no public URL.
          // Saying so beats a dead link or an unexplained missing one.
          <Paragraph data-size="xs" className="source-document__no-link">
            Dokumentet har ingen offentlig lenke.
          </Paragraph>
        ) : (
          <Link
            href={source.url}
            target="_blank"
            rel="noreferrer"
            data-size="sm"
            className="source-link"
          >
            {documentLinkLabel(corpusName)}
            {/* The title, because every card ends in these same words, and a
                list of the panel's links must tell them apart (WCAG 2.4.9).
                Designsystemet says not to mark an external link with an icon
                alone, so leaving the app is said in words too.

                accname joins the text and this span with a space, «… på Kudos
                , Årsrapport …». It is silent in speech, and the only way to
                drop it is one `aria-label` for the whole name. */}
            <span className="ds-sr-only">
              {', '}
              {name} (åpnes i ny fane)
            </span>
            {/* Figma's icon for leaving the app, decorative for the same
                reason as on the excerpt's page link. */}
            <ExternalLinkIcon aria-hidden />
          </Link>
        )}
      </Card.Block>
    </Card>
  );
}
