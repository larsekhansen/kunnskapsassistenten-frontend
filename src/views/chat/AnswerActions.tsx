import { Button } from '@digdir/designsystemet-react';
import { ClipboardIcon, ClipboardLinkIcon, MagnifyingGlassIcon } from '@navikt/aksel-icons';
import type { RefObject } from 'react';
import type { SourceDocument } from '../../model';
import { AnswerTime } from './AnswerTime';
import { answerWithSources, copyReceipt, referenceList } from './answerText';
import { useCopy } from './useCopy';

type AnswerActionsProps = {
  /** The answer as markdown. */
  content: string;
  /** When the answer came, ISO 8601. Drawn at the end of the row. */
  createdAt: string;
  /** The documents behind the answer. They become the reference list under the
     copied text, and the `[n]` markers are kept so they point at something. */
  sources?: SourceDocument[];
  /** Opens or closes the search inside this answer. */
  onToggleSearch?: () => void;
  searchOpen?: boolean;
  /** Where focus goes when the search strip closes. */
  searchToggleRef?: RefObject<HTMLButtonElement | null>;
};

/**
 * What a reader can do with a finished answer. **Copying takes the sources
 * with it**, because an answer pasted without its provenance is the one thing
 * KA is not for, and the receipt counts what went along.
 *
 * The receipt is rendered empty rather than hidden: a live region that is
 * `display: none` is out of the accessibility tree, and region and text would
 * then arrive in the same frame and announce nothing.
 */
export function AnswerActions({
  content,
  createdAt,
  sources,
  onToggleSearch,
  searchOpen,
  searchToggleRef,
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

      {/*
        The reader's own way into a long answer. The
        browser's Ctrl+F is left alone on purpose — it is the one find every
        reader already has, and a page that takes it away to offer its own has
        made things worse. `aria-expanded` is what says the strip below
        belongs to this button.
      */}
      {onToggleSearch ? (
        <Button
          aria-expanded={searchOpen ?? false}
          data-color="neutral"
          data-size="sm"
          onClick={onToggleSearch}
          ref={searchToggleRef}
          variant="tertiary"
        >
          <MagnifyingGlassIcon aria-hidden />
          Søk i svaret
        </Button>
      ) : null}

      {/*
        When the answer came, after the things a reader can do with it: the
        row is what to do first, and when it was is a fact about it. Outside
        every button, so it never joins one's accessible name — the same
        reason the thread list keeps it beside the link rather than inside.
      */}
      <AnswerTime createdAt={createdAt} />

      <p aria-live="polite" className="ka-answer-actions__receipt">
        {receipt}
      </p>
    </div>
  );
}
