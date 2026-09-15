import type { Message } from '../../model';

/**
 * The `h2` over a conversation: the thread title, and whether it is worth
 * looking at.
 *
 * The same conversation looked like two different pages depending on how the
 * reader got there: `/threads/:id` drew the thread title as an `h2` with the
 * question under it, `/` drew no heading at all, so the first heading in the
 * column was the answer's own `h3` (brukerblikk 2026-09-15, finding 5). The
 * head is the same on both routes now.
 *
 * Until a thread has a title of its own, the first sentence of the first
 * question stands in — the same rule the client will use when it names the
 * thread. That title is the question again, and the question is right under
 * it, so the conductor settled it on 2026-09-15: a title that only repeats
 * the question is visually hidden. The heading stays in the document, so the
 * outline a screen reader walks is the same on both routes and in both
 * states; it is the second copy on screen that goes. A real title — from the
 * backend, or generated later from more than the first sentence — is shown
 * with the question under it, as Figma draws it.
 *
 * The stand-in is a label rather than a sentence, so it loses the question
 * mark or full stop the question ended on, the way the titles it replaces are
 * written («NKOM måloppnåelse», «Om Stimulab»).
 */
export type ThreadHeading = {
  /** The `h2` text. */
  title: string;
  /**
   * True when the title says no more than the question under it. The heading
   * is then structure only, and carries `ds-sr-only`.
   */
  repeatsQuestion: boolean;
};

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

/** What the question would be called, so a given title can be held up to it. */
function fromQuestion(question: string): string {
  return shorten(firstSentence(question));
}

/*
 * Two titles say the same thing when they differ only in case, spacing or the
 * mark the sentence ended on. Nothing looser than that: this decides whether
 * a heading is hidden, and a guess at what «close enough» means would hide a
 * real title that happens to start with the same words.
 */
function saysTheSame(one: string, other: string): boolean {
  const plain = (text: string) =>
    text.trim().replace(/\s+/gu, ' ').replace(TRAILING_END, '').toLocaleLowerCase('nb-NO');
  return plain(one) === plain(other);
}

/**
 * The heading to draw, or undefined when there is nothing to head — an
 * untouched front page has no thread and no question yet.
 */
export function threadHeading(
  title: string | undefined,
  messages: Message[],
): ThreadHeading | undefined {
  const question = messages.find((message) => message.role === 'user')?.content;
  const standIn = question ? fromQuestion(question) : undefined;

  const named = title?.trim();
  const shown = named && named.length > 0 ? named : standIn;
  if (!shown) return undefined;

  return {
    title: shown,
    repeatsQuestion: standIn !== undefined && saysTheSame(shown, standIn),
  };
}
