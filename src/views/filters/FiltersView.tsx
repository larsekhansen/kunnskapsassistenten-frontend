import { Button, Skeleton } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatClient } from '../../api';
import { BackIcon } from '../../components/icons';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import { useAnswerSources } from '../../layout/useAnswerSources';
import { useFilterSelection } from '../../layout/useFilterSelection';
import type { SlotViewProps } from '../../layout/viewModel';
import type { FilterFacet } from '../../model';
import { DocumentsList } from './DocumentsList';
import { FacetField } from './FacetField';
import './filters.css';

export type FiltersViewProps = Pick<SlotViewProps, 'siblingViews' | 'onShowView'> &
  /* Optional: a view mounted outside the shell has not been switched to. */
  Partial<Pick<SlotViewProps, 'switchedByUser'>> & {
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
 *
 * The documents under «Fra Kudos» come the same way, from the same shell: they
 * are the sources behind the answer on screen, which the chat view produces
 * and the sources panel also draws. See src/layout/answerSourcesContext.ts.
 */
export function FiltersView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  facets: given,
}: FiltersViewProps) {
  const client = useMemo(() => createChatClient(), []);
  const { selection, setSelection } = useFilterSelection();
  const { documents } = useAnswerSources();
  const [facets, setFacets] = useState<FilterFacet[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const backRef = useRef<HTMLButtonElement>(null);
  const loading = !failed && !facets;

  /*
   * Focus after a switch from the thread list. The button the user pressed
   * was unmounted with the view it stood in, so focus fell to the body; this
   * takes it back to the same place in the panel. The shell says whether a
   * user asked for this view or the page merely opened on it, so nothing is
   * stolen from the skip link on a page load. See SlotViewProps.
   */
  // The flag is settled before this view mounts and does not flip while it is
  // mounted: the button that switches away from a view is the only one that
  // sets it, and it is in the OTHER view. So this runs on mount and no later.
  useEffect(() => {
    if (switchedByUser) backRef.current?.focus();
  }, [switchedByUser]);

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
    <div className="filters-view" aria-busy={loading || undefined}>
      {/*
        The way back to the thread list. The slot tells the view which other
        views it holds, so the button appears only when there is somewhere to
        go. A Button and not a Link: it changes what the panel shows, not the
        address. See design/designsystemet/behov-til-komponent.md.
      */}
      {siblingViews.includes('threads') && (
        <Button
          ref={backRef}
          variant="tertiary"
          data-color="neutral"
          onClick={() => onShowView('threads')}
        >
          <BackIcon aria-hidden="true" />
          Tråder
        </Button>
      )}

      <PanelHeader title="Filtrering" size="sm" />

      <ErrorState message={failed ? 'Klarte ikke å hente filtrene.' : undefined} onRetry={retry} />

      {/*
        Skeleton is aria-hidden, so this carries the message. Rendered
        permanently with the text coming and going: a live region only
        announces what appears inside a region that already existed, so
        mounting the region and its text together says nothing — the same
        reason ErrorState keeps its alert container. A retry has to announce.
      */}
      <output className="ds-sr-only">{loading ? 'Henter filtre' : ''}</output>

      {loading && (
        <div className="filters-view__loading">
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

      <DocumentsList documents={documents} />
    </div>
  );
}
