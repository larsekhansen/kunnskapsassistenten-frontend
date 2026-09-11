import { Heading } from '@digdir/designsystemet-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components';
import { excerptDomId, type Excerpt, type SourceDocument } from '../../model';
import { ExcerptSearch } from './ExcerptSearch';
import { SourceDocumentCard } from './SourceDocumentCard';
import { SourcesOverview } from './SourcesOverview';
import { SourcesPlaceholder } from './SourcesPlaceholder';
import { documentDomId } from './ids';
import { type SearchHit, buildSearchIndex, findHits, stepHit } from './search';
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
function scrollTo(domId: string): HTMLElement | null {
  const element = document.getElementById(domId);
  if (element === null) return null;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
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

/**
 * The sources view: the content of the secondary sidebar (answer 49).
 *
 * The shell owns the collapse button and hides this whole subtree with
 * `hidden` when the slot is collapsed, so there is no «Vis kilder» button
 * here. What is here is the search, the shortcut list, and one card per
 * document with the excerpts grouped under it (answer 57).
 *
 * Three states, not two:
 *
 *   documents === undefined   loading, `excerpts-placeholder` from Figma
 *   documents.length === 0    no answer yet, an empty state (answer 36)
 *   otherwise                 the sources
 *
 * Figma only draws the skeleton version, but skeletons promise content that is
 * on its way. Before the first question nothing is on its way, and `Skeleton`
 * is `aria-hidden`, so that state has to be said in words instead.
 *
 * The tools menu and notes land in this same slot later, as views beside this
 * one (answers 22 and 52). Nothing here assumes it is alone in the slot.
 */
export function SourcesView({
  documents,
  collapsed = false,
  onCollapsedChange,
  activeCitationNumber,
  activeCitationNonce,
}: SourcesViewProps) {
  const [query, setQuery] = useState('');
  const [currentHitIndex, setCurrentHitIndex] = useState(0);
  const [openExcerptIds, setOpenExcerptIds] = useState<ReadonlySet<string>>(new Set());

  const documentList = useMemo(() => documents ?? [], [documents]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A `[n]` marker in the answer is an event we do not own — it arrives as a
  // prop — so the excerpt is opened while rendering the change, which is
  // React's documented way to adjust state when a prop changes. The scroll is
  // a separate effect, because it has to happen after the layout.
  //
  // Both halves are compared, not just the nonce: the number alone covers a
  // caller that sends no nonce, and the nonce is what makes a second click on
  // the SAME marker count as a new request (answer 19).
  const [handled, setHandled] = useState<{ number?: number; nonce?: number } | undefined>(
    undefined,
  );
  if (handled?.number !== activeCitationNumber || handled?.nonce !== activeCitationNonce) {
    setHandled({ number: activeCitationNumber, nonce: activeCitationNonce });

    const target = allExcerpts(documentList).find(
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

  useEffect(() => {
    const previous = revealedCitation.current;
    revealedCitation.current = { number: activeCitationNumber, nonce: activeCitationNonce };

    if (activeCitationNumber === undefined) return;
    if (previous.number === activeCitationNumber && previous.nonce === activeCitationNonce) return;

    // Two frames: one for the excerpt to open, one in case the panel had to be
    // un-collapsed, since the shell only removes `hidden` on its own render.
    return afterRender(() =>
      afterRender(() => scrollToAndFocus(excerptDomId(activeCitationNumber))),
    );
  }, [activeCitationNumber, activeCitationNonce]);

  function setExcerptOpen(excerptId: string, open: boolean) {
    setOpenExcerptIds((previous) => {
      const next = new Set(previous);
      if (open) next.add(excerptId);
      else next.delete(excerptId);
      return next;
    });
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

  return (
    <div className="sources-view">
      {/* The slot's accessible name already says «Kilder», and the design has
          no visible panel title here — the shell's own toggle button carries
          the word. This heading is what the document titles below hang off. */}
      <Heading level={2} className="ds-sr-only">
        Kilder
      </Heading>

      {/* No search field when there is nothing to search. It stays during
          loading, so the layout does not shift when the sources arrive. */}
      {(documents === undefined || documentList.length > 0) && (
        <ExcerptSearch
          query={query}
          onQueryChange={changeQuery}
          hitCount={hits.length}
          currentHitIndex={currentHitIndex}
          onStep={stepToHit}
        />
      )}

      {documents === undefined ? (
        <SourcesPlaceholder />
      ) : documentList.length === 0 ? (
        <EmptyState
          title="Ingen kilder ennå"
          description="Kildene vises her når du har stilt et spørsmål. Hvert utdrag er et sitat fra et dokument på Kudos, med samme nummer som markøren i svaret."
        />
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
                activeCitationNumber={activeCitationNumber}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
