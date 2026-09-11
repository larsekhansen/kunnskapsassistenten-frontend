import { Paragraph } from '@digdir/designsystemet-react';

/**
 * Before the first answer there is nothing to cite (answer 36).
 *
 * This is deliberately NOT `excerpts-placeholder`. Skeletons promise that
 * content is on its way, and `Skeleton` is `aria-hidden`, so to a screen
 * reader user the empty panel would be silent. Two states, two treatments:
 * skeletons while sources are loading, a sentence when there are none yet.
 */
export function SourcesEmpty() {
  return (
    <div className="sources-empty">
      <Paragraph data-size="sm">
        Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat fra et dokument på
        Kudos, med samme nummer som markøren i svaret.
      </Paragraph>
    </div>
  );
}
