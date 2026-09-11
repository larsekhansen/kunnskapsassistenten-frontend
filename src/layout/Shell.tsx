import { Button, SkipLink } from '@digdir/designsystemet-react';
import { useId, useRef } from 'react';
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

  // «Vis kilder» / «Skjul kilder», «Vis tråder og filter» / «Skjul tråder og
  // filter». Derived from the slot's own name so a moved view takes its
  // wording with it, rather than from a hardcoded string per slot.
  const toggleLabel = `${state.collapsed ? 'Vis' : 'Skjul'} ${(label ?? views[state.activeView].label).toLocaleLowerCase('nb-NO')}`;

  return (
    <Element aria-label={label} className={slot} data-collapsed={state.collapsed || undefined}>
      <Button
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

      <div id={contentId} hidden={state.collapsed} className="sidebar-content">
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
