import { Button, Heading } from '@digdir/designsystemet-react';
import { FileTextIcon } from '@navikt/aksel-icons';
import { KICKSTARTERS } from './text';

type KickstartersProps = {
  /** Fills the compose field. It deliberately does not send (answer 40). */
  onPick: (question: string) => void;
};

/**
 * Three ready-made questions on the empty state.
 *
 * Each row is a tertiary Button (answer 40), not a chip: these are long,
 * corpus-specific questions, and a row can hold one. The follow-up
 * suggestions under an answer are chips, because they are short.
 *
 * Picking one fills the field and leaves the caret there, so the reader can
 * edit before sending. That is the whole point of a kickstarter: it starts
 * the question, it does not ask it.
 *
 * A plain div, not a labelled section: a labelled section is a landmark, and
 * three buttons are not worth one. The heading carries the structure on its
 * own, and without the landmark there is no id to hand around either.
 */
export function Kickstarters({ onPick }: KickstartersProps) {
  return (
    <div className="ka-kickstarters">
      <Heading data-size="2xs" level={3}>
        Forslag
      </Heading>
      <ul className="ka-kickstarters__list">
        {KICKSTARTERS.map((question) => (
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
