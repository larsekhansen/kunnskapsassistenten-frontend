import { filterDimensions } from '../model';
import type { FilterDimension } from '../model';
import { kaEnv } from './runtimeConfig';

/**
 * What a corpus calls the three dimensions the design draws.
 *
 * The filter panel offers «Dokumenttyper», «Virksomheter» and «År». The
 * backend's filter wants the corpus's own field names, and those differ from
 * corpus to corpus: Kudos has `type`, `orgs_long` and `concerned_years`, the
 * next corpus will have three other names, and one of them may well have no
 * year at all.
 *
 * **That translation is knowledge about a corpus, so it is configuration and
 * not code** (docs/arkitektur/0001-fasetter-og-korpuskunnskap.md, alternative
 * D: the mechanism ships in code, the policy lives per dataset). A field name
 * written into `src/` would be a frontend that only works against Kudos, and
 * the next corpus would be a pull request rather than an environment
 * variable. So nothing here names a field; it reads them.
 *
 * Read the same way as `VITE_KA_DATASETS` in corpus.ts, deliberately: one
 * variable, semicolons between entries, one bad entry dropped with a single
 * warning rather than an exception. A deployment setting is read at startup,
 * and a typo should cost that entry and not the app.
 *
 * A dimension with no entry is **not sent, and never guessed**. Sending a
 * guessed field name is worse than sending nothing: Typesense answers a
 * filter on a field it does not know with an error or with nothing, and the
 * reader would see «ingen treff» for a corpus that has the documents.
 */

/** One dimension, as one corpus names it. */
export type FilterFieldMapping = {
  /** The corpus's own field name, spelled as the backend's filter expects it. */
  field: string;
  /**
   * `value-type` on the wire, for a field that is not text.
   *
   * Measured by the conductor against the whole Kudos corpus 2026-09-24:
   * `concerned_years = 2024` WITHOUT it gives 0 hits, because Typesense
   * refuses a quoted number on a numeric field. So it is required for year,
   * not decoration.
   *
   * Passed through as written rather than checked against a list of known
   * types. The set of types is the backend's and Typesense's to grow, and a
   * frontend that validated it would reject a working configuration the day
   * one of them added `float`.
   */
  valueType?: string;
};

/** One dataset's field names. A missing dimension is one that is not sent. */
export type DatasetFilterFields = Partial<Record<FilterDimension, FilterFieldMapping>>;

/** Every dataset this deployment knows the field names of, by dataset key. */
export type FilterFieldConfig = Record<string, DatasetFilterFields>;

/** The dimensions, as a set, for telling a name from a typo. */
const KNOWN_DIMENSIONS = new Set<string>(filterDimensions);

/**
 * `"kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer"`
 *
 * Semicolons between datasets and the first `=` after the dataset key, as in
 * `VITE_KA_DATASETS` — the two variables describe the same datasets and
 * should not need two grammars learnt. Inside one dataset: `|` between
 * dimensions, and `:` inside a dimension, as
 * `dimension:field` or `dimension:field:value-type`.
 *
 * Neither a dataset key, a dimension name, a field name nor a value type has
 * ever held any of those four characters: the first two are ours, and the
 * last two are Typesense identifiers and type names. Unlike the corpus label,
 * none of this is a human sentence, so there is nothing here to protect from
 * the separators.
 *
 * Whitespace around every part is trimmed, so the variable can be written
 * across lines in a compose file.
 *
 * Dropped rather than thrown, one warning for the lot:
 * - a dataset with no `=`, or an empty key
 * - a dimension that is not one of the three (a typo would otherwise be a
 *   filter that silently never reached the backend)
 * - a mapping with no field name
 * - a dataset left with no valid dimension at all, which says nothing that
 *   an absent entry does not
 *
 * First wins for a repeated dataset key and for a repeated dimension inside
 * one, for the reason corpus.ts gives: one thing written twice is a mistake,
 * and picking the later one silently is not more right than picking the
 * earlier one loudly.
 */
export function parseFilterFields(raw: string | undefined): FilterFieldConfig {
  if (!raw?.trim()) return {};

  const config: FilterFieldConfig = {};
  const dropped: string[] = [];

  for (const entry of raw.split(';')) {
    if (!entry.trim()) continue;

    const split = entry.indexOf('=');
    const key = (split === -1 ? entry : entry.slice(0, split)).trim();
    const rest = split === -1 ? '' : entry.slice(split + 1);

    if (!key || split === -1) {
      dropped.push(entry.trim());
      continue;
    }
    if (config[key]) continue;

    const fields: DatasetFilterFields = {};
    for (const mapping of rest.split('|')) {
      if (!mapping.trim()) continue;

      const [dimension = '', field = '', valueType = ''] = mapping.split(':').map((p) => p.trim());
      if (!KNOWN_DIMENSIONS.has(dimension) || !field) {
        dropped.push(mapping.trim());
        continue;
      }

      const named = dimension as FilterDimension;
      if (fields[named]) continue;
      fields[named] = { field, ...(valueType ? { valueType } : {}) };
    }

    // A dataset whose every mapping was dropped is the same as no dataset:
    // keeping the empty shell would only make `filterFieldsFor` answer with
    // an object that translates nothing.
    if (Object.keys(fields).length === 0) {
      dropped.push(key);
      continue;
    }

    config[key] = fields;
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) oppføring(er) i VITE_KA_FILTER_FIELDS. ` +
        `Formatet er "datasett=dimensjon:felt|dimensjon:felt:verditype;…", ` +
        `der dimensjonen er ${filterDimensions.join(', ')}. ` +
        `Hoppet over: ${dropped.join(', ')}`,
    );
  }

  return config;
}

/*
 * Read once, at import, like the corpus list: this is a deployment's
 * statement about its datasets and it does not change while the app runs.
 * `kaEnv()` and not `import.meta.env`, so one container image can be pointed
 * at another corpus without a rebuild — and so the module survives plain
 * Node, where Playwright loads spec files that reach it.
 */
const filterFields = parseFilterFields(kaEnv().VITE_KA_FILTER_FIELDS);

/**
 * The field names for one dataset, or undefined when none are configured.
 *
 * Undefined for an unknown dataset and for `undefined` itself — which is the
 * live client with no tenant and dataset pair set, where the backend picks a
 * dataset and nothing on this side knows which one it picked. No dataset
 * means no field names, and no field names means no filter on the wire.
 */
export function filterFieldsFor(datasetKey: string | undefined): DatasetFilterFields | undefined {
  return datasetKey ? filterFields[datasetKey] : undefined;
}
