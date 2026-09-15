import type { Message } from '../../model';

/**
 * A title for a thread the backend has not named yet.
 *
 * The same conversation looked like two different pages depending on how the
 * reader got there: `/threads/:id` drew the thread title as an `h2` with the
 * question under it, `/` drew no heading at all, so the first heading in the
 * column was the answer's own `h3` (brukerblikk 2026-09-15, finding 5). The
 * head is the same on both routes now, and until a thread has a title of its
 * own the first sentence of the first question stands in — the same rule the
 * client will use when it names the thread.
 *
 * It is a label, not a sentence, so it loses the question mark or full stop
 * the question ended on. The titles it stands in for are written that way
 * («NKOM måloppnåelse», «Om Stimulab»), and a `h2` that repeats the sentence
 * under it word for word, punctuation and all, reads as the same text twice.
 */

/** Past this the line reads as a paragraph rather than as a title. */
const MAX_LENGTH = 80;

/** Sentence end followed by a space: «.», «?», «!», «…», with «?!» allowed. */
const SENTENCE_END = /[.?!…]+(?=\s)/u;

/** The same marks where the sentence simply stops. */
const TRAILING_END = /[.?!…]+$/u;

function firstSentence(question: string): string {
  const text = question.trim().replace(/\s+/gu, ' ');
  const end = text.search(SENTENCE_END);
  const sentence = end < 0 ? text : text.slice(0, end + text.slice(end).search(/\s/u));
  return sentence.replace(TRAILING_END, '').trimEnd();
}

/** Cuts on a word boundary, so a title never ends mid-word. */
function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.lastIndexOf(' ', MAX_LENGTH);
  return `${text.slice(0, cut > 0 ? cut : MAX_LENGTH).trimEnd()} …`;
}

/**
 * The thread title to show, or undefined when there is nothing to show one
 * for — an untouched front page has no thread and no question yet.
 */
export function threadTitle(title: string | undefined, messages: Message[]): string | undefined {
  if (title) return title;

  const question = messages.find((message) => message.role === 'user')?.content;
  if (!question) return undefined;

  const sentence = shorten(firstSentence(question));
  return sentence.length > 0 ? sentence : undefined;
}
