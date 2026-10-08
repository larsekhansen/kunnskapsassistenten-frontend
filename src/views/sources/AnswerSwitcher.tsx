import { Button, Paragraph } from '@digdir/designsystemet-react';

type AnswerSwitcherProps = {
  /**
   * «Kilder til svar 2 av 3», built by the view, because the live region that
   * announces it is in the view and the two have to be one string.
   */
  label: string;
  /** Zero-based position in the thread's answers; the user reads it one-based. */
  index: number;
  count: number;
  onStep: (step: 1 | -1) => void;
};

/**
 * «Kilder til svar 2 av 3», with a way to step between the answers.
 *
 * The panel shows one answer's sources at a time, and every answer numbers its
 * excerpts from 1, so this line is what keeps «Utdrag 2» unambiguous.
 *
 * The counter is `aria-hidden`, and the live region that announces it is in
 * `SourcesView`. A live region has to be in the document before its content
 * changes, and this row mounts with the second answer, the one moment the
 * announcement matters.
 *
 * `aria-disabled` rather than `disabled` at the ends, as in `ExcerptSearch`:
 * a `disabled` button drops focus to `<body>` the moment it turns off.
 */
export function AnswerSwitcher({ label, index, count, onStep }: AnswerSwitcherProps) {
  const atFirst = index === 0;
  const atLast = index >= count - 1;

  return (
    <div className="sources-answer-switcher">
      <Paragraph aria-hidden="true" data-size="xs" className="sources-answer-switcher__count">
        {label}
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
