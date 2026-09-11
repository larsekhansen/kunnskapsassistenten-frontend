import { Button, Skeleton } from '@digdir/designsystemet-react';
import { ArrowLeftIcon } from '@navikt/aksel-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createChatClient } from '../../api';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import { useFilterSelection } from '../../layout/useFilterSelection';
import type { SlotViewProps } from '../../layout/viewModel';
import type { FilterFacet } from '../../model';
import { DocumentsList } from './DocumentsList';
import { FacetField } from './FacetField';
import './filters.css';

export type FiltersViewProps = Pick<SlotViewProps, 'siblingViews' | 'onShowView'> & {
  /** Overrides the fetch. Only for tests. */
  facets?: FilterFacet[];
};

/**
 * The document filter: what the answer is allowed to build on.
 *
 * This is where a first-time user lands (answer 1), so it is the view that
 * has to be legible without any prior state.
 *
 * The selection is not kept here. The chat view has to ask its question
 * against the same narrowing, and two views may not import each other, so the
 * shell holds it — see src/layout/filterContext.ts.
 */
export function FiltersView({ siblingViews, onShowView, facets: given }: FiltersViewProps) {
  const client = useMemo(() => createChatClient(), []);
  const { selection, setSelection } = useFilterSelection();
  const [facets, setFacets] = useState<FilterFacet[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (given) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal)
      .then(setFacets)
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => abort.abort();
  }, [client, given, attempt]);

  // Clearing the error here rather than in the effect: the retry click is
  // what changed, and setting state inside an effect starts another render.
  const retry = useCallback(() => {
    setFacets(undefined);
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  return (
    <div className="filters-view">
      {/*
        The way back to the thread list. The slot tells the view which other
        views it holds, so the button appears only when there is somewhere to
        go. A Button and not a Link: it changes what the panel shows, not the
        address. See design/designsystemet/behov-til-komponent.md.
      */}
      {siblingViews.includes('threads') && (
        <Button variant="tertiary" data-color="neutral" onClick={() => onShowView('threads')}>
          <ArrowLeftIcon aria-hidden="true" />
          Tråder
        </Button>
      )}

      <PanelHeader title="Filtrering" size="sm" />

      <ErrorState message={failed ? 'Klarte ikke å hente filtrene.' : undefined} onRetry={retry} />

      {!failed && !facets && (
        <div className="filters-view__loading">
          {/* Skeleton is aria-hidden, so an <output> carries the message. */}
          <output className="ds-sr-only">Henter filtre</output>
          {['a', 'b', 'c'].map((key) => (
            <Skeleton key={key} height="var(--ds-size-14)" />
          ))}
        </div>
      )}

      {/*
        No facets is a normal state, not an error: nothing is narrowing the
        answer, and the user can still ask. Separate from the loading branch
        above, which tests !facets — an empty array is truthy.
      */}
      {facets?.length === 0 && (
        <EmptyState
          title="Filtrering er ikke tilgjengelig ennå"
          description="Du kan stille spørsmål uten å avgrense dokumentene."
        />
      )}

      {facets?.map((facet) => (
        <FacetField
          key={facet.dimension}
          facet={facet}
          selected={selection[facet.dimension]}
          onChange={(values) => setSelection({ ...selection, [facet.dimension]: values })}
        />
      ))}

      <DocumentsList />
    </div>
  );
}
