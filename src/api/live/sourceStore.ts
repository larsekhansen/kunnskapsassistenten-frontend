import type { McpChunk } from './mcp';

/**
 * Which chunks each answer was built from, kept in this browser, so the
 * sources come back when the page is loaded again (Simens runde 3, ekstra 2;
 * docs/arkitektur/0005).
 *
 * The backend keeps the answer and not its chunks: a thread read back has
 * `chunks: []` on every message (headless-rag #21). So the one record of them
 * is what the live answer carried, and this is where it is written down.
 *
 * Only what the answer itself carried is kept: the chunk's id, the document's
 * number, its title, its address and the heading path. No passage from any
 * document is written to the browser. The text is looked up again from the
 * same route a fresh answer uses (excerpts.ts), so a fresh answer and one read
 * back cannot show two texts for one chunk.
 *
 * Keyed by the conversation and by the answer's text, because nothing else
 * survives: the live stream names its answer `msg-<time>`, and the store gives
 * the same answer an id of its own. The stored text was measured to be the
 * text `tools/call` returned, character for character (30.09, one answer).
 *
 * Everything here fails quietly. Storage that is full, blocked or corrupt
 * leaves the reader where they were before this existed — sources gone after
 * a reload — and never costs them an answer.
 */

export const SOURCES_STORAGE_KEY = 'ka.sources.v1';

/**
 * The most this store takes, in characters of JSON. A chunk is about 350
 * (measured: 1041 for three), an answer at most 20 chunks, so this is some
 * 140 answers at their largest and many more as they come. Browsers give an
 * origin about five million, and the rest of this app needs some of it.
 */
export const MAX_STORED_CHARS = 1_000_000;

/** What is kept of one chunk: what `toSourceDocuments` reads, and no more. */
export type StoredChunk = Pick<McpChunk, 'chunk_id' | 'doc_num' | 'title' | 'url' | 'metadata'>;

type StoredThread = {
  /** When this thread was last written or opened, for choosing what to drop. */
  usedAt: number;
  /** Answer fingerprint → its chunks, in the order the answer numbered them. */
  answers: Record<string, StoredChunk[]>;
};

type Store = { threads: Record<string, StoredThread> };

/**
 * A short, stable name for an answer's text: its length and an FNV-1a hash of
 * it. Trimmed first, because whitespace at the ends is the one difference a
 * store could introduce without changing the answer.
 *
 * Not a secret and not a guard against anyone: two answers in one thread with
 * the same length and hash would share their sources, and those are the odds
 * of a 32-bit collision among a handful of strings.
 */
export function answerFingerprint(text: string): string {
  const trimmed = text.trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash ^= trimmed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${trimmed.length}.${hash.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const optionalString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** One stored chunk, or nothing, from whatever was in storage. */
function chunkFrom(value: unknown): StoredChunk | undefined {
  if (!isRecord(value)) return undefined;
  const chunk: StoredChunk = {};
  const id = optionalString(value.chunk_id);
  const docNum = optionalString(value.doc_num);
  const title = optionalString(value.title);
  const url = optionalString(value.url);
  const metadata = optionalString(value.metadata);
  if (id) chunk.chunk_id = id;
  if (docNum) chunk.doc_num = docNum;
  if (title) chunk.title = title;
  if (url) chunk.url = url;
  if (metadata) chunk.metadata = metadata;
  return chunk;
}

/** The store as it is in `localStorage`, or an empty one. Never throws. */
function read(): Store {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SOURCES_STORAGE_KEY) ?? 'null');
    if (!isRecord(parsed) || !isRecord(parsed.threads)) return { threads: {} };

    const threads: Record<string, StoredThread> = {};
    for (const [id, thread] of Object.entries(parsed.threads)) {
      if (!isRecord(thread) || !isRecord(thread.answers)) continue;
      const answers: Record<string, StoredChunk[]> = {};
      for (const [fingerprint, chunks] of Object.entries(thread.answers)) {
        if (!Array.isArray(chunks)) continue;
        answers[fingerprint] = chunks.flatMap((chunk) => chunkFrom(chunk) ?? []);
      }
      threads[id] = { usedAt: typeof thread.usedAt === 'number' ? thread.usedAt : 0, answers };
    }
    return { threads };
  } catch {
    return { threads: {} };
  }
}

/**
 * Drops the threads used longest ago until the store fits `limit`. The thread
 * just written is the newest, so it is the last to go.
 */
function trimmed(store: Store, limit: number): string {
  let json = JSON.stringify(store);
  const oldestFirst = Object.entries(store.threads)
    .sort(([, a], [, b]) => a.usedAt - b.usedAt)
    .map(([id]) => id);
  while (json.length > limit && oldestFirst.length > 1) {
    delete store.threads[oldestFirst.shift() as string];
    json = JSON.stringify(store);
  }
  return json;
}

/**
 * Writes the store, and when the browser says it is full anyway, tries once
 * more with half the room. Never throws.
 */
function write(store: Store): void {
  try {
    localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS));
  } catch {
    try {
      localStorage.setItem(SOURCES_STORAGE_KEY, trimmed(store, MAX_STORED_CHARS / 2));
    } catch {
      // Blocked or full. The reader loses their sources at the next reload,
      // which is what happened before this store existed.
    }
  }
}

/**
 * Writes down the chunks behind one answer. An answer with no chunks writes
 * nothing, and there is nothing to bring back for it either.
 */
export function rememberAnswerSources(
  threadId: string,
  answerText: string,
  chunks: McpChunk[],
  now = Date.now(),
): void {
  if (!threadId || answerText.trim() === '' || chunks.length === 0) return;

  const store = read();
  const thread = store.threads[threadId] ?? { usedAt: now, answers: {} };
  thread.usedAt = now;
  thread.answers[answerFingerprint(answerText)] = chunks.flatMap(
    (chunk) =>
      chunkFrom({
        ...chunk,
        // One name for the title, whichever of the three it arrived under.
        title: chunk.title ?? chunk.doc_title ?? chunk.docTitle,
      }) ?? [],
  );
  store.threads[threadId] = thread;
  write(store);
}

/**
 * The chunks written down for one thread's answers, by fingerprint, or
 * undefined when there are none. Opening a thread counts as using it, so a
 * thread the reader keeps coming back to is not the one dropped.
 */
export function recallThreadSources(
  threadId: string,
  now = Date.now(),
): ReadonlyMap<string, StoredChunk[]> | undefined {
  const store = read();
  const thread = store.threads[threadId];
  if (!thread) return undefined;

  thread.usedAt = now;
  write(store);
  return new Map(Object.entries(thread.answers));
}
