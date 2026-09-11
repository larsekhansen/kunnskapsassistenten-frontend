import { Button, Heading, Paragraph, Skeleton } from '@digdir/designsystemet-react';
import { useEffect, useMemo, useState } from 'react';
import { createChatClient } from '../../api';
import type { FilterFacet, FilterSelection } from '../../model';
import { emptyFilterSelection } from '../../model';
import { BackIcon } from './BackIcon';
import { DocumentsList } from './DocumentsList';
import { FacetField } from './FacetField';
import './filters.css';

export type FiltersViewProps = {
  /**
   * Switches the slot back to the thread list. The switch lives in the
   * layout, so the view only reports the intent; without a handler the button
   * is not rendered, because a control that does nothing is worse than none.
   */
  onShowThreads?: () => void;
  /** Lifts the selection into the layout once it has somewhere to live. */
  selection?: FilterSelection;
  onSelectionChange?: (selection: FilterSelection) => void;
  /** Overrides the fetch. Only for previews and tests. */
  facets?: FilterFacet[];
};

/**
 * The document filter: what the answer is allowed to build on.
 *
 * This is where a first-time user lands (answer 1), so it is the view that
 * has to be legible without any prior state.
 *
 * The selection is kept here until the layout owns it. Passing `selection`
 * and `onSelectionChange` takes it over without touching this file.
 */
export function FiltersView({
  onShowThreads,
  selection: given,
  onSelectionChange,
  facets: givenFacets,
}: FiltersViewProps) {
  const client = useMemo(() => createChatClient(), []);
  const [facets, setFacets] = useState<FilterFacet[] | undefined>(givenFacets);
  const [failed, setFailed] = useState(false);
  const [own, setOwn] = useState<FilterSelection>(emptyFilterSelection);

  const selection = given ?? own;

  useEffect(() => {
    if (givenFacets) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal)
      .then(setFacets)
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => abort.abort();
  }, [client, givenFacets]);

  function update(next: FilterSelection) {
    if (onSelectionChange) onSelectionChange(next);
    else setOwn(next);
  }

  return (
    <div className="filters-view">
      {onShowThreads && (
        <Button variant="tertiary" data-color="neutral" onClick={onShowThreads}>
          <BackIcon />
          Tråder
        </Button>
      )}

      <Heading level={2} data-size="sm">
        Filtrering
      </Heading>

      {failed && (
        <Paragraph data-size="sm">
          Klarte ikke å hente filtrene. Prøv å laste siden på nytt.
        </Paragraph>
      )}

      {!failed && !facets && (
        <div className="filters-view__loading">
          {/* Skeleton is aria-hidden, so an <output> carries the message. */}
          <output className="ds-sr-only">Henter filtre</output>
          {['a', 'b', 'c'].map((key) => (
            <Skeleton key={key} height="var(--ds-size-14)" />
          ))}
        </div>
      )}

      {facets?.map((facet) => (
        <FacetField
          key={facet.dimension}
          facet={facet}
          selected={selection[facet.dimension]}
          onChange={(values) => update({ ...selection, [facet.dimension]: values })}
        />
      ))}

      <DocumentsList />
    </div>
  );
}
