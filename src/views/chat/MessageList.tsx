import { Alert, Button, Heading, Paragraph, Skeleton } from '@digdir/designsystemet-react';
import type { Message } from '../../model';
import { AnswerActions } from './AnswerActions';
import { AnswerBody } from './AnswerBody';
import { RetrievalPanel } from './RetrievalPanel';
import { CLOSING_QUESTION } from './text';
import type { ChatStatus } from './useChat';

type MessageListProps = {
  messages: Message[];
  status: ChatStatus;
  /** Norwegian error text, when the turn failed. */
  error: string | null;
  onRetry: () => void;
  onSelectSource?: (citationNumber: number) => void;
  onScrollToBottom?: () => void;
  canScrollToBottom?: boolean;
};

/** Shown between «sent» and the first token (answer 32). */
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
 * The sender line is a plain visually hidden span rather than a heading. The
 * answer brings its own headings from the model, and a heading per message on
 * top of those would give the page two competing outlines.
 */
export function MessageList({
  messages,
  status,
  error,
  onRetry,
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
              <Paragraph variant="long">{message.content}</Paragraph>
            </li>
          );
        }

        const streaming = message.status === 'streaming';
        const empty = message.content.length === 0;

        return (
          <li className="ka-message ka-message--assistant" key={message.id}>
            <span className="ds-sr-only">Kunnskapsassistenten svarte:</span>

            {empty && streaming ? <AnswerSkeleton /> : null}

            {empty ? null : (
              <AnswerBody
                citations={message.citations}
                content={message.content}
                onSelectSource={onSelectSource}
                sources={message.sources}
                streaming={streaming}
              />
            )}

            {message.retrieval && !streaming ? (
              <RetrievalPanel retrieval={message.retrieval} />
            ) : null}

            {message.status === 'complete' && !empty ? (
              <>
                <Paragraph variant="long">{CLOSING_QUESTION}</Paragraph>
                <AnswerActions
                  canScrollToBottom={canScrollToBottom}
                  content={message.content}
                  onScrollToBottom={onScrollToBottom}
                />
              </>
            ) : null}

            {message.status === 'error' && error ? (
              <Alert className="ka-answer-error" data-color="danger" role="alert">
                <Heading data-size="2xs" level={3}>
                  Svaret kom ikke fram
                </Heading>
                <Paragraph>{error}</Paragraph>
                <Button data-size="sm" onClick={onRetry} variant="secondary">
                  Prøv igjen
                </Button>
              </Alert>
            ) : null}
          </li>
        );
      })}

      {status === 'pending' && messages.at(-1)?.role !== 'assistant' ? (
        <li className="ka-message">
          <AnswerSkeleton />
        </li>
      ) : null}
    </ol>
  );
}
