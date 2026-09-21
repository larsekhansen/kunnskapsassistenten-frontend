import { Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { useId } from 'react';
import type { SourceDocument } from '../../model';
import { documentDomId } from './ids';
import { isOwnDocument, OWN_DOCUMENT_LABEL } from './origin';

/**
 * «Utdrag 1–3» when the numbers run unbroken, «Utdrag 1, 2, 5» when they do
 * not, and nothing at all for a document whose excerpts the answer never
 * cited.
 *
 * It removes an ambiguity the design has: the shortcut list is numbered by
 * document, the excerpts are numbered by `[n]` marker, and without this line
 * the reader meets two numbering systems with no way to tell them apart.
 */
function excerptRange(numbers: (number | undefined)[]): string {
  const sorted = numbers.filter((number) => number !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const unbroken = sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);

  if (sorted.length === 1) return `Utdrag ${sorted[0]}`;
  if (unbroken) return `Utdrag ${sorted[0]}–${sorted[sorted.length - 1]}`;

  return `Utdrag ${sorted.join(', ')}`;
}

type SourcesOverviewProps = {
  documents: SourceDocument[];
  onNavigateToDocument: (documentId: string) => void;
};

/**
 * «Snarveier til dokumentene»: a numbered shortcut list to the cards below.
 *
 * `List.Ordered` gives a real `<ol>`, so a screen reader announces how many
 * documents the answer rests on and where in the list the user is. Figma draws
 * each number as a circle with a thin border; we keep the native marker
 * instead. `list.md` documents that Designsystemet puts a zero-width character
 * in `li::before` to work around a VoiceOver bug, and drawing our own circle
 * there would knock that fix out.
 *
 * A plain `div` rather than a `section`: a labelled `section` is a landmark,
 * and three links inside a panel that is already a landmark do not need a
 * navigation level of their own.
 */
export function SourcesOverview({ documents, onNavigateToDocument }: SourcesOverviewProps) {
  // Not a module constant: two SourcesView in different slots would then share
  // one id, and the layout model exists so views can be moved and paired.
  const headingId = useId();

  return (
    <div className="sources-overview">
      <Heading level={3} data-size="xs" id={headingId}>
        Snarveier til dokumentene
      </Heading>

      <List.Ordered data-size="sm" aria-labelledby={headingId}>
        {documents.map((source) => {
          const range = excerptRange(source.excerpts.map((excerpt) => excerpt.citationNumber));

          return (
            <List.Item key={source.id}>
              <Link
                href={`#${documentDomId(source.id)}`}
                onClick={(event) => {
                  // Keep the fragment as the real href — it works without
                  // JavaScript and can be copied — but take over the jump so
                  // we can move focus as well as scroll.
                  event.preventDefault();
                  onNavigateToDocument(source.id);
                }}
              >
                {source.title}
                {/* An uploaded document is named by its file name, and a file
                    name can look exactly like a corpus document's title. The
                    shortcut list is read out of context — that is what a
                    shortcut list is for — so the name carries what the card
                    below shows as a subtitle. Same reason as the Kudos link
                    names in #92: a list of links has to tell its rows apart. */}
                {isOwnDocument(source) && (
                  <span className="ds-sr-only">, {OWN_DOCUMENT_LABEL.toLowerCase()}</span>
                )}
              </Link>
              {range !== '' && (
                <Paragraph data-size="xs" className="sources-overview__excerpts">
                  {range}
                </Paragraph>
              )}
            </List.Item>
          );
        })}
      </List.Ordered>
    </div>
  );
}
