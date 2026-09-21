import { Button, Chip, Spinner } from '@digdir/designsystemet-react';
import { useEffect, useRef, useState } from 'react';
import {
  ATTACHMENTS_LABEL,
  removeAttachmentLabel,
  retryAttachmentLabel,
  uploadErrorText,
  uploadFailedAnnouncement,
  uploadProgressAnnouncement,
  uploadReadyAnnouncement,
  uploadRetryable,
} from './attachmentText';
import type { AttachmentView } from './useAttachments';

type AttachmentsProps = {
  items: AttachmentView[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
};

/**
 * The files attached to the question being written, over the compose field.
 *
 * A chip per file, as the brief asks, and the chip is `Chip.Removable`: its
 * whole job is to be taken off again, which is what that variant is for. The
 * removable chip is a button, so the file name is inside a control and the
 * accessible name says what pressing it does — «Fjern vedlegget rapport.pdf»,
 * not «rapport.pdf», which would be a button named after a noun.
 *
 * A failed file keeps its chip. A file that silently did not attach is worse
 * than one that says why: the reader asked for it to go along, and the answer
 * is no plus a reason. Where trying again could work, «Prøv igjen» sits
 * beside it — on the general failure only, because a file that is too big is
 * the same size next time (see `uploadRetryable`).
 *
 * Progress is announced rather than only drawn. The bar is a `Spinner` and a
 * percentage in the chip for anyone looking; the polite region under the list
 * is how a screen reader hears that anything is happening at all, and it
 * speaks on whole percent changes rather than on every frame.
 */
export function Attachments({ items, onRemove, onRetry }: AttachmentsProps) {
  const announcement = useUploadAnnouncement(items);

  if (items.length === 0) return null;

  return (
    <>
      <ul aria-label={ATTACHMENTS_LABEL} className="ka-attachments">
        {items.map((item) => (
          <li className="ka-attachments__item" key={item.key}>
            <Chip.Removable
              data-color={item.status === 'failed' ? 'danger' : 'neutral'}
              data-wrap="wrap"
              aria-label={removeAttachmentLabel(item.name)}
              onClick={() => onRemove(item.key)}
            >
              {item.status === 'uploading' ? <Spinner aria-hidden="true" data-size="xs" /> : null}
              {item.name}
              {item.status === 'uploading' ? ` ${Math.round(item.progress)} %` : null}
            </Chip.Removable>

            {/*
              The reason, outside the chip. Inside it would join the button's
              accessible name, and «Fjern vedlegget rapport.pdf Filen er
              større enn 20 MB» is a name nobody can ask for by voice.
            */}
            {item.status === 'failed' && item.errorCode ? (
              <span className="ka-attachments__error">{uploadErrorText(item.errorCode)}</span>
            ) : null}

            {item.status === 'failed' && item.errorCode && uploadRetryable(item.errorCode) ? (
              <Button
                aria-label={retryAttachmentLabel(item.name)}
                data-color="neutral"
                data-size="sm"
                onClick={() => onRetry(item.key)}
                variant="tertiary"
              >
                Prøv igjen
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="ds-sr-only">
        {announcement}
      </p>
    </>
  );
}

/**
 * What the polite region should say at this moment.
 *
 * Held as state and written from an effect rather than computed during
 * render, because a live region only announces a CHANGE: recomputing the same
 * sentence on every render is silent, and recomputing a different one on
 * every frame of the bar is a region that never stops talking. So it changes
 * when the whole percentage does, and when a file settles.
 */
function useUploadAnnouncement(items: AttachmentView[]): string {
  const [announcement, setAnnouncement] = useState('');
  const said = useRef(new Map<string, string>());

  useEffect(() => {
    for (const item of items) {
      const now =
        item.status === 'uploading'
          ? uploadProgressAnnouncement(item.name, item.progress)
          : item.status === 'ready'
            ? uploadReadyAnnouncement(item.name)
            : item.errorCode
              ? uploadFailedAnnouncement(item.name, item.errorCode)
              : '';

      if (now && said.current.get(item.key) !== now) {
        said.current.set(item.key, now);
        setAnnouncement(now);
      }
    }

    // Forget the ones that are gone, so the same file attached twice is
    // announced twice.
    const live = new Set(items.map((item) => item.key));
    for (const key of [...said.current.keys()]) {
      if (!live.has(key)) said.current.delete(key);
    }
  }, [items]);

  return announcement;
}
