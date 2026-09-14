import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { emptyFilterSelection, type FilterSelection, type SourceDocument } from '../model';
import { AnswerSourcesContext } from './answerSourcesContext';
import { CitationContext, type ActiveCitation } from './citationContext';
import { FilterContext } from './filterContext';
import { LayoutContext } from './layoutContext';
import { useNarrowViewport } from './useNarrowViewport';
import {
  defaultLayout,
  otherSidebar,
  withActiveView,
  withCollapsed,
  withOneSidebarOpen,
  withViewMoved,
  withWidth,
  yieldingSidebar,
  type Layout,
  type Slot,
  type ViewId,
} from './viewModel';

/**
 * Holds the layout: which view is active in each slot, whether a slot is
 * collapsed, and how wide the slots are.
 *
 * The operations are the ones a layout UI would need — switch view, collapse,
 * resize, move a view between slots — and they exist before that UI does, on
 * purpose (answers 10 and 48). Nothing here persists yet: a reload returns to
 * `defaultLayout`.
 *
 * It also holds the pieces of state that two views have to agree on and
 * therefore neither can own: the active citation, the document filter, and
 * the sources behind the answer on screen. See citationContext.ts,
 * filterContext.ts and answerSourcesContext.ts.
 *
 * And it owns one rule about the window: below `bothSidebarsMinViewport` only
 * one sidebar can be open at a time, so opening one collapses the other.
 * Decision 2026-09-14, option B. It lives here rather than in CSS because it
 * changes collapsed state, which the buttons report; see useNarrowViewport.ts.
 */
export function LayoutProvider({
  children,
  initialLayout = defaultLayout,
}: {
  children: ReactNode;
  initialLayout?: Layout;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const narrow = useNarrowViewport();
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | undefined>(undefined);
  const [selection, setSelection] = useState<FilterSelection>(emptyFilterSelection);
  const [answerDocuments, setAnswerDocuments] = useState<SourceDocument[] | undefined>(undefined);
  // The view the user last switched each slot to. Empty on a page load, which
  // is the whole point: a view that mounts because the default layout opened
  // on it must not take focus off the skip link.
  const [switchedTo, setSwitchedTo] = useState<Partial<Record<Slot, ViewId>>>({});

  const setActiveView = useCallback((slot: Slot, view: ViewId) => {
    setLayout((current) => withActiveView(current, slot, view));
    setSwitchedTo((current) => ({ ...current, [slot]: view }));
  }, []);
  /**
   * Collapse or open a slot, and keep the one-sidebar rule while doing it.
   *
   * Opening is the only direction that can break the rule, and the slot being
   * opened is the one that wins: the user asked for it, so the other sidebar
   * is what gives. `main` is not a sidebar and never takes part.
   */
  const fitted = useCallback(
    (current: Layout, slot: Slot, collapsed: boolean): Layout => {
      const next = withCollapsed(current, slot, collapsed);
      if (collapsed || !narrow || slot === 'main') return next;
      return withOneSidebarOpen(next, slot);
    },
    [narrow],
  );

  /**
   * The window just got too narrow for both. The sources panel is the one that
   * gives — it is opened to check a citation, while the navigation panel is
   * where the conversation is steered from.
   *
   * Adjusted during render with a remembered previous value, not in an effect.
   * React re-runs the component with the new state before it commits anything,
   * so the sidebar is never painted open in a window that cannot hold it; an
   * effect would have shown it for a frame and then taken it away.
   *
   * Only on the crossing, hence the guard. Running it on every render would
   * make the rule mean «below 1440 the sources panel cannot be open», which is
   * a different rule: the user is still allowed to open it down there, and
   * doing so collapses the navigation panel instead.
   *
   * Growing back is deliberately not the mirror image. The rule takes a panel
   * away when there is no room; it does not hand one back, because a panel
   * that opened itself would undo a choice the user made.
   */
  // Starts false rather than at `narrow`, so a first render in a window that
  // is ALREADY narrow applies the rule as well. `initialLayout` is an argument
  // and cannot be assumed to obey a rule about the window it will be drawn in.
  const [appliedForNarrow, setAppliedForNarrow] = useState(false);
  if (narrow !== appliedForNarrow) {
    setAppliedForNarrow(narrow);
    if (narrow) {
      setLayout((current) => withOneSidebarOpen(current, otherSidebar(yieldingSidebar)));
    }
  }

  const setCollapsed = useCallback(
    (slot: Slot, collapsed: boolean) => setLayout((current) => fitted(current, slot, collapsed)),
    [fitted],
  );
  const toggleCollapsed = useCallback(
    (slot: Slot) => setLayout((current) => fitted(current, slot, !current.slots[slot].collapsed)),
    [fitted],
  );
  const setWidth = useCallback(
    (slot: Slot, width: number) => setLayout((current) => withWidth(current, slot, width)),
    [],
  );
  const moveView = useCallback(
    (view: ViewId, target: Slot) => setLayout((current) => withViewMoved(current, view, target)),
    [],
  );

  // Asking to see a citation opens the panel it lives in. Nothing is gained
  // by pointing at an excerpt behind a collapsed panel.
  //
  // Through `fitted` like every other opening, so a narrow window collapses
  // the navigation panel here too. A citation is a request to open a sidebar;
  // where the request came from changes nothing about whether it fits.
  const showCitation = useCallback(
    (number: number) => {
      setActiveCitation((current) => ({ number, nonce: (current?.nonce ?? 0) + 1 }));
      setLayout((current) => fitted(current, 'secondary-sidebar', false));
    },
    [fitted],
  );

  // Compared against the active view, not just read: `withActiveView` ignores
  // a view that does not sit in the slot, and a request that changed nothing
  // must not claim focus.
  const isSwitchedByUser = useCallback(
    (slot: Slot) => switchedTo[slot] === layout.slots[slot].activeView,
    [switchedTo, layout],
  );

  const value = useMemo(
    () => ({
      layout,
      setActiveView,
      setCollapsed,
      toggleCollapsed,
      setWidth,
      moveView,
      isSwitchedByUser,
    }),
    [layout, setActiveView, setCollapsed, toggleCollapsed, setWidth, moveView, isSwitchedByUser],
  );

  const citation = useMemo(
    () => ({ activeCitation, showCitation }),
    [activeCitation, showCitation],
  );

  const filter = useMemo(() => ({ selection, setSelection }), [selection]);

  const answerSources = useMemo(
    () => ({ documents: answerDocuments, setDocuments: setAnswerDocuments }),
    [answerDocuments],
  );

  return (
    <LayoutContext value={value}>
      <CitationContext value={citation}>
        <FilterContext value={filter}>
          <AnswerSourcesContext value={answerSources}>{children}</AnswerSourcesContext>
        </FilterContext>
      </CitationContext>
    </LayoutContext>
  );
}
