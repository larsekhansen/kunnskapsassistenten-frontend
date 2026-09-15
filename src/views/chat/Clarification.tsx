import { Button, Card, Tag } from '@digdir/designsystemet-react';
import { ClipboardIcon } from '@navikt/aksel-icons';
import { Markdown } from '../../components';
import { answerAsPlainText } from './answerText';
import { CLARIFICATION_COPIED, CLARIFICATION_COPY, CLARIFICATION_TAG } from './text';
import { useCopy } from './useCopy';

type ClarificationProps = {
  /** The agent's question back, as markdown. */
  question: string;
};

/**
 * The agent asking for more before it answers: backend status
 * `needs-clarification` (design/eksisterende/api-for-frontend.md l.208).
 *
 * It is a finished turn, not a failed one, so it is not an `Alert` and says
 * nothing about anything going wrong. What it needs is a frame that makes the
 * text read as a question to the reader rather than as a short answer, and
 * that is the `Tag`: «Trenger avklaring», neutral, above the question.
 *
 * Nothing was retrieved, so there is nothing to show from a search: no `[n]`
 * markers, no «Fremgangsmåte», no follow-up suggestions. `Markdown` is given
 * no citations, which leaves any bracketed number in the text as plain text —
 * the right outcome when there is no excerpt behind it.
 *
 * The action row is one button. «Kopier lenke til tråden» and «Bla til
 * nederst» belong to a finished answer; here the reader's next move is to
 * answer the question, and the compose field below is already waiting for it
 * with its own placeholder. See ChatView.
 */
export function Clarification({ question }: ClarificationProps) {
  const { receipt, copy } = useCopy();

  return (
    <Card className="ka-answer-card" data-color="neutral">
      <Card.Block>
        <p className="ka-clarification__label">
          <Tag data-color="neutral" data-size="sm">
            {CLARIFICATION_TAG}
          </Tag>
        </p>

        <Markdown startLevel={3}>{question}</Markdown>
      </Card.Block>

      <Card.Block>
        <div className="ka-answer-actions">
          <Button
            data-color="neutral"
            data-size="sm"
            onClick={() => void copy(answerAsPlainText(question), CLARIFICATION_COPIED)}
            variant="tertiary"
          >
            <ClipboardIcon aria-hidden />
            {CLARIFICATION_COPY}
          </Button>

          <p aria-live="polite" className="ka-answer-actions__receipt">
            {receipt}
          </p>
        </div>
      </Card.Block>
    </Card>
  );
}
