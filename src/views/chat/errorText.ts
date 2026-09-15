/**
 * The error text the chat shows next to «Prøv igjen».
 *
 * `ErrorState` draws the message and the retry button one line apart, so a
 * message that ends in «Prøv igjen.» asks for exactly what the button under
 * it does (brukerblikk 2026-09-15, finding 9). The sentence is written by the
 * layer that produced the error — both mock paths end that way today, and a
 * live agent may too — and that layer cannot know what sits under its text.
 * So the view trims it here, once, rather than relying on every writer of an
 * error message to remember the button.
 */

/** Used when trimming leaves nothing, so the alert is never empty. */
export const GENERIC_CHAT_ERROR = 'Noe gikk galt da svaret skulle hentes.';

/*
 * A closing «Prøv igjen», with or without «om litt» and with or without its
 * full stop. Anchored to the end, so «Prøv igjen senere» or a sentence that
 * happens to contain the words in the middle is left alone.
 */
const RETRY_PROMPT = /\s*Prøv igjen(?: om litt)?\s*[.!…]*\s*$/iu;

export function withoutRetryPrompt(message: string): string {
  const trimmed = message.replace(RETRY_PROMPT, '').trim();
  return trimmed.length > 0 ? trimmed : GENERIC_CHAT_ERROR;
}
