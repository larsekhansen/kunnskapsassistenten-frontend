import { Button, Heading } from '@digdir/designsystemet-react';
import { useEffect, useMemo, useState } from 'react';
import type { SourceDocument } from '../../model';
import { ExcerptSearch } from './ExcerptSearch';
import { SourceDocumentCard } from './SourceDocumentCard';
import { SourcesEmpty } from './SourcesEmpty';
import { SourcesOverview } from './SourcesOverview';
import { SourcesPlaceholder } from './SourcesPlaceholder';
import { SOURCES_PANEL_ID, documentDomId, excerptDomId } from './ids';
import { type SearchHit, buildSearchIndex, findHits, stepHit } from './search';
import type { SourcesViewProps } from './types';
import './sources.css';

/**
 * Scroll to an element and put the keyboard there.
 *
 * Focus matters as much as the scroll: it is what makes a screen reader read
 * the excerpt the user just jumped to, and it is what makes the next Tab
 * continue from there instead of from the top of the panel. `preventScroll`
 * keeps the browser's own focus scroll from cutting the smooth scroll short.
 */
function reveal(domId: string) {
  const element = document.getElementById(domId);
  if (element === null) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  element.focus({ preventScroll: true });
}

/** Wait one frame, so state that opens an excerpt has been laid out first. */
function revealNextFrame(domId: string) {
  requestAnimationFrame(() => reveal(domId));
}

function findExcerptById(documents: SourceDocument[], excerptId: string) {
  return documents.flatMap((document) => document.excerpts).find((it) => it.id === excerptId);
}

/** Scroll to whichever excerpt holds this hit. */
function revealHit(documents: SourceDocument[], hit: SearchHit | undefined) {
  if (hit === undefined) return;

  const excerpt = findExcerptById(documents, hit.itemId);
  if (excerpt !== undefined) revealNextFrame(excerptDomId(excerpt.citationNumber));
}

/**
 * The sources view: the content of the secondary sidebar (answer 49).
 *
 * Collapsed it is a single button; open it is the search, the shortcut list,
 * and one card per document with the excerpts grouped under it (answer 57).
 *
 * Three states, not two:
 *
 *   documents === undefined   loading, `excerpts-placeholder` from Figma
 *   documents.length === 0    no answer yet, a sentence (answer 36)
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
  collapsed,
  onCollapsedChange,
  activeCitationNumber,
  activeCitationNonce,
}: SourcesViewProps) {
  // Collapsed state lives in the layout when the layout passes it in, and here
  // when it does not, so the view also works on its own.
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const isCollapsed = collapsed ?? ownCollapsed;

  const [query, setQuery] = useState('');
  const [currentHitIndex, setCurrentHitIndex] = useState(0);
  const [openExcerptIds, setOpenExcerptIds] = useState<ReadonlySet<string>>(new Set());

  const documentList = useMemo(() => documents ?? [], [documents]);
  const searchIndex = useMemo(() => buildSearchIndex(documentList), [documentList]);
  const hits = useMemo(() => findHits(searchIndex, query), [searchIndex, query]);
  const currentHit = hits[currentHitIndex];

  // A `[n]` marker in the answer is an event we do not own — it arrives as a
  // prop — so the excerpt is opened while rendering the change, which is
  // React's documented way to adjust state when a prop changes. The scroll
  // itself is a separate effect, because it has to happen after the layout.
  //
  // Both halves are compared, not just the nonce: the number alone covers a
  // caller that sends no nonce, and it covers mounting with a marker already
  // set, which a nonce-only comparison would miss because both sides start
  // undefined. The nonce is what makes a second click on the SAME marker count
  // as a new event (answer 19).
  const [handled, setHandled] = useState<{ number?: number; nonce?: number } | undefined>(
    undefined,
  );
  if (handled?.number !== activeCitationNumber || handled?.nonce !== activeCitationNonce) {
    setHandled({ number: activeCitationNumber, nonce: activeCitationNonce });

    const target = documentList
      .flatMap((document) => document.excerpts)
      .find((excerpt) => excerpt.citationNumber === activeCitationNumber);

    if (target !== undefined && !openExcerptIds.has(target.id)) {
      setOpenExcerptIds(new Set(openExcerptIds).add(target.id));
    }
  }

  useEffect(() => {
    if (activeCitationNumber === undefined) return;
    revealNextFrame(excerptDomId(activeCitationNumber));
  }, [activeCitationNumber, activeCitationNonce]);

  function setCollapsed(next: boolean) {
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
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
   * A new query restarts at the first hit and opens every excerpt that has
   * one. Opening them is the point of the counter: «3 av 26 treff» means
   * nothing if the matches sit behind closed toggles. The user can close them
   * again afterwards.
   */
  function changeQuery(next: string) {
    const nextHits = findHits(searchIndex, next);

    setQuery(next);
    setCurrentHitIndex(0);
    setOpenExcerptIds((previous) => new Set([...previous, ...nextHits.map((hit) => hit.itemId)]));
    revealHit(documentList, nextHits[0]);
  }

  function stepToHit(step: 1 | -1) {
    const next = stepHit(hits.length, currentHitIndex, step);
    setCurrentHitIndex(next);
    revealHit(documentList, hits[next]);
  }

  const toggle = (
    <Button
      type="button"
      variant="tertiary"
      data-color="neutral"
      aria-expanded={!isCollapsed}
      // Only while the panel exists: `aria-controls` pointing at an id that
      // is not in the document is a dangling reference.
      aria-controls={isCollapsed ? undefined : SOURCES_PANEL_ID}
      onClick={() => setCollapsed(!isCollapsed)}
    >
      {isCollapsed ? 'Vis kilder' : 'Skjul kilder'}
    </Button>
  );

  if (isCollapsed) {
    return <div className="sources-view sources-view--collapsed">{toggle}</div>;
  }

  return (
    <div className="sources-view" id={SOURCES_PANEL_ID}>
      {/* The slot's accessible name already says «Kilder»; this heading is what
          the document titles below hang off. It is not drawn in Figma, so it is
          not drawn here either. */}
      <Heading level={2} className="ds-sr-only">
        Kilder
      </Heading>

      <div className="sources-view__toggle">{toggle}</div>

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
        <SourcesEmpty />
      ) : (
        <>
          <SourcesOverview
            documents={documentList}
            onNavigateToDocument={(documentId) => reveal(documentDomId(documentId))}
          />

          <div className="sources-documents">
            {documentList.map((document) => (
              <SourceDocumentCard
                key={document.id}
                document={document}
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
