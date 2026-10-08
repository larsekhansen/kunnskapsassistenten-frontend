import type { SourceDocument } from '../../model';
import type { SearchableItem } from '../../components';

/**
 * What this view gives the search to look inside.
 *
 * The search is in `src/components/textSearch.ts` and knows nothing about
 * documents: it takes a flat list of text with an id each. This is the piece
 * that knows what a document is. Whole documents would be one more `kind`
 * here, and the matching, the counter and previous/next would not change.
 */

/**
 * Everything the search can look inside: the excerpt text. The heading is not
 * indexed, because a hit in a heading cannot be highlighted in the body.
 */
export function buildSearchIndex(documents: SourceDocument[]): SearchableItem[] {
  // `source`, not `document`: this view uses the DOM global in the same files.
  return documents.flatMap((source) =>
    source.excerpts.map((excerpt) => ({
      id: excerpt.id,
      kind: 'excerpt' as const,
      text: excerpt.text,
    })),
  );
}
