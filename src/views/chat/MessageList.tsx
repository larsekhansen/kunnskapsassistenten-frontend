import { Button, Card, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { ArrowsCirclepathIcon } from '@navikt/aksel-icons';
import { Markdown } from '../../components';
import { citationTargets, type Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { Clarification } from './Clarification';
import { RetrievalPanel } from './RetrievalPanel';
import { ThinkingPanel } from './ThinkingPanel';
import { ABORTED_BEFORE_ANSWER, ABORTED_NOTE, CLOSING_QUESTION, REGENERATE } from './text';

type MessageListProps = {
  messages: Message[];
  /**
   * A `[n]` marker was activated. The message id goes with the number: each
   * answer numbers its excerpts from 1, so the number alone does not say
   * which excerpt (#4, brukerreiser punkt 5).
   */
  onSelectSource: (citationNumber: number, messageId: string) => void;
  onScrollToBottom: () => void;
  canScrollToBottom: boolean;
  /** Ask the stopped question again, in place of the answer that was cut off. */
  onRegenerate: () => void;
  /**
   * «Avgrenset til …» over an answer, by message id. Absent means the
   * question was asked against the whole corpus.
   */
  filterSummary?: (messageId: string) => string | undefined;
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
 * The conversation.
 *
 * An ordered list, because the order is the meaning: message four answers
 * message three. Who said what is carried by text, not by colour or by which
 * side a bubble sits on — a screen reader user gets neither.
 *
 * The sender line is a visually hidden span rather than a heading. The answer
 * brings its own headings from the model, and a heading per message on top of
 * those would give the page two competing outlines.
 *
 * The answer is rendered by the shared `Markdown` component at `startLevel`
 * 3, because it sits under the thread title, which is a level 2 under the
 * route's level 1.
 *
 * An assistant turn that came back as `needs-clarification` is a question to
 * the reader and not an answer, so the sender line says «spurte» and the card
 * is `Clarification`.
 *
 * «Tenker …» sits above the card and «Fremgangsmåte» inside it, and they do
 * not overlap: the first is what the agent did, step by step, the second is
 * what the search found. Neither repeats the other.
 */
export function MessageList({
  messages,
  onSelectSource,
  onScrollToBottom,
  canScrollToBottom,
  onRegenerate,
  filterSummary,
}: MessageListProps) {
  return (
    <ol className="ka-messages">
      {messages.map((message) => {
        if (message.role === 'user') {
          return (
            <li className="ka-message ka-message--user" key={message.id}>
              <span className="ds-sr-only">Du skrev:</span>
              {/* Set larger than the answer and above the card, as in Figma:
                  the question is what the card is an answer to. */}
              <Paragraph data-size="lg" variant="long">
                {message.content}
              </Paragraph>
            </li>
          );
        }

        // The agent asking back rather than answering. It is an assistant
        // turn like any other, but nothing a finished answer carries applies
        // to it, so it is drawn by its own component rather than by switching
        // four things off in this one.
        //
        // «Tenkte i N sekunder» does apply, and stays: the agent searched
        // before it asked back, and how long it spent is the same fact here
        // as over an answer (the conductor, 2026-09-15).
        if (message.status === 'needs-clarification') {
          return (
            <li className="ka-message ka-message--assistant" key={message.id}>
              <span className="ds-sr-only">Kunnskapsassistenten spurte:</span>
              {message.thinkingSteps?.length ? (
                <ThinkingPanel status="done" steps={message.thinkingSteps} />
              ) : null}
              <Clarification question={message.content} />
            </li>
          );
        }

        const streaming = message.status === 'streaming';
        const aborted = message.status === 'aborted';
        const complete = message.status === 'complete';
        const empty = message.content.length === 0;
        // A failed turn with nothing in it gets no card: an empty bordered
        // box above the error says nothing. A stopped one gets one whatever
        // phase it was stopped in — the card is what says it was stopped and
        // offers to run it again (#4, funn A).
        const showCard = !empty || streaming || aborted;
        const narrowedTo = filterSummary?.(message.id);

        return (
          <li className="ka-message ka-message--assistant" key={message.id}>
            <span className="ds-sr-only">Kunnskapsassistenten svarte:</span>

            {/*
              Which documents the question was asked against. Over the card
              and not inside it, because it is a fact about the question and
              not part of the answer — and not a Chip, because there is
              nothing to click: the filter is changed where it was set.
            */}
            {narrowedTo ? (
              <p className="ka-filter-summary">
                <span className="ds-sr-only">Svaret er </span>Avgrenset til: {narrowedTo}
              </p>
            ) : null}

            {/*
              What the agent did before it started writing, above the answer
              and before it in the tab order. It is the same turn, so it is
              not a message of its own; it is the header of this one.
            */}
            {message.thinkingSteps?.length ? (
              <ThinkingPanel
                status={streaming && empty ? 'thinking' : 'done'}
                steps={message.thinkingSteps}
              />
            ) : null}

            {/*
              The answer sits in a card, as the design draws it. `data-color`
              is neutral and not inherited: with accent on the root, the card
              and its border would go blue, which nobody has drawn. Chrome
              gets an explicit family, see visjon-og-beslutninger.md.

              Two blocks rather than one, because Card.Block draws the rule
              between them — which is exactly the divider above the action row.
            */}
            {showCard ? (
              <Card className="ka-answer-card" data-color="neutral">
                <Card.Block>
                  {empty && streaming ? <AnswerSkeleton /> : null}

                  {empty ? null : (
                    <Markdown
                      citations={citationTargets(message.sources ?? [])}
                      onCitationActivate={(number) => onSelectSource(number, message.id)}
                      // A stopped answer wrote its markers; the excerpts were
                      // still on their way. Then `[3]` is drawn as text that
                      // says why, not as a link to nothing.
                      sourcesLost={aborted}
                      startLevel={3}
                    >
                      {message.content}
                    </Markdown>
                  )}

                  {/* The live region says the same thing in words, so this
                      line is decoration. */}
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
                    A stopped answer has no sources: they arrive in the last
                    frame and that frame never came. Saying so is what keeps
                    the `[n]` markers in the text from reading as a mistake.
                  */}
                  {aborted ? (
                    <Paragraph className="ka-aborted-note" data-size="sm" variant="long">
                      {empty ? ABORTED_BEFORE_ANSWER : ABORTED_NOTE}
                    </Paragraph>
                  ) : null}

                  {complete && !empty ? (
                    <Paragraph variant="long">{CLOSING_QUESTION}</Paragraph>
                  ) : null}
                </Card.Block>

                {complete && !empty ? (
                  <Card.Block>
                    <AnswerActions
                      canScrollToBottom={canScrollToBottom}
                      content={message.content}
                      onScrollToBottom={onScrollToBottom}
                      sources={message.sources}
                    />
                  </Card.Block>
                ) : null}

                {/*
                  Nothing to copy from half an answer, and no thread link
                  worth sharing yet. What the reader wants is the answer they
                  stopped, so the row is the one way onward.
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
                    </div>
                  </Card.Block>
                ) : null}
              </Card>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
