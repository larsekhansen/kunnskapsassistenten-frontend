import {
  emptyFilterSelection,
  type ChatErrorCode,
  type FilterFacet,
  type FilterSelection,
  type StreamEvent,
  type Thread,
  type ThreadDetail,
} from '../../model';
import { facetsFor } from './corpus/facets';
import { citationsFor, scriptedFor } from './conversations';
import { mockThreadDetail, mockThreadList, openMockThread, recordMockTurn } from './sessionThreads';
import type { AskParams, ChatClient } from '../chatClient';
import { citedNumbers, narrowToSelection, retrievalFor, withOnlyCitations } from './filtering';
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
 * One question per error code, so each of the cases can be seen.
 *
 * The frontend now says something different for a model that is down, a
 * corpus that is down, a request that timed out, a key that was rejected and
 * a search that found nothing — and none of those five could be reached from
 * a built app before, for the same reason `MOCK_FAILURE_QUERY` exists. The
 * backend does not send the codes yet either (API-bestilling A16), so this is
 * the only way in until it does.
 *
 * `simuler feil` keeps its old meaning, `unknown`: the generic failure the
 * end-to-end suite and the brukerblikk tests already ask for by name. The
 * longer phrases are exact matches too, so `simuler feil modell` is its own
 * question and not a prefix match on the short one.
 */
export const MOCK_ERROR_QUERIES: Readonly<Record<string, ChatErrorCode>> = {
  [MOCK_FAILURE_QUERY]: 'unknown',
  'simuler feil modell': 'model-unavailable',
  'simuler feil korpus': 'retrieval-unavailable',
  'simuler tidsavbrudd': 'timeout',
  'simuler ingen treff': 'no-hits',
  'simuler avvist nøkkel': 'unauthorized',
};

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

let answerCounter = 0;

/**
 * An id for one answer. The clock alone was not enough: two questions asked
 * inside the same millisecond produced the same id, and the stored thread
 * then had two messages React could not tell apart.
 */
function nextMessageId(): string {
  answerCounter += 1;
  return `msg-${Date.now()}-${answerCounter}`;
}

/**
 * A backend that is not there. Streams the NKOM answer token by token with
 * thinking steps first and sources last, in the same order and shape the live
 * client will produce.
 *
 * It honours the document filter, which the real backend does not yet. See
 * filtering.ts for why that belongs here and not only in a test.
 *
 * Cancellation surfaces as a final `error` event with code `aborted` rather
 * than a thrown exception, so a caller has one code path for «the answer
 * stopped» regardless of why.
 *
 * It also remembers: every turn that produced text is written into the open
 * thread in `sessionStorage`, so a reload finds the conversation again and
 * the thread list shows it. See sessionThreads.ts for why a mock does this
 * and the live client does not.
 */
export class MockChatClient implements ChatClient {
  readonly #delays: MockDelays;

  constructor(delays: Partial<MockDelays> = {}) {
    this.#delays = { ...defaultMockDelays, ...delays };
  }

  async *ask(params: AskParams): AsyncIterable<StreamEvent> {
    const { signal } = params;
    // What has actually been said, so a turn the reader stopped can be
    // remembered as the half-answer it is rather than dropped.
    let written = '';
    /*
     * The clock over the thinking, so the turn written into `sessionStorage`
     * carries the wait the reader actually sat through. Without it a reloaded
     * conversation showed the sum of the steps' own `durationMs` instead —
     * a different number for a turn that had not changed (brukerblikk runde
     * 2, funn 5). The view measures the same interval off the stream; both
     * are the same clock over the same two events.
     */
    let thinkingStartedAt: number | undefined;
    const thoughtMs = () =>
      thinkingStartedAt === undefined ? undefined : { thoughtMs: Date.now() - thinkingStartedAt };
    try {
      const simulated = MOCK_ERROR_QUERIES[params.query.trim().toLocaleLowerCase('nb-NO')];
      if (simulated) {
        // After a thinking step, not instantly: a failure that arrives before
        // anything has happened does not exercise the state the views go
        // through, which is «an answer was under way and then it was not».
        // The same holds for a search that came back empty — it searched
        // first, and the thinking panel is what says so.
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt = Date.now();
        yield { type: 'thinking-step', step: nkomThinkingSteps[0]! };
        await wait(this.#delays.firstTokenMs, signal);
        // No `message`: the whole point is that the text comes from the code,
        // so a mock that wrote its own would be testing the mock's wording.
        yield { type: 'error', error: { code: simulated }, createdAt: new Date().toISOString() };
        return;
      }

      if (params.query.trim().toLocaleLowerCase('nb-NO') === MOCK_CLARIFICATION_QUERY) {
        // One thinking step and then the question back: the agent looked at
        // what was asked and decided it could not search on it yet. No
        // `sources` event, because nothing was retrieved — a clarification
        // with sources behind it would be a different thing entirely.
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt = Date.now();
        yield { type: 'thinking-step', step: nkomThinkingSteps[0]! };

        await wait(this.#delays.firstTokenMs, signal);
        const clarificationThought = thoughtMs();
        for (const text of tokenize(clarificationMarkdown)) {
          await wait(this.#delays.tokenMs, signal);
          written += text;
          yield { type: 'token', text };
        }

        const clarificationId = nextMessageId();
        // One turn, one time. Made here and handed to both the store and the
        // `done` frame, so the answer says the same thing before and after a
        // reload. See `StreamEvent`'s `done`.
        const clarificationAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: clarificationId,
          // No sources, because nothing was retrieved. A clarification with
          // sources behind it would be a different thing entirely.
          answer: {
            content: written,
            citations: [],
            createdAt: clarificationAt,
            ...clarificationThought,
            status: 'needs-clarification',
          },
        });
        yield {
          type: 'done',
          messageId: clarificationId,
          conversationId: params.conversationId ?? 'conv-nkom-1',
          createdAt: clarificationAt,
          outcome: 'needs-clarification',
        };
        return;
      }

      /*
       * A cached conversation, when the question is one of the eleven. Lars
       * asked for «noen nye søk, cachede, så jeg kan teste selv»; see
       * conversations/scripts.ts. Everything below it — steps, answer,
       * sources, done — is the same sequence the default answer uses, so a
       * scripted turn and an unscripted one are indistinguishable to a view.
       */
      const scripted = scriptedFor(params.query);

      /*
       * What the filter leaves to search in. The backend ignores the
       * parameter today (API-bestilling A2), so this is the only place the
       * control has an effect — and a filter with no effect is the thing
       * reise 8 says a first-time user meets first. See filtering.ts.
       *
       * It narrows a scripted conversation the same way it narrows the
       * default one. The filter belongs to the reader and not to the answer,
       * and a control that quietly stops working on eleven of the questions is
       * worse than one that never worked at all.
       */
      const documents = narrowToSelection(scripted?.documents ?? nkomSources, params.filters);
      const cited = citedNumbers(documents);

      const steps = scripted?.thinkingSteps ?? nkomThinkingSteps;
      for (const step of steps) {
        await wait(this.#delays.thinkingStepMs, signal);
        thinkingStartedAt ??= Date.now();
        yield { type: 'thinking-step', step };
      }

      // A question that fails does it after the thinking steps, the way the
      // real one does: an answer was under way and then it was not.
      if (scripted?.failure) {
        await wait(this.#delays.firstTokenMs, signal);
        yield { type: 'error', error: scripted.failure, createdAt: new Date().toISOString() };
        return;
      }

      await wait(this.#delays.firstTokenMs, signal);
      const thought = thoughtMs();
      for (const text of tokenize(
        withOnlyCitations(scripted?.answer ?? mockAnswerMarkdown, cited),
      )) {
        await wait(this.#delays.tokenMs, signal);
        written += text;
        yield { type: 'token', text };
      }

      // No sources event for a clarification: nothing was retrieved, and a
      // question back with sources behind it would be a different thing.
      //
      // Asked of the script and not of `documents`: a conversation the filter
      // has narrowed to nothing is an answer whose sources are all outside
      // the selection, which is not the same thing as a question back.
      if (scripted && scripted.documents.length === 0) {
        const scriptedId = nextMessageId();
        const scriptedAt = new Date().toISOString();
        recordMockTurn({
          question: params.query,
          answerId: scriptedId,
          answer: {
            content: written,
            citations: [],
            createdAt: scriptedAt,
            thinkingSteps: steps,
            ...thought,
            status: scripted.outcome ?? 'complete',
          },
        });
        yield {
          type: 'done',
          messageId: scriptedId,
          conversationId: params.conversationId ?? 'conv-nkom-1',
          createdAt: scriptedAt,
          ...(scripted.outcome ? { outcome: scripted.outcome } : {}),
        };
        return;
      }

      const citations = (scripted ? citationsFor(scripted) : nkomCitations).filter((citation) =>
        cited.has(citation.number),
      );
      const retrieval = retrievalFor(documents, scripted?.retrieval ?? nkomRetrieval);

      await wait(this.#delays.sourcesMs, signal);
      yield { type: 'sources', documents, citations, retrieval };

      /*
       * Written down as the turn that was actually streamed, not as the
       * default one. Named locals rather than the fixtures, because the two
       * had drifted apart the moment a scripted or filtered answer existed: a
       * reload would then have replaced a Bufdir answer's sources with NKOM's,
       * and a filtered answer's with the whole unfiltered set.
       */
      const messageId = nextMessageId();
      const answeredAt = new Date().toISOString();
      recordMockTurn({
        question: params.query,
        answerId: messageId,
        answer: {
          content: written,
          citations,
          createdAt: answeredAt,
          sources: documents,
          retrieval,
          thinkingSteps: steps,
          ...thought,
          status: scripted?.outcome ?? 'complete',
        },
      });
      yield {
        type: 'done',
        messageId,
        conversationId: params.conversationId ?? 'conv-nkom-1',
        createdAt: answeredAt,
        ...(scripted?.outcome ? { outcome: scripted.outcome } : {}),
      };
    } catch {
      /*
       * Stopped by the reader, and text had arrived. That half-answer stays
       * on screen — answer 34 — so it is part of the conversation and is
       * remembered as one.
       *
       * Stored as `complete` and not as `aborted`, deliberately: `useChat`
       * settles a stopped answer as complete, so this is what the reader was
       * looking at when they reloaded. Nothing arrived means nothing is
       * stored: an answer with no content draws no card, and a stored empty
       * one would draw a card that never existed.
       */
      // One turn, one time, the same rule the `done` path follows: made once
      // here and handed to both the store and the frame that ends the stream.
      const stoppedAt = new Date().toISOString();
      if (signal?.aborted && written.length > 0) {
        recordMockTurn({
          question: params.query,
          answerId: nextMessageId(),
          answer: {
            content: written,
            citations: [],
            createdAt: stoppedAt,
            status: 'complete',
          },
        });
      }
      yield {
        type: 'error',
        error: signal?.aborted ? { code: 'aborted' } : { code: 'unknown' },
        createdAt: stoppedAt,
      };
    }
  }

  /**
   * Which conversation the questions that follow belong to. See
   * `ChatClient.openThread`, and sessionThreads.ts for what is kept.
   */
  openThread(thread: Thread): void {
    openMockThread(thread);
  }

  async listThreads(signal?: AbortSignal): Promise<Thread[]> {
    await wait(this.#delays.requestMs, signal);
    return mockThreadList(threads);
  }

  async getThread(threadId: string, signal?: AbortSignal): Promise<ThreadDetail | null> {
    await wait(this.#delays.requestMs, signal);
    return mockThreadDetail(threadId, findThread(threadId));
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
