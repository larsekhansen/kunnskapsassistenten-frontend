import { Details, Paragraph, Spinner } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState } from 'react';
import type { ThinkingStep } from '../../model';
import { reportedDurationMs, thoughtForLabel } from './thinkingTime';

export type ThinkingStatus = 'thinking' | 'done';

type ThinkingPanelProps = {
  /** The steps as they arrived. Rendered in that order, never reordered. */
  steps: ThinkingStep[];
  /** `thinking` until the first token of the answer lands. */
  status: ThinkingStatus;
};

/**
 * «Tenker …»: what the agent is doing while the search takes its time.
 *
 * Lars, 2026-09-15: «når søkingen tar lang tid vil jeg gjerne vite hva
 * modellen driver med». The steps have been in the stream and in the model
 * all along (`agent/thinking` → `StreamEvent` → `Message.thinkingSteps`);
 * until now nothing drew them, so a long search was a blank card.
 *
 * It knows two things: the steps, and whether the answer has started. Not
 * which model, not which backend, not what a step means. The agent writes the
 * steps in Norwegian first person and this renders them as they came —
 * swapping the model out later changes the words and nothing here.
 *
 * `Details` rather than a disclosure of our own: the native `<details>`
 * underneath gives the summary a button role, `aria-expanded` and the
 * keyboard for free, and it sits before the answer in the DOM, so Tab reaches
 * it first.
 *
 * Open while it thinks, shut when the answer starts — the steps are worth
 * watching while they are the only thing happening, and worth folding away
 * the moment there is an answer to read instead. A reader who has an opinion
 * overrides both: `chosen` outranks the automatic state for the rest of the
 * turn, in either direction.
 *
 * It does not announce anything. The steps arrive several seconds apart, and
 * a polite region that speaks once per step would talk over the answer it is
 * waiting for; the one «Kunnskapsassistenten søker …» is said by the view's
 * own region, once, when the first step lands. See useChat.
 */
export function ThinkingPanel({ steps, status }: ThinkingPanelProps) {
  const thinking = status === 'thinking';

  const [chosen, setChosen] = useState<boolean | undefined>(undefined);
  const open = chosen ?? thinking;

  // The clock runs from the first step to the first token. It is started and
  // read in an effect because it measures wall time, which is not something a
  // render may look at: two renders of the same state have to agree.
  const startedAt = useRef<number | undefined>(undefined);
  const [measuredMs, setMeasuredMs] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (steps.length === 0) return;

    if (thinking) {
      startedAt.current ??= Date.now();
      return;
    }

    // The answer has started. Freeze the clock the first time we see that,
    // and only if we were here when it started.
    if (startedAt.current !== undefined && measuredMs === undefined) {
      setMeasuredMs(Date.now() - startedAt.current);
    }
  }, [thinking, steps.length, measuredMs]);

  if (steps.length === 0) return null;

  const lastIndex = steps.length - 1;

  return (
    <Details
      className="ka-thinking"
      data-color="neutral"
      onToggle={(event) => setChosen((event.currentTarget as HTMLDetailsElement).open)}
      open={open}
    >
      <Details.Summary>
        <span className="ka-thinking__summary">
          {thinking ? (
            <>
              <Spinner aria-hidden="true" data-size="xs" />
              Tenker …
            </>
          ) : (
            thoughtForLabel(measuredMs ?? reportedDurationMs(steps))
          )}
        </span>
      </Details.Summary>

      <Details.Content>
        <ol className="ka-thinking__steps">
          {steps.map((step, index) => {
            // The step being worked on right now. `aria-current` says so
            // without a live region, so a reader who goes looking is told
            // where the agent is and nobody is interrupted who is not.
            const ongoing = thinking && index === lastIndex;
            return (
              <li
                aria-current={ongoing ? 'step' : undefined}
                className="ka-thinking__step"
                data-ongoing={ongoing ? 'true' : undefined}
                key={step.id}
              >
                <Paragraph variant="long">{step.label}</Paragraph>
                {step.detail ? (
                  <Paragraph className="ka-thinking__detail" data-size="sm" variant="long">
                    {step.detail}
                  </Paragraph>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Details.Content>
    </Details>
  );
}
