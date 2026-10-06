import type { Message } from '../../model';
import { NO_HITS_FILTERED, NO_HITS_WHOLE_CORPUS } from './text';

/**
 * Whether a finished answer stands with no sources behind it, and the card
 * says so (`NO_SOURCES_WARNING`).
 *
 * The same answers the sources panel calls «Ingen kilder til dette svaret»
 * (`emptyStateFor` in views/sources), so the two never disagree:
 *
 * - finished, with text, and no excerpts, whether the sources frame came
 *   empty or never came;
 * - but not an answer whose text cites `[n]` that were not stored with it.
 *   That one had sources and the store lost them: a conversation read back
 *   from the live backend or the BFF keeps the text and not the chunks, and
 *   the panel says «Kildene er ikke lagret» instead.
 *
 * Not the client's own «Fant ingen utdrag …» either. That is not an answer to
 * check against the documents; it says nothing was found, and the warning
 * would say it again.
 */
export function lacksSources(message: Message): boolean {
  return (
    message.role === 'assistant' &&
    message.status === 'complete' &&
    message.content.trim() !== '' &&
    (message.sources?.length ?? 0) === 0 &&
    (message.citationCount ?? 0) === 0 &&
    message.content !== NO_HITS_WHOLE_CORPUS &&
    message.content !== NO_HITS_FILTERED
  );
}
