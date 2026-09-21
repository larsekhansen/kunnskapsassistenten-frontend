import {
  Button,
  EXPERIMENTAL_FileUpload as FileUpload,
  Field,
  Heading,
  Label,
  Paragraph,
  Tag,
} from '@digdir/designsystemet-react';
import { CloudUpIcon, TrashIcon } from '@navikt/aksel-icons';
import { useId, useRef } from 'react';
import { useUserDocuments } from '../../layout/useUserDocuments';
import { UPLOAD_ACCEPT, type UserDocument } from '../../model';
import { fileSize, MAX_UPLOAD_TEXT, uploadErrorText } from './uploadText';

/** «PDF» and «DOCX», as a reader expects to see a file type written. */
const TYPE_LABEL = { pdf: 'PDF', docx: 'DOCX' } as const;

/**
 * The reader's own documents: a place to drop files, and what they dropped.
 *
 * It was a picture of a feature until now — a dashed box saying upload was
 * not ready — and the box is the same shape, but the flow behind it is real
 * (#117). What it cannot be is honest by accident: in live mode there is no
 * upload endpoint at all (API-bestilling A3), and then the zone says so
 * instead of taking a file and refusing it a moment later.
 */
export function OwnDocuments() {
  const { documents, unavailable, upload, remove } = useUserDocuments();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  async function choose(files: FileList | null) {
    if (!files) return;

    /*
     * One at a time, awaited. The store is one list and every upload writes
     * to it; two writes in flight would race over the same array, and a
     * reader picking three files cares about seeing three rows, not about
     * which order they finish in.
     */
    for (const file of Array.from(files)) {
      await upload(file);
    }

    // The same file can be picked again after it was removed, and an input
    // that still holds it fires no change event the second time.
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section className="documents-list own-documents">
      <div className="own-documents__heading">
        {/*
          Level 4, a sibling of «Fra Kudos», and the same `2xs` as that one:
          the spec draws one column with «Dokumenter» over both sources
          (brukerblikk, funn 12).
        */}
        <Heading level={4} data-size="2xs">
          Dine dokumenter
        </Heading>

        {/*
          The Tag came back with the thing it was about. It was taken out
          because it promised something new directly above a box saying
          upload did not work (brukerblikk, funn 13) — so it is drawn only
          where upload actually works, which is the same test the zone below
          makes.
        */}
        {unavailable === undefined && (
          <Tag data-color="info" data-size="sm">
            Ny
          </Tag>
        )}
      </div>

      {/*
        Designsystemet's own composition, from file-upload.md: the field
        carries the label and the descriptions, the icon is decorative, and
        the «button» is a span because the real control is the file input
        that CSS lays over the whole surface. A real button inside the click
        surface would be a second tab stop that does nothing.

        The component is `EXPERIMENTAL_` and that is the name it ships under;
        it is a styled div with no behaviour of its own, so what it costs us
        if it changes is the box, not the flow.
      */}
      <Field>
        <Label>Last opp egne dokumenter</Label>

        <FileUpload data-size="sm" className="own-documents__zone">
          <CloudUpIcon aria-hidden="true" fontSize="1.5rem" />

          {unavailable === undefined ? (
            <>
              <Field.Description>
                Slipp filer her, eller velg dem selv. Kun PDF og .docx for øyeblikket, maks{' '}
                {MAX_UPLOAD_TEXT}.
              </Field.Description>

              <Button asChild variant="secondary" data-size="sm">
                <span>Velg filer</span>
              </Button>

              <input
                ref={inputRef}
                type="file"
                multiple
                accept={UPLOAD_ACCEPT}
                aria-describedby={listId}
                onChange={(event) => void choose(event.currentTarget.files)}
              />
            </>
          ) : (
            /*
              No picker at all when there is nowhere to send a file. A control
              that cannot work is worse than none: it invites the one action
              the service cannot do, and the reader finds out by failing.
            */
            <Field.Description>{uploadErrorText(unavailable)}</Field.Description>
          )}
        </FileUpload>
      </Field>

      {documents.length > 0 && (
        <ul className="own-documents__list" id={listId}>
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              onRemove={() => void remove(document.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DocumentRow({ document, onRemove }: { document: UserDocument; onRemove: () => void }) {
  return (
    <li className="own-documents__item">
      <div className="own-documents__text">
        <Paragraph data-size="sm" className="own-documents__name">
          {document.name}
        </Paragraph>

        {/*
          Type and size always; a status only when there is something to say.
          A row that says «Klar» under every finished document is a word per
          row in a panel that is already over its height budget, and the
          reader can see that it is there.
        */}
        <Paragraph data-size="xs" className="own-documents__meta">
          {TYPE_LABEL[document.type]} · {fileSize(document.size)}
          {document.status === 'uploading' && ` · Laster opp … ${Math.round(document.progress)} %`}
        </Paragraph>

        {document.status === 'failed' && (
          <Paragraph data-size="xs" className="own-documents__error">
            {uploadErrorText(document.errorCode ?? 'failed')}
          </Paragraph>
        )}
      </div>

      {/*
        The name is in the accessible name, because «Fjern» four times over is
        four controls a screen reader user cannot tell apart.
      */}
      <Button
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        aria-label={`Fjern ${document.name}`}
        onClick={onRemove}
      >
        <TrashIcon aria-hidden="true" />
      </Button>
    </li>
  );
}
