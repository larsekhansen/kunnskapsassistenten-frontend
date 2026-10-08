import type { SourceDocument } from '../../model';
import { isOwnDocument } from './origin';

/** Two titles are the same when they differ only in case or spacing. */
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nb');
}

/**
 * The name each document goes by in the sources panel and under the answer:
 * its title, and its number when another document in the same answer has the
 * same title.
 *
 * The index can give two Kudos documents the same title (it drops a suffix
 * such as «(DFD)»). Without the number, one answer drew two cards and two
 * links with the same name and different targets.
 *
 * The number and not «1 av 2»: «1 av 2» reads as part one of a report, and the
 * order changes from answer to answer. The number is the one in the Kudos
 * address the reader lands on. Nothing else in the data tells the two apart: a
 * chunk has no date, and in live mode no type, publisher or year.
 *
 * `id` is the document's number in Kudos (`doc_num`) in live and bff mode.
 * Without one it falls back to a chunk's id, which is still distinct and
 * stable.
 *
 * Only documents from the corpus count and get a number. An uploaded file has
 * no number in Kudos, and is told apart already as «ditt dokument».
 *
 * A comma before it, not brackets: the Kudos link's name ends in «(åpnes i ny
 * fane)», and two brackets in a row read badly.
 */
export function distinctTitles(documents: readonly SourceDocument[]): Map<string, string> {
  const counts = new Map<string, number>();
  const corpus = documents.filter((document) => !isOwnDocument(document));
  for (const document of corpus) {
    const key = titleKey(document.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return new Map(
    documents.map((document) => [
      document.id,
      !isOwnDocument(document) && (counts.get(titleKey(document.title)) ?? 0) > 1
        ? `${document.title}, dokument ${document.id}`
        : document.title,
    ]),
  );
}
