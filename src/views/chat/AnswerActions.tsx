import { Button } from '@digdir/designsystemet-react';
import { ArrowDownIcon, ClipboardIcon, ClipboardLinkIcon } from '@navikt/aksel-icons';
import type { SourceDocument } from '../../model';
import { answerWithSources, copyReceipt, referenceList } from './answerText';
import { useCopy } from './useCopy';

type AnswerActionsProps = {
  /** The answer as markdown. */
  content: string;
  /**
   * The documents behind the answer. They become the reference list under the
   * copied text, and the `[n]` markers are kept so they point at something.
   */
  sources?: SourceDocument[];
  /** Shown only when there is something below the fold (answer 17). */
  onScrollToBottom?: () => void;
  canScrollToBottom?: boolean;
};

/**
 * What a reader can do with a finished answer: copy it (answer 15), copy a
 * link to the thread (answer 16), jump to the newest message (answer 17).
 *
 * Copying takes the sources with it. An answer pasted into a submission
 * without its provenance is the one thing KA is not for (reise 13, 14 and 20
 * in design/brukerreiser-2026-09-15.md), so the markers stay and a reference
 * list follows them. The receipt counts what went along, because «Svaret er
 * kopiert» would not tell the reader that anything more did.
 *
 * The receipt under the row is rendered empty rather than hidden while there
 * is nothing to say. A live region that is `display: none` is not in the
 * accessibility tree, so the region and its text would appear in the same
 * frame and announce nothing — the same rule
 * `src/components/ErrorState.tsx` is built around.
 *
 * A clarification has its own, shorter row: see `Clarification.tsx`.
 */
export function AnswerActions({
  content,
  sources,
  onScrollToBottom,
  canScrollToBottom,
}: AnswerActionsProps) {
  const { receipt, copy } = useCopy();

  return (
    <div className="ka-answer-actions">
      <Button
        data-color="neutral"
        data-size="sm"
        onClick={() =>
          void copy(
            answerWithSources(content, sources),
            copyReceipt(referenceList(sources ?? []).length),
          )
        }
        variant="tertiary"
      >
        <ClipboardIcon aria-hidden />
        Kopier svaret
      </Button>

      <Button
        data-color="neutral"
        data-size="sm"
        onClick={() => void copy(window.location.href, 'Lenken til tråden er kopiert.')}
        variant="tertiary"
      >
        <ClipboardLinkIcon aria-hidden />
        Kopier lenke til tråden
      </Button>

      {canScrollToBottom ? (
        <Button data-color="neutral" data-size="sm" onClick={onScrollToBottom} variant="tertiary">
          <ArrowDownIcon aria-hidden />
          Bla til nederst
        </Button>
      ) : null}

      <p aria-live="polite" className="ka-answer-actions__receipt">
        {receipt}
      </p>
    </div>
  );
}
