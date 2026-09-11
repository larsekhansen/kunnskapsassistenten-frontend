import type { ChatTransport, StreamEvent } from '../types';
import { DEMO_SOURCES } from './content';
import { DEMO_ANSWER, DEMO_RETRIEVAL } from './thread';

/** Resolves after `ms`, or rejects the moment the signal aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export type FixtureTransportOptions = {
  /** The answer to stream. */
  answer?: string;
  /** Milliseconds before the first token, so the skeleton is visible. */
  latencyMs?: number;
  /** Milliseconds between tokens. */
  tokenDelayMs?: number;
  /** Fail instead of answering, to exercise the error state (answer 35). */
  fail?: boolean;
};

/**
 * A transport that streams a fixture answer token by token.
 *
 * The real one speaks to the API; this one has the same shape, so the view is
 * written once. Tokens are words, because that is roughly what a model emits
 * and it is what makes the paragraph-wise announcement worth testing.
 */
export function fixtureTransport(options: FixtureTransportOptions = {}): ChatTransport {
  const { answer = DEMO_ANSWER, latencyMs = 700, tokenDelayMs = 18, fail = false } = options;

  return async function* stream(_question, signal): AsyncIterable<StreamEvent> {
    await wait(latencyMs, signal);

    if (fail) {
      yield { type: 'error', message: 'Kunne ikke hente svaret. Prøv igjen.' };
      return;
    }

    yield { type: 'retrieval', retrieval: DEMO_RETRIEVAL };

    // Keep the whitespace: the blank lines are what separate the blocks, and
    // the announcement waits for them.
    for (const token of answer.split(/(?<=\s)/)) {
      await wait(tokenDelayMs, signal);
      yield { type: 'token', text: token };
    }

    yield { type: 'sources', sources: DEMO_SOURCES };
  };
}
