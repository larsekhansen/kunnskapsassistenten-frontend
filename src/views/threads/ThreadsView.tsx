import { Button, Link, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { createChatClient } from '../../api';
import { FilterIcon, NewThreadIcon } from '../../components/icons';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import { useOpenThread } from '../../layout/useOpenThread';
import type { SlotViewProps } from '../../layout/viewModel';
import type { Thread } from '../../model';
import { groupThreads } from './grouping';
import { threadTime } from './threadTime';
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
  // Which conversation is on screen, whoever put it there. See
  // src/layout/openThreadContext.ts.
  const openThreadId = useOpenThread();
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
        No `aria-current` here, and that is the same distinction the rows
        below make: «Ny tråd» is an ACTION, and marking it as the current page
        told a screen reader user that the button they are about to press is
        the page they are already on. The thread rows are places, and they are
        marked (answer 7).
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
            {group.threads.map((thread) => {
              const when = threadTime(thread.updatedAt);

              return (
                <li key={thread.id} className="threads-view__item">
                  {/*
                    `aria-current="page"` — not the colour — is what makes the
                    open thread available to a screen reader, and the style
                    hangs off the same attribute so the two can never drift.

                    It came from `NavLink`, which reads the router's location,
                    until 2026-09-15. That missed the commonest way in: a
                    conversation the reader starts on `/` gets its address from
                    `history.replaceState`, which the router never sees, so the
                    thread they had just made stayed unmarked until a reload
                    (KA CC). The shell knows which conversation is on screen
                    however the address got there; see openThreadContext.ts.
                  */}
                  <Link asChild data-size="sm" className="threads-view__thread">
                    <RouterLink
                      aria-current={thread.id === openThreadId ? 'page' : undefined}
                      to={`/threads/${thread.id}`}
                    >
                      {thread.title}
                    </RouterLink>
                  </Link>
                  {/*
                    Beside the link and not inside it. Inside, the time would
                    join the link's accessible name, and every row would be
                    announced as «NKOM måloppnåelse 14:32» — a name that
                    changes as the clock moves and that no one can use to ask
                    for the row by voice. Out here it is read after the link,
                    which is where it belongs: first what the thread is, then
                    when it was.
                  */}
                  {when && (
                    <time
                      className="threads-view__time"
                      dateTime={when.dateTime}
                      title={when.title}
                    >
                      {when.text}
                    </time>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
