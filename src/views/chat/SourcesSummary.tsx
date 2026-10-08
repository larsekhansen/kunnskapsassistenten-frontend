import { Details, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';
import { excerptDomId, type SourceDocument } from '../../model';
import { distinctTitles, excerptRange, isOwnDocument, OWN_DOCUMENT_LABEL } from '../sources';

type SourcesSummaryProps = {
  /** The documents behind this answer, in the order the sources panel has. */
  documents: SourceDocument[];
  /** Opens the sources panel on an excerpt of this answer, as a marker does. */
  onSelectSource: (citationNumber: number) => void;
};

/**
 * «Kilder brukt i svaret»: the documents the answer is built on, under the
 * answer, as a way into the sources panel (issue 113).
 *
 * One row per document and not per excerpt. The `[n]` markers in the text are
 * the per-excerpt view and the panel is the full one; this is the short list
 * a reader takes in at the end of the answer.
 *
 * A title opens the panel on that document's first cited excerpt, by the same
 * route a `[n]` marker takes. A document whose excerpts the answer never
 * cited has no number to go to, and its title is text.
 *
 * Numbered by document, with «Utdrag 1–2» under each title to say which
 * markers point into it — without that line, «2.» here and «[2]» in the
 * answer are two numbers for different things. `List.Ordered` is a real
 * `<ol>`, so a screen reader says how many documents there are. The native
 * numbers stay rather than Figma's circles: Designsystemet puts a zero-width
 * character in `li::before` against a VoiceOver bug, and drawing a circle
 * there would knock the fix out.
 *
 * Open from the start, as Figma draws it, and it can afford to be: it stands
 * under the answer and pushes nothing the reader came for, unlike
 * «Fremgangsmåte» above it.
 *
 * A document icon and not Figma's robot, because every line in this list is a
 * quote from a document and not something the model made.
 */
export function SourcesSummary({ documents, onSelectSource }: SourcesSummaryProps) {
  if (documents.length === 0) return null;

  // The same names as the cards in the sources panel: a document's number
  // follows its title when another one in this answer has the same title.
  const names = distinctTitles(documents);

  return (
    <Details className="ka-sources-summary" data-color="neutral" defaultOpen>
      <Details.Summary>
        <span className="ka-sources-summary__title">
          <FileTextIcon aria-hidden className="ka-sources-summary__icon" />
          Kilder brukt i svaret
        </span>
      </Details.Summary>
      <Details.Content>
        <List.Ordered className="ka-sources-summary__list" data-size="sm">
          {documents.map((document) => {
            const numbers = document.excerpts.map((excerpt) => excerpt.citationNumber);
            const first = numbers.filter((number) => number !== undefined).sort((a, b) => a - b)[0];
            const range = excerptRange(numbers);
            /*
             * An uploaded document is named by its file name, and a file name
             * can look exactly like a corpus document's title. A list like
             * this one is read out of context — a screen reader's list of
             * links — so the name says whose it is. Seen on the card as a
             * subtitle in the panel; here only in the name, so the row reads
             * as the others do.
             */
            const own = isOwnDocument(document) ? (
              <span className="ds-sr-only">, {OWN_DOCUMENT_LABEL.toLowerCase()}</span>
            ) : null;

            return (
              <List.Item key={document.id}>
                {first === undefined ? (
                  <>
                    {names.get(document.id) ?? document.title}
                    {own}
                  </>
                ) : (
                  <Link
                    // Blue as links are, as Figma draws them. The box around
                    // it is neutral, and a link takes its colour from there.
                    data-color="accent"
                    href={`#${excerptDomId(first)}`}
                    onClick={(event) => {
                      // The panel does the moving, as for a marker. Following
                      // the fragment would be a route change that remounts the
                      // chat slot (see the marker in Markdown.tsx).
                      event.preventDefault();
                      onSelectSource(first);
                    }}
                  >
                    {names.get(document.id) ?? document.title}
                    {own}
                  </Link>
                )}
                {range !== '' && (
                  <Paragraph data-size="xs" className="ka-sources-summary__excerpts">
                    {range}
                  </Paragraph>
                )}
              </List.Item>
            );
          })}
        </List.Ordered>
      </Details.Content>
    </Details>
  );
}
