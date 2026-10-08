import { Link, Paragraph } from '@digdir/designsystemet-react';
import { useId, useState } from 'react';
import type { CorpusOption } from '../../api';
import type { FilterFacet } from '../../model';
import { corpusLine } from './corpusText';

export type CorpusLineProps = {
  /** The unconditional facets, or undefined while they load. */
  facets?: FilterFacet[];
  /** The corpus being searched, when one is known. */
  corpus?: CorpusOption;
};

/**
 * What the reader is searching, on one line.
 *
 * The whole sentence wraps to two lines in the panel, so only the name stays
 * on screen and the rest goes behind «Vis mer». The name is the half that
 * changes when a reader switches corpus, and the half that says where the
 * answers come from; what is inside a corpus reads the same every time.
 *
 * A button with `aria-expanded` rather than `Details`: a `Details` summary is
 * a block and would start its own line, which is the line this exists to
 * save. The button sits at the end of the name's line, and the detail opens
 * under it.
 *
 * The open state is deliberately not remembered: a reader who opened it once
 * has read it, and the panel starts from the short line again.
 *
 * It does survive a corpus switch, on purpose: a reader who has opened the
 * detail is reading what is in the corpus, which is what changed. The name
 * changes in the same render, so the new text never sits under the old name.
 *
 * The visible words stay «Vis mer», but the accessible name says what of, for
 * a reader who lists the buttons on the page and hears them out of context.
 */
export function CorpusLine({ facets, corpus }: CorpusLineProps) {
  const { source, detail } = corpusLine(facets, corpus);
  const [open, setOpen] = useState(false);
  const detailId = useId();

  return (
    <Paragraph asChild data-size="xs">
      <div className="filters-view__corpus">
        <span className="filters-view__corpus-source">{source}</span>

        {detail && (
          <>
            {/*
              A `Link` around a `button`, and both halves are deliberate.

              The button is the semantics: this opens something on the page,
              it is not a place to go, and `aria-expanded` belongs on a
              button. The link is the size: Designsystemet's `Button` is
              42 px tall at `data-size="sm"` against a 21 px line of text, and
              would set the height of the row. `Link` draws text, so the
              control is as tall as the line it sits on, and quieter beside a
              small muted sentence.

              Nothing of Designsystemet's is overridden; the link styles and
              the focus ring come from the component.
            */}
            <Link asChild className="filters-view__corpus-toggle">
              <button
                type="button"
                aria-label={open ? 'Vis mindre om korpuset' : 'Vis mer om korpuset'}
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setOpen((shown) => !shown)}
              >
                {open ? 'Vis mindre' : 'Vis mer'}
              </button>
            </Link>

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
