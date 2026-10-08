/**
 * The Norwegian strings the chat view owns.
 *
 * The wording is the designer's, taken verbatim from Figma, so it is not to
 * be reworded here. Collected in one file rather than spread through the
 * components, because every user-visible string in one place is what makes a
 * language review possible.
 */

/** Under the compose field, in all four chatInput variants. */
export const DISCLAIMER = 'Kunnskapsassistenten kan gjøre feil. Husk å sjekke viktig informasjon.';

/** Placeholder in the compose field. */
export const COMPOSE_PLACEHOLDER = 'Hva vil du vite mer om?';

/** Fixed; a follow-up generated from the answer is wanted later. */
export const CLOSING_QUESTION = 'Er det noe mer jeg kan hjelpe deg med?';

/**
 * Three suggestions on the empty state. They fill the compose field, they do
 * not send.
 *
 * All three name documents only the mock corpus holds, so over any other
 * corpus they invite three questions it cannot answer. See `kickstartersFor`.
 */
export const KICKSTARTERS = [
  'Hva rapporteres om regnskap, kostnader og bevilgning i DSS sine årsrapporter for 2022 og 2023?',
  'Hvilke utfordringer rapporterer Udir om i evaluering om lærerspesialtordningen?',
  'Hva rapporterer Digdir om prioriteringene i tildelingsbrevene fra 2022 og 2023 sammenlignet med årsrapportene?',
] as const;

/**
 * The three for a corpus nobody has written suggestions for.
 *
 * About the documents rather than anything in them, because they have to hold
 * over a corpus this code has never seen. Whole questions, not «Hvilke
 * dokumenter finnes om …?» with the subject left to the reader: an unfinished
 * one would work once picked, but it reads as a broken label on the button
 * before it is.
 */
export const GENERAL_KICKSTARTERS = [
  'Hva handler dokumentene i dette korpuset om?',
  'Gi meg en oversikt over de viktigste temaene.',
  'Oppsummer det viktigste i noen få punkter.',
] as const;

/**
 * The one corpus the three named questions belong to.
 *
 * Written out rather than imported from src/api/corpus.ts, so this module of
 * words stays a module of words; `kickstartersPerCorpus.test.ts` ties the two
 * together, so a rename there goes red instead of quietly falling back.
 *
 * `kudos-pilot` is deliberately NOT here: it is Kudos by name, but it holds
 * annual reports from other agencies than these questions name, and asking
 * them over it returns nothing.
 */
const CORPUS_WITH_OWN_KICKSTARTERS = 'mock';

/**
 * The three suggestions to offer over `corpusKey`. Everything else gets the
 * general three, which is the safe direction to be wrong in: a general
 * question over Kudos works, a named question over a corpus without those
 * documents does not.
 */
export function kickstartersFor(corpusKey: string | undefined): readonly string[] {
  return corpusKey === CORPUS_WITH_OWN_KICKSTARTERS ? KICKSTARTERS : GENERAL_KICKSTARTERS;
}

/**
 * Fixed for now, model generated later.
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
 * A stopped answer. The sources arrive in the last frame of the stream, so a
 * stopped answer has none, and the `[n]` markers left in the text point
 * nowhere. Saying so keeps them from reading as a bug.
 */

/** Under the text of an answer the reader stopped. */
export const ABORTED_NOTE = 'Svaret ble avbrutt, så kildene bak det kom aldri fram.';

/**
 * The same, for a turn stopped while it was still searching.
 *
 * There is no answer to say anything about — «svaret ble avbrutt» would be
 * about text that never existed — so it names what there was: a search, and a
 * reader who stopped it.
 */
export const ABORTED_BEFORE_ANSWER = 'Du stoppet søket før svaret begynte.';

/**
 * Under a turn that failed, once the alert about it is gone — restored from
 * the store, or outlived by a newer question. The card is then the only thing
 * left to say why there is no answer under the question.
 *
 * It says less than the alert did on purpose: which error it was is not
 * written down with the turn, and a note that guessed would be worse.
 */
export const FAILED_NOTE = 'Dette spørsmålet fikk ikke noe svar. Noe gikk galt underveis.';

/** The only action on a stopped answer: ask the same question again. */
export const REGENERATE = 'Generer på nytt';

/*
 * The agent asking for more before it answers: backend status
 * `needs-clarification` (design/eksisterende/api-for-frontend.md l.208).
 *
 * The wording frames the card as a question to the reader rather than as a
 * failed answer, which is what it is: nothing went wrong, the assistant just
 * needs one more thing.
 */

/** The `Tag` at the top of the clarification card. */
export const CLARIFICATION_TAG = 'Trenger avklaring';

/** Replaces COMPOSE_PLACEHOLDER while a clarification is the last message. */
export const CLARIFICATION_PLACEHOLDER = 'Svar på spørsmålet over …';

/** What the polite live region says when the clarification arrives. */
export const CLARIFICATION_ANNOUNCEMENT = 'Kunnskapsassistenten trenger en avklaring.';

/**
 * What the polite region says while the conversation at the address is read.
 *
 * Said through the region the view already keeps in the page: a live region
 * that arrives WITH its text was inserted, not changed, and a screen reader
 * has nothing to announce about it.
 */
export const READING_THREAD = 'Henter samtalen';

/**
 * The page title before anything is asked: the conversation is the one «Ny
 * tråd» starts, and the thread list calls it that too.
 */
export const NEW_THREAD_TITLE = 'Ny tråd';

/*
 * The keyboard shortcut to the compose field, which is deep in the tab order
 * on a thread page for the thing a reader does most often.
 *
 * Ctrl and not the bare key: a single character key shortcut is WCAG 2.1.4,
 * level A, and this one could not be switched off. See useComposerShortcut.ts.
 */

/**
 * A small hint by the field, for anyone looking at the screen.
 *
 * It names the modifier the reader's own keyboard has; both work everywhere,
 * since the handler takes `ctrlKey` or `metaKey`. A function and not a
 * constant, because the answer depends on the machine and a module constant
 * would be read before a test could say otherwise.
 */
export function shortcutHint(): string {
  // `userAgentData` is not in Safari or Firefox, and the user agent string is
  // what is left. It is only choosing a word, so a wrong guess costs a reader
  // one confusing label and nothing else.
  const apple = /Mac|iPhone|iPad/u.test(navigator.userAgent);
  return `Trykk ${apple ? 'Cmd' : 'Ctrl'} + / for å hoppe hit`;
}

/**
 * The same thing for a screen reader, on the field itself. The key is spelled
 * out rather than shown as the character: «/» is «skråstrek» in some voices
 * and silence in others, and a shortcut nobody can hear the name of is not
 * one.
 */
export const SHORTCUT_DESCRIPTION =
  'Trykk Ctrl og skråstrek, eller Cmd og skråstrek, for å flytte skrivemerket hit fra hvor som helst på siden.';

/*
 * A search that found nothing. Not an error and not in red: the assistant did
 * what it was asked and came back empty-handed, which is an answer with an
 * empty source list (API-bestilling A16). Drawn as an answer rather than as
 * an alert with «Prøv igjen», since the same question over the same documents
 * gives the same nothing.
 *
 * Two versions, because only one of them is honest at a time: a reader who
 * has not touched the filter cannot loosen it.
 */

/** The reader had narrowed the corpus, so the filter is the first thing to try. */
export const NO_HITS_FILTERED = [
  'Fant ingen utdrag om dette i dokumentene som er valgt.',
  '',
  'Prøv å løsne filteret, eller still spørsmålet med andre ord.',
].join('\n');

/** Nothing was filtered away, so the words in the question are all there is to change. */
export const NO_HITS_WHOLE_CORPUS = [
  'Fant ingen utdrag om dette i dokumentene.',
  '',
  'Prøv å stille spørsmålet med andre ord, gjerne med ord du venter å finne i dokumentene.',
].join('\n');

/** What the polite live region says when the search came back empty. */
export const NO_HITS_ANNOUNCEMENT = 'Fant ingen utdrag om dette i dokumentene.';

/**
 * The agent choice in the compose field. The prefix is in the button's name
 * and not on it: the agent's name is enough to see, and «agent-rag» on its own
 * says nothing to a screen reader about what the button changes.
 */
export const AGENT_PREFIX = 'Agent: ';
/** On the button when the BFF has not said which agent is its default. */
export const AGENT_DEFAULT_LABEL = 'Standard';
/** Over the list of agents. */
export const AGENT_HEADING = 'Velg agent';

/**
 * Over a finished answer with no sources behind it. Without it, an answer
 * with no sources looks exactly like one with them, and only the sources
 * panel says otherwise.
 */
export const NO_SOURCES_WARNING =
  'Svaret har ingen kilder. Kontroller det mot originaldokumentene før du bruker det.';
