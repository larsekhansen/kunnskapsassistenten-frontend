import type { FilterDimension, FilterSelection } from '../../model';

/**
 * «Avgrenset til: Årsrapport · 2023» — what the answer above it was asked
 * against.
 *
 * A facet value is the word the reader ticked: `facetsFor` in
 * src/api/mock/corpus/facets.ts builds the dropdowns from the corpus and sets
 * `value` and `label` to the same string. So there is nothing to look up, and
 * this stays a pure function of the selection. The day the backend hands out
 * ids of its own (API-bestilling A2), this is where the lookup goes, and the
 * line will need the facets to do it.
 */

/** Dimensions in the order the filter panel lists them. */
const DIMENSION_ORDER: FilterDimension[] = ['documentType', 'organisation', 'year'];

/** The line over an answer, or undefined when nothing was narrowed. */
export function filterSummaryText(selection: FilterSelection): string | undefined {
  const chosen = DIMENSION_ORDER.flatMap((dimension) => selection[dimension]);
  return chosen.length === 0 ? undefined : chosen.join(' · ');
}

/**
 * The whole «Avgrenset til …» line: the corpus when it needs saying, then
 * what the reader narrowed it to.
 *
 * The chat column drew no corpus name at all until now, and for one corpus it
 * should not: «Avgrenset til: Kudos · Årsrapport» over every answer in a
 * deployment with one corpus is a word that never varies.
 *
 * It varies in exactly one case, and that is the case this exists for: an
 * answer retrieved from somewhere other than where the chooser stands now.
 * Open a Kudos thread while the chooser says Wikipedia and every answer in it
 * came from Kudos — the sources panel says so, and without this the column
 * above it does not (KA CC on #129, and the reason `Message.corpusKey`
 * exists).
 *
 * `answerCorpusName` is looked up from the ANSWER's key, never from the
 * choice. A name read from the chooser would be the bug wearing the fix's
 * clothes.
 */
export function answerScopeText(
  selection: FilterSelection,
  answerCorpusName?: string,
): string | undefined {
  const narrowed = filterSummaryText(selection);
  if (!answerCorpusName) return narrowed;
  return narrowed ? `${answerCorpusName} · ${narrowed}` : answerCorpusName;
}
