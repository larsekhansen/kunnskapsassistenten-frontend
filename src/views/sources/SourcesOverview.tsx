import { Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import type { SourceDocument } from '../../model';
import { documentDomId } from './ids';

/**
 * «Utdrag 1–3» when the numbers run unbroken, «Utdrag 1, 2, 5» when they do
 * not.
 *
 * It removes an ambiguity the design has: the shortcut list is numbered by
 * document, the excerpts are numbered by `[n]` marker, and without this line
 * the reader meets two numbering systems with no way to tell them apart.
 */
function excerptRange(numbers: number[]): string {
  if (numbers.length === 0) return '';

  const sorted = [...numbers].sort((a, b) => a - b);
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
 * there would knock that fix out. A ring around a digit is not worth it.
 */
export function SourcesOverview({ documents, onNavigateToDocument }: SourcesOverviewProps) {
  return (
    <section className="sources-overview" aria-labelledby="kilder-snarveier">
      <Heading level={3} data-size="xs" id="kilder-snarveier">
        Snarveier til dokumentene
      </Heading>

      <List.Ordered data-size="sm">
        {documents.map((document) => (
          <List.Item key={document.id}>
            <Link
              href={`#${documentDomId(document.id)}`}
              onClick={(event) => {
                // Keep the fragment as the real href — it works without
                // JavaScript and can be copied — but take over the jump so we
                // can move focus as well as scroll.
                event.preventDefault();
                onNavigateToDocument(document.id);
              }}
            >
              {document.title}
            </Link>
            <Paragraph data-size="xs" className="sources-overview__excerpts">
              {excerptRange(document.excerpts.map((excerpt) => excerpt.citationNumber))}
            </Paragraph>
          </List.Item>
        ))}
      </List.Ordered>
    </section>
  );
}
