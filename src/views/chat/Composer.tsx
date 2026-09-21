import { Button, Chip, Paragraph, Textfield } from '@digdir/designsystemet-react';
import {
  useId,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
  type RefObject,
} from 'react';
import { UPLOAD_ACCEPT } from '../../model';
import { COMPOSER_ID } from '../../layout/ids';
import { PaperclipIcon, PaperplaneIcon, StopIcon } from '@navikt/aksel-icons';
import {
  COMPOSE_PLACEHOLDER,
  DISCLAIMER,
  FOLLOW_UP_QUESTIONS,
  SHORTCUT_DESCRIPTION,
  shortcutHint,
} from './text';
import { Attachments } from './Attachments';
import { ATTACH_LABEL, DROP_HINT, uploadErrorText } from './attachmentText';
import type { Attachments as AttachmentsState } from './useAttachments';
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
  /**
   * The send button, which is the stop button while an answer is on its way.
   *
   * One ref for both, because it is one element to the browser: React keeps
   * the same `<button>` and swaps its label and handler, which is why focus
   * survives the change. The chat view needs to recognise it by identity when
   * a failure takes it out from under the reader — see `ChatView`.
   */
  sendRef?: RefObject<HTMLButtonElement | null>;
  status: ChatStatus;
  /** Show the fixed follow-up suggestions under the field (answer 29). */
  showFollowUps?: boolean;
  /** A follow-up fills the field and sends it (answer 28). */
  onFollowUp: (question: string) => void;
  /** The files this question is being written with. */
  attachments: AttachmentsState;
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
  sendRef,
  fieldRef,
  value,
  placeholder = COMPOSE_PLACEHOLDER,
  onChange,
  onSubmit,
  onCancel,
  status,
  showFollowUps,
  onFollowUp,
  attachments,
}: ComposerProps) {
  const busy = status === 'pending' || status === 'streaming';
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Nesting counter, not a boolean: dragging over a child fires `dragleave`
  // on the parent, so a boolean flickers the hint off every time the pointer
  // crosses the field or a chip.
  const [dragDepth, setDragDepth] = useState(0);
  /*
   * What to say when attaching cannot work here at all. Its own line rather
   * than a chip: a chip stands for a file the reader picked, and in this case
   * no file was ever taken. It stays until the reader picks something that
   * does work, because a sentence that vanished on the next render would be
   * one nobody had time to read.
   */
  const [refusal, setRefusal] = useState('');
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
      <Attachments
        items={attachments.items}
        onRemove={attachments.remove}
        onRetry={attachments.retry}
      />

      {/*
        Dropping a file on the field attaches it. The button is the way —
        WCAG 2.5.7 asks that nothing depend on dragging — and this is the
        shortcut for anyone who already has the file under the pointer.

        The handlers sit on the frame and not on the textarea, so the whole
        white box takes a file rather than the 20 px of text inside it.
      */}
      <div
        className="ka-composer"
        data-dragging={dragDepth > 0 || undefined}
        onDragEnter={(event: DragEvent<HTMLDivElement>) => {
          if (!hasFiles(event)) return;
          setDragDepth((depth) => depth + 1);
        }}
        onDragLeave={() => setDragDepth((depth) => Math.max(0, depth - 1))}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          // Without this the browser opens the file instead of handing it over.
          if (hasFiles(event)) event.preventDefault();
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          setDragDepth(0);
          if (!hasFiles(event)) return;
          event.preventDefault();
          if (attachments.unavailable) {
            setRefusal(uploadErrorText(attachments.unavailable));
            return;
          }
          setRefusal('');
          attachments.add(event.dataTransfer.files);
        }}
      >
        {/*
          The picker, hidden but real: a styled `<label>` around a file input
          is the other way to do this, and it loses the button semantics the
          row needs — this control sits between a textarea and a send button
          and has to behave like the third control, not like a label.

          `multiple`, because a reader with three documents on the same
          question should not have to pick them one at a time.
        */}
        <input
          accept={UPLOAD_ACCEPT}
          /*
           * `display: none` and not `ds-sr-only`: the input is the mechanism,
           * the button is the control. Screen-reader-only keeps it in the
           * accessibility tree, where it is a second, nameless file control
           * beside the named one — axe called it, and it was right.
           * A hidden input still opens the picker when clicked.
           */
          className="ka-composer__file-input"
          multiple
          onChange={(event) => {
            const picked = event.currentTarget.files;
            if (picked?.length) {
              setRefusal('');
              attachments.add(picked);
            }
            // Cleared so picking the SAME file again fires `change` at all.
            event.currentTarget.value = '';
          }}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />

        <Button
          aria-label={ATTACH_LABEL}
          className="ka-composer__attach"
          data-color="neutral"
          icon
          onClick={() => {
            /*
             * A service with no upload endpoint says so instead of opening a
             * picker that leads nowhere. The refusal goes through the same
             * chip the other three do, so the reader reads one kind of
             * sentence about attachments and not two.
             */
            if (attachments.unavailable) {
              setRefusal(uploadErrorText(attachments.unavailable));
              return;
            }
            fileInputRef.current?.click();
          }}
          variant="tertiary"
        >
          <PaperclipIcon aria-hidden />
        </Button>

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
          /* The shortcut for anyone using a pointer. It used to be a line of
             grey text under the field; the footer is one line now, and the
             hint belongs on the thing it acts on. Screen readers get the
             spelled-out version through `aria-describedby`. */
          title={shortcutHint()}
          value={value}
        />

        {busy ? (
          <Button
            // The one control in the row while an answer is on its way, so
            // this is where «busy» belongs: the send button does not exist
            // during sending, it has become this one.
            aria-busy="true"
            aria-label="Avbryt genereringen"
            className="ka-composer__send"
            onClick={onCancel}
            ref={sendRef}
            variant="secondary"
          >
            <StopIcon aria-hidden />
            Avbryt
          </Button>
        ) : (
          <Button
            aria-label="Send spørsmålet"
            className="ka-composer__send"
            /*
             * Waits for the files too. Only ready documents are sent, so
             * sending mid-upload would drop the very file the reader attached
             * — silently, which is the one thing an attachment must never do.
             */
            disabled={value.trim().length === 0 || attachments.busy}
            icon
            onClick={onSubmit}
            ref={sendRef}
          >
            <PaperplaneIcon aria-hidden />
          </Button>
        )}
      </div>

      {dragDepth > 0 ? (
        <p aria-hidden="true" className="ka-composer__drop-hint">
          {DROP_HINT}
        </p>
      ) : null}

      {refusal ? <output className="ka-composer__refusal">{refusal}</output> : null}

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

      {/*
        One line, and only the disclaimer on it.
        «Kunnskapsassistenten kan gjøre feil» is what the design puts under
        the field in all four chatInput variants. The shortcut used to share
        the line and wrapped it onto two on both measured widths, which cost
        24 px of the sticky bottom on every screen to say something a reader
        needs once (høydebudsjett 2026-09-21, H3).

        It is not gone: it is on the field as a tooltip, on the field as a
        description for screen readers, and in the skip link that does the
        same jump.
      */}
      <Paragraph className="ka-composer__disclaimer" data-size="sm">
        {DISCLAIMER}
      </Paragraph>
    </div>
  );
}

/**
 * Whether what is being dragged is files at all.
 *
 * Dragging selected text across the page fires the same events, and a compose
 * field that lit up every time someone dragged a word would be lying about
 * what it was about to do.
 */
function hasFiles(event: DragEvent<HTMLDivElement>): boolean {
  return [...event.dataTransfer.types].includes('Files');
}
