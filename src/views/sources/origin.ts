import type { SourceDocument } from '../../model';

/**
 * Telling the reader's own file from a Kudos document.
 *
 * Read off `origin`, never off the title. An uploaded «Årsrapport 2025.pdf» is
 * not the corpus's «Årsrapport … 2025»: it has no Kudos address, nobody else
 * can open it, and the panel has to say so. See `src/model/source.ts`.
 *
 * Absent means corpus, because documents from before uploads came from one.
 */
export function isOwnDocument(source: SourceDocument): boolean {
  return source.origin === 'user';
}

/**
 * The line under the document title.
 *
 * A corpus document has type, organisation and year. An uploaded one has none
 * of the three, so it says that it is the reader's own. Without it the card
 * looks like a corpus document with missing metadata.
 */
export function documentSubtitle(source: SourceDocument): string {
  if (isOwnDocument(source)) return OWN_DOCUMENT_LABEL;

  return [source.documentType, source.organisation, source.year]
    .filter((part) => part !== undefined)
    .join(' · ');
}

/** What an uploaded document is called, in the subtitle and in link names. */
export const OWN_DOCUMENT_LABEL = 'Ditt dokument';

/**
 * Why there is no link out of an uploaded document's card.
 *
 * Not the folder-corpus sentence («Dokumentet har ingen offentlig lenke»),
 * which reads as something missing. A file only the reader holds never had a
 * link, and that is its normal state.
 */
export const OWN_DOCUMENT_NO_LINK =
  'Bare du har dette dokumentet, så det finnes ingen lenke til det.';

/**
 * Which corpus key the panel should name for the answer on screen.
 *
 * The answer's own, whenever it has one. The answer's corpus and the chooser
 * part when an older thread from another corpus is opened, and the excerpts
 * do not change when the chooser moves, so nothing naming them may either.
 *
 * The active key is only the fallback, for a turn where nothing said which
 * corpus answered. It is a guess, but right where nobody has switched.
 */
export function corpusKeyFor(
  answerKey: string | undefined,
  activeKey: string | undefined,
): string | undefined {
  return answerKey ?? activeKey;
}
