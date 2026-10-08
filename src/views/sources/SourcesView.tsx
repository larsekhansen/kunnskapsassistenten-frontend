import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { corpusDisplayNameFor, corpusOption } from '../../api';
import { EmptyState, findHits, PanelHeader, stepHit, type SearchHit } from '../../components';
import { useActiveCorpus } from '../../layout/useActiveCorpus';
import { ViewHead } from '../../layout/ViewHead';
import { excerptDomId, type AnswerSources, type Excerpt, type SourceDocument } from '../../model';
import { AnswerSwitcher } from './AnswerSwitcher';
import { ExcerptSearch } from './ExcerptSearch';
import { CorpusDisclaimer } from './CorpusDisclaimer';
import { corpusKeyFor, isOwnDocument } from './origin';
import { SourceDocumentCard } from './SourceDocumentCard';
import { distinctTitles } from './distinctTitles';
import { SourcesPlaceholder } from './SourcesPlaceholder';
import { noAnswerYet, emptyStateFor, type SourcesEmptyState } from './emptyStates';
import { readableDocuments } from './readableText';
import { buildSearchIndex } from './search';
import type { SourcesViewProps } from './types';
import './sources.css';

/**
 * Scrolling and focusing are kept apart.
 *
 * `scrollTo` is for content that moves under the reader: search as you type,
 * and stepping through hits. The keyboard has to stay in the field or on
 * «Neste», or the control makes itself unusable.
 *
 * `scrollToAndFocus` is for a move the reader asked for: a `[n]` marker in the
 * answer, or a title in «Kilder brukt i svaret» under it. Focus is what makes a
 * screen reader read the excerpt on arrival, and the next Tab continue there.
 *
 * `preventScroll` keeps the browser's own focus scroll from cutting the
 * smooth scroll short.
 */
function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollElementIntoView(element: HTMLElement) {
  element.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

function scrollTo(domId: string): HTMLElement | null {
  const element = document.getElementById(domId);
  if (element === null) return null;

  scrollElementIntoView(element);
  return element;
}

function scrollToAndFocus(domId: string) {
  scrollTo(domId)?.focus({ preventScroll: true });
}

/** Wait a frame, so state that opens an excerpt has been laid out first. */
function afterRender(action: () => void): () => void {
  const frame = requestAnimationFrame(action);
  return () => cancelAnimationFrame(frame);
}

function allExcerpts(sources: SourceDocument[]): Excerpt[] {
  return sources.flatMap((source) => source.excerpts);
}

function excerptOfHit(sources: SourceDocument[], hit: SearchHit | undefined): Excerpt | undefined {
  if (hit === undefined) return undefined;
  return allExcerpts(sources).find((excerpt) => excerpt.id === hit.itemId);
}

/** Stands in for a message id while the shell still holds one flat list. */
const LEGACY_ANSWER_ID = 'siste-svar';

/**
 * The `[n]` marker that sent the reader here, so Escape and «Tilbake til
 * svaret» can put focus back on it.
 *
 * The marker is drawn in the main column and has no id, so it is found:
 *
 *   1. The marker that still has focus. That is the right one when the same
 *      number is written twice in an answer.
 *   2. Otherwise, any marker pointing at this excerpt. Safari does not focus a
 *      link on click unless full keyboard access is on, so step 1 finds
 *      `<body>` there.
 *
 * Both check the `href`, because focus could be on something else entirely,
 * such as the «Neste» button, and returning there would be worse than nothing.
 */
function markerFor(citationNumber: number): HTMLElement | null {
  const href = `#${excerptDomId(citationNumber)}`;
  const focused = document.activeElement;

  if (focused instanceof HTMLElement && focused.getAttribute('href') === href) return focused;

  return document.querySelector<HTMLElement>(`a[href="${href}"]`);
}

/**
 * Where a marker stood, so it can be found again once the answer is drawn anew.
 *
 * A render that gives react-markdown a new citation list or a new search query
 * mounts the answer's paragraphs again, and the marker is swapped for an equal
 * one. The container around the answer is not mounted again, so the marker is
 * also kept as that container, its href, and which of the equal markers it was.
 */
type MarkerPlace = {
  element: HTMLElement;
  scope: Element | null;
  href: string;
  index: number;
};

function placeOf(marker: HTMLElement): MarkerPlace {
  const href = marker.getAttribute('href') ?? '';
  const scope = marker.closest('.markdown') ?? marker.closest('main');
  const index =
    scope === null ? -1 : [...scope.querySelectorAll(`a[href="${href}"]`)].indexOf(marker);
  return { element: marker, scope, href, index };
}

/** The marker itself when it is still there, or the one that took its place. */
function markerAt(place: MarkerPlace): HTMLElement | null {
  if (place.element.isConnected) return place.element;
  if (place.scope === null || !place.scope.isConnected) return null;

  const equal = place.scope.querySelectorAll<HTMLElement>(`a[href="${place.href}"]`);
  return equal[place.index] ?? equal[0] ?? null;
}

/**
 * One answer's worth of sources, whichever prop carried it.
 *
 * `answers` is the shape the panel wants, and `documents` the flat list the
 * shell holds today. Below this function there is only one shape.
 *
 * `undefined` is «nothing is known yet», and `[]` is «nothing has been asked».
 */
function normaliseAnswers(
  answers: readonly AnswerSources[] | undefined,
  documents: SourceDocument[] | undefined,
): readonly AnswerSources[] | undefined {
  if (answers !== undefined) return answers;
  if (documents === undefined) return undefined;
  if (documents.length === 0) return [];
  return [{ messageId: LEGACY_ANSWER_ID, documents, status: 'complete' }];
}

/** What the body of the panel shows, once the four states are told apart. */
type PanelContent =
  { kind: 'loading' } | { kind: 'empty'; state: SourcesEmptyState } | { kind: 'sources' };

/**
 * The four states, in order. Early returns, because the last two depend on
 * having ruled out the first two: `emptyStateFor` does not take `streaming`.
 */
function panelContentFor(
  answers: readonly AnswerSources[] | undefined,
  active: AnswerSources | undefined,
  /** For the «nothing asked yet» state, which has no answer to read from. */
  activeCorpusName: string,
): PanelContent {
  if (answers === undefined) return { kind: 'loading' };
  if (active === undefined) return { kind: 'empty', state: noAnswerYet(activeCorpusName) };
  if (active.status === 'streaming') return { kind: 'loading' };
  if (active.documents.length === 0) {
    return {
      kind: 'empty',
      state: emptyStateFor(active.status, active.citationCount, active.sourcesNotStored),
    };
  }
  return { kind: 'sources' };
}

/**
 * The sources view: the content of the secondary sidebar.
 *
 * The shell owns the collapse button and hides this subtree with `hidden` when
 * the slot is collapsed. Here are the search, and one card per document with
 * its excerpts under it.
 *
 * **One answer at a time.** Each answer numbers its excerpts from 1, so one
 * flat list made `[2]` in the first answer open the second answer's excerpt 2.
 * The panel shows the newest answer, follows a new one when it arrives, and
 * switches when a marker in an older answer is activated. `AnswerSwitcher` says
 * which answer is on screen.
 *
 * Four states:
 *
 *   answers === undefined      loading, the skeleton
 *   answers.length === 0       nothing asked yet, an empty state
 *   answer with no documents   what became of it, per status (`emptyStates.ts`)
 *   otherwise                  the sources
 *
 * A skeleton promises content on its way, and `Skeleton` is `aria-hidden`, so
 * the states where nothing is on its way are said in words.
 *
 * Other views may share the slot, so nothing here assumes it is alone.
 */
export function SourcesView({
  answers,
  documents,
  collapsed = false,
  onCollapsedChange,
  activeCitationNumber,
  activeCitationNonce,
  activeCitationMessageId,
}: SourcesViewProps) {
  // The disclaimer is drawn outside the sticky head and the search field
  // inside it, so the id that ties them together is made here, where both are.
  const disclaimerId = useId();
  const [query, setQuery] = useState('');
  const [currentHitIndex, setCurrentHitIndex] = useState(0);
  const [openExcerptIds, setOpenExcerptIds] = useState<ReadonlySet<string>>(new Set());

  const answerList = useMemo(() => normaliseAnswers(answers, documents), [answers, documents]);
  const answersOnScreen = useMemo(() => answerList ?? [], [answerList]);
  const newestMessageId = answersOnScreen.at(-1)?.messageId;

  // Which answer the reader stepped or was sent to. `undefined` means the
  // newest, which it goes back to when a new answer arrives: the panel opens
  // for a new answer, and an older set beside it would be wrong.
  const [chosenMessageId, setChosenMessageId] = useState<string | undefined>(undefined);
  const [followedMessageId, setFollowedMessageId] = useState(newestMessageId);
  if (followedMessageId !== newestMessageId) {
    setFollowedMessageId(newestMessageId);
    setChosenMessageId(undefined);
  }

  const chosenIndex = answersOnScreen.findIndex((answer) => answer.messageId === chosenMessageId);
  const activeIndex = chosenIndex >= 0 ? chosenIndex : answersOnScreen.length - 1;
  const activeAnswer = answersOnScreen[activeIndex];

  // Readable once, here, so the search and the quote measure and draw the same
  // string. See `readableText.ts`.
  const documentList = useMemo(
    () => readableDocuments(activeAnswer?.documents ?? []),
    [activeAnswer],
  );
  // Two documents with one title get their numbers, here and under the answer.
  const names = useMemo(() => distinctTitles(documentList), [documentList]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A `[n]` marker arrives as a prop, so the excerpt is opened while rendering
  // the change, which is React's way to adjust state when a prop changes. The
  // scroll is an effect, because it has to come after layout.
  //
  // All three parts are compared: the number for a caller without a nonce,
  // the nonce so that a second click on the same marker counts, and the
  // message id for a marker in another answer.
  //
  // `shownFor` is recorded, not compared: the answer the citation was resolved
  // against. The highlight and the way back belong to that answer, not to
  // whichever answer has an excerpt with that number. Recording it here makes
  // it right both with and without a message id from the shell.
  const [handled, setHandled] = useState<
    { number?: number; nonce?: number; messageId?: string; shownFor?: string } | undefined
  >(undefined);
  if (
    handled?.number !== activeCitationNumber ||
    handled?.nonce !== activeCitationNonce ||
    handled?.messageId !== activeCitationMessageId
  ) {
    // Switch to the answer the marker sits in before looking the excerpt up.
    // Without a message id, the marker is resolved against the answer on screen.
    const citedIndex = answersOnScreen.findIndex(
      (answer) => answer.messageId === activeCitationMessageId,
    );
    if (citedIndex >= 0 && citedIndex !== activeIndex) {
      setChosenMessageId(activeCitationMessageId);
    }

    const citedAnswer = citedIndex >= 0 ? answersOnScreen[citedIndex] : activeAnswer;

    setHandled({
      number: activeCitationNumber,
      nonce: activeCitationNonce,
      messageId: activeCitationMessageId,
      shownFor: activeCitationNumber === undefined ? undefined : citedAnswer?.messageId,
    });

    const target = allExcerpts(citedAnswer?.documents ?? []).find(
      (excerpt) => excerpt.citationNumber === activeCitationNumber,
    );

    if (target !== undefined && !openExcerptIds.has(target.id)) {
      setOpenExcerptIds(new Set(openExcerptIds).add(target.id));
    }

    // A marker into a collapsed panel would do nothing, and the default layout
    // starts collapsed. The shell's `showCitation` opens it too, but this view
    // is the one that knows a citation arrived.
    if (target !== undefined && collapsed) onCollapsedChange?.(false);
  }

  // The same guard as in render. Effects run on mount, so without it a view
  // mounted with a citation already set, after an answer or when it moves
  // between slots, would take focus before the reader has done anything.
  const revealedCitation = useRef<{ number?: number; nonce?: number }>({
    number: activeCitationNumber,
    nonce: activeCitationNonce,
  });

  // Where «Tilbake til svaret» and Escape go.
  const returnTarget = useRef<MarkerPlace | null>(null);

  /*
   * The marker as the reader activated it, recorded in the capture phase of
   * the click: before the main column's handler starts the render that can
   * replace it. By the time the effect runs, focus may be on `<body>`, and
   * «any marker with this href» is the first answer's [n] even when the reader
   * clicked the second's. A click inside this view is not a marker.
   */
  const activatedMarker = useRef<MarkerPlace | null>(null);

  useEffect(() => {
    function record(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const marker = target?.closest('a[href^="#excerpt-"]');
      if (!(marker instanceof HTMLElement) || marker.closest('.sources-view') !== null) return;
      activatedMarker.current = placeOf(marker);
    }

    document.addEventListener('click', record, true);
    return () => document.removeEventListener('click', record, true);
  }, []);

  useEffect(() => {
    const previous = revealedCitation.current;
    revealedCitation.current = { number: activeCitationNumber, nonce: activeCitationNonce };

    if (activeCitationNumber === undefined) return;
    if (previous.number === activeCitationNumber && previous.nonce === activeCitationNonce) return;

    const activated = activatedMarker.current;
    activatedMarker.current = null;
    const focused = markerFor(activeCitationNumber);
    returnTarget.current =
      activated?.href === `#${excerptDomId(activeCitationNumber)}`
        ? activated
        : focused === null
          ? null
          : placeOf(focused);

    // Two frames: one for the excerpt to open, one in case the panel had to be
    // un-collapsed, since the shell only removes `hidden` on its own render.
    return afterRender(() =>
      afterRender(() => scrollToAndFocus(excerptDomId(activeCitationNumber))),
    );
  }, [activeCitationNumber, activeCitationNonce]);

  /**
   * Back to the marker the reader came from. The answer can be replaced under
   * the panel, and focusing a detached element drops focus to `<body>`.
   */
  function returnToAnswer() {
    const place = returnTarget.current;
    const marker = place === null ? null : markerAt(place);
    if (marker === null) return;

    scrollElementIntoView(marker);
    marker.focus({ preventScroll: true });
  }

  function setExcerptOpen(excerptId: string, open: boolean) {
    setOpenExcerptIds((previous) => {
      const next = new Set(previous);
      if (open) next.add(excerptId);
      else next.delete(excerptId);
      return next;
    });
  }

  /**
   * Stepping to another answer resets the search: the query was aimed at the
   * excerpts that were on screen, and a counter for a set the reader can no
   * longer see is worse than an empty field.
   */
  function stepToAnswer(step: 1 | -1) {
    const next = activeIndex + step;
    const answer = answersOnScreen[next];
    if (answer === undefined) return;

    setChosenMessageId(answer.messageId);
    setQuery('');
    setCurrentHitIndex(0);
  }

  /**
   * A new query restarts at the first hit and opens every excerpt that has
   * one: «3 av 26 treff» means nothing if the matches sit behind closed
   * toggles.
   *
   * It scrolls but does not focus. Focus would leave the field the reader is
   * typing in.
   */
  function changeQuery(next: string) {
    const nextHits = findHits(searchIndex, next);
    const first = excerptOfHit(documentList, nextHits[0]);

    setQuery(next);
    setCurrentHitIndex(0);
    setOpenExcerptIds((previous) => new Set([...previous, ...nextHits.map((hit) => hit.itemId)]));

    if (first?.citationNumber !== undefined) {
      afterRender(() => scrollTo(excerptDomId(first.citationNumber as number)));
    }
  }

  /**
   * Previous and next open the excerpt they land on, as the search does, and
   * leave focus on the button so it can be pressed again. The live region on
   * the counter announces the move.
   */
  function stepToHit(step: 1 | -1) {
    const next = stepHit(hits.length, currentHitIndex, step);
    const excerpt = excerptOfHit(documentList, hits[next]);

    setCurrentHitIndex(next);
    if (excerpt !== undefined) {
      setOpenExcerptIds((previous) => new Set(previous).add(excerpt.id));
      if (excerpt.citationNumber !== undefined) {
        afterRender(() => scrollTo(excerptDomId(excerpt.citationNumber as number)));
      }
    }
  }

  /*
   * The corpus the answer on screen came from, not the one the chooser stands
   * on now. They part when an older thread from another corpus is opened, and
   * the excerpts under the line do not change with the chooser.
   *
   * The active corpus is only the fallback, for an answer where nothing said
   * which corpus answered.
   *
   * `useActiveCorpus` and not the store, so the view still mounts outside a
   * Router, `preview/` included.
   */
  const activeCorpus = useActiveCorpus();
  const corpusKey = corpusKeyFor(activeAnswer?.corpusKey, activeCorpus.key);
  const corpusName = corpusDisplayNameFor(corpusKey);

  /*
   * The same corpus, but undefined when nothing names it. The disclaimer is a
   * sentence and takes the «standardkorpuset» stand-in; a link label says only
   * what the link does.
   */
  const linkCorpusName = corpusOption(corpusKey) === undefined ? undefined : corpusName;

  const content = panelContentFor(answerList, activeAnswer, activeCorpus.displayName);

  // One string, said in two places: the visible row and the live region that
  // announces it. Empty while there is only one answer, which keeps the region
  // silent without taking it out of the document.
  const answerLabel =
    answersOnScreen.length > 1
      ? `Kilder til svar ${activeIndex + 1} av ${answersOnScreen.length}`
      : '';

  // The marker is active on the answer the reader was sent to, and nowhere
  // else. Every answer has a `[1]`, so the number alone would carry the
  // highlight and «Tilbake til svaret» to an excerpt nobody was sent to.
  const citationIsOnScreen =
    handled?.shownFor !== undefined && handled.shownFor === activeAnswer?.messageId;
  const activeNumberHere = citationIsOnScreen ? activeCitationNumber : undefined;

  return (
    <div className="sources-view">
      {/* Which answer is on screen, for a screen reader. Mounted from the first
          render and empty while there is nothing to say: a live region has to
          exist before its content changes. `<output>` is `role="status"`, and
          the visible counter is `aria-hidden`, so nothing is said twice. */}
      <output className="ds-sr-only">{answerLabel}</output>

      {/* The panel head stays put while the excerpts scroll, so «Kilder til svar
          1 av 2» and the search stay in view. It always holds the heading, so
          the box with the border is there from the first render. See
          src/layout/viewHeadContext.ts. */}
      <ViewHead>
        {/* «Kilder», visible over the search as in Figma (node 1549-46119), and
            as «Filtrering» in the navigation panel, so the two panels start
            alike. The document titles below are level 3 under it. */}
        <PanelHeader title="Kilder" size="sm" />

        {/* Shown whenever the thread has more than one answer, including while
            the answer on screen has nothing to show: stepping back to the
            answer that did have sources is the whole point of it then. */}
        {answersOnScreen.length > 1 && (
          <AnswerSwitcher
            label={answerLabel}
            index={activeIndex}
            count={answersOnScreen.length}
            onStep={stepToAnswer}
          />
        )}

        {/* No search field when there is nothing to search. It stays during
            loading, so the layout does not shift when the sources arrive. */}
        {content.kind !== 'empty' && (
          <ExcerptSearch
            query={query}
            onQueryChange={changeQuery}
            hitCount={hits.length}
            currentHitIndex={currentHitIndex}
            onStep={stepToHit}
            descriptionId={disclaimerId}
          />
        )}
      </ViewHead>

      {content.kind !== 'empty' && (
        <CorpusDisclaimer
          id={disclaimerId}
          corpusName={corpusName}
          hasOwnDocument={documentList.some(isOwnDocument)}
        />
      )}

      {content.kind === 'loading' ? (
        <SourcesPlaceholder />
      ) : content.kind === 'empty' ? (
        <EmptyState title={content.state.title} description={content.state.description} />
      ) : (
        <>
          <div className="sources-documents">
            {documentList.map((source) => (
              <SourceDocumentCard
                key={source.id}
                source={source}
                name={names.get(source.id) ?? source.title}
                corpusName={linkCorpusName}
                openExcerptIds={openExcerptIds}
                onExcerptOpenChange={setExcerptOpen}
                hits={hits}
                currentHit={currentHit}
                activeCitationNumber={activeNumberHere}
                onReturnToAnswer={returnToAnswer}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
