import type { MessageStatus } from '../../model';

/** Title and body for one of the panel's empty states. */
export type SourcesEmptyState = {
  title: string;
  description: string;
};

/**
 * Nothing has been asked yet: the untouched front page.
 *
 * The only empty state that may say «når du har stilt et spørsmål». After a
 * stopped answer it would tell the reader they had not asked anything.
 *
 * It names the selected corpus, not an answer's, since there is no answer
 * here, so the sentence promises what the reader is about to search.
 */
export function noAnswerYet(corpusName: string): SourcesEmptyState {
  return {
    title: 'Ingen kilder ennå',
    description: `Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat fra et dokument på ${corpusName}, med samme nummer som markøren i svaret.`,
  };
}

/**
 * What an answer with no sources means, per status.
 *
 * `streaming` is missing on purpose: an answer still being written is loading,
 * not empty. The `Exclude` makes the compiler say so if a status is added.
 *
 * The texts claim no more than the frontend knows. «Svaret viser ikke til noen
 * utdrag» is observable; «den fant ingenting» would be a guess.
 */
const BY_STATUS: Record<Exclude<MessageStatus, 'streaming'>, SourcesEmptyState> = {
  complete: {
    title: 'Ingen kilder til dette svaret',
    description: 'Svaret viser ikke til noen utdrag fra dokumentene.',
  },
  aborted: {
    title: 'Svaret ble avbrutt før kildene kom',
    description:
      'Kildene kommer sist i et svar. Still spørsmålet på nytt for å se hvilke dokumenter det bygger på.',
  },
  error: {
    title: 'Svaret kom ikke fram',
    description: 'Da kom kildene heller ikke. Prøv spørsmålet på nytt.',
  },
  'needs-clarification': {
    title: 'Kunnskapsassistenten spurte om en avklaring',
    description: 'Kildene kommer når du har svart på spørsmålet i samtalen.',
  },
};

/**
 * An answer whose excerpts were never stored, which is not an answer without
 * sources. In live mode the backend keeps the conversation but not the chunks,
 * so a thread opened from the list has `[1]`–`[4]` with nothing behind them,
 * and «Svaret viser ikke til noen utdrag» would be wrong beside it.
 */
const NOT_STORED: SourcesEmptyState = {
  title: 'Kildene er ikke lagret for denne samtalen',
  description:
    'Svaret viser til utdrag, men de ble ikke lagret sammen med samtalen. Still spørsmålet på nytt for å få et svar med kilder du kan åpne.',
};

/**
 * An answer read back from a store that keeps no sources per answer, with no
 * markers in it. Not the sentence above: there is nothing on screen that
 * «viser til utdrag», and nothing here knows whether the answer had sources.
 * The BFF is such a store; see `Message.sourcesNotStored`.
 */
const NOT_KEPT: SourcesEmptyState = {
  title: NOT_STORED.title,
  description:
    'Kildene blir ikke lagret sammen med samtalen. Still spørsmålet på nytt for å se hvilke dokumenter svaret bygger på.',
};

/**
 * @param citationCount how many `[n]` the answer carries, when that is known.
 *   A finished answer that cited something and has no excerpts lost them; one
 *   that cited nothing never had any.
 * @param sourcesNotStored the store kept no sources for this answer, so none
 *   is not known to mean none.
 */
export function emptyStateFor(
  status: Exclude<MessageStatus, 'streaming'>,
  citationCount?: number,
  sourcesNotStored?: boolean,
): SourcesEmptyState {
  if (status === 'complete' && citationCount !== undefined && citationCount > 0) {
    return NOT_STORED;
  }
  if (status === 'complete' && sourcesNotStored) return NOT_KEPT;
  return BY_STATUS[status];
}
