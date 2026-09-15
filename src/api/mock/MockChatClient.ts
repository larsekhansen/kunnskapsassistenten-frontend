import type { FilterFacet, StreamEvent, Thread, ThreadDetail } from '../../model';
import type { AskParams, ChatClient } from '../chatClient';
import {
  facets,
  findThread,
  mockAnswerMarkdown,
  nkomCitations,
  nkomRetrieval,
  nkomSources,
  nkomThinkingSteps,
  threads,
} from './fixtures';

export interface MockDelays {
  /** Between thinking steps. */
  thinkingStepMs: number;
  /** Before the first token, once the thinking steps are done. */
  firstTokenMs: number;
  /** Between tokens. */
  tokenMs: number;
  /** Between the last token and the sources. */
  sourcesMs: number;
  /** For listThreads, getThread and listFacets. */
  requestMs: number;
}

export const defaultMockDelays: MockDelays = {
  thinkingStepMs: 500,
  firstTokenMs: 300,
  tokenMs: 18,
  sourcesMs: 400,
  requestMs: 250,
};

/**
 * Ask this and the mock fails instead of answering.
 *
 * The error path has no other way in from a built app: the mock never fails
 * on its own, so «Prøv igjen» and the alert region could not be reached by an
 * end-to-end test or shown to a designer without swapping in a live backend
 * that is down. An environment flag would have meant a second build, since
 * Vite substitutes those at build time and the suite builds once.
 *
 * An exact match on the whole question, not a word inside it: «hva er feil i
 * rapporten» is a real question and has to get a real answer.
 */
export const MOCK_FAILURE_QUERY = 'simuler feil';

/**
 * Ask this and the mock answers with a question back instead of an answer.
 *
 * Same reasoning as the failure query: `needs-clarification` is a real state
 * the backend reports in `_meta.status`, and without a way in from a built app
 * neither an end-to-end test nor a designer could ever see what it looks like.
 * The text is what that state IS — a question to the user — so it carries no
 * sources and no citations, and nothing here pretends otherwise.
 */
export const MOCK_CLARIFICATION_QUERY = 'simuler avklaring';

const clarificationMarkdown = [
  'Jeg trenger litt mer for å svare godt på dette.',
  '',
  'Mener du måloppnåelsen slik den er rapportert i årsrapportene, eller slik',
  'den er satt opp som mål i tildelingsbrevene? De to henger sammen, men',
  'tallene står forskjellige steder.',
].join('\n');

/** Resolves after `ms`, or rejects with the abort reason if the signal fires. */
function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Split into tokens that keep their trailing whitespace, so joining them back
 * reproduces the markdown exactly. Roughly word-sized, which is finer than
 * the real backend flushes (it batches at paragraph boundaries or every
 * 250 ms) — deliberately, because it makes streaming bugs visible.
 */
function tokenize(markdown: string): string[] {
  return markdown.match(/\S+\s*/g) ?? [];
}

/**
 * A backend that is not there. Streams the NKOM answer token by token with
 * thinking steps first and sources last, in the same order and shape the live
 * client will produce.
 *
 * Cancellation surfaces as a final `error` event with code `aborted` rather
 * than a thrown exception, so a caller has one code path for «the answer
 * stopped» regardless of why.
 */
export class MockChatClient implements ChatClient {
  readonly #delays: MockDelays;

  constructor(delays: Partial<MockDelays> = {}) {
    this.#delays = { ...defaultMockDelays, ...delays };
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const { signal } = params;
    try {
      if (params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_FAILURE_QUERY) {
        // After a thinking step, not instantly: a failure that arrives before
        // anything has happened does not exercise the state the views go
        // through, which is «an answer was under way and then it was not».
        await wait(this.#delays.thinkingStepMs, signal);
        yield { type: 'thinking-step', step: nkomThinkingSteps[0]! };
        await wait(this.#delays.firstTokenMs, signal);
        yield {
          type: 'error',
          error: { code: 'unknown', message: 'Noe gikk galt. Prøv igjen.' },
        };
        return;
      }

      if (params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_CLARIFICATION_QUERY) {
        // One thinking step and then the question back: the agent looked at
        // what was asked and decided it could not search on it yet. No
        // `sources` event, because nothing was retrieved — a clarification
        // with sources behind it would be a different thing entirely.
        await wait(this.#delays.thinkingStepMs, signal);
        yield { type: 'thinking-step', step: nkomThinkingSteps[0]! };

        await wait(this.#delays.firstTokenMs, signal);
        for (const text of tokenize(clarificationMarkdown)) {
          await wait(this.#delays.tokenMs, signal);
          yield { type: 'token', text };
        }

        yield {
          type: 'done',
          messageId: `msg-${Date.now()}`,
          conversationId: params.conversationId ?? 'conv-nkom-1',
          outcome: 'needs-clarification',
        };
        return;
      }

      for (const step of nkomThinkingSteps) {
        await wait(this.#delays.thinkingStepMs, signal);
        yield { type: 'thinking-step', step };
      }

      await wait(this.#delays.firstTokenMs, signal);
      for (const text of tokenize(mockAnswerMarkdown)) {
        await wait(this.#delays.tokenMs, signal);
        yield { type: 'token', text };
      }

      await wait(this.#delays.sourcesMs, signal);
      yield {
        type: 'sources',
        documents: nkomSources,
        citations: nkomCitations,
        retrieval: nkomRetrieval,
      };

      yield {
        type: 'done',
        messageId: `msg-${Date.now()}`,
        conversationId: params.conversationId ?? 'conv-nkom-1',
      };
    } catch {
      yield {
        type: 'error',
        error: signal?.aborted
          ? { code: 'aborted', message: 'Svaret ble avbrutt.' }
          : { code: 'unknown', message: 'Noe gikk galt. Prøv igjen.' },
      };
    }
  }

  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    await wait(this.#delays.requestMs, signal);
    return threads;
  }

  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    await wait(this.#delays.requestMs, signal);
    return findThread(threadId);
  }

  async listFacets(signal?: AbortSignal): Promise<FilterFacet[]> {
    await wait(this.#delays.requestMs, signal);
    return facets;
  }
}
