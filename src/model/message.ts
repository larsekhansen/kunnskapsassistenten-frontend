import type { Citation } from './citation';
import type { RetrievalDetails, ThinkingStep } from './retrieval';
import type { SourceDocument } from './source';

export type MessageRole = 'user' | 'assistant';

/**
 * `streaming` is an assistant message still being produced. `error` means the
 * turn failed; `content` then holds whatever arrived before it did.
 */
export type MessageStatus = 'streaming' | 'complete' | 'error';

/**
 * One turn in a thread.
 *
 * `content` is markdown. Answer 14: heading plus paragraph, with markdown
 * lists and simple tables inside the paragraph flow. Rendering maps it onto
 * Designsystemet components, never onto raw HTML tags.
 */
export interface Message {
  id: string;
  role: MessageRole;
  /** Markdown for assistant turns, plain text for user turns. */
  content: string;
  /** ISO 8601. */
  createdAt: string;
  /**
   * The `[n]` markers found in `content`, resolved. Empty for user turns and
   * for answers that cite nothing.
   */
  citations: Citation[];
  /**
   * Sources behind this answer, grouped per document (answer 57). Arrives at
   * the end of the stream, so it is absent while the answer is streaming.
   */
  sources?: SourceDocument[];
  /** «Fremgangsmåte»: what the search did. Placeholder data in v1 (answer 11). */
  retrieval?: RetrievalDetails;
  /** Progress from the agent, in arrival order. Shown while the answer builds. */
  thinkingSteps?: ThinkingStep[];
  status: MessageStatus;
}
