/**
 * The Norwegian strings the chat view owns.
 *
 * Taken verbatim from the curated Figma section «Hva skjer når du åpner
 * Kunnskapsassistenten?» and from the `chatInput` and `kickstarters`
 * molecules, so the wording is the designer's. Collected here rather than
 * spread through the components: every user-visible string in one file is
 * what makes a language review possible (open question 60).
 */

/** Under the compose field, in all four chatInput variants. */
export const DISCLAIMER = 'Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.';

/** Placeholder in the compose field. */
export const COMPOSE_PLACEHOLDER = 'Hva vil du vite mer om?';

/** Fixed for now; a follow-up generated from the answer is wanted later (answer 18). */
export const CLOSING_QUESTION = 'Er det noe mer jeg kan hjelpe deg med?';

/**
 * Three suggestions on the empty state. They fill the compose field, they do
 * not send (answer 40).
 */
export const KICKSTARTERS = [
  'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  'Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?',
  'Hva rapporterer Digdir om prioriteringene i tildelingsbrevene fra 2022 og 2023 sammenlignet med årsrapportene?',
] as const;

/**
 * Fixed in the first version, model generated in the second (answer 29).
 *
 * The language is not consistent — one question and two imperatives — but it
 * is the designer's wording, so it stays until someone decides otherwise.
 */
export const FOLLOW_UP_QUESTIONS = [
  'Kan du utdype?',
  'Identifiser utfordringer',
  'Lag relaterte spørsmål',
] as const;

/*
 * A stopped answer (reise 9 in design/brukerreiser-2026-09-15.md). The
 * sources arrive in the last frame of the stream, so an answer that was
 * stopped has none — and the `[n]` markers left in the text point nowhere.
 * Saying that is what keeps them from reading as a bug.
 */

/** Under the text of an answer the reader stopped. */
export const ABORTED_NOTE = 'Svaret ble avbrutt, så kildene bak det kom aldri fram.';

/** The only action on a stopped answer: ask the same question again. */
export const REGENERATE = 'Generer på nytt';

/*
 * The agent asking for more before it answers: backend status
 * `needs-clarification` (design/eksisterende/api-for-frontend.md l.208).
 *
 * The wording is the conductor's, from the brief. It frames the card as a
 * question to the reader rather than as a failed answer, which is what it is:
 * nothing went wrong, the assistant just needs one more thing.
 */

/** The `Tag` at the top of the clarification card. */
export const CLARIFICATION_TAG = 'Trenger avklaring';

/** Replaces COMPOSE_PLACEHOLDER while a clarification is the last message. */
export const CLARIFICATION_PLACEHOLDER = 'Svar på spørsmålet over …';

/** What the polite live region says when the clarification arrives. */
export const CLARIFICATION_ANNOUNCEMENT = 'Kunnskapsassistenten trenger en avklaring.';

/**
 * The only action on a clarification. Named after what it copies, like
 * «Kopier svaret» on a finished answer — the card holds a question, not an
 * answer, so the label says so.
 */
export const CLARIFICATION_COPY = 'Kopier spørsmålet';

/** The receipt after CLARIFICATION_COPY. */
export const CLARIFICATION_COPIED = 'Spørsmålet er kopiert.';
