import { kaEnv } from './runtimeConfig';

/**
 * Where a corpus's documents can be read, as a template per dataset.
 *
 * The chunks the backend returns carry the document's number (`doc_num`) and,
 * for Kudos, no address: measured in the test environment 30.09, every source
 * said «Dokumentet har ingen offentlig lenke» (Simens issue 92). The address
 * is knowledge about a corpus — Kudos puts a document at
 * `https://kudos.dfo.no/documents/<doc_num>`, and the next corpus somewhere
 * else, or nowhere — so it is configuration and not code, like the filter
 * fields (docs/arkitektur/0001-fasetter-og-korpuskunnskap.md). Nikolai's BFF
 * reads it the same way, from `KUDOS_BASE`.
 *
 * `VITE_KA_DOCUMENT_URLS`, in the grammar of `VITE_KA_DATASETS`: semicolons
 * between datasets, the first `=` after the key, and `{doc_num}` where the
 * number goes:
 *
 *   kudos-full=https://kudos.dfo.no/documents/{doc_num}
 *
 * A template and not a base, so no path is written into `src/`. A dataset
 * with no entry gets no link, which the sources panel already draws honestly.
 * An entry that is not an http(s) address with `{doc_num}` in it is dropped
 * with one warning: a link built from it would go nowhere, or somewhere a
 * link from here must never go.
 */

export const DOC_NUM = '{doc_num}';

export function parseDocumentUrls(raw: string | undefined): ReadonlyMap<string, string> {
  const templates = new Map<string, string>();
  const dropped: string[] = [];

  for (const entry of (raw ?? '').split(';')) {
    if (!entry.trim()) continue;
    const split = entry.indexOf('=');
    const key = split === -1 ? '' : entry.slice(0, split).trim();
    const template = split === -1 ? '' : entry.slice(split + 1).trim();
    if (!key || !/^https?:\/\//i.test(template) || !template.includes(DOC_NUM)) {
      dropped.push(entry.trim());
      continue;
    }
    // First wins, as in the other dataset settings.
    if (!templates.has(key)) templates.set(key, template);
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) oppføring(er) i VITE_KA_DOCUMENT_URLS. ` +
        `Formatet er "datasett=https://…/${DOC_NUM};…". Hoppet over: ${dropped.join(', ')}`,
    );
  }
  return templates;
}

let parsed: { raw: string | undefined; templates: ReadonlyMap<string, string> } | undefined;

/**
 * `kaEnv()` and not `import.meta.env`, so one container image can be pointed
 * at another corpus by its environment alone, as with the filter fields.
 * Parsed once per value, so a bad entry is warned about once and not per
 * chunk.
 */
function configured(): ReadonlyMap<string, string> {
  const raw = kaEnv().VITE_KA_DOCUMENT_URLS;
  if (parsed === undefined || parsed.raw !== raw) {
    parsed = { raw, templates: parseDocumentUrls(raw) };
  }
  return parsed.templates;
}

/**
 * The address of one document, or undefined when the corpus has none.
 *
 * `dataset` is the corpus the chunk was retrieved from. Without one — a turn
 * where the backend picked, a thread from before there was a choice — it is
 * the dataset live asks when nothing is chosen, which is what those were
 * asked of.
 *
 * The number is encoded, because it comes from the backend and is put into a
 * path: a `doc_num` with a slash in it must not reach another page.
 */
export function documentUrl(
  dataset: string | undefined,
  docNum: string | number | null | undefined,
  templates: ReadonlyMap<string, string> = configured(),
): string | undefined {
  const number = docNum === null || docNum === undefined ? '' : String(docNum).trim();
  if (!number) return undefined;
  const key = dataset ?? kaEnv().VITE_KA_DATASET_CONFIG_KEY;
  const template = key === undefined ? undefined : templates.get(key);
  return template?.replaceAll(DOC_NUM, encodeURIComponent(number));
}
