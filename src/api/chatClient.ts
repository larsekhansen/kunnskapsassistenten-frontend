import type { FilterFacet, FilterSelection, StreamEvent, Thread, ThreadDetail } from '../model';

/** One question to the assistant. */
export interface AskParams {
  /** The question, as the user typed it. */
  query: string;
  /** Continue an existing backend conversation. Omit to start a new one. */
  conversationId?: string;
  /** Which documents to search in. Empty selection means the whole corpus. */
  filters?: FilterSelection;
  /** Cancels the answer (answer 34). */
  signal?: AbortSignal;
}

/**
 * Everything the frontend needs from a backend. The mock and the live client
 * implement the same interface, so nothing above this layer knows which one
 * it is talking to.
 *
 * `ask` returns an async iterable rather than taking callbacks: `for await`
 * gives the caller cancellation and back pressure for free, and it maps
 * straight onto the server-sent events the live client will read.
 */
export interface ChatClient {
  ask(params: AskParams): AsyncIterable<StreamEvent>;
  listThreads(signal?: AbortSignal): Promise<Thread[]>;
  /** Resolves to null when the thread does not exist. */
  getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null>;
  /**
   * The filter dropdowns with their values.
   *
   * `selection` is what the user has already ticked, and the counts come back
   * conditioned on it: pick an organisation and the years then say how many
   * of THAT organisation's documents each year holds. A dimension never
   * narrows its own counts, or every unticked value would drop to zero the
   * moment the first one was ticked.
   *
   * Optional, and omitting it asks for the unconditioned counts. Mock mode
   * computes all of this from the corpus. Live mode returns nothing at all:
   * the backend filters by whole dataset and has no facet aggregation. See
   * `FacetValue.count` and API-bestilling A2.
   */
  listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]>;
}
