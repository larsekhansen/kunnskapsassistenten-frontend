import { Button, SkipLink } from '@digdir/designsystemet-react';
import { useEffect, useId, useRef } from 'react';
import { Outlet } from 'react-router';
import { PrimarySidebarIcon, SecondarySidebarIcon } from '../components/icons';
import { MainScrollContext } from './scrollContext';
import { useCitation } from './useCitation';
import { useLayout } from './useLayout';
import { viewComponents } from './viewComponents';
import { layoutStyle, slotLabel, views } from './viewModel';

/**
 * The shell: three slots on one row.
 *
 * Slots are named after position — `primary-sidebar`, `main`,
 * `secondary-sidebar` — and never after the content that happens to sit in
 * them today. Views are named after content and can move between slots. Same
 * split VS Code makes, and the rule Lars set on 2026-09-11.
 *
 * Two reasons the slots are not named after the side they sit on today:
 *
 *   1. Screen readers. The accessible name comes from the view in the slot,
 *      via slotLabel(), so moving a view moves its name with it. A name tied
 *      to a side lies the day the panel is moved, and a screen reader user
 *      has no sides to navigate by anyway.
 *   2. The user will be able to choose what sits where. A name tied to
 *      position cannot survive that.
 *
 * Widths come from the layout as CSS custom properties, so CSS never needs to
 * know whether a slot is collapsed. See viewModel.ts and LayoutProvider.tsx.
 */
export function Shell() {
  const { layout } = useLayout();
  // The main slot owns the scroll, so the element is handed to the views
  // rather than looked up from inside them. See scrollContext.ts.
  const mainScroll = useRef<HTMLElement | null>(null);

  return (
    <MainScrollContext value={mainScroll}>
      <SkipLink href="#main-content">Hopp til hovedinnhold</SkipLink>

      <div className="shell" style={layoutStyle(layout)}>
        <Sidebar slot="primary-sidebar" element="nav" />

        <main id="main-content" className="main" ref={mainScroll}>
          {/*
            The route contributes the page's level 1 heading and nothing else;
            the view in the slot is what draws the content, looked up in
            viewComponents like every other slot. Chat used to BE the outlet,
            and that made it the one view no reader could ever move.
          */}
          <Outlet />
          <MainSlot />
        </main>

        <Sidebar slot="secondary-sidebar" element="aside" />
      </div>
    </MainScrollContext>
  );
}

/**
 * One sidebar slot: a collapse button, and the active view under it.
 *
 * The content stays in the DOM when collapsed and is hidden with `hidden`, so
 * the button's `aria-controls` always points at something that exists and
 * `aria-expanded` means what it says.
 */
// The glyph shows which edge the panel sits at, so it is chosen per slot
// rather than per view. See src/components/icons.ts.
const slotIcons = {
  'primary-sidebar': PrimarySidebarIcon,
  'secondary-sidebar': SecondarySidebarIcon,
} as const;

/**
 * The view in the main slot. No collapse button: main is what the sidebars
 * sit beside, and a page with its content collapsed is a blank page.
 */
function MainSlot() {
  const { layout, setCollapsed, setActiveView, isSwitchedByUser } = useLayout();
  const { activeCitation } = useCitation();
  const state = layout.slots.main;
  const ActiveView = viewComponents[state.activeView];

  return (
    <ActiveView
      view={state.activeView}
      collapsed={state.collapsed}
      onCollapsedChange={(collapsed) => setCollapsed('main', collapsed)}
      activeCitationNumber={activeCitation?.number}
      activeCitationNonce={activeCitation?.nonce}
      siblingViews={state.views.filter((id) => id !== state.activeView)}
      onShowView={(view) => setActiveView('main', view)}
      switchedByUser={isSwitchedByUser('main')}
    />
  );
}

function Sidebar({
  slot,
  element: Element,
}: {
  slot: 'primary-sidebar' | 'secondary-sidebar';
  element: 'nav' | 'aside';
}) {
  const { layout, toggleCollapsed, setCollapsed, setActiveView, isSwitchedByUser } = useLayout();
  const { activeCitation } = useCitation();
  const state = layout.slots[slot];
  const contentId = useId();
  const label = slotLabel(layout, slot);
  const ActiveView = viewComponents[state.activeView];
  const Icon = slotIcons[slot];

  const toggle = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);

  /**
   * Whether the keyboard focus is inside this slot's content right now.
   *
   * A ref rather than state: nothing renders differently because of it, and
   * re-rendering a panel on every focus move inside it would be a great many
   * renders for nothing.
   *
   * Cleared only when focus goes somewhere we can name. `relatedTarget` is
   * null when focus is lost to nothing at all, which is precisely what hiding
   * this panel does — so that is the one blur that must NOT clear the flag.
   * It is the case the repair below exists for.
   */
  const holdsFocus = useRef(false);

  /**
   * A collapsing panel must not take the keyboard focus down with it.
   *
   * The slot can be collapsed by something other than the user pressing its
   * own button: below `bothSidebarsMinViewport` only one sidebar may be open,
   * so shrinking or zooming the window past 1440 collapses one of them
   * (LayoutProvider). The content is hidden with `hidden`, the browser blurs
   * whatever was focused inside it, and focus lands on `<body>` — a whole page
   * away from what the user was doing, with the next Tab starting again at the
   * skip link. WCAG 2.4.3. Found by KA CC in review of PR #14, measured at
   * 1536 → 1439 with the focus in the search field of the sources panel.
   *
   * The repair is the same move CONTRIBUTING asks of any control that
   * disappears by its own action: send focus to the thing the action left
   * behind, which here is the button that now says «Vis kilder».
   *
   * This sits in the slot rather than in the provider on purpose. The provider
   * knows WHY a panel closed; only the slot knows whether it was holding the
   * focus, and that is the only question the repair turns on. Written this way
   * it covers every route into a collapse, including ones nobody has built
   * yet, rather than the one route review happened to find.
   */
  useEffect(() => {
    if (!state.collapsed || !holdsFocus.current) return;

    // Both readings mean the same thing — focus is gone — and which one the
    // browser leaves behind depends on whether it has recalculated style yet.
    // Anything else means focus has moved somewhere real and is not ours to
    // take back.
    const active = document.activeElement;
    const lost = active === null || active === document.body || content.current?.contains(active);
    if (!lost) return;

    holdsFocus.current = false;
    toggle.current?.focus();
  }, [state.collapsed]);

  // «Vis kilder» / «Skjul kilder», «Vis tråder og filter» / «Skjul tråder og
  // filter». Derived from the slot's own name so a moved view takes its
  // wording with it, rather than from a hardcoded string per slot.
  const toggleLabel = `${state.collapsed ? 'Vis' : 'Skjul'} ${(label ?? views[state.activeView].label).toLocaleLowerCase('nb-NO')}`;

  return (
    <Element aria-label={label} className={slot} data-collapsed={state.collapsed || undefined}>
      <Button
        ref={toggle}
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        aria-expanded={!state.collapsed}
        aria-controls={contentId}
        onClick={() => toggleCollapsed(slot)}
      >
        <Icon aria-hidden />
        {toggleLabel}
      </Button>

      {/*
        onFocus and onBlur are React's focusin and focusout, which bubble, so
        this pair is «does the focus sit anywhere inside me». They are here to
        observe, not to handle an interaction: nothing about this container is
        clickable and no keyboard handler belongs on it.
      */}
      <div
        id={contentId}
        ref={content}
        hidden={state.collapsed}
        className="sidebar-content"
        onFocus={() => {
          holdsFocus.current = true;
        }}
        onBlur={(event) => {
          if (event.relatedTarget) holdsFocus.current = false;
        }}
      >
        <ActiveView
          view={state.activeView}
          collapsed={state.collapsed}
          onCollapsedChange={(collapsed) => setCollapsed(slot, collapsed)}
          activeCitationNumber={activeCitation?.number}
          activeCitationNonce={activeCitation?.nonce}
          siblingViews={state.views.filter((id) => id !== state.activeView)}
          onShowView={(view) => setActiveView(slot, view)}
          switchedByUser={isSwitchedByUser(slot)}
        />
      </div>
    </Element>
  );
}
