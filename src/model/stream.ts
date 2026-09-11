import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

/**
 * Why a turn failed. `aborted` is the user pressing stop (answer 34) and is
 * not an error state in the UI.
 */
export type ChatErrorCode =
  'aborted' | 'network' | 'unauthorized' | 'rate-limited' | 'agent' | 'unknown';

export interface ChatError {
  code: ChatErrorCode;
  /** Norwegian, shown to the user. */
  message: string;
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
  | { type: 'done'; messageId: string; conversationId: string }
  | { type: 'error'; error: ChatError };
