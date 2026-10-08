import { Paragraph } from '@digdir/designsystemet-react';

/**
 * The disclaimer over the excerpts, in the corpus's own name.
 *
 * The corpus comes from `corpusDisplayName`, which the filter panel names the
 * corpus with too, so the two cannot drift apart, and a corpus with no name
 * gets «standardkorpuset» rather than a claim. With an uploaded file among the
 * sources, «fra <korpus>» alone would be false about that excerpt.
 *
 * The second sentence is the one that matters: nothing here is generated, and
 * that is true of every corpus.
 */
export function sourcesDisclaimer(corpusName: string, hasOwnDocument: boolean): string {
  const source = hasOwnDocument
    ? `dokumentene, både fra ${corpusName} og fra dine egne dokumenter`
    : `dokumentene fra ${corpusName}`;

  return `All tekst er sitater fra ${source}. Ikke generert av kunstig intelligens.`;
}

type CorpusDisclaimerProps = {
  /** `aria-describedby` on the search field points here. */
  id: string;
  /** What to call the corpus, from `corpusDisplayName`. */
  corpusName: string;
  /** True when at least one document in the panel is the reader's own. */
  hasOwnDocument?: boolean;
};

/**
 * Below the panel head, not in it, on purpose. The head is sticky, and what is
 * pinned there takes room from the reading area while the reader scrolls. This
 * line never changes, so it loses nothing by scrolling away with the excerpts.
 *
 * `aria-describedby` resolves by id, so the search field still has this as its
 * description wherever it sits.
 */
export function CorpusDisclaimer({
  id,
  corpusName,
  hasOwnDocument = false,
}: CorpusDisclaimerProps) {
  return (
    <Paragraph id={id} data-size="xs" className="sources-search__description">
      {sourcesDisclaimer(corpusName, hasOwnDocument)}
    </Paragraph>
  );
}
