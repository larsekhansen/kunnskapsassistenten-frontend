import { Card, Skeleton } from '@digdir/designsystemet-react';
import { AnswerSkeleton } from './AnswerMessage';

/**
 * How wide the question standing in for the reader's own is.
 *
 * A number of CHARACTERS and not a length, the same as the answer's lines —
 * see `AnswerSkeleton` for what a percentage does here. Shorter than the
 * answer, because a question is.
 */
const QUESTION_CHARACTERS = 46;

/**
 * The conversation at the address, while it is being read.
 *
 * NOT the front page greeting: a reader who opened a thread is not being
 * welcomed to a new one, and three suggestions on a route that names a
 * conversation they already chose are an offer to start over. The waiting is
 * not the problem; the greeting is.
 *
 * So the shape of what is coming stands here instead: one question and one
 * answer. It is the same skeleton the answer being written uses, because it
 * is the same promise — text is on its way to this spot.
 *
 * Hidden from a screen reader, which cannot read a shape. What the lines say
 * in grey is said in words by the view's own polite region, which is already
 * in the page and empty — see `READING_THREAD`. An `output` here would arrive
 * with its text already in it, and an inserted region is not a change a
 * screen reader announces.
 *
 * The compose field stays. A question asked while this is on screen belongs
 * to the thread in the address and is filed under it (#149, #153), and the
 * stored conversation lays itself in front of the turn when it lands.
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
