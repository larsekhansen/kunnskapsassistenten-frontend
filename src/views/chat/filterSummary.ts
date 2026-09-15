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
