/**
 * Which corpus the assistant searches, chosen at runtime.
 *
 * Lars 21.09: «Jeg vil kunne velge hvilke korpuser jeg bruker» — the NorQuAD
 * wiki corpus and the Kudos pilot separately, in one frontend, without
 * restarting the dev server.
 *
 * Two halves that are deliberately apart. The LIST is configuration and comes
 * from the environment, because which datasets a deployment can reach is a
 * property of that deployment and not of this code. The CHOICE is state: one
 * key, remembered per browser, that the reader changes and every backend call
 * then carries.
 *
 * It is a module store rather than a React context, and that is the one
 * design decision here worth defending. The chat client is not a component —
 * it is built once by `createChatClient()` and has to read the active key at
 * the moment it builds a request — so a context would mean either handing the
 * key through every `ask()` call site, which is four views that would all
 * have to remember, or a client that is rebuilt whenever the choice changes.
 * An external store is read by both: the client reads it at call time, and
 * `useCorpus` subscribes to it the same way `useViewportWidth` subscribes to
 * the window.
 */

/** One corpus a reader can pick, as the environment names it. */
export type CorpusOption = {
  /** `dataset_config_key` on the wire. See src/api/live/mcp.ts. */
  key: string;
  /** What the reader sees. Norwegian, from the environment. */
  label: string;
  /**
   * The line under the label: what is actually in this corpus.
   *
   * Optional, because a corpus is usable without one. It exists because the
   * corpus line in the filter panel has always said what the reader is
   * searching — «Dokumenter fra Kudos: 938 dokumenter …» — and that sentence
   * has to change with the corpus, or it says «Kudos» over NorQuAD's
   * articles. Asked for by #2, 21.09.
   */
  description?: string;
};

/**
 * `"norquad-docs=Wikipedia (NorQuAD)|351 artikler;kudos-pilot=Kudos-pilot"`.
 *
 * Semicolons between entries, one `=` inside each, and an optional `|` after
 * the label for the description. The label may hold anything but those three,
 * parentheses and spaces included, because it is a human name — so only the
 * FIRST `=` splits, and the rest of the entry is the name whatever it
 * contains.
 *
 * `key=Label` with no `|` stays exactly as valid as it was: the description
 * is an addition to the format in the brief, not a change to it, and a
 * deployment that sets no descriptions loses nothing but the second line.
 *
 * Anything malformed is dropped rather than thrown: this is a deployment
 * setting read at startup, and one bad entry should cost that entry, not the
 * whole app. A dropped entry is reported once to the console, because a
 * corpus that silently fails to appear is the kind of thing that gets blamed
 * on the backend for an afternoon.
 */
export function parseCorpusOptions(raw: string | undefined): CorpusOption[] {
  if (!raw?.trim()) return [];

  const options: CorpusOption[] = [];
  const dropped: string[] = [];

  for (const entry of raw.split(';')) {
    if (!entry.trim()) continue;

    const split = entry.indexOf('=');
    const key = (split === -1 ? entry : entry.slice(0, split)).trim();
    const rest = split === -1 ? '' : entry.slice(split + 1);
    const pipe = rest.indexOf('|');
    const label = (pipe === -1 ? rest : rest.slice(0, pipe)).trim();
    const description = pipe === -1 ? undefined : rest.slice(pipe + 1).trim() || undefined;

    // A key with no label would draw a nameless row in the selector, and a
    // label with no key names nothing. Both are the setting being wrong.
    if (!key || !label) {
      dropped.push(entry.trim());
      continue;
    }
    // First wins. A repeated key is one corpus written twice, and two rows
    // that send the same thing is worse than one.
    if (options.some((option) => option.key === key)) continue;

    options.push({ key, label, ...(description ? { description } : {}) });
  }

  if (dropped.length > 0) {
    console.warn(
      `KA: hopper over ${dropped.length} ugyldig(e) oppføring(er) i VITE_KA_DATASETS. ` +
        `Formatet er "nøkkel=Navn|beskrivelse;nøkkel=Navn", der beskrivelsen er valgfri. ` +
        `Hoppet over: ${dropped.join(', ')}`,
    );
  }

  return options;
}

/**
 * The list this deployment offers, and which of them starts selected.
 *
 * `VITE_KA_DATASET_CONFIG_KEY` keeps working on its own: it was the only
 * setting until today, and a deployment that sets just it has exactly one
 * corpus and no choice to make. When the list is there too, the single key is
 * read as «which of these to start on» — and if it names one the list does
 * not hold, it is added, because a key that reaches the backend today must
 * not stop doing so because somebody wrote a list that forgot it.
 */
export function resolveCorpus(
  datasets: string | undefined,
  configured: string | undefined,
): { options: CorpusOption[]; fallback: string | undefined } {
  const options = parseCorpusOptions(datasets);
  const key = configured?.trim() || undefined;

  if (key && !options.some((option) => option.key === key)) {
    // Named by its key, because nobody has given it a nicer name to show.
    options.unshift({ key, label: key });
  }

  return { options, fallback: key ?? options[0]?.key };
}

/**
 * How a thread records the corpus it was started in, inside the conversation
 * store's own `tags` list.
 *
 * Prefixed because `tags` is shared: the backend labels conversations with it
 * too, and a bare `kudos-pilot` sitting among them would be ambiguous both
 * ways — we could read someone else's tag as a corpus, and they could read
 * ours as whatever they use tags for.
 */
export const CORPUS_TAG_PREFIX = 'corpus:';

/** The corpus a stored thread belongs to, or undefined if it records none. */
export function corpusKeyFromTags(tags: string[] | null | undefined): string | undefined {
  const tag = tags?.find((value) => value.startsWith(CORPUS_TAG_PREFIX));
  return tag?.slice(CORPUS_TAG_PREFIX.length) || undefined;
}

/** Where the choice is remembered. Versioned like `ka.layout.v1`. */
export const CORPUS_STORAGE_KEY = 'ka.corpus.v1';

/**
 * The one corpus mock mode has.
 *
 * Mock answers from a fixed corpus of 938 Kudos documents, and it is not a
 * dataset any backend knows — the key is for the shape, so everything
 * downstream can treat mock and live alike, and `(mock)` is in the label so
 * nobody reads a demo as the pilot. One entry means no chooser is drawn.
 */
export const MOCK_CORPUS: CorpusOption = {
  key: 'mock',
  label: 'Kudos, 938 dokumenter (mock)',
  description:
    'Årsrapporter, strategi og plan, tildelingsbrev, statusrapporter og evalueringer, 2020–2027.',
};

const { options: corpusOptions, fallback } =
  (import.meta.env.VITE_API_MODE ?? 'mock') === 'live'
    ? resolveCorpus(import.meta.env.VITE_KA_DATASETS, import.meta.env.VITE_KA_DATASET_CONFIG_KEY)
    : { options: [MOCK_CORPUS], fallback: MOCK_CORPUS.key };

export { corpusOptions };

/**
 * A reader with one corpus has no choice to make, so nothing is drawn for it.
 * The key still travels on every call — one corpus is still a corpus.
 */
export const corpusIsChoosable = corpusOptions.length > 1;

function readStored(): string | undefined {
  try {
    const stored = localStorage.getItem(CORPUS_STORAGE_KEY) ?? undefined;
    // A stored key the list no longer holds is a corpus that has been taken
    // away since the reader last chose it. Falling back beats asking the
    // backend for a dataset that is not there any more.
    return stored && corpusOptions.some((option) => option.key === stored) ? stored : undefined;
  } catch {
    // Private mode, blocked storage. The choice is a convenience; losing it
    // must not stop the app reading its own configuration.
    return undefined;
  }
}

let active = readStored() ?? fallback;
const listeners = new Set<() => void>();

/** The key that goes on the wire right now. Undefined means «backend picks». */
export function activeCorpusKey(): string | undefined {
  return active;
}

/** The whole entry for a key, for anything that needs more than the key. */
export function corpusOption(key: string | undefined): CorpusOption | undefined {
  return corpusOptions.find((option) => option.key === key);
}

export function corpusLabel(key: string | undefined): string | undefined {
  return corpusOption(key)?.label;
}

/**
 * Change the corpus. Nothing else here knows what that costs the reader —
 * the thread in progress was asked of the old corpus and cannot be continued
 * in the new one — so starting a new thread is the shell's job, in
 * `useCorpus`.
 */
export function setActiveCorpusKey(key: string): void {
  if (key === active || !corpusOptions.some((option) => option.key === key)) return;
  active = key;

  try {
    localStorage.setItem(CORPUS_STORAGE_KEY, key);
  } catch {
    // Remembered for this page at least. See `readStored`.
  }

  for (const listener of [...listeners]) listener();
}

export function subscribeToCorpus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
