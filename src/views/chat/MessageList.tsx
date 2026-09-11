import { Card, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { Markdown } from '../../components';
import { citationTargets, type Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { RetrievalPanel } from './RetrievalPanel';
import { CLOSING_QUESTION } from './text';

type MessageListProps = {
  messages: Message[];
  onSelectSource: (citationNumber: number) => void;
  onScrollToBottom: () => void;
  canScrollToBottom: boolean;
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
 */
export function MessageList({
  messages,
  onSelectSource,
  onScrollToBottom,
  canScrollToBottom,
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

        const streaming = message.status === 'streaming';
        const empty = message.content.length === 0;
        // A failed turn with nothing in it gets no card: an empty bordered
        // box above the error says nothing.
        const showCard = !empty || streaming;

        return (
          <li className="ka-message ka-message--assistant" key={message.id}>
            <span className="ds-sr-only">Kunnskapsassistenten svarte:</span>

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
                      onCitationActivate={onSelectSource}
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

                  {message.status === 'complete' && !empty ? (
                    <Paragraph variant="long">{CLOSING_QUESTION}</Paragraph>
                  ) : null}
                </Card.Block>

                {message.status === 'complete' && !empty ? (
                  <Card.Block>
                    <AnswerActions
                      canScrollToBottom={canScrollToBottom}
                      content={message.content}
                      onScrollToBottom={onScrollToBottom}
                    />
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
