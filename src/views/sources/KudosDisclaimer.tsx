import { Paragraph } from '@digdir/designsystemet-react';

/**
 * The Kudos disclaimer.
 *
 * Question 25 is still open, and the two Figma panels word it differently.
 * Choice made here: the wording from the newer of the two Figma panels, which
 * is also the one the curated September page shows. Written down so the next
 * person does not have to re-derive it.
 */
export const KUDOS_DISCLAIMER =
  'All tekst er sitater fra dokumentene fra Kudos. Ikke generert av kunstig intelligens.';

/**
 * The same promise when one of the documents is the reader's own.
 *
 * The sentence above is a claim about where every word in the panel came
 * from, and with an uploaded document in the list it is false: that excerpt
 * is not from Kudos. The part that matters is unchanged and is the reason the
 * line exists at all — none of this is generated — so only the source is
 * widened. Saying «fra Kudos» over the reader's own file would be the panel
 * telling them something they can see is wrong, and the whole point of this
 * panel is that it can be checked.
 */
export const OWN_DOCUMENT_DISCLAIMER =
  'All tekst er sitater fra dokumentene, både fra Kudos og fra dine egne. Ikke generert av kunstig intelligens.';

type KudosDisclaimerProps = {
  /** `aria-describedby` on the search field points here. */
  id: string;
  /** True when at least one document in the panel is the reader's own. */
  hasOwnDocument?: boolean;
};

/**
 * It sits below the panel head rather than inside it, and that is a decision,
 * not a leftover.
 *
 * The head is sticky (brukerblikk 2, finding 3), and everything pinned there
 * is taken off the reading area for as long as the reader scrolls. Measured at
 * 1440 with two answers: the head is 219 px of a 778 px region without this
 * line and 292 px with it, 28 % against 38 %. The line says something about
 * the excerpts underneath and never changes, so it is the one part of the old
 * head that loses nothing by scrolling with them.
 *
 * `aria-describedby` resolves by id, not by position, so the search field
 * still carries this as its description wherever it sits.
 */
export function KudosDisclaimer({ id, hasOwnDocument = false }: KudosDisclaimerProps) {
  return (
    <Paragraph id={id} data-size="xs" className="sources-search__description">
      {hasOwnDocument ? OWN_DOCUMENT_DISCLAIMER : KUDOS_DISCLAIMER}
    </Paragraph>
  );
}
