import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

/**
 * Why a turn ended the way it did.
 *
 * The code is the contract; the Norwegian the reader sees is looked up from
 * it in the view, so the same case reads the same whether it came from the
 * mock, from an HTTP status or from the backend. «Noe gikk galt» covered all
 * of these at once and told the reader nothing about what to do next
 * (design/brukerreiser-2026-09-15.md, punkt 12).
 *
 * `aborted` is the user pressing stop (answer 34) and is not an error state
 * in the UI. `no-hits` is not one either: the search ran and found nothing,
 * which is an answer with an empty source list — it travels as an `error`
 * event because that is the frame that ends a stream without content, and
 * the chat turns it back into a finished turn. API-bestilling A16 asks the
 * backend for the same distinction.
 *
 * `model-unavailable` and `retrieval-unavailable` are told apart only when
 * the backend says which it was. Nothing here guesses: an HTTP 5xx is
 * `unknown`, because «språkmodellen svarer ikke» and «korpuset er nede» need
 * different things from the reader and a wrong guess sends them the wrong way.
 */
const CHAT_ERROR_CODES = [
  'aborted',
  'model-unavailable',
  'retrieval-unavailable',
  'timeout',
  'no-hits',
  'unauthorized',
  'rate-limited',
  'unknown',
] as const;

export type ChatErrorCode = (typeof CHAT_ERROR_CODES)[number];

/**
 * A code from outside, narrowed to one we know.
 *
 * The backend does not send `error.code` yet (API-bestilling A16), and the
 * day it does it will send codes this frontend has never heard of. That must
 * land on `unknown` and show the generic text, never throw and never reach a
 * lookup table with no entry for it.
 */
export function chatErrorCode(value: unknown): ChatErrorCode {
  return CHAT_ERROR_CODES.find((code) => code === value) ?? 'unknown';
}

export interface ChatError {
  code: ChatErrorCode;
  /**
   * What the layer that caught it saw, when it knows more than the code does
   * — «Fikk ikke kontakt med tjenesten», the agent's own error text. It
   * replaces the first of the two sentences the view writes; the second one,
   * about what the reader can do, always comes from the code. Leave it out
   * and both come from the code.
   *
   * Norwegian if it is set at all: it goes on screen.
   */
  message?: string;
}

/**
 * One frame from a streaming answer (answer 33).
 *
 * The order is: `thinking-step` zero or more times, `token` many times,
 * `sources` once when the answer is done building, then `done` — or `error`
 * at any point, which always ends the stream.
 *
 * `sources` comes last because the backend only knows the chunks when the
 * final frame arrives; a client must not expect citations to resolve while
 * the text is still streaming.
 */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'thinking-step'; step: ThinkingStep }
  | {
      type: 'sources';
      documents: SourceDocument[];
      citations: Citation[];
      retrieval: RetrievalDetails;
    }
  | {
      type: 'done';
      messageId: string;
      conversationId: string;
      /**
       * How the agent says the turn ended, from `_meta.status` in the final
       * frame. Absent means `complete`, which is what every answer up to now
       * has been and what a client that ignores this field keeps getting.
       *
       * The backend's third value, `error`, is not here: an answer that
       * failed already arrives as an `error` event, and having two ways to
       * say the same thing would leave a reader wondering which one wins.
       */
      outcome?: 'complete' | 'needs-clarification';
    }
  | { type: 'error'; error: ChatError };
