import { Details, Paragraph, Spinner } from '@digdir/designsystemet-react';
import { useState } from 'react';
import { MagnifyingGlassIcon } from '@navikt/aksel-icons';
import type { RetrievalDetails, ThinkingStep } from '../../model';

type ProcedurePanelProps = {
  /** The steps as they arrived. Rendered in that order, never reordered. */
  steps: ThinkingStep[];
  /** `thinking` until the first token of the answer lands. */
  status: 'thinking' | 'done';
  /** What the answer was built from. Absent until the turn is finished. */
  retrieval?: RetrievalDetails;
};

/** «Svaret bygger på 3 dokumenter», with the singular right. */
function builtOnText(documentCount: number): string | undefined {
  if (documentCount <= 0) return undefined;
  const documents = documentCount === 1 ? '1 dokument' : `${documentCount} dokumenter`;
  return `Svaret bygger på ${documents}.`;
}

/**
 * «Fremgangsmåte»: what the assistant set out to do, in its own words.
 *
 * The standard half of the display level (Simens issue 88). It draws the same
 * steps the detailed panel draws, and nothing else from them: no search
 * strings, no hit counts, no times. What a step SAYS is the agent's plan read
 * back — «Jeg søker i korpuset», «Jeg leser årsrapporten» — and that is what
 * Simen asked to keep. What a step measured is machinery, and that is what he
 * asked to lose.
 *
 * The one number here is how many documents the answer was built on, because
 * that is not machinery: the same documents are listed in the sources panel,
 * and a reader who wants to check the answer counts them there. «10 treff i 3
 * dokumenter» counts chunks as well, and a chunk is not a thing a reader has
 * ever seen.
 *
 * `Details`, like the detailed panel and like «Fremgangsmåte» inside the card
 * used to be: the native `<details>` gives the summary a button role,
 * `aria-expanded` and the keyboard for free.
 *
 * Open while it thinks and shut once there is an answer, which is the
 * detailed panel's rule and holds for the same reason — the steps are worth
 * watching while they are the only thing happening. A reader who has an
 * opinion overrides both, for the rest of the turn.
 *
 * It announces nothing, for the reason `ThinkingPanel` gives: the steps
 * arrive seconds apart, and the view's own region already says once that the
 * assistant is searching.
 */
export function ProcedurePanel({ steps, status, retrieval }: ProcedurePanelProps) {
  const thinking = status === 'thinking';
  // The reader's own choice outranks the automatic state for the rest of the
  // turn, in either direction. Same rule as the detailed panel.
  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  if (steps.length === 0) return null;

  const open = chosen ?? thinking;
  const builtOn = retrieval && !thinking ? builtOnText(retrieval.documentCount) : undefined;
  const lastIndex = steps.length - 1;

  return (
    <Details
      className="ka-procedure"
      data-color="neutral"
      onToggle={(event) => setChosen((event.currentTarget as HTMLDetailsElement).open)}
      open={open}
    >
      <Details.Summary>
        <span className="ka-procedure__summary">
          {thinking ? (
            <Spinner aria-hidden="true" data-size="xs" />
          ) : (
            <MagnifyingGlassIcon aria-hidden className="ka-retrieval__icon" />
          )}
          Fremgangsmåte
        </span>
      </Details.Summary>

      <Details.Content>
        <ol className="ka-procedure__steps">
          {steps.map((step, index) => {
            // The step being worked on right now. `aria-current` says so
            // without a live region, so a reader who goes looking is told
            // where the agent is and nobody is interrupted who is not.
            const ongoing = thinking && index === lastIndex;
            return (
              <li
                aria-current={ongoing ? 'step' : undefined}
                className="ka-procedure__step"
                data-ongoing={ongoing ? 'true' : undefined}
                key={step.id}
              >
                <Paragraph variant="long">{step.label}</Paragraph>
              </li>
            );
          })}
        </ol>

        {builtOn ? (
          <Paragraph className="ka-procedure__built-on" data-size="sm" variant="long">
            {builtOn}
          </Paragraph>
        ) : null}
      </Details.Content>
    </Details>
  );
}
