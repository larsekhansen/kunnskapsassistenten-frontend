import { Button, Heading } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';

type KickstartersProps = {
  /** Fills the compose field. It deliberately does not send. */
  onPick: (question: string) => void;
  /** The three to offer, handed in rather than read here: which three
      depends on the corpus, and a leaf that went looking would need a router
      to read a hook it only reads. */
  questions: readonly string[];
};

/**
 * Three ready-made questions on the empty state. A row each, not a chip,
 * because they are long; picking one fills the field and leaves the caret
 * there, since a kickstarter starts the question and does not ask it.
 *
 * A plain div and not a labelled section, which would be a landmark, and
 * three buttons are not worth one.
 */
export function Kickstarters({ onPick, questions }: KickstartersProps) {
  return (
    <div className="ka-kickstarters">
      <Heading data-size="2xs" level={3}>
        Forslag
      </Heading>
      <ul className="ka-kickstarters__list">
        {questions.map((question) => (
          <li key={question}>
            <Button
              className="ka-kickstarter"
              data-color="neutral"
              onClick={() => onPick(question)}
              variant="tertiary"
            >
              <FileTextIcon aria-hidden className="ka-kickstarter__icon" />
              {question}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
