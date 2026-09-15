import { Paragraph } from '@digdir/designsystemet-react';
import type { Message } from '../../model';
import { AnswerMessage } from './AnswerMessage';
import { Clarification } from './Clarification';
import { ThinkingPanel } from './ThinkingPanel';

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
  /**
   * Whether the search behind an answer came back empty, by message id.
   *
   * By id and not «the last one», because it is a fact about that answer: the
   * notice it carries is the whole answer, and what a finished answer offers
   * onward does not belong under it however many turns come after.
   */
  foundNothing?: (messageId: string) => boolean;
};

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
 * Three kinds of turn, and this file is the choice between them. A question
 * is a paragraph. A turn that came back as `needs-clarification` is a question
 * to the reader and not an answer, so the sender line says «spurte» and the
 * card is `Clarification`. Everything else is an answer, and `AnswerMessage`
 * draws it — it holds state of its own, which is why it is a component and
 * not another branch in here.
 */
export function MessageList({
  messages,
  onSelectSource,
  onScrollToBottom,
  canScrollToBottom,
  onRegenerate,
  filterSummary,
  foundNothing,
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
                <ThinkingPanel
                  status="done"
                  steps={message.thinkingSteps}
                  thoughtMs={message.thoughtMs}
                />
              ) : null}
              <Clarification question={message.content} />
            </li>
          );
        }

        return (
          <AnswerMessage
            canScrollToBottom={canScrollToBottom}
            foundNothing={foundNothing?.(message.id)}
            key={message.id}
            message={message}
            narrowedTo={filterSummary?.(message.id)}
            onRegenerate={onRegenerate}
            onScrollToBottom={onScrollToBottom}
            onSelectSource={onSelectSource}
          />
        );
      })}
    </ol>
  );
}
