import { Heading } from '@digdir/designsystemet-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, findHits, stepHit, type SearchHit } from '../../components';
import { excerptDomId, type AnswerSources, type Excerpt, type SourceDocument } from '../../model';
import { AnswerSwitcher } from './AnswerSwitcher';
import { ExcerptSearch } from './ExcerptSearch';
import { SourceDocumentCard } from './SourceDocumentCard';
import { SourcesOverview } from './SourcesOverview';
import { SourcesPlaceholder } from './SourcesPlaceholder';
import { NO_ANSWER_YET, emptyStateFor, type SourcesEmptyState } from './emptyStates';
import { documentDomId } from './ids';
import { buildSearchIndex } from './search';
import type { SourcesViewProps } from './types';
import './sources.css';

/**
 * Scrolling and focusing are two different things, and conflating them was a
 * bug in the first version of this file.
 *
 * `scrollTo` is «the content moved under you»: search-as-you-type, and
 * stepping through hits. The keyboard has to stay where the user put it, in
 * the field or on the «Neste» button, or the control makes itself unusable.
 *
 * `scrollToAndFocus` is «you asked to be moved here»: a `[n]` marker in the
 * answer, or a shortcut in the list. Focus is what makes a screen reader read
 * the excerpt on arrival, and what makes the next Tab continue from there.
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
 * The marker has no id and this view may not give it one — it is drawn in the
 * main column, which another worker owns — so the element is found rather than
 * addressed. Two ways, in order:
 *
 *   1. The marker the reader just activated still has focus. That is the right
 *      one when the same number is written twice in an answer, which the
 *      sample answer does.
 *   2. Otherwise, any marker pointing at this excerpt. Safari does not focus a
 *      link on click unless full keyboard access is on, so step 1 finds
 *      `<body>` there, and a way back to roughly the right place beats none.
 *
 * The `href` is checked in both, because focus could be sitting on something
 * else entirely — a shortcut in the list, the «Neste» button — and returning
 * to that would be worse than doing nothing.
 */
function markerFor(citationNumber: number): HTMLElement | null {
  const href = `#${excerptDomId(citationNumber)}`;
  const focused = document.activeElement;

  if (focused instanceof HTMLElement && focused.getAttribute('href') === href) return focused;

  return document.querySelector<HTMLElement>(`a[href="${href}"]`);
}

/**
 * One answer's worth of sources, whichever prop carried it.
 *
 * `answers` is the shape the panel wants and the shell does not hold yet
 * (rolle-5h). `documents` is the one flat list it does hold. Normalising here
 * means everything below this function sees one thing, and the day the shell
 * sends `answers` the only change is that this branch stops being taken.
 *
 * `[]` and `undefined` are kept apart on both paths, because they are
 * different answers: undefined is «nothing is known yet», `[]` is «nothing has
 * been asked».
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
 * The four states, in one place and in order.
 *
 * Early returns rather than nested conditions in the JSX, because the last two
 * depend on having ruled out the first two — `emptyStateFor` does not take
 * `streaming`, and the compiler is what holds that.
 */
function panelContentFor(
  answers: readonly AnswerSources[] | undefined,
  active: AnswerSources | undefined,
): PanelContent {
  if (answers === undefined) return { kind: 'loading' };
  if (active === undefined) return { kind: 'empty', state: NO_ANSWER_YET };
  if (active.status === 'streaming') return { kind: 'loading' };
  if (active.documents.length === 0) return { kind: 'empty', state: emptyStateFor(active.status) };
  return { kind: 'sources' };
}

/**
 * The sources view: the content of the secondary sidebar (answer 49).
 *
 * The shell owns the collapse button and hides this whole subtree with
 * `hidden` when the slot is collapsed, so there is no «Vis kilder» button
 * here. What is here is the search, the shortcut list, and one card per
 * document with the excerpts grouped under it (answer 57).
 *
 * **One answer at a time.** A thread has several answers and each numbers its
 * excerpts from 1, so a single flat list made `[2]` in the first answer open
 * the second answer's excerpt 2 — right-looking and wrong (brukerreiser punkt
 * 5). The panel shows the newest answer by default, follows a new one when it
 * arrives, and switches when a marker in an older answer is activated.
 * `AnswerSwitcher` says which one is on screen, because otherwise two sets are
 * indistinguishable.
 *
 * Four states, not two:
 *
 *   answers === undefined      loading, `excerpts-placeholder` from Figma
 *   answers.length === 0       nothing asked yet, an empty state (answer 36)
 *   answer with no documents   what became of it, per status (`emptyStates.ts`)
 *   otherwise                  the sources
 *
 * Figma only draws the skeleton version, but skeletons promise content that is
 * on its way. Before the first question nothing is on its way, and `Skeleton`
 * is `aria-hidden`, so those states have to be said in words instead.
 *
 * The tools menu and notes land in this same slot later, as views beside this
 * one (answers 22 and 52). Nothing here assumes it is alone in the slot.
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
  const [query, setQuery] = useState('');
  const [currentHitIndex, setCurrentHitIndex] = useState(0);
  const [openExcerptIds, setOpenExcerptIds] = useState<ReadonlySet<string>>(new Set());

  const answerList = useMemo(() => normaliseAnswers(answers, documents), [answers, documents]);
  const answersOnScreen = useMemo(() => answerList ?? [], [answerList]);
  const newestMessageId = answersOnScreen.at(-1)?.messageId;

  // Which answer the reader stepped or was sent to. `undefined` means «the
  // newest», which is what it goes back to whenever a new answer arrives: a
  // fresh answer is a fresh event, the panel opens itself for it (PR #30), and
  // showing an older set beside it would be the same lie in reverse.
  const [chosenMessageId, setChosenMessageId] = useState<string | undefined>(undefined);
  const [followedMessageId, setFollowedMessageId] = useState(newestMessageId);
  if (followedMessageId !== newestMessageId) {
    setFollowedMessageId(newestMessageId);
    setChosenMessageId(undefined);
  }

  const chosenIndex = answersOnScreen.findIndex((answer) => answer.messageId === chosenMessageId);
  const activeIndex = chosenIndex >= 0 ? chosenIndex : answersOnScreen.length - 1;
  const activeAnswer = answersOnScreen[activeIndex];

  const documentList = useMemo(() => activeAnswer?.documents ?? [], [activeAnswer]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A `[n]` marker in the answer is an event we do not own — it arrives as a
  // prop — so the excerpt is opened while rendering the change, which is
  // React's documented way to adjust state when a prop changes. The scroll is
  // a separate effect, because it has to happen after the layout.
  //
  // All three parts are compared, not just the nonce: the number alone covers
  // a caller that sends no nonce, the nonce is what makes a second click on
  // the SAME marker count as a new request (answer 19), and the message id
  // changes when the reader clicks a marker in a different answer.
  //
  // `shownFor` is not part of the comparison; it is what the block records.
  // It is the answer the citation was resolved against, and it is what makes
  // the active marker stay behind when the reader steps to another answer:
  // the highlight and the way back belong to the answer the reader was sent
  // to, not to whichever answer happens to show an excerpt with that number.
  // Recording it here rather than reading `activeCitationMessageId` later
  // means it is right in both states the shell passes through — with the
  // message id, and without it, where the marker is resolved against the
  // answer on screen at the time.
  const [handled, setHandled] = useState<
    { number?: number; nonce?: number; messageId?: string; shownFor?: string } | undefined
  >(undefined);
  if (
    handled?.number !== activeCitationNumber ||
    handled?.nonce !== activeCitationNonce ||
    handled?.messageId !== activeCitationMessageId
  ) {
    // The marker says which answer it sits in, so the panel switches to that
    // set before looking the excerpt up in it. Without the id — which is where
    // the chat view still is — the marker is resolved against whatever is on
    // screen, exactly as before.
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

    // A marker pointing into a collapsed panel does nothing, and the default
    // layout starts collapsed, so this is the first-run case rather than an
    // edge case. The shell's own `showCitation` opens the panel too; this view
    // does not depend on that, because it is the one that knows a citation
    // arrived.
    if (target !== undefined && collapsed) onCollapsedChange?.(false);
  }

  // The same guard the render phase has. Effects run on mount, so without it a
  // view mounted with a citation already set steals focus before the user has
  // done anything — which is exactly what happens when the shell mounts this
  // view after an answer has arrived, or when the view is moved between slots.
  const revealedCitation = useRef<{ number?: number; nonce?: number }>({
    number: activeCitationNumber,
    nonce: activeCitationNonce,
  });

  // Where «Tilbake til svaret» and Escape go. Captured when the citation
  // arrives, because that is the one moment the marker still has focus.
  const returnTarget = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previous = revealedCitation.current;
    revealedCitation.current = { number: activeCitationNumber, nonce: activeCitationNonce };

    if (activeCitationNumber === undefined) return;
    if (previous.number === activeCitationNumber && previous.nonce === activeCitationNonce) return;

    returnTarget.current = markerFor(activeCitationNumber);

    // Two frames: one for the excerpt to open, one in case the panel had to be
    // un-collapsed, since the shell only removes `hidden` on its own render.
    return afterRender(() =>
      afterRender(() => scrollToAndFocus(excerptDomId(activeCitationNumber))),
    );
  }, [activeCitationNumber, activeCitationNonce]);

  /**
   * Back to the marker the reader came from.
   *
   * `isConnected` because the answer can be replaced under the panel — a new
   * question, a different thread — and focusing a detached element silently
   * drops focus to `<body>`, which is the bug this whole control exists to fix.
   */
  function returnToAnswer() {
    const marker = returnTarget.current;
    if (marker === null || !marker.isConnected) return;

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
   * excerpts that were on screen, and a hit counter counting a set the reader
   * can no longer see is worse than an empty field.
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
   * one. Opening them is the point of the counter: «3 av 26 treff» means
   * nothing if the matches sit behind closed toggles. The user can close them
   * again afterwards.
   *
   * It scrolls but does not focus. Focusing here would take the keyboard out
   * of the field the user is typing in, and the field would be unusable past
   * the first two characters.
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
   * Previous and next also open the excerpt they land on, for the same reason
   * the search does, and they leave focus on the button so the user can press
   * it again. The live region on the counter is what announces the move.
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

  const content = panelContentFor(answerList, activeAnswer);

  /**
   * The marker is active on the answer the reader was sent to, and nowhere
   * else.
   *
   * Every answer numbers its excerpts from 1, so `[1]` exists in all of them.
   * Comparing only the number meant that stepping from the cited answer to
   * another one carried the blue band and «Tilbake til svaret» along to an
   * excerpt nobody had been sent to, offering a way back from a place the
   * reader never left (KA CC on PR #36).
   */
  // One string, said in two places: the visible row and the live region that
  // announces it. Empty while there is only one answer, which is what keeps
  // the region silent without taking it out of the document.
  const answerLabel =
    answersOnScreen.length > 1
      ? `Kilder til svar ${activeIndex + 1} av ${answersOnScreen.length}`
      : '';

  const citationIsOnScreen =
    handled?.shownFor !== undefined && handled.shownFor === activeAnswer?.messageId;
  const activeNumberHere = citationIsOnScreen ? activeCitationNumber : undefined;

  return (
    <div className="sources-view">
      {/* The slot's accessible name already says «Kilder», and the design has
          no visible panel title here — the shell's own toggle button carries
          the word. This heading is what the document titles below hang off. */}
      <Heading level={2} className="ds-sr-only">
        Kilder
      </Heading>

      {/* Which answer is on screen, for a screen reader.

          Mounted from the first render and never taken away, empty while there
          is nothing to say. A live region has to exist BEFORE its content
          changes; mounting it together with the text — which is what the
          visible row does, since it appears with the second answer — means the
          one announcement that matters is the one that is never made.

          `<output>` is `role="status"`, the same element and the same reason as
          the loading line in `SourcesPlaceholder`. The visible counter carries
          the identical string and is `aria-hidden`, so nothing is said twice. */}
      <output className="ds-sr-only">{answerLabel}</output>

      {/* Shown whenever the thread has more than one answer, including while
          the answer on screen has nothing to show: stepping back to the answer
          that DID have sources is the whole point of it then. */}
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
        />
      )}

      {content.kind === 'loading' ? (
        <SourcesPlaceholder />
      ) : content.kind === 'empty' ? (
        <EmptyState title={content.state.title} description={content.state.description} />
      ) : (
        <>
          <SourcesOverview
            documents={documentList}
            onNavigateToDocument={(documentId) => scrollToAndFocus(documentDomId(documentId))}
          />

          <div className="sources-documents">
            {documentList.map((source) => (
              <SourceDocumentCard
                key={source.id}
                source={source}
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
