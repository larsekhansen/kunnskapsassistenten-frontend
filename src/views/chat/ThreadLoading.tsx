import { Card, Skeleton } from '@digdir/designsystemet-react';
import { AnswerSkeleton } from './AnswerMessage';

/** How wide the stand-in question is: a number of CHARACTERS and not a
    length, the same as the answer's lines. See `AnswerSkeleton`. */
const QUESTION_CHARACTERS = 46;

/**
 * The conversation at the address, while it is being read. NOT the front page
 * greeting: three suggestions on a route naming a conversation the reader
 * already chose are an offer to start over.
 *
 * Hidden from a screen reader, which cannot read a shape; the view's own
 * polite region says it in words (`READING_THREAD`). The compose field stays,
 * because a question asked here belongs to the thread in the address.
 */
export function ThreadLoading() {
  return (
    <div aria-hidden="true" className="ka-thread-loading__turn">
      <p className="ka-thread-loading__question">
        <Skeleton variant="text" width={QUESTION_CHARACTERS} />
      </p>

      <Card className="ka-answer-card" data-color="neutral">
        <Card.Block>
          <AnswerSkeleton />
        </Card.Block>
      </Card>
    </div>
  );
}
