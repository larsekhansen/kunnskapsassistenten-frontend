import { Button, Card, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { ArrowsCirclepathIcon } from '@navikt/aksel-icons';
import { useRef } from 'react';
import { Markdown } from '../../components';
import { ViewHead } from '../../layout/ViewHead';
import { citationTargets, type Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { AnswerSearch } from './AnswerSearch';
import { AnswerTime } from './AnswerTime';
import { RetrievalPanel } from './RetrievalPanel';
import { ThinkingPanel } from './ThinkingPanel';
import {
  ABORTED_BEFORE_ANSWER,
  ABORTED_NOTE,
  CLOSING_QUESTION,
  FAILED_NOTE,
  REGENERATE,
} from './text';
import { ANSWER_MARK_CLASS, useAnswerHits } from './useAnswerHits';

type AnswerMessageProps = {
  message: Message;
  /** A `[n]` marker was activated, with the answer it sits in. */
  onSelectSource: (citationNumber: number, messageId: string) => void;
  onScrollToBottom: () => void;
  canScrollToBottom: boolean;
  /** Ask the stopped question again, in place of the answer that was cut off. */
  onRegenerate: () => void;
  /**
   * Whether the search strip belongs to THIS answer right now.
   *
   * Held by the list rather than by each answer, because the strip is drawn
   * in the shell's view-head and there is one of those per region. Two
   * answers searching at once would be two heads in one place; see
   * `MessageList`.
   */
  searchOpen: boolean;
  /** What is typed in the strip. One strip, one query. */
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** Open the search on this answer, or close it if it is already here. */
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  /** «Søk i svar 2 av 3» — which answer the pinned strip is searching. */
  searchLabel: string;
  /**
   * The turn the error alert below the conversation is about, if any.
   *
   * A failed turn keeps its thinking panel now, so it stays on screen after
   * the alert has gone — restored from the store, or pushed up by a question
   * asked since. Then nothing under the question says why there is no answer,
   * and the card says it instead. While the alert IS about this turn, it says
   * it better and with a way on, so the card stays quiet rather than saying
   * the same thing twice.
   */
  liveErrorId?: string;
  /** «Avgrenset til …» over the answer. Absent means the whole corpus. */
  narrowedTo?: string;
  /**
   * The search behind this answer came back empty.
   *
   * Then the answer is the notice saying so, and the two things a finished
   * answer offers onward do not apply: «Er det noe mer jeg kan hjelpe deg
   * med?» invites a follow-up to an answer that found nothing, and the fixed
   * suggestions under the field are hidden for the same reason (KA CC,
   * 2026-09-15). What the notice itself says — loosen the filter, ask in
   * other words — is the way on from here.
   */
  foundNothing?: boolean;
};

/**
 * Four ragged lines standing in for the paragraph on its way (answer 32).
 *
 * `width` on `variant="text"` is a NUMBER OF CHARACTERS, not a length:
 * Skeleton writes `data-text={'-'.repeat(Number(width) || 1)}` and never
 * passes width to `style`. A percentage makes `Number()` return NaN, every
 * line falls back to a single dash, and the CSS width takes over — four
 * identical full-width bars instead of a block of text.
 *
 * Each line sits in its own block, because Skeleton's text variant is
 * `display: inline` and the dashes only decide the width while it stays that
 * way. Made a flex item it is blockified, and its own `width: 100%` wins.
 */
const SKELETON_LINE_CHARACTERS = [78, 86, 82, 48];

function AnswerSkeleton() {
  return (
    <div aria-hidden="true" className="ka-answer-skeleton">
      {SKELETON_LINE_CHARACTERS.map((characters) => (
        <p className="ka-answer-skeleton__line" key={characters}>
          <Skeleton variant="text" width={characters} />
        </p>
      ))}
    </div>
  );
}

/**
 * One assistant turn: what the agent did, what it answered, and what the
 * reader can do with it.
 *
 * It is its own component because it holds state — the search inside the
 * answer (brukerreiser punkt 13) belongs to one answer and not to the
 * thread, and a thread of ten answers has ten independent searches.
 *
 * «Tenker …» sits above the card and «Fremgangsmåte» inside it, and they do
 * not overlap: the first is what the agent did, step by step, the second is
 * what the search found. Neither repeats the other.
 */
export function AnswerMessage({
  message,
  onSelectSource,
  onScrollToBottom,
  canScrollToBottom,
  onRegenerate,
  searchOpen,
  searchQuery,
  onSearchQueryChange,
  onToggleSearch,
  onCloseSearch,
  searchLabel,
  liveErrorId,
  narrowedTo,
  foundNothing,
}: AnswerMessageProps) {
  const streaming = message.status === 'streaming';
  const aborted = message.status === 'aborted';
  const complete = message.status === 'complete';
  const empty = message.content.length === 0;
  // Failed, and the alert is no longer speaking for it.
  const failedQuietly = message.status === 'error' && message.id !== liveErrorId;
  // A failed turn with nothing in it gets no card: an empty bordered box
  // above the error says nothing. A stopped one gets one whatever phase it was
  // stopped in — the card is what says it was stopped and offers to run it
  // again (#4, funn A).
  const showCard = !empty || streaming || aborted || failedQuietly;

  const searching = searchOpen;
  const query = searchQuery;
  const answerRef = useRef<HTMLDivElement>(null);
  const searchFieldRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const { hitCount, currentIndex, step } = useAnswerHits(answerRef, searching ? query : '');

  /**
   * Closing puts focus back on the button that opened it.
   *
   * The strip is gone by the time this has run, so a keyboard user standing
   * in the field would otherwise land on `<body>` — at the top of the
   * document, a whole page from the answer they were reading (WCAG 2.4.3).
   */
  function closeSearch() {
    onCloseSearch();
    searchToggleRef.current?.focus();
  }

  return (
    <li className="ka-message ka-message--assistant">
      {/*
        The search strip, pinned to the top of the answer column.

        It used to sit at the bottom of this card, and the card scrolls: one
        «Neste treff» and the strip was under the sticky compose field, so the
        reader was typing in a field they could not see and the hit counter —
        the whole point of having a counter — stood behind the composer's
        buttons (brukerblikk 3, funn 1). The shell owns a place at the top of
        the region for exactly this; see layout/viewHeadContext.ts, which
        names this case.

        Written first in the view on purpose. React sends events through the
        portal along the React tree while the browser tabs the DOM, so a head
        written first and drawn first is in the same place both ways round.
      */}
      {searching ? (
        <ViewHead>
          <AnswerSearch
            currentHitIndex={currentIndex}
            fieldRef={searchFieldRef}
            hitCount={hitCount}
            label={searchLabel}
            onClose={closeSearch}
            onQueryChange={onSearchQueryChange}
            onStep={step}
            query={query}
          />
        </ViewHead>
      ) : null}

      <span className="ds-sr-only">Kunnskapsassistenten svarte:</span>

      {/*
        Which documents the question was asked against. Over the card and not
        inside it, because it is a fact about the question and not part of the
        answer — and not a Chip, because there is nothing to click: the filter
        is changed where it was set.
      */}
      {narrowedTo ? (
        <p className="ka-filter-summary">
          <span className="ds-sr-only">Svaret er </span>Avgrenset til: {narrowedTo}
        </p>
      ) : null}

      {/*
        What the agent did before it started writing, above the answer and
        before it in the tab order. It is the same turn, so it is not a message
        of its own; it is the header of this one.
      */}
      {message.thinkingSteps?.length ? (
        <ThinkingPanel
          status={streaming && empty ? 'thinking' : 'done'}
          steps={message.thinkingSteps}
          // The measured wait, and not the sum of what the steps reported.
          // The stream writes it down while it happens (`useChat`), and it
          // has to be handed over or the panel falls back to the sum — which
          // is «Tenkte i 2 sekunder» live and «Tenkte i 4 sekunder» after a
          // reload, for a turn that has not changed. See `Message.thoughtMs`.
          // The clarification path already passed it; this one did not.
          thoughtMs={message.thoughtMs}
        />
      ) : null}

      {/*
        The answer sits in a card, as the design draws it. `data-color` is
        neutral and not inherited: with accent on the root, the card and its
        border would go blue, which nobody has drawn. Chrome gets an explicit
        family, see visjon-og-beslutninger.md.

        Two blocks rather than one, because Card.Block draws the rule between
        them — which is exactly the divider above the action row.
      */}
      {showCard ? (
        <Card className="ka-answer-card" data-color="neutral">
          <Card.Block>
            {empty && streaming ? <AnswerSkeleton /> : null}

            {/* The ref is what the search counts marks inside, so it wraps the
                answer and nothing else: the closing question and the action
                row are not part of what was searched. */}
            <div ref={answerRef}>
              {empty ? null : (
                <Markdown
                  citations={citationTargets(message.sources ?? [])}
                  markClassName={ANSWER_MARK_CLASS}
                  onCitationActivate={(number) => onSelectSource(number, message.id)}
                  searchQuery={searching ? query : ''}
                  // A stopped answer wrote its markers; the excerpts were
                  // still on their way. Then `[3]` is drawn as text that says
                  // why, not as a link to nothing.
                  sourcesLost={aborted}
                  startLevel={3}
                >
                  {message.content}
                </Markdown>
              )}
            </div>

            {/* The live region says the same thing in words, so this line is
                decoration. */}
            {streaming && !empty ? (
              <p aria-hidden="true" className="ka-streaming-status">
                <Spinner aria-hidden="true" data-size="xs" />
                Skriver svar …
              </p>
            ) : null}

            {message.retrieval && !streaming ? (
              <RetrievalPanel retrieval={message.retrieval} />
            ) : null}

            {/*
              A stopped answer has no sources: they arrive in the last frame
              and that frame never came. Saying so is what keeps the `[n]`
              markers in the text from reading as a mistake.
            */}
            {aborted ? (
              <Paragraph className="ka-aborted-note" data-size="sm" variant="long">
                {empty ? ABORTED_BEFORE_ANSWER : ABORTED_NOTE}
              </Paragraph>
            ) : null}

            {failedQuietly ? (
              <Paragraph className="ka-failed-note" data-size="sm" variant="long">
                {FAILED_NOTE}
              </Paragraph>
            ) : null}

            {complete && !empty && !foundNothing ? (
              <Paragraph variant="long">{CLOSING_QUESTION}</Paragraph>
            ) : null}
          </Card.Block>

          {complete && !empty ? (
            <Card.Block>
              <AnswerActions
                canScrollToBottom={canScrollToBottom}
                content={message.content}
                createdAt={message.createdAt}
                onScrollToBottom={onScrollToBottom}
                onToggleSearch={() => {
                  if (searching) {
                    closeSearch();
                    return;
                  }
                  onToggleSearch();
                  // The strip is not in the page yet, so the focus goes on the
                  // next render.
                  queueMicrotask(() => searchFieldRef.current?.focus());
                }}
                searchOpen={searching}
                searchToggleRef={searchToggleRef}
                sources={message.sources}
              />
            </Card.Block>
          ) : null}

          {/*
            Nothing to copy from half an answer, and no thread link worth
            sharing yet. What the reader wants is the answer they stopped, so
            the row is the one way onward.
          */}
          {aborted ? (
            <Card.Block>
              <div className="ka-answer-actions">
                <Button
                  data-color="neutral"
                  data-size="sm"
                  onClick={onRegenerate}
                  variant="tertiary"
                >
                  <ArrowsCirclepathIcon aria-hidden />
                  {REGENERATE}
                </Button>

                {/* A stopped answer is still an answer the reader can refer
                    back to, and it is in the thread with the same timestamp
                    as any other. */}
                <AnswerTime createdAt={message.createdAt} />
              </div>
            </Card.Block>
          ) : null}
        </Card>
      ) : null}
    </li>
  );
}
