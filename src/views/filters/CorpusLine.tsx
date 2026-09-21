import { Button, Paragraph } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import type { CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';
import { corpusLine } from './corpusSummary';

export type CorpusLineProps = {
  /** The unconditional facets, or undefined while they load. */
  facets?: FilterFacet[];
  /** The corpus being searched, when one is known. */
  corpus?: CorpusOption;
};

/**
 * What the reader is searching, on one line.
 *
 * The whole sentence — «Dokumenter fra Kudos: 938 dokumenter, årsrapporter,
 * …» — wrapped to two lines in a 327 px panel and took 63 px of a filter head
 * that measured 179 at 1440. The panel is over its height budget, and this is
 * N2 in hoydebudsjett-forslag-2026-09-21: keep the name, put the rest behind
 * «Vis mer».
 *
 * The name is the right half to keep, and that follows from #103 and #106
 * rather than from taste: it is the half that CHANGES when a reader switches
 * corpus, and the half that says where the answers come from (brukerreiser
 * punkt 11). What is inside a corpus is the same sentence every time it is
 * read.
 *
 * A button with `aria-expanded` rather than `Details`: a `Details` summary is
 * a block and would start its own line, which is the 32 px this exists to
 * save. The button sits at the end of the name's line instead, and the detail
 * opens under it.
 *
 * The state is not remembered — deliberately, and it is in the brief. A
 * reader who opened it once has read it; reopening the panel tomorrow starts
 * from the short line again, which is the line the height budget assumes.
 */
export function CorpusLine({ facets, corpus }: CorpusLineProps) {
  const { source, detail } = corpusLine(facets, corpus);
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <Paragraph asChild data-size="xs">
      <div className="filters-view__corpus">
        <span>{source}</span>

        {detail && (
          <>
            <Button
              variant="tertiary"
              data-color="neutral"
              data-size="sm"
              className="filters-view__corpus-toggle"
              aria-expanded={open}
              aria-controls={detailId}
              onClick={() => setOpen((shown) => !shown)}
            >
              {open ? 'Vis mindre' : 'Vis mer'}
            </Button>

            {/*
              Rendered whether or not it is open, and hidden with `hidden`:
              `aria-controls` points at it, and an element that is not in the
              document is one a screen reader cannot follow the pointer to.
            */}
            <span hidden={!open} id={detailId} className="filters-view__corpus-detail">
              {detail}
            </span>
          </>
        )}
      </div>
    </Paragraph>
  );
}
