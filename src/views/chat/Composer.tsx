import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
import type { KeyboardEvent, RefObject } from 'react';
import { PaperclipIcon, PaperplaneIcon, StopIcon } from '@navikt/aksel-icons';
import { COMPOSE_PLACEHOLDER, DISCLAIMER, FOLLOW_UP_QUESTIONS } from './text';
import type { ChatStatus } from './useChat';

type ComposerProps = {
  /** So a kickstarter can put the caret in the field after filling it. */
  fieldRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
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
 * Attachments are in scope (answer 53) but there is no upload endpoint
 * (API-bestilling A3), so the paperclip is inert. It keeps its focus and says
 * «Vedlegg kommer» rather than disappearing, because a control that is coming
 * is worth knowing about — and `aria-disabled` keeps it reachable for a
 * keyboard user, which `disabled` would not.
 */
export function Composer({
  fieldRef,
  value,
  onChange,
  onSubmit,
  onCancel,
  status,
  showFollowUps,
  onFollowUp,
}: ComposerProps) {
  const busy = status === 'pending' || status === 'streaming';

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (!busy) onSubmit();
  }

  return (
    <div className="ka-composer-area">
      <div className="ka-composer">
        <Textfield
          aria-label="Spørsmål til Kunnskapsassistenten"
          className="ka-composer__field"
          multiline
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={onKeyDown}
          placeholder={COMPOSE_PLACEHOLDER}
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
            <PaperclipIcon aria-hidden fontSize="1.25rem" />
          </Button>

          {busy ? (
            <Button aria-label="Avbryt genereringen" icon onClick={onCancel} variant="secondary">
              <StopIcon aria-hidden fontSize="1.25rem" />
            </Button>
          ) : (
            <Button
              aria-label="Send spørsmålet"
              disabled={value.trim().length === 0}
              icon
              onClick={onSubmit}
            >
              <PaperplaneIcon aria-hidden fontSize="1.25rem" />
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

      <Paragraph className="ka-composer__disclaimer" data-size="sm">
        {DISCLAIMER}
      </Paragraph>
    </div>
  );
}
