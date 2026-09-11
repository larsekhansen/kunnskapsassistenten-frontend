/**
 * The three filter dimensions the design draws, as three multi-select
 * dropdowns: «Dokumenttyper», «Virksomheter», «År».
 */
export type FilterDimension = 'documentType' | 'organisation' | 'year';

/** One selectable value inside a dimension. */
export interface FacetValue {
  /** Stable key sent to the backend. Not shown to the user. */
  value: string;
  /** Norwegian, shown to the user: «Årsrapport», «Advokattilsynet», «2024». */
  label: string;
  /**
   * How many documents this value matches, given the other selections.
   * The design shows it in parentheses: «Årsrapport (1032)».
   * backend: mangler, se API-bestilling A2 — the backend filters by whole
   * dataset (`tenant` + `dataset_config_key`), it has no facet aggregation.
   * Undefined means «unknown», and the count is then simply not rendered.
   */
  count?: number;
}

/** One dropdown: a dimension with its values. */
export interface FilterFacet {
  dimension: FilterDimension;
  /** Norwegian, the field label. */
  label: string;
  values: FacetValue[];
}

/**
 * What the user has selected, per dimension. Values are {@link FacetValue.value}.
 * An empty array means «no restriction on this dimension», never «nothing».
 */
export type FilterSelection = Record<FilterDimension, string[]>;

export const emptyFilterSelection: FilterSelection = {
  documentType: [],
  organisation: [],
  year: [],
};

/** True when nothing is selected in any dimension. */
export function isEmptySelection(selection: FilterSelection): boolean {
  return Object.values(selection).every((values) => values.length === 0);
}
