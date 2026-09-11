import { Details, Paragraph, Tag } from '@digdir/designsystemet-react';
import type { RetrievalDetails } from '../../model';
import { MagnifyingGlassIcon } from '@navikt/aksel-icons';

type RetrievalPanelProps = { retrieval: RetrievalDetails };

/** «10 treff i 3 dokumenter», with correct singular forms. */
function hitSummary({ hitCount, documentCount }: RetrievalDetails): string {
  const hits = hitCount === 1 ? '1 treff' : `${hitCount} treff`;
  const documents = documentCount === 1 ? '1 dokument' : `${documentCount} dokumenter`;
  return `${hits} i ${documents}`;
}

/**
 * «Fremgangsmåte»: how the assistant searched.
 *
 * Figma draws a collapsible bar with an open/close chevron of its own; this
 * is a `Details`, which gives the disclosure role, `aria-expanded` and
 * keyboard operation for free. Three components in the design build that
 * switch by hand (`chunk`, `blackbox` and `expandable`), and all three are
 * one `Details` in code.
 *
 * Two deliberate departures from Figma:
 *
 *   1. The hit count is a neutral Tag, not `color="success"`. Green means
 *      «this went well» in Designsystemet. Ten hits is a fact, and a green
 *      count makes zero hits look like a failure the user caused.
 *   2. No heading inside the summary. `Details.Summary` is already the
 *      control that names the section; a heading inside it would put a
 *      heading inside a button, which helps no one.
 *
 * Frontend placeholder in v1 (answer 11), open by default, because what makes
 * an answer checkable should not be behind a click. The keywords are plain
 * Tags: they are not clickable (answer 13).
 */
export function RetrievalPanel({ retrieval }: RetrievalPanelProps) {
  return (
    // data-color is neutral so the bar is grey as drawn, not accent blue.
    <Details data-color="neutral" defaultOpen>
      <Details.Summary>
        <span className="ka-retrieval__summary">
          <MagnifyingGlassIcon aria-hidden fontSize="1.25rem" />
          Fremgangsmåte
          <Tag data-color="neutral" data-size="sm">
            {hitSummary(retrieval)}
          </Tag>
        </span>
      </Details.Summary>
      <Details.Content>
        <Paragraph data-size="sm">Nøkkelord som ble brukt i søket</Paragraph>
        <ul className="ka-retrieval__keywords">
          {retrieval.keywords.map((keyword) => (
            <li key={keyword}>
              <Tag data-color="neutral" data-size="sm">
                {keyword}
              </Tag>
            </li>
          ))}
        </ul>
      </Details.Content>
    </Details>
  );
}
