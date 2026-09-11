import { Button, Heading, Link, Paragraph, Search, Skeleton } from '@digdir/designsystemet-react';
import { FunnelIcon, PencilWritingIcon } from '@navikt/aksel-icons';
import { useEffect, useId, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { createChatClient } from '../../api';
import type { Thread } from '../../model';
import { groupThreads } from './grouping';
import './threads.css';

export type ThreadsViewProps = {
  /**
   * Switches the slot to the filters view. The switch lives in the layout, so
   * the view only reports the intent. Without a handler the button is not
   * rendered at all: a control that does nothing is worse than no control.
   */
  onShowFilters?: () => void;
  /** Overrides the fetch. Only for previews and tests. */
  threads?: Thread[];
};

/**
 * The thread list: a new thread, a search field, and earlier threads grouped
 * by period.
 *
 * The view fetches what it renders, so mounting it takes no wiring. Data
 * comes from the ChatClient, which is the mock until the live client exists.
 */
export function ThreadsView({ onShowFilters, threads: given }: ThreadsViewProps) {
  const client = useMemo(() => createChatClient(), []);
  const [threads, setThreads] = useState<Thread[] | undefined>(given);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const searchStatusId = useId();

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
  }, [client, given]);

  const trimmed = query.trim().toLocaleLowerCase('nb-NO');
  const matches = useMemo(
    () =>
      (threads ?? []).filter((thread) => thread.title.toLocaleLowerCase('nb-NO').includes(trimmed)),
    [threads, trimmed],
  );
  const groups = useMemo(() => groupThreads(matches), [matches]);

  return (
    <div className="threads-view">
      {onShowFilters && (
        <Button variant="tertiary" data-color="neutral" onClick={onShowFilters}>
          <FunnelIcon aria-hidden="true" />
          Filtrer dokumenter
        </Button>
      )}

      <Button asChild>
        <NavLink to="/">
          Ny tråd
          <PencilWritingIcon aria-hidden="true" />
        </NavLink>
      </Button>

      <Heading level={2} data-size="xs">
        Tidligere tråder
      </Heading>

      {/*
        <search> is the landmark; the <form> inside it is what makes
        Search.Clear work, since that button is type="reset". Submitting does
        nothing because the list filters as the user types.
      */}
      <search>
        <form onSubmit={(event) => event.preventDefault()} onReset={() => setQuery('')}>
          <Search>
            <Search.Input
              aria-label="Søk i tråder"
              aria-describedby={trimmed ? searchStatusId : undefined}
              placeholder="Søk i tråder"
              onInput={(event) => setQuery(event.currentTarget.value)}
            />
            <Search.Clear />
          </Search>
        </form>
      </search>

      {trimmed && (
        <Paragraph asChild data-size="sm">
          <output id={searchStatusId}>
            {matches.length === 1 ? '1 tråd' : `${matches.length} tråder`}
          </output>
        </Paragraph>
      )}

      {failed && (
        <Paragraph data-size="sm">
          Klarte ikke å hente trådene. Prøv å laste siden på nytt.
        </Paragraph>
      )}

      {!failed && !threads && (
        <div className="threads-view__loading">
          {/* Skeleton is aria-hidden, so an <output> carries the message. */}
          <output className="ds-sr-only">Henter tråder</output>
          {[28, 22, 30, 18].map((characters) => (
            <Skeleton key={characters} variant="text" width={characters} />
          ))}
        </div>
      )}

      {threads && threads.length === 0 && (
        <Paragraph data-size="sm">
          Du har ingen tråder ennå. Still et spørsmål, så havner samtalen her.
        </Paragraph>
      )}

      {threads && threads.length > 0 && matches.length === 0 && (
        <Paragraph data-size="sm">Ingen tråder passer til søket.</Paragraph>
      )}

      {groups.map((group) => (
        <section key={group.id} className="threads-view__group">
          <Heading level={3} data-size="2xs">
            {group.title}
          </Heading>
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
