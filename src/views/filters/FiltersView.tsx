import { Button, Field, Label, Paragraph, Select, Skeleton } from '@digdir/designsystemet-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChatClient } from '../../api';
import { BackIcon } from '../../components/icons';
import { EmptyState, ErrorState, PanelHeader } from '../../components';
import { useAnswerSources } from '../../layout/useAnswerSources';
import { useCorpus } from '../../layout/useCorpus';
import { useFilterSelection } from '../../layout/useFilterSelection';
import { ViewHead } from '../../layout/ViewHead';
import type { SlotViewProps } from '../../layout/viewModel';
import { emptyFilterSelection, isEmptySelection, type FilterFacet } from '../../model';
import { KudosDocuments, OwnDocuments } from './DocumentsList';
import { corpusSummary } from './corpusSummary';
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
  const { options, active, option, choosable, set } = useCorpus();
  /**
   * What the live region says after a corpus switch.
   *
   * The region already exists and already announces «Henter filtre»; this
   * reuses it rather than adding a second one, which is what the brief asks
   * and what a panel with two announcers would get wrong anyway — two regions
   * mean two voices and no order between them.
   *
   * The switch itself is silent on screen: the panel is redrawn and the
   * address goes to `/`, neither of which a screen reader reads out. Without
   * this, the one thing that changed — which corpus the next question is
   * asked of — is the one thing nobody is told.
   */
  const [corpusAnnouncement, setCorpusAnnouncement] = useState('');

  function chooseCorpus(key: string) {
    const picked = options.find((candidate) => candidate.key === key);
    setCorpusAnnouncement(`Korpus: ${picked?.label ?? key}`);
    // The shell owns what a switch does — a new thread, and the address with
    // it. See useCorpus.ts.
    set(key);
  }

  const [facets, setFacets] = useState<FilterFacet[] | undefined>(given);
  /*
   * The facets as they are with nothing selected, kept apart from the ones
   * above because the corpus line is about the corpus and not about what the
   * user is looking at right now. Fed only by a fetch that no selection
   * narrowed, so the line cannot say the corpus shrank when all that happened
   * was that somebody ticked a box.
   */
  const [corpus, setCorpus] = useState<FilterFacet[] | undefined>(given);
  /*
   * Whether the corpus needs a fetch of its own.
   *
   * It used to get one for free: the selection started empty, so the first
   * conditional fetch WAS the unconditional one. #39 restores a saved filter
   * before this view mounts, and with one saved the first fetch is already
   * narrowed — `corpus` was then never set and the line fell back to
   * «Dokumenter fra Kudos» alone, on exactly the reload where the user had
   * most reason to want it. KA CC's follow-up on #34.
   *
   * Read once, at mount, because that is the question: was the selection
   * empty when this view opened? Later changes cannot make the first fetch
   * unconditional in hindsight. Clearing the filter does hand `corpus` the
   * same data through the effect below, which is free and harmless.
   */
  const [needsOwnCorpusFetch] = useState(() => !isEmptySelection(selection));
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

  /*
   * The counts are conditional on the other dimensions: picking one
   * organisation changes how many documents each year has, and leaves that
   * organisation's own list alone. That is the backend's rule and #33 built
   * it; this is the caller, and without it the dropdowns showed the whole
   * corpus no matter what the user had chosen.
   *
   * Refetched on every change of the selection, and `facets` is deliberately
   * NOT cleared first: the fields stay on screen with the old counts until
   * the new ones land, instead of collapsing to a skeleton on every click.
   * The cleanup aborts the previous request, so two answers cannot arrive out
   * of order and leave the counts from a selection the user has moved past.
   */
  useEffect(() => {
    if (given) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal, selection)
      .then((found) => {
        setFacets(found);
        if (isEmptySelection(selection)) setCorpus(found);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });

    return () => abort.abort();
  }, [client, given, attempt, selection]);

  /*
   * The unconditional facets, for the corpus line, when the conditional fetch
   * above cannot double as them. One extra request, on a load that restored a
   * filter, and none otherwise.
   *
   * A failure here is deliberately silent: the effect above owns `failed`,
   * and it is asking the same endpoint. Losing this one alone costs the
   * numbers in one sentence, which then says «Dokumenter fra Kudos» — the
   * same thing it says in live mode. That is a worse sentence, not a broken
   * panel, and an error region about it would be.
   */
  useEffect(() => {
    if (given || !needsOwnCorpusFetch) return;

    const abort = new AbortController();
    client
      .listFacets(abort.signal, emptyFilterSelection)
      .then(setCorpus)
      .catch(() => {});

    return () => abort.abort();
  }, [client, given, attempt, needsOwnCorpusFetch]);

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
        The top of the panel, pinned while the documents and the facets scroll
        under it.

        All three of these are in the head and not just the corpus line, and
        that is the lesson from #55 rather than a preference. The «Tråder»
        button is the first thing in the tab order here; left below a pinned
        head it keeps that place, the browser scrolls it to the top of the
        region when it takes focus, and it arrives underneath — clicks land on
        the head and the focus ring is invisible. Anything the reader can
        reach either goes IN the head or stays clear of it, and the way out of
        this view is not something to make them scroll for.

        The «Filtrering» heading comes with it because it names what the
        button leads away from, and a heading that scrolled off while its own
        controls stayed would read as a heading for the wrong thing.

        The box is the shell's; see src/layout/viewHeadContext.ts.
      */}
      <ViewHead>
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
            /*
              Its own class, because the rule that used to give it the panel's
              full width — `.filters-view > .ds-btn` — no longer reaches it:
              the button is drawn in the shell's head now. It is full width
              today either way, since the head stretches its children, but
              that is the head's default and the head belongs to somebody
              else. #2 asked for the width to be said where the button lives.
            */
            className="filters-view__back"
            onClick={() => onShowView('threads')}
          >
            <BackIcon aria-hidden="true" />
            Tråder
          </Button>
        )}

        <PanelHeader title="Filtrering" size="sm" />

        {/*
          What the answers are actually built on. «Kudos» used to appear nowhere
          the first-time user could see it, and nothing said how much there is or
          which years it covers (brukerreiser, punkt 11).

          Read off the UNCONDITIONAL facets — see `corpus` above — so it follows
          the corpus rather than the user's own narrowing, and it says
          «Dokumenter fra Kudos» on its own while they load and in live mode,
          where there is no facet aggregation to read.

          Pinned, because it is the sentence that says what the facets below
          are narrowing: scrolled away, «3 av 6 valgt» is three of six of
          nothing in particular (brukerblikk runde 2, funn 4).
        */}
        {choosable ? (
          /*
            More than one corpus to search, so the line becomes the control
            that picks between them. `Select` and not `Suggestion`: one value,
            a handful of options, and the native dropdown is the one control a
            reader already knows on every platform (select.md).

            `Field` wires the label to the control and the description to
            `aria-describedby` on its own, which is why the description keeps
            the same class and text as the line it replaces — it IS the line,
            now saying what the chosen corpus holds.
          */
          <Field>
            <Label>Korpus</Label>
            <Select value={active} onChange={(event) => chooseCorpus(event.currentTarget.value)}>
              {options.map((candidate) => (
                <Select.Option key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </Select.Option>
              ))}
            </Select>
            <Field.Description data-size="xs" className="filters-view__corpus">
              {corpusSummary(corpus, option)}
            </Field.Description>
          </Field>
        ) : (
          <Paragraph data-size="xs" className="filters-view__corpus">
            {corpusSummary(corpus, option)}
          </Paragraph>
        )}
      </ViewHead>

      {/*
        The documents the answer builds on, directly under the corpus line and
        ABOVE the facets.
 
        Drawn last in Figma, and that is where it was: measured at 1440 × 900
        with an answer on screen, the first row started at y = 818 in a 900 px
        window, under three facet fields nobody had touched (brukerblikk runde
        2, funn 4). What changes with every answer was sitting below what
        changes rarely.

        Answer 1 is not touched by this. It settles which VIEW a first-time
        user meets — filtering rather than the thread list — and they still
        land here, on a panel headed «Filtrering» with the corpus line under
        it. It says nothing about the order inside the view.

        Answer 2 is the reason the facets keep their full size just under it:
        the horizontal filter in the main column was dropped, so this panel is
        the only place filtering lives and it may not be folded away. That is
        also why the facets are not collapsed into `Details` instead — a
        disclosure that starts closed would hide «Ingen avgrensning» and «3 av
        6 valgt», which is the very text brukerblikk funn 3 existed to expose.
      */}
      <KudosDocuments documents={documents} />

      <ErrorState message={failed ? 'Klarte ikke å hente filtrene.' : undefined} onRetry={retry} />

      {/*
        Skeleton is aria-hidden, so this carries the message. Rendered
        permanently with the text coming and going: a live region only
        announces what appears inside a region that already existed, so
        mounting the region and its text together says nothing — the same
        reason ErrorState keeps its alert container. A retry has to announce.
      */}
      <output className="ds-sr-only">{loading ? 'Henter filtre' : corpusAnnouncement}</output>

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

      {/*
        Last, and it is the one thing here with no claim on the space above
        the fold: upload does not exist anywhere in the stack yet
        (API-bestilling A3), so nothing in it changes with the answer.
      */}
      <OwnDocuments />
    </div>
  );
}
