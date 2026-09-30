import type { SourceDocument } from '../../model';

/**
 * The text of an answer's chunks, from our own server's `/api/excerpts`
 * (server/excerpts.ts, docs/arkitektur/0005).
 *
 * The MCP answer names its chunks and leaves their text out, so every excerpt
 * in live arrived with an empty `text` and nothing saying why — the sources
 * panel drew the heading path and a blank box (Simens issue 86d). This fills
 * the text in, or says it could not be had.
 */

/** Long enough for the server's own 5 s towards Typesense, and a little more. */
const TIMEOUT_MS = 6_000;

/**
 * The texts by chunk id, or undefined when they could not be fetched at all.
 *
 * Undefined and an empty map are told apart on purpose: undefined is «the
 * lookup failed», an empty map is «it answered, and none of these were
 * found». The excerpts come out the same either way — `textUnavailable` —
 * but only the first is worth a line in the console.
 */
export async function fetchExcerptTexts(
  basePath: string,
  dataset: string | undefined,
  ids: string[],
  signal?: AbortSignal,
): Promise<Map<string, string> | undefined> {
  if (!dataset || ids.length === 0) return new Map();

  const query = new URLSearchParams({ dataset, ids: ids.join(',') });
  // The caller's signal and a timeout, as one. By hand rather than with
  // `AbortSignal.any`, which the test environment does not have.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const response = await fetch(`${basePath}/excerpts?${query}`, { signal: controller.signal });
    if (!response.ok) {
      console.warn('KA: utdragene svarte %d.', response.status);
      return undefined;
    }
    const body = (await response.json()) as { excerpts?: Record<string, unknown> };
    return new Map(
      Object.entries(body.excerpts ?? {}).flatMap(([id, text]) =>
        typeof text === 'string' && text.trim() !== '' ? [[id, text]] : [],
      ),
    );
  } catch (error) {
    // A reader who stopped the answer is not a failure worth reporting.
    if (!signal?.aborted) console.warn('KA: fikk ikke hentet utdragene.', error);
    return undefined;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/**
 * What a chunk id is made of, as the server checks it (server/excerpts.ts).
 * An excerpt whose chunk came with no id has one this client made up, and one
 * id the server refuses would cost the whole request.
 */
const CHUNK_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Every chunk id in the documents that can be asked for, in order, once each. */
export function excerptIds(documents: SourceDocument[]): string[] {
  const ids = documents.flatMap((document) => document.excerpts.map((excerpt) => excerpt.id));
  return [...new Set(ids.filter((id) => CHUNK_ID.test(id)))];
}

/**
 * The documents with each excerpt's text filled in, or `textUnavailable` set
 * where there is none: the lookup failed, or this chunk was not found.
 *
 * `textUnavailable` is the model's own word for it, and the sources panel says
 * it in words (source.ts). An empty `text` with no flag is what live used to
 * send, and it drew as a box with nothing in it.
 */
export function withExcerptTexts(
  documents: SourceDocument[],
  texts: ReadonlyMap<string, string> | undefined,
): SourceDocument[] {
  return documents.map((document) => ({
    ...document,
    excerpts: document.excerpts.map((excerpt) => {
      const text = texts?.get(excerpt.id);
      if (text) return { ...excerpt, text };
      return { ...excerpt, text: '', textUnavailable: true };
    }),
  }));
}
