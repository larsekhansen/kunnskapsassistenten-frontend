import { Button, Heading, Link, List, Paragraph } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef, useState } from 'react';
import { corpusDisplayName } from '../../api';
import { useCorpus } from '../../layout/useCorpus';
import type { SourceDocument } from '../../model';

/**
 * How many documents are listed before «Vis flere dokumenter».
 *
 * Not in the spec, where Figma draws seven rows: five is what the panel holds
 * without pushing the upload section below off screen at the drawn width.
 */
const initiallyVisible = 5;

/**
 * Why a document in this list is not a link.
 *
 * Normal, not an error: a folder-based corpus has no public addresses. A
 * title that is not a link and says nothing about it reads as a link that
 * failed.
 *
 * Two words rather than the sources panel's sentence («Dokumentet har ingen
 * offentlig lenke.»): this list is an index in a narrow panel, and the note
 * shares the row's small line with the document's properties, where the
 * sentence would wrap the line to two sooner.
 *
 * After a comma rather than a fourth « · »: the dots separate what the
 * document IS, and this is about the row, not another property.
 *
 * `src/views/sources/SourceDocumentCard.tsx` holds the sentence. Two views
 * may not import each other (the shell holds what they share), so if the
 * wording changes, it changes in both places.
 */
const NO_LINK_NOTE = 'uten lenke';

/**
 * The same note at the start of the line, for a corpus that knows neither
 * type, organisation nor year. A line in this list begins with a capital.
 */
const NO_LINK_ALONE = 'Uten lenke';

/** The row's small line: what the document is, and whether it can be opened. */
function aboutLine(source: SourceDocument): string {
  const properties = [source.documentType, source.organisation, source.year]
    .filter((part) => part !== undefined)
    .join(' · ');

  if (source.url !== undefined) return properties;
  return properties === '' ? NO_LINK_ALONE : `${properties}, ${NO_LINK_NOTE}`;
}

export type KudosDocumentsProps = {
  /**
   * The documents behind the answer on screen, held by the shell. See
   * src/layout/answerSourcesContext.ts.
   *
   * `undefined` («no answer yet») and `[]` («an answer with nothing behind
   * it») are different states in the sources panel, but not here: both mean
   * there is no document to look at, and the panel says so the same way.
   */
  documents?: SourceDocument[];
};

/**
 * The documents from the corpus that the answer on screen builds on.
 *
 * Separate from {@link OwnDocuments}, although Figma draws both as one column
 * at the foot of the panel: in a panel that scrolls, what changes with every
 * answer would sit below what changes rarely, under the window edge. The
 * view puts this one above the facets; see FiltersView for the order.
 *
 * «Velg dokumenter», drawn greyed out in the empty state, is not rendered. A
 * disabled button is not reachable by keyboard and says nothing about why,
 * and Designsystemet's own JSDoc advises against it; the sentence under the
 * heading already explains the state. Nor is there an active state: the
 * frame never draws a selected row.
 */
export function KudosDocuments({ documents }: KudosDocumentsProps) {
  // Not a module constant: two filter views in different slots would then
  // share one id, and the layout model exists so views can be moved.
  const kudosHeadingId = useId();
  const { option } = useCorpus();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * A new answer brings new documents, and the list starts over at five.
   * Adjusted during render with a remembered previous value rather than in an
   * effect: React re-runs the component with the new state before it commits,
   * so the longer list is never painted. The identity is stable while an
   * answer stands, since the chat view hands over the answer's own array.
   */
  const [listed, setListed] = useState(documents);
  if (listed !== documents) {
    setListed(documents);
    setExpanded(false);
  }

  /*
   * The reader's own uploads are left out, however much the answer leaned on
   * them. The heading says «Fra <korpus>», and a file only the reader holds
   * did not come from there; it has its own section further down the panel.
   *
   * Read off `origin` and never off the title, and absent means corpus, the
   * model's own rule (src/model/source.ts). The sources panel splits on the
   * same field with `isOwnDocument`, which lives in its view, so this reads
   * the model instead of tying two views together.
   *
   * The count under the heading and «Vis flere dokumenter» both follow from
   * this array, so neither counts a document the list does not show.
   */
  const fromCorpus = (documents ?? []).filter((source) => source.origin !== 'user');
  const hidden = expanded ? 0 : Math.max(fromCorpus.length - initiallyVisible, 0);
  const shown = hidden === 0 ? fromCorpus : fromCorpus.slice(0, initiallyVisible);

  /*
   * «Vis flere dokumenter» removes itself with the click that hits it, and a
   * control that disappears has to say where focus goes, or a keyboard user
   * lands on `<body>` and tabs from the skip link again (WCAG 2.4.3). The
   * list is what the click produced, so focus goes there, and because the
   * list is labelled by its heading, a screen reader says which list grew and
   * how many rows it now has.
   *
   * On `expanded` and not in the handler: the rows have to be in the DOM
   * before the list can take focus. `expanded` starts false and only the
   * button sets it, so this never fires on mount.
   */
  useEffect(() => {
    if (expanded) listRef.current?.focus();
  }, [expanded]);

  return (
    <section className="documents-list">
      <Heading level={3} data-size="xs">
        Dokumenter
      </Heading>
      {/*
        The corpus, not the constant «Kudos», and the same short name the
        corpus line uses, from the same function, so the two cannot disagree
        about what to call one corpus. The list below is labelled by this
        heading, so its accessible name follows.
      */}
      <Heading level={4} data-size="2xs" id={kudosHeadingId}>
        Fra {corpusDisplayName(option)}
      </Heading>

      {fromCorpus.length === 0 ? (
        /*
            Not the spec's «Dokumentene som er relevant for ditt søk vises
            her»: «relevant» has to agree with «dokumentene».
          */
        <Paragraph data-size="sm">Dokumentene som er relevante for søket ditt vises her.</Paragraph>
      ) : (
        <>
          {/*
              «Viser 7 av 15 dokumenter.» in the spec, against a corpus the
              panel cannot see. Ours counts the documents behind the answer,
              which is the only total the frontend knows.

              Only while something is held back: with every document listed
              the line says «Viser 3 av 3 dokumenter», which is noise, and it
              leaves together with the button that made it worth reading.
            */}
          {hidden > 0 && (
            <Paragraph data-size="xs" className="documents-list__count">
              Viser {shown.length} av {fromCorpus.length} dokumenter.
            </Paragraph>
          )}

          {/*
              `tabIndex={-1}` so «Vis flere dokumenter» has somewhere to put
              focus; the list is not in the tab order. `ds-focus` draws
              Designsystemet's ring on :focus-visible — the keyboard user who
              gets sent here sees it, the mouse user does not. NOT
              `ds-focus--visible`, which is the forced-on variant and paints a
              ring around the list at rest.
            */}
          <List.Unordered
            data-size="sm"
            aria-labelledby={kudosHeadingId}
            className="documents-list__list ds-focus"
            tabIndex={-1}
            ref={listRef}
          >
            {shown.map((source) => {
              // Named `source`, not `document`: the DOM global.
              const about = aboutLine(source);

              return (
                <List.Item key={source.id}>
                  {source.url === undefined ? (
                    // A title without a link beats a link that goes nowhere.
                    // The row says why below the title; see NO_LINK_NOTE.
                    <Paragraph data-size="sm">{source.title}</Paragraph>
                  ) : (
                    <Link href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                      {/* Designsystemet says not to mark an external link
                            with an icon alone, so the fact that it leaves the
                            app is said in words. */}
                      <span className="ds-sr-only"> (åpnes i ny fane)</span>
                    </Link>
                  )}
                  {about !== '' && (
                    <Paragraph data-size="xs" className="documents-list__about">
                      {about}
                    </Paragraph>
                  )}
                </List.Item>
              );
            })}
          </List.Unordered>

          {/*
              An action that loads more, not navigation, so a Button, and
              tertiary because the spec draws it as a link.
            */}
          {hidden > 0 && (
            <Button
              variant="tertiary"
              data-size="sm"
              data-color="neutral"
              onClick={() => setExpanded(true)}
            >
              Vis flere dokumenter
            </Button>
          )}
        </>
      )}
    </section>
  );
}
