import { Button, Link, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, NavLink } from 'react-router';
import { createChatClient } from '../../api';
import { FilterIcon, NewThreadIcon } from '../../components/icons';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import type { SlotViewProps } from '../../layout/viewModel';
import type { Thread } from '../../model';
import { groupThreads } from './grouping';
import './threads.css';

export type ThreadsViewProps = Pick<SlotViewProps, 'siblingViews' | 'onShowView'> &
  /* Optional: a view mounted outside the shell has not been switched to. */
  Partial<Pick<SlotViewProps, 'switchedByUser'>> & {
    /** Overrides the fetch. Only for tests. */
    threads?: Thread[];
  };

/**
 * The thread list: a new thread, a search field, and earlier threads grouped
 * by period.
 *
 * The view fetches what it renders, so the shell mounts it without wiring.
 * Data comes from the ChatClient, which is the mock until the live client
 * exists.
 */
export function ThreadsView({
  siblingViews,
  onShowView,
  switchedByUser = false,
  threads: given,
}: ThreadsViewProps) {
  const client = useMemo(() => createChatClient(), []);
  const [threads, setThreads] = useState<Thread[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const searchStatusId = useId();
  const filterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (given) return;

    const abort = new AbortController();
    client
      .listThreads(abort.signal)
      .then(setThreads)
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => abort.abort();
  }, [client, given, attempt]);

  // Clearing the error here rather than in the effect: the retry click is
  // what changed, and setting state inside an effect starts another render.
  const retry = useCallback(() => {
    setThreads(undefined);
    setFailed(false);
    setAttempt((count) => count + 1);
  }, []);

  /*
   * Focus after a switch from the filter view, which unmounted the button the
   * user pressed and dropped focus on the body. The shell says whether a user
   * asked for this view or the page merely opened on it, so this never fires
   * ahead of the skip link. See SlotViewProps.
   */
  // The flag is settled before this view mounts and does not flip while it is
  // mounted: the button that switches away from a view is the only one that
  // sets it, and it is in the OTHER view. So this runs on mount and no later.
  useEffect(() => {
    if (switchedByUser) filterRef.current?.focus();
  }, [switchedByUser]);

  const loading = !failed && !threads;
  const trimmed = query.trim().toLocaleLowerCase('nb-NO');
  const matches = useMemo(
    () =>
      (threads ?? []).filter((thread) => thread.title.toLocaleLowerCase('nb-NO').includes(trimmed)),
    [threads, trimmed],
  );
  const groups = useMemo(() => groupThreads(matches), [matches]);

  return (
    <div className="threads-view" aria-busy={loading || undefined}>
      {/*
        The way in to filtering. The slot tells the view which other views it
        holds, so the button appears only when there is somewhere to go.
        Conditional rendering, not Tabs: this is navigation between two modes,
        not two views that exist side by side. See
        design/designsystemet/behov-til-komponent.md.
      */}
      {siblingViews.includes('filters') && (
        <Button
          ref={filterRef}
          variant="tertiary"
          data-color="neutral"
          onClick={() => onShowView('filters')}
        >
          <FilterIcon aria-hidden="true" />
          Filtrer dokumenter
        </Button>
      )}

      {/*
        Link and not NavLink: NavLink marks itself as the current page when the
        route matches, and on «/» that told a screen reader user that the
        button they are about to press is the page they are already on. «Ny
        tråd» is an action. The thread rows below are places, and they keep
        NavLink and aria-current (answer 7).
      */}
      <Button asChild>
        <RouterLink to="/">
          Ny tråd
          <NewThreadIcon aria-hidden="true" />
        </RouterLink>
      </Button>

      <PanelHeader title="Tidligere tråder">
        {/*
          <search> is the landmark; the <form> inside it is what makes
          Search.Clear work, since that button is type="reset". Submitting
          does nothing because the list filters as the user types.
        */}
        <search>
          <form onSubmit={(event) => event.preventDefault()} onReset={() => setQuery('')}>
            <Search>
              <Search.Input
                aria-label="Søk i tråder"
                aria-describedby={searchStatusId}
                placeholder="Søk i tråder"
                onInput={(event) => setQuery(event.currentTarget.value)}
              />
              <Search.Clear />
            </Search>
          </form>
        </search>
      </PanelHeader>

      {/*
        The hit count, and the loading message under it, are both rendered
        permanently with their text coming and going. A live region only
        announces content that appears inside a region that already existed,
        so mounting the region together with its text — which is what a
        `{trimmed && …}` around it did — said nothing on the first search.
        ErrorState keeps its alert container for the same reason.
      */}
      <Paragraph asChild data-size="sm">
        <output id={searchStatusId} className="threads-view__search-status">
          {trimmed ? (matches.length === 1 ? '1 tråd' : `${matches.length} tråder`) : ''}
        </output>
      </Paragraph>

      <ErrorState message={failed ? 'Klarte ikke å hente trådene.' : undefined} onRetry={retry} />

      {/* Skeleton is aria-hidden, so this carries the message. */}
      <output className="ds-sr-only">{loading ? 'Henter tråder' : ''}</output>

      {loading && (
        <div className="threads-view__loading">
          {[28, 22, 30, 18].map((characters) => (
            <Skeleton key={characters} variant="text" width={characters} />
          ))}
        </div>
      )}

      {threads?.length === 0 && (
        <EmptyState
          title="Ingen tråder ennå"
          description="Still et spørsmål, så havner samtalen her."
        />
      )}

      {threads && threads.length > 0 && matches.length === 0 && (
        <EmptyState title="Ingen treff" description="Ingen tråder passer til søket." />
      )}

      {groups.map((group) => (
        <section key={group.id} className="threads-view__group">
          <PanelHeader title={group.title} level={3} size="2xs" />
          <ul className="threads-view__list">
            {group.threads.map((thread) => (
              <li key={thread.id}>
                {/*
                  NavLink sets aria-current="page" on the active route by
                  itself, and that attribute — not the colour — is what makes
                  the selected thread available to a screen reader. The style
                  hangs off the same attribute so the two can never drift.
                */}
                <Link asChild data-size="sm" className="threads-view__thread">
                  <NavLink to={`/threads/${thread.id}`}>{thread.title}</NavLink>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
