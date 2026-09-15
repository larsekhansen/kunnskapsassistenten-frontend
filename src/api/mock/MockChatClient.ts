import {
  emptyFilterSelection,
  type FilterFacet,
  type FilterSelection,
  type StreamEvent,
  type Thread,
  type ThreadDetail,
} from '../../model';
import { facetsFor } from './corpus/facets';
import type { AskParams, ChatClient } from '../chatClient';
import {
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

/**
 * How fast the mock answers, as three settings rather than a number.
 *
 * `realistic` is the default and the reason this exists: a mock that answers
 * instantly cannot show what it is supposed to show. Lars asked to see the
 * skeletons, the thinking panel and the streaming actually happen, and at
 * 500 ms per thinking step and 18 ms per token the whole thing was over
 * before any of them registered. These numbers are what a real agent takes —
 * measured against the running stack on 2026-09-11, one question took 15,1
 * seconds, 15,1 of them inside the agent.
 *
 * `fast` is for the end-to-end suite, which tests what the app does and not
 * how long it takes: 56 tests each waiting out a realistic answer is minutes
 * of nothing. `slow` is for looking hard at one state.
 *
 * Chosen with `VITE_MOCK_SPEED`; see src/api/index.ts.
 */
export const mockSpeeds = {
  /*
   * Quick, not instant. These are the delays the mock had before there were
   * three settings, and the end-to-end suite is written against them.
   *
   * Zero was tried and is wrong: «avbryt stopper genereringen og beholder
   * teksten som kom» needs an answer that is still arriving when the stop
   * button is pressed, and at zero the whole thing is over before the test
   * can press anything. A mock that streams instantly does not stream.
   */
  fast: {
    thinkingStepMs: 500,
    firstTokenMs: 300,
    tokenMs: 18,
    sourcesMs: 400,
    requestMs: 250,
  },
  realistic: {
    thinkingStepMs: 1100, // the brief asks for 0,8–1,5 s
    firstTokenMs: 3800, // 3–5 s after the last thinking step
    tokenMs: 25,
    sourcesMs: 500,
    requestMs: 350,
  },
  slow: {
    thinkingStepMs: 2500,
    firstTokenMs: 7000,
    tokenMs: 60,
    sourcesMs: 1200,
    requestMs: 800,
  },
} as const satisfies Record<string, MockDelays>;

export type MockSpeed = keyof typeof mockSpeeds;

export const defaultMockSpeed: MockSpeed = 'realistic';

export const defaultMockDelays: MockDelays = mockSpeeds[defaultMockSpeed];

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

  /**
   * Facets counted from the real corpus, conditioned on what is already
   * ticked — what API-bestilling A2 asks the backend for. See
   * corpus/facets.ts for the rule about a dimension not narrowing itself.
   */
  async listFacets(signal?: AbortSignal, selection?: FilterSelection): Promise<FilterFacet[]> {
    await wait(this.#delays.requestMs, signal);
    return facetsFor(selection ?? emptyFilterSelection);
  }
}
