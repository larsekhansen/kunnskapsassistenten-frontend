import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { emptyFilterSelection, type FilterSelection } from '../model';
import { CitationContext, type ActiveCitation } from './citationContext';
import { FilterContext } from './filterContext';
import { LayoutContext } from './layoutContext';
import {
  defaultLayout,
  withActiveView,
  withCollapsed,
  withViewMoved,
  withWidth,
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
 * It also holds the two pieces of state that two views have to agree on and
 * therefore neither can own: the active citation and the document filter. See
 * citationContext.ts and filterContext.ts.
 */
export function LayoutProvider({
  children,
  initialLayout = defaultLayout,
}: {
  children: ReactNode;
  initialLayout?: Layout;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | undefined>(undefined);
  const [selection, setSelection] = useState<FilterSelection>(emptyFilterSelection);
  // The view the user last switched each slot to. Empty on a page load, which
  // is the whole point: a view that mounts because the default layout opened
  // on it must not take focus off the skip link.
  const [switchedTo, setSwitchedTo] = useState<Partial<Record<Slot, ViewId>>>({});

  const setActiveView = useCallback((slot: Slot, view: ViewId) => {
    setLayout((current) => withActiveView(current, slot, view));
    setSwitchedTo((current) => ({ ...current, [slot]: view }));
  }, []);
  const setCollapsed = useCallback(
    (slot: Slot, collapsed: boolean) =>
      setLayout((current) => withCollapsed(current, slot, collapsed)),
    [],
  );
  const toggleCollapsed = useCallback(
    (slot: Slot) =>
      setLayout((current) => withCollapsed(current, slot, !current.slots[slot].collapsed)),
    [],
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
  const showCitation = useCallback((number: number) => {
    setActiveCitation((current) => ({ number, nonce: (current?.nonce ?? 0) + 1 }));
    setLayout((current) => withCollapsed(current, 'secondary-sidebar', false));
  }, []);

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

  return (
    <LayoutContext value={value}>
      <CitationContext value={citation}>
        <FilterContext value={filter}>{children}</FilterContext>
      </CitationContext>
    </LayoutContext>
  );
}
