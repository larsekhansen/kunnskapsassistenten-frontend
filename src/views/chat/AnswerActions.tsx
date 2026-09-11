import { Button } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { answerAsPlainText } from './answer';
import { ArrowDownIcon, CopyIcon, LinkIcon } from './icons';

type AnswerActionsProps = {
  /** The answer as markdown. Copied as plain text, without the `[n]` markers. */
  content: string;
  /** Shown only when there is something below the fold (answer 17). */
  onScrollToBottom?: () => void;
  canScrollToBottom?: boolean;
};

/**
 * What a reader can do with a finished answer: copy it (answer 15), copy a
 * link to the thread (answer 16), jump to the newest message (answer 17).
 *
 * Copying has to say that it worked. The receipt is one element that is both
 * visible and a polite live region, so a sighted reader and a screen reader
 * user are told the same thing at the same time — and the clipboard can
 * refuse, in which case saying so is the only honest outcome.
 */
export function AnswerActions({
  content,
  onScrollToBottom,
  canScrollToBottom,
}: AnswerActionsProps) {
  const [receipt, setReceipt] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = useCallback(async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setReceipt(done);
    } catch {
      setReceipt('Kunne ikke kopiere. Nettleseren tillot det ikke.');
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setReceipt(null), 4000);
  }, []);

  return (
    <div className="ka-answer-actions">
      <Button
        data-color="neutral"
        data-size="sm"
        onClick={() => void copy(answerAsPlainText(content), 'Svaret er kopiert.')}
        variant="tertiary"
      >
        <CopyIcon />
        Kopier svaret
      </Button>

      <Button
        data-color="neutral"
        data-size="sm"
        onClick={() => void copy(window.location.href, 'Lenken til tråden er kopiert.')}
        variant="tertiary"
      >
        <LinkIcon />
        Kopier lenke til tråden
      </Button>

      {canScrollToBottom ? (
        <Button data-color="neutral" data-size="sm" onClick={onScrollToBottom} variant="tertiary">
          <ArrowDownIcon />
          Bla til nederst
        </Button>
      ) : null}

      <p aria-live="polite" className="ka-answer-actions__receipt">
        {receipt}
      </p>
    </div>
  );
}
