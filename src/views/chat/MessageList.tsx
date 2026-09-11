import { Card, Paragraph, Skeleton, Spinner } from '@digdir/designsystemet-react';
import { Markdown } from '../../components';
import { citationTargets, type Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { RetrievalPanel } from './RetrievalPanel';
import { CLOSING_QUESTION } from './text';
import type { ChatStatus } from './useChat';

type MessageListProps = {
  messages: Message[];
  status: ChatStatus;
  onSelectSource: (citationNumber: number) => void;
  onScrollToBottom: () => void;
  canScrollToBottom: boolean;
};

/** Shown between «sendt» and the first token (answer 32). */
function AnswerSkeleton() {
  return (
    <div aria-hidden="true" className="ka-answer-skeleton">
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="94%" />
      <Skeleton variant="text" width="60%" />
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
  status,
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

      {status === 'pending' && messages.at(-1)?.role !== 'assistant' ? (
        <li className="ka-message">
          <Card className="ka-answer-card" data-color="neutral">
            <Card.Block>
              <AnswerSkeleton />
            </Card.Block>
          </Card>
        </li>
      ) : null}
    </ol>
  );
}
