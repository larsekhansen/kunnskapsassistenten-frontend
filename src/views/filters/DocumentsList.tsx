import { Heading, Paragraph, Tag } from '@digdir/designsystemet-react';

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
 *   under «Fra Kudos» already explains the state.
 *
 *   The upload zone is drawn as a drop target with a button. Upload does not
 *   exist anywhere in the stack (API-bestilling A3), and question 9 is still
 *   open, so this is text, not a control. A dashed box that looks droppable
 *   but drops nothing is worse than a sentence that says so.
 */
export function DocumentsList() {
  return (
    <>
      <section className="documents-list">
        <Heading level={3} data-size="xs">
          Dokumenter
        </Heading>
        <Heading level={4} data-size="2xs">
          Fra Kudos
        </Heading>
        <Paragraph data-size="sm">Dokumentene som er relevante for søket ditt vises her.</Paragraph>
      </section>

      <section className="documents-list">
        <div className="documents-list__heading-row">
          <Heading level={3} data-size="xs">
            Dine dokumenter
          </Heading>
          <Tag data-color="info" data-size="sm">
            Ny
          </Tag>
        </div>
        <div className="documents-list__upload">
          <Paragraph data-size="sm">Last opp egne dokumenter</Paragraph>
          <Paragraph data-size="xs">
            Opplasting er ikke klar ennå. Når den kommer, tar den PDF og .docx.
          </Paragraph>
        </div>
      </section>
    </>
  );
}
