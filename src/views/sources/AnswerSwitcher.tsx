import { Button, Paragraph } from '@digdir/designsystemet-react';

type AnswerSwitcherProps = {
  /** Zero-based position in the thread's answers; the user reads it one-based. */
  index: number;
  count: number;
  onStep: (step: 1 | -1) => void;
};

/**
 * «Kilder til svar 2 av 3», with a way to step between the answers.
 *
 * The panel shows one answer's sources at a time (brukerreiser punkt 5). That
 * is only honest if the reader can see WHICH answer, because the excerpts are
 * numbered from 1 in every answer and two sets look identical from the
 * outside. So this line is not decoration: it is the thing that stops
 * «Utdrag 2» from being ambiguous.
 *
 * `aria-live="polite"` because the set can change without the reader touching
 * this control — a `[n]` marker in an older answer switches it — and then the
 * whole panel has new content under an unchanged heading. The counter is the
 * only thing that says so. Same reasoning, and same markup, as the hit counter
 * in `ExcerptSearch`.
 *
 * `aria-disabled` rather than `disabled` at the ends, for the reason spelled
 * out in `ExcerptSearch`: stepping is something you do by pressing the same
 * button repeatedly, and a `disabled` button drops focus to `<body>` the
 * moment it turns off. Designsystemet draws the two alike.
 */
export function AnswerSwitcher({ index, count, onStep }: AnswerSwitcherProps) {
  const atFirst = index === 0;
  const atLast = index >= count - 1;

  return (
    <div className="sources-answer-switcher">
      <Paragraph data-size="xs" aria-live="polite" className="sources-answer-switcher__count">
        {`Kilder til svar ${index + 1} av ${count}`}
      </Paragraph>

      <div className="sources-answer-switcher__steps">
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label="Forrige svar"
          aria-disabled={atFirst || undefined}
          onClick={() => !atFirst && onStep(-1)}
        >
          Forrige
        </Button>
        <Button
          type="button"
          variant="tertiary"
          data-size="sm"
          aria-label="Neste svar"
          aria-disabled={atLast || undefined}
          onClick={() => !atLast && onStep(1)}
        >
          Neste
        </Button>
      </div>
    </div>
  );
}
