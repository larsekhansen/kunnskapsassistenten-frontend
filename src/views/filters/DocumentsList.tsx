import { Button, Heading, Link, List, Paragraph, Tag } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { SourceDocument } from '../../model';

/**
 * How many documents are listed before «Vis flere dokumenter».
 *
 * Figma draws seven rows and the button under them, so the number is not in
 * the spec. Five is what the panel holds without the upload section below
 * being pushed off screen at the drawn width.
 */
const initiallyVisible = 5;

export type DocumentsListProps = {
  /**
   * The documents behind the answer on screen, held by the shell. See
   * src/layout/answerSourcesContext.ts.
   *
   * `undefined` («no answer yet») and `[]` («an answer with nothing behind
   * it») are different states over in the sources panel, but not here: both
   * mean there is no document to look at, and the panel says so the same way.
   */
  documents?: SourceDocument[];
};

/**
 * The documents the answer may build on: the ones Kudos matched, and the
 * user's own uploads.
 *
 * Two deliberate omissions against the Figma frame:
 *
 *   «Velg dokumenter» is drawn greyed out in the empty state. A disabled
 *   button is not reachable by keyboard and says nothing about why, and
 *   Designsystemet's own JSDoc advises against it, so the button is simply
 *   not rendered until there is something to choose between. The sentence
 *   under «Fra Kudos» already explains the state. It is not built in the
 *   active state either: the frame never draws a selected row, so there is
 *   no state for it to put the list into (answers 8 and 9).
 *
 *   The upload zone is drawn as a drop target with a button. Upload does not
 *   exist anywhere in the stack (API-bestilling A3), and question 9 is still
 *   open, so this is text, not a control. A dashed box that looks droppable
 *   but drops nothing is worse than a sentence that says so.
 */
export function DocumentsList({ documents }: DocumentsListProps) {
  // Not a module constant: two filter views in different slots would then
  // share one id, and the layout model exists so views can be moved.
  const kudosHeadingId = useId();
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  /*
   * A new answer brings a new set of documents, and the list starts over at
   * five. Adjusted during render with a remembered previous value rather than
   * in an effect: React re-runs the component with the new state before it
   * commits, so the longer list is never painted. The identity is stable
   * while an answer stands — the chat view hands over the answer's own array.
   */
  const [listed, setListed] = useState(documents);
  if (listed !== documents) {
    setListed(documents);
    setExpanded(false);
  }

  const fromKudos = documents ?? [];
  const hidden = expanded ? 0 : Math.max(fromKudos.length - initiallyVisible, 0);
  const shown = hidden === 0 ? fromKudos : fromKudos.slice(0, initiallyVisible);

  /*
   * «Vis flere dokumenter» removes itself with the click that hits it, and a
   * control that disappears has to say where focus goes, or a keyboard user
   * lands on `<body>` and tabs from the skip link again (WCAG 2.4.3). The
   * list is what the click produced, so focus goes there — and because the
   * list is labelled by «Fra Kudos», a screen reader says which list grew and
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
    <>
      <section className="documents-list">
        <Heading level={3} data-size="xs">
          Dokumenter
        </Heading>
        <Heading level={4} data-size="2xs" id={kudosHeadingId}>
          Fra Kudos
        </Heading>

        {fromKudos.length === 0 ? (
          /*
            The spec reads «Dokumentene som er relevant for ditt søk vises her».
            Deliberate deviation: «relevant» has to agree with «dokumentene».
          */
          <Paragraph data-size="sm">
            Dokumentene som er relevante for søket ditt vises her.
          </Paragraph>
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
                Viser {shown.length} av {fromKudos.length} dokumenter.
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
                const about = [source.documentType, source.organisation, source.year]
                  .filter((part) => part !== undefined)
                  .join(' · ');

                return (
                  <List.Item key={source.id}>
                    {source.url === undefined ? (
                      // Normal, not an error: folder-based corpora have no
                      // public URL, and a title without a link beats a link
                      // that goes nowhere.
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
              An action that loads more, not navigation, so a Button — the
              spec links it to `button.tsx` and draws it as a link, and
              `documents-list.md` settles that as tertiary. See
              design/designsystemet/behov-til-komponent.md.
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

      <section className="documents-list">
        <div className="documents-list__heading-row">
          {/*
            Level 4, a sibling of «Fra Kudos». The spec draws DocumentsList as
            one column with «Dokumenter» over both sources; level 3 here made
            this a sibling of «Dokumenter» instead, and the outline stopped
            matching the picture.
          */}
          <Heading level={4} data-size="xs">
            Dine dokumenter
          </Heading>
          <Tag data-color="info" data-size="sm">
            Ny
          </Tag>
        </div>
        <div className="documents-list__upload">
          <Paragraph data-size="sm">Last opp egne dokumenter</Paragraph>
          {/*
            The spec reads «Kun PDF og .docx for øyeblikket». Deliberate
            deviation: that sentence describes a limit on something the user
            can do, and there is nothing to do here yet, so it would promise a
            control that does not exist. The formats are kept.
          */}
          <Paragraph data-size="xs">
            Opplasting er ikke klar ennå. Når den kommer, tar den PDF og .docx.
          </Paragraph>
        </div>
      </section>
    </>
  );
}
