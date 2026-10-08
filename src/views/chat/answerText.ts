import type { SourceDocument } from '../../model';

/*
 * The answer as text rather than markup, for the clipboard and the live
 * region. `Markdown` renders and does not read back, so this much stays here;
 * it deliberately does no block parsing and no component mapping.
 */

// A marker and the space in front of it: the space goes with the marker, or
// «kvartalsvis [1].» is pasted as «kvartalsvis .»
const CITATION = /[ \t]?\[\d{1,3}\]/g;
const BLOCK_SYNTAX = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|>\s?)/;

/**
 * Markdown stripped to what a reader would paste into a document. The `[1]`
 * markers go by default, since on their own they point at a panel the
 * clipboard cannot carry; `keepCitations` is for the case where it does
 * ({@link answerWithSources}). Table rows become tab separated.
 */
export function answerAsPlainText(markdown: string, keepCitations = false): string {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line.startsWith('|')
        ? line
            .replace(/^\||\|$/g, '')
            .split('|')
            .map((cell) => cell.trim())
            .join('\t')
        : line.replace(BLOCK_SYNTAX, ''),
    )
    .join('\n')
    .replace(CITATION, keepCitations ? '$&' : '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * How much of a streaming answer is safe to announce: everything up to the
 * last blank line is finished text, and the tail is still being written.
 */
export function announcedText(markdown: string): string {
  const lastBreak = markdown.lastIndexOf('\n\n');
  if (lastBreak < 0) return '';
  return answerAsPlainText(markdown.slice(0, lastBreak));
}

/**
 * The reference list under a copied answer, Norwegian APA-like, with every
 * part dropped when the corpus does not have it. One line per CITED EXCERPT
 * and not per document, because `[n]` points at an excerpt and two from the
 * same report are on different pages.
 */
export function referenceList(documents: SourceDocument[]): string[] {
  return documents
    .flatMap((document) => document.excerpts.map((excerpt) => ({ document, excerpt })))
    .filter(({ excerpt }) => excerpt.citationNumber !== undefined)
    .sort((a, b) => (a.excerpt.citationNumber ?? 0) - (b.excerpt.citationNumber ?? 0))
    .map(({ document, excerpt }) => {
      const author = [document.organisation, document.year && `(${document.year})`]
        .filter(Boolean)
        .join(' ');
      const where =
        excerpt.page === undefined ? document.title : `${document.title}, s. ${excerpt.page}`;
      const url = document.url ?? excerpt.kudosUrl;

      return [`[${excerpt.citationNumber}]`, author && `${author}.`, `${where}.`, url]
        .filter(Boolean)
        .join(' ');
    });
}

/** The heading over the reference list, so a paste explains itself. */
const REFERENCE_HEADING = 'Kilder';

/**
 * What «Kopier svaret» puts on the clipboard.
 *
 * The answer with its `[n]` markers intact, then the references they point
 * at: the one thing that moves an answer out of KA must not move it out
 * without its provenance, which is precisely what KA is for.
 *
 * With nothing behind the answer — a stopped turn, a corpus that returned
 * nothing — it falls back to today's clean text, markers and all removed.
 * Markers pointing at a list that is not there would be worse than no markers.
 */
export function answerWithSources(markdown: string, documents: SourceDocument[] = []): string {
  const references = referenceList(documents);
  if (references.length === 0) return answerAsPlainText(markdown);

  return [answerAsPlainText(markdown, true), '', REFERENCE_HEADING, ...references].join('\n');
}

/** «Svaret og 3 kilder er kopiert.», with the singular form when it is one. */
export function copyReceipt(referenceCount: number): string {
  if (referenceCount === 0) return 'Svaret er kopiert.';
  const sources = referenceCount === 1 ? '1 kilde' : `${referenceCount} kilder`;
  return `Svaret og ${sources} er kopiert.`;
}
