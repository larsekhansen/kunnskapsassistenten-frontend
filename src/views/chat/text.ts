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
