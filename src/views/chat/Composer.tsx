import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
import { useId, type KeyboardEvent, type Ref, type RefObject } from 'react';
import { COMPOSER_ID } from '../../layout/ids';
import { PaperclipIcon, PaperplaneIcon, StopIcon } from '@navikt/aksel-icons';
import {
  COMPOSE_PLACEHOLDER,
  DISCLAIMER,
  FOLLOW_UP_QUESTIONS,
  SHORTCUT_DESCRIPTION,
  SHORTCUT_HINT,
} from './text';
import type { ChatStatus } from './useChat';

type ComposerProps = {
  /**
   * The sticky area around the field. The chat view measures it, to keep that
   * much of the scroll container free at the bottom, and asks it where focus
   * is before moving the caret into the field.
   */
  ref?: Ref<HTMLDivElement>;
  /** So a kickstarter can put the caret in the field after filling it. */
  fieldRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  /** Defaults to the everyday one. A clarification asks for an answer to it. */
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  status: ChatStatus;
  /** Show the fixed follow-up suggestions under the field (answer 29). */
  showFollowUps?: boolean;
  /** A follow-up fills the field and sends it (answer 28). */
  onFollowUp: (question: string) => void;
};

/**
 * The compose field.
 *
 * The field grows with the text, scrolls once it reaches the limit, and wraps
 * its lines (answer 54). That is `field-sizing: content` plus a `max-height`
 * in chat.css — one line of CSS instead of a ResizeObserver that is always
 * one frame behind.
 *
 * Enter sends and Shift+Enter makes a new line. Designsystemet has nothing
 * for this, so it is written here. `isComposing` is checked because an input
 * method editor uses Enter to accept a candidate, and sending the question
 * mid-word would be a real bug for anyone typing that way.
 *
 * The field and the two buttons are one control to a reader, so the frame
 * around them carries the border and the focus ring, and the textarea inside
 * gives up its own. The ring is Designsystemet's, not a hand-drawn one.
 *
 * The icons carry no size of their own. `Button` already sizes what it holds
 * (`--ds-icon-size`), and a size written here would be a raw length that does
 * not follow the size mode.
 *
 * The stop button carries the word «Avbryt» next to its icon. A bare square
 * is not obviously «stopp» to anyone looking at the screen, however good its
 * `aria-label` is (brukerblikk 2026-09-15, finding 10). The label stays
 * longer than the visible text — it says which generation is being stopped —
 * and starts with the same word, which is what WCAG 2.5.3 asks for.
 *
 * The field carries the page's skip-link target and says, twice, how to reach
 * it with the keyboard: a small hint for anyone looking at it, and a
 * description on the field itself for anyone who is not. Two texts rather than
 * one because they are read in different ways — see text.ts.
 *
 * Attachments are in scope (answer 53) but there is no upload endpoint
 * (API-bestilling A3), so the paperclip is inert. It keeps its focus and says
 * «Vedlegg kommer» rather than disappearing, because a control that is coming
 * is worth knowing about — and `aria-disabled` keeps it reachable for a
 * keyboard user, which `disabled` would not.
 */
export function Composer({
  ref,
  fieldRef,
  value,
  placeholder = COMPOSE_PLACEHOLDER,
  onChange,
  onSubmit,
  onCancel,
  status,
  showFollowUps,
  onFollowUp,
}: ComposerProps) {
  const busy = status === 'pending' || status === 'streaming';
  // Generated, not a constant: two chat views in two slots would otherwise
  // share one id and the description would describe the wrong field.
  const descriptionId = useId();

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!busy) onSubmit();
  }

  return (
    <div className="ka-composer-area" ref={ref}>
      <div className="ka-composer">
        <Textfield
          aria-describedby={descriptionId}
          aria-label="Spørsmål til Kunnskapsassistenten"
          className="ka-composer__field"
          id={COMPOSER_ID}
          multiline
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          ref={fieldRef}
          rows={1}
          value={value}
        />

        <div className="ka-composer__buttons">
          <Button
            aria-disabled="true"
            data-color="neutral"
            data-tooltip="Vedlegg kommer"
            icon
            onClick={(event) => event.preventDefault()}
            variant="tertiary"
          >
            <PaperclipIcon aria-hidden />
          </Button>

          {busy ? (
            <Button aria-label="Avbryt genereringen" onClick={onCancel} variant="secondary">
              <StopIcon aria-hidden />
              Avbryt
            </Button>
          ) : (
            <Button
              aria-label="Send spørsmålet"
              disabled={value.trim().length === 0}
              icon
              onClick={onSubmit}
            >
              <PaperplaneIcon aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {showFollowUps ? (
        <ul className="ka-follow-ups">
          {FOLLOW_UP_QUESTIONS.map((question) => (
            <li key={question}>
              <Chip.Button onClick={() => onFollowUp(question)}>{question}</Chip.Button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="ds-sr-only" id={descriptionId}>
        {SHORTCUT_DESCRIPTION}
      </p>

      <Paragraph className="ka-composer__disclaimer" data-size="sm">
        <span className="ka-composer__shortcut">{SHORTCUT_HINT}</span>
        {DISCLAIMER}
      </Paragraph>
    </div>
  );
}
