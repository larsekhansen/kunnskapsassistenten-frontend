import type { SourceDocument } from '../../model';

/**
 * The one search mechanism (answers 27 and 55).
 *
 * Lars asked for one mechanism, not two: searching excerpts today, searching
 * the whole document later. So the index is a flat list of searchable pieces,
 * each tagged with what kind of thing it is. Adding document bodies later is
 * one more `kind` and one more loop in `buildSearchIndex` — the matching, the
 * counter and the previous/next navigation do not change.
 */
export type SearchableKind = 'excerpt' | 'document';

export type SearchableItem = {
  /** Same id as the excerpt (or, later, the document) the text came from. */
  id: string;
  kind: SearchableKind;
  text: string;
};

/** One match: which piece of text, and where in it. */
export type SearchHit = {
  itemId: string;
  kind: SearchableKind;
  /** Index of the first character of the match in `item.text`. */
  start: number;
  /** Index one past the last character. */
  end: number;
};

/** Shortest query we act on. One character matches nearly everything. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Everything the search can currently look inside.
 *
 * Today that is the excerpt text. The heading is not indexed separately,
 * because a hit in a heading cannot be highlighted in the body. Later the full
 * document text arrives here as `kind: 'document'`.
 */
export function buildSearchIndex(documents: SourceDocument[]): SearchableItem[] {
  return documents.flatMap((document) =>
    document.excerpts.map((excerpt) => ({
      id: excerpt.id,
      kind: 'excerpt' as const,
      text: excerpt.text,
    })),
  );
}

/**
 * All matches, in reading order: index order first, then position in the text.
 *
 * Matching is a plain case-insensitive substring search. `toLowerCase()` keeps
 * the length of every Norwegian character, æ ø å included, so the offsets stay
 * valid against the original string — which is what lets us search a
 * lowercased copy and highlight the original.
 */
export function findHits(items: SearchableItem[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_QUERY_LENGTH) return [];

  const hits: SearchHit[] = [];

  for (const item of items) {
    const haystack = item.text.toLowerCase();
    let from = 0;

    for (;;) {
      const start = haystack.indexOf(needle, from);
      if (start === -1) break;
      hits.push({ itemId: item.id, kind: item.kind, start, end: start + needle.length });
      from = start + needle.length;
    }
  }

  return hits;
}

/** The hits inside one piece of text, for rendering. */
export function hitsFor(hits: SearchHit[], itemId: string): SearchHit[] {
  return hits.filter((hit) => hit.itemId === itemId);
}

/** Wrap around in both directions, so previous from the first goes to the last. */
export function stepHit(total: number, current: number, step: 1 | -1): number {
  if (total === 0) return 0;
  return (current + step + total) % total;
}

/** A run of text, either plain or part of a match. */
export type TextRun = { text: string; hit?: SearchHit };

/**
 * Split a text into plain and matched runs, so the caller can wrap the matched
 * ones in `<mark>`. The runs cover the whole text exactly once, in order.
 */
export function splitByHits(text: string, hits: SearchHit[]): TextRun[] {
  if (hits.length === 0) return [{ text }];

  const runs: TextRun[] = [];
  let cursor = 0;

  for (const hit of hits) {
    if (hit.start > cursor) runs.push({ text: text.slice(cursor, hit.start) });
    runs.push({ text: text.slice(hit.start, hit.end), hit });
    cursor = hit.end;
  }

  if (cursor < text.length) runs.push({ text: text.slice(cursor) });

  return runs;
}
