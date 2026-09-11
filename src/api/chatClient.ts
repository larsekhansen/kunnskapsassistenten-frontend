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
   * The filter dropdowns with their values. Counts may be missing — see
   * `FacetValue.count` and API-bestilling A2.
   */
  listFacets(signal?: AbortSignal): Promise<FilterFacet[]>;
}
