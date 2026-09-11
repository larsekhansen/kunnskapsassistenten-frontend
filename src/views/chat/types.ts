/**
 * Local types for the chat view.
 *
 * These mirror what `src/model/` is meant to own once the foundation lands.
 * Until then the rules say to work from fixtures in your own folder
 * (design/_briefs/bygg/regler.md), so they live here and are deliberately
 * narrow: only what the chat flow renders, nothing more. When the shared
 * model arrives, this file becomes a re-export and the fixtures move over.
 */

/** Who said it. The role is exposed as text, never as colour or position alone. */
export type MessageRole = 'user' | 'assistant';

/**
 * One block of a rendered answer.
 *
 * Answers are heading plus paragraph (answer 14). Lists and simple tables are
 * part of the same decision, but they arrive with the shared Markdown
 * component; until then a block is a heading or a paragraph and nothing else.
 */
export type AnswerBlock =
  | { kind: 'heading'; level: 3 | 4; text: string }
  | { kind: 'paragraph'; text: string };

/** A source the answer cites, numbered the way the markers in the text are. */
export type SourceReference = {
  /** 1-based, and the number shown in the `[n]` marker. */
  number: number;
  /** Norwegian document title, shown in the marker's accessible name. */
  title: string;
};

/**
 * What the «Fremgangsmåte» panel shows (answers 11, 12, 13).
 *
 * A hit is one relevant chunk in a document. The keywords are model
 * generated and are not clickable.
 */
export type RetrievalDetails = {
  hitCount: number;
  documentCount: number;
  keywords: string[];
};

export type Message = {
  id: string;
  role: MessageRole;
  /**
   * The raw answer text. Blocks are separated by a blank line, and a line
   * starting with `## ` or `### ` is a heading. Citations are written `[n]`.
   */
  text: string;
  /** Assistant only. Sources cited by the `[n]` markers in `text`. */
  sources?: SourceReference[];
  /** Assistant only. Placeholder data for «Fremgangsmåte» (answer 11). */
  retrieval?: RetrievalDetails;
};

export type Thread = {
  id: string;
  /** Norwegian thread title, shown above the conversation. */
  title: string;
  messages: Message[];
};

/** What the transport emits while an answer is produced (answer 33). */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'retrieval'; retrieval: RetrievalDetails }
  | { type: 'sources'; sources: SourceReference[] }
  | { type: 'error'; message: string };

/**
 * How the chat gets an answer.
 *
 * Injected so the view can run on fixtures now and on the real API later
 * without changing a line in the components. The signal is what the cancel
 * button aborts (answer 34).
 */
export type ChatTransport = (
  question: string,
  signal: AbortSignal,
) => AsyncIterable<StreamEvent>;

/** Where the answer is in its lifecycle. Drives skeleton, cancel and error. */
export type ChatStatus = 'idle' | 'pending' | 'streaming' | 'error';
