import { Badge, BadgePosition, Button, SkipLink, Tooltip } from '@digdir/designsystemet-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Outlet } from 'react-router';
import { PrimarySidebarIcon, SecondarySidebarIcon } from '../components/icons';
import { ComposerContext } from './composerContext';
import { COMPOSER_ID } from './ids';
import { PanelSeparator } from './PanelSeparator';
import { PanelWidthButtons } from './PanelWidthButtons';
import { OpenThreadContext } from './openThreadContext';
import { MainScrollContext } from './scrollContext';
import { useAnswerSources } from './useAnswerSources';
import { useNoAnswers } from './useNoAnswers';
import { useOpenThreadRegistry } from './useOpenThread';
import { useCitation } from './useCitation';
import { useComposerRegistry } from './useComposerPresence';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { ViewHeadContext, type ViewHeadContextValue } from './viewHeadContext';
import { viewComponents } from './viewComponents';
import { layoutStyle, slotLabel, views } from './viewModel';

export type ShellProps = {
  /**
   * The route draws the main slot itself, and the view that normally sits
   * there stands down. For pages that are not a conversation at all; see
   * src/routes/NotFound.tsx.
   */
  routeOwnsMain?: boolean;
};

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
export function Shell({ routeOwnsMain = false }: ShellProps) {
  const { layout } = useLayout();
  /*
   * A panel's drawn width depends on the window as well as on the layout: a
   * panel dragged wider than this window can hold is drawn at what fits. See
   * `fittedWidths` in viewModel.ts.
   */
  const viewport = useViewportWidth();
  // The main slot owns the scroll, so the element is handed to the views
  // rather than looked up from inside them. See scrollContext.ts.
  const mainScroll = useRef<HTMLElement | null>(null);

  // No conversation on this page, so nothing will ever report sources. The
  // panel has to be told, or it draws the skeletons for an answer that is not
  // coming. See useNoAnswers.ts.
  useNoAnswers(routeOwnsMain);

  /**
   * Whether the views below have a compose field on screen, for the second
   * skip link. See composerContext.ts for why the shell has to be told rather
   * than work it out from the route.
   *
   * Held here and not in `LayoutProvider`, because the question is about what
   * is on screen in THIS shell and the provider outlives it: the two layout
   * routes in App.tsx mount separate shells, and a count kept above them
   * would carry a field from the page being left over to the page being
   * entered.
   */
  const composerPresence = useComposerRegistry();

  /**
   * Which conversation is on screen, for the thread list's `aria-current`.
   *
   * Held here for the same reason as the compose field above: the question is
   * about what is on screen in THIS shell, and the two layout routes mount
   * separate shells. See openThreadContext.ts for why the router cannot
   * answer it.
   */
  const openThread = useOpenThreadRegistry();

  /**
   * The view head of the answer column. Held here rather than in a component
   * of its own, because the box is drawn inside `<main>` and the provider has
   * to wrap what comes after it.
   */
  const [mainHead, mainHeadRef] = useViewHeadBox(mainScroll);

  return (
    <MainScrollContext value={mainScroll}>
      <SkipLink href="#main-content">Hopp til hovedinnhold</SkipLink>
      {/*
        The second skip link, and the one that earns its keep every turn.
        «Hopp til hovedinnhold» lands at the top of the answer; the compose
        field is at the BOTTOM of it, and reaching it by keyboard was tab stop
        22 — for the thing a reader does more often than anything else. Reise
        7 and 15 in design/brukerreiser-2026-09-15.md, punkt 8 on the ranked
        list. #3 asked for it; #41 put the id where both sides can read it.

        Drawn only while a compose field is actually mounted, which is a
        question only the view holding the conversation can answer — it says
        so through `ComposerContext`. It used to be drawn whenever the route
        did not draw its own main, and those are different questions: on
        `/threads/<ukjent>` the chat view draws «Fant ikke tråden» in a main
        slot the route did not draw, and the link pointed at nothing.

        `COMPOSER_ID` comes from ids.ts rather than from the chat view, so the
        shell never imports a view to build its own chrome.
      */}
      {composerPresence.hasComposer ? (
        <SkipLink href={`#${COMPOSER_ID}`}>Hopp til skrivefeltet</SkipLink>
      ) : null}

      <ComposerContext value={composerPresence}>
        <OpenThreadContext value={openThread}>
          <div className="shell" style={layoutStyle(layout, viewport)}>
            <Sidebar slot="primary-sidebar" element="nav" />

            <main id="main-content" className="main" ref={mainScroll}>
              {/*
              The answer column's view head. First in the region, so nothing
              the reader can reach ends up underneath it when it pins — which
              is the whole reason the shell owns the place rather than the
              view. The search strip in the answer (#60) is what asked for it:
              it sits at the bottom of the answer card and scrolls out of
              sight exactly when a hit is found at the top.

              Empty until a view fills it, and an empty head draws no line.
            */}
              <div className="view-head" ref={mainHeadRef} />

              {/*
              The route contributes the page's level 1 heading and nothing
              else; the view in the slot is what draws the content, looked up
              in viewComponents like every other slot. Chat used to BE the
              outlet, and that made it the one view no reader could ever move.

              `routeOwnsMain` is the one exception, and it is about pages
              rather than about views: the catch-all route draws its own main,
              because «siden finnes ikke» with a working conversation under it
              would be two answers to one question. The sidebars stay: the
              thread list and the filter are still there to steer to somewhere
              that exists.
            */}
              <ViewHeadContext value={mainHead}>
                <Outlet />
                {routeOwnsMain ? null : <MainSlot />}
              </ViewHeadContext>
            </main>

            <Sidebar slot="secondary-sidebar" element="aside" />
          </div>
        </OpenThreadContext>
      </ComposerContext>
    </MainScrollContext>
  );
}

/**
 * The shell's end of the view head: the box, and the context a view renders
 * into it through.
 *
 * State and not a ref, because the view has to render again once the box
 * exists. React runs the ref callback during the commit and flushes the state
 * it sets before paint, so the extra render costs a render and not a frame.
 *
 * Why the shell holds the box at all, rather than each view pinning its own
 * head: viewHeadContext.ts, with the measurement from #55.
 */
function useViewHeadBox(
  scroller: RefObject<HTMLElement | null>,
): [ViewHeadContextValue, (element: HTMLDivElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ element }), [element]);

  /*
   * Keep the region from scrolling things underneath its own head.
   *
   * `scrollIntoView` and the scroll the browser does when something takes
   * focus both stop at the top of the scrollport, which is exactly where the
   * head is pinned. So a `[n]` marker sent to an excerpt, or a Tab onto a
   * facet field further down, lands behind it: the reader is told they are
   * somewhere they cannot see, and the focus ring is invisible. WCAG 2.4.11.
   *
   * `scroll-padding-block-start` moves that stopping line down by the head's
   * height. Measured rather than written down, because the head is the view's
   * and changes with it — the sources panel grows an answer selector with the
   * second answer, the filter panel's corpus line wraps to two lines in a
   * narrow panel. Zero when the head is empty, since `.view-head:empty` is
   * `display: none` and an element that is not drawn has no height.
   *
   * The same repair the compose field makes at the other end of the same
   * element (`scrollPaddingBlockEnd` in views/chat/ChatView.tsx). Two
   * properties, no argument between them.
   */
  useEffect(() => {
    const region = scroller.current;
    if (element === null || region === null) return;
    // jsdom has no ResizeObserver, and nothing there scrolls or paints. The
    // stub belongs in the tests that need the views' own observers, not here.
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      region.style.scrollPaddingBlockStart = `${Math.round(element.offsetHeight)}px`;
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      region.style.scrollPaddingBlockStart = '';
    };
  }, [element, scroller]);

  return [value, setElement];
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
  const element = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);

  /**
   * This slot's view head. Outside `ActiveView`, so switching between the two
   * views in a slot does not take the box away and put a new one back — the
   * view that mounts finds the place already there.
   */
  const [viewHead, viewHeadRef] = useViewHeadBox(content);

  /**
   * Whether the keyboard focus is anywhere inside this slot — the toggle
   * button as well as the content.
   *
   * State rather than a ref, and that is the part that matters: the repair
   * below has to know whether the slot held focus BEFORE the change it is
   * reacting to, and an effect closes over the value from the render it
   * belongs to. A ref would be read after the commit, by which time a blur
   * fired by the browser's own tidying may already have cleared it — and
   * whether that blur fires at all is a browser detail this should not rest
   * on. `setHasFocus` with an unchanged value costs nothing; React bails out.
   *
   * Cleared only when focus actually leaves the slot. A null `relatedTarget`
   * means focus went nowhere, which counts as leaving: a programmatic `blur()`
   * or a click on dead space really does end with the slot holding nothing,
   * and treating that as «still ours» is what made an earlier version steal
   * focus on the next resize from a user who had not touched the panel.
   * Measured 2026-09-15.
   */
  const [hasFocus, setHasFocus] = useState(false);

  /**
   * Changing this slot must not drop the keyboard focus on the floor.
   *
   * Two different ways it happens, and one repair for both:
   *
   *   1. Collapsing hides the content with `hidden`, the browser blurs
   *      whatever was focused inside it, and focus lands on `<body>`. The
   *      slot can be collapsed without the user asking — below
   *      `bothSidebarsMinViewport` only one sidebar may be open, so shrinking
   *      or zooming the window past 1440 collapses one of them. Found by
   *      KA CC reviewing PR #14, measured at 1536 → 1439 with the focus in
   *      the sources panel's search field.
   *   2. The toggle button itself is REPLACED when the slot collapses or
   *      opens: collapsed it is wrapped in a Tooltip, and a wrapper appearing
   *      around an element is a different element to React, so the old button
   *      is unmounted and a new one mounted. The user pressed that button and
   *      the DOM node they were standing on stops existing. Measured
   *      2026-09-15, when the rail wrapped it for the first time.
   *
   * Either way the next Tab would start again at the skip link, a whole page
   * away from what the user was doing. WCAG 2.4.3.
   *
   * The repair is the move CONTRIBUTING asks of any control that disappears
   * by its own action: send focus to what the action left behind, which here
   * is the toggle button in its new state.
   *
   * This sits in the slot rather than in the provider on purpose. The provider
   * knows WHY a panel closed; only the slot knows whether it was holding the
   * focus, and that is the only question the repair turns on. Written this way
   * it covers every route into a collapse, including ones nobody has built
   * yet, rather than the one route review happened to find.
   */
  useLayoutEffect(() => {
    if (!hasFocus) return;

    // Four readings of the same thing — the focus this slot had is gone — and
    // which one is true depends on how far the browser has got.
    //
    //   null / body     focus is nowhere, the usual end state
    //   not connected   the replaced button: some browsers keep reporting a
    //                   detached node as active
    //   inside hidden   the browser has not recalculated style yet, so focus
    //                   is still sitting on an element that is now display:
    //                   none. This one is not belt and braces: a layout
    //                   effect runs before that recalculation, and without
    //                   this clause the repair measured BODY a moment too
    //                   late and did nothing. 2026-09-15.
    //
    // The last clause asks about the CONTENT, not the whole slot, and is
    // gated on `collapsed`. Asking about the slot would also be true of a
    // panel the user had simply tabbed into, and this effect now runs on
    // focus changes as well as on collapse.
    const active = document.activeElement;
    const lost =
      active === null ||
      active === document.body ||
      !active.isConnected ||
      (state.collapsed && (content.current?.contains(active) ?? false));
    if (!lost) return;

    toggle.current?.focus();
  }, [hasFocus, state.collapsed]);

  // «Vis kilder» / «Skjul kilder», «Vis tråder og filter» / «Skjul tråder og
  // filter». Derived from the slot's own name so a moved view takes its
  // wording with it, rather than from a hardcoded string per slot.
  const toggleLabel = `${state.collapsed ? 'Vis' : 'Skjul'} ${(label ?? views[state.activeView].label).toLocaleLowerCase('nb-NO')}`;

  /**
   * How many documents the folded-away view is holding, for the badge.
   *
   * Keyed on the VIEW and not on the slot: the count belongs to the sources,
   * so it follows them if they are ever moved to the other sidebar. A slot
   * does not have sources; whatever sits in it might.
   */
  const { documents } = useAnswerSources();
  const sourceCount = state.activeView === 'sources' ? (documents?.length ?? 0) : 0;
  const showBadge = state.collapsed && sourceCount > 0;

  /**
   * «Vis kilder, 3 dokumenter».
   *
   * The number has to be in the text, because the badge cannot carry it:
   * Designsystemet draws it as `content: attr(data-count)` on a pseudo
   * element, which screen readers read unreliably or not at all. See
   * design/designsystemet/komponenter/badge.md.
   *
   * One string for both the accessible name and the tooltip, which is not
   * tidiness: @digdir/designsystemet-web writes `data-tooltip` into
   * `aria-label` on an element with no text of its own, so a tooltip saying
   * something shorter would quietly replace the name a moment after render.
   */
  const toggleName = showBadge
    ? `${toggleLabel}, ${sourceCount} ${sourceCount === 1 ? 'dokument' : 'dokumenter'}`
    : toggleLabel;

  /*
   * Collapsed, the slot is a rail barely wider than this button, so the label
   * cannot be drawn beside the icon and becomes the accessible name instead.
   * Open, the panel has room and the words are better on screen than hidden
   * behind a hover.
   *
   * The name is the same string either way, which is the point: a screen
   * reader user hears «Vis tråder og filter» in both states, and only the
   * sighted presentation changes.
   */
  const toggleButton = (
    <Button
      ref={toggle}
      variant="tertiary"
      data-color="neutral"
      data-size="sm"
      icon={state.collapsed || undefined}
      aria-label={state.collapsed ? toggleName : undefined}
      aria-expanded={!state.collapsed}
      aria-controls={contentId}
      onClick={() => toggleCollapsed(slot)}
    >
      <Icon aria-hidden />
      {state.collapsed ? null : toggleLabel}
    </Button>
  );

  return (
    <Element
      ref={element}
      aria-label={label}
      className={slot}
      data-collapsed={state.collapsed || undefined}
      /*
        React's focusin and focusout, which bubble, so this pair answers «does
        the focus sit anywhere inside me». Here to observe, not to handle an
        interaction: nothing about this landmark is clickable and no keyboard
        handler belongs on it.
      */
      onFocus={() => setHasFocus(true)}
      onBlur={(event) => {
        if (!element.current?.contains(event.relatedTarget)) setHasFocus(false);
      }}
    >
      {/*
        Designsystemet's Tooltip renders no box of its own: it sets
        `data-tooltip` on its child, and the custom element in
        @digdir/designsystemet-web draws it. See
        design/designsystemet/komponenter/tooltip.md.

        That package ALSO reads `data-tooltip` into an accessible name — it
        writes `aria-label` when the element has no text and `aria-description`
        when it has (`tooltip.ts:83-84`), so a collapsed rail button would get
        its name from the tooltip whether or not we set one.

        The explicit `aria-label` on the button stays anyway, and not as belt
        and braces: it is the name from first render, while the web package's
        MutationObserver only gets there a tick later, and it is the name even
        if that package never loads — it is an indirect dependency, pulled in
        by whichever Designsystemet component happens to import it. Both
        strings are the same, so the two never disagree.
      */}
      {/*
        The panel head does not scroll; the content under it does.

        Without that, the toggle button rides the panel's own scrolling. Click
        a `[n]` marker and the sources panel scrolls 987 px to the excerpt at
        1440, taking «Skjul kilder» to y = −955 — a screen above the top of the
        window — so the panel has no visible way to close itself and the user
        has to scroll back up to find out where it went. The navigation panel
        does the same at 991 px of content in a 900 px window. Finding 2 in
        docs/review/brukerblikk-2026-09-15.md.
      */}
      {/*
        The panel's own box. It carries the surface, the border, the padding
        and the clipping; the landmark around it carries the width and the
        separator.

        The separator has to be inside the landmark — content outside every
        landmark is an axe `region` violation, and a control a reader can
        reach is content (KA CC, measured on four routes after #50). It cannot
        be inside THIS box: `overflow: hidden` would cut its focus ring off,
        and the scrolling region below it puts a scrollbar exactly where the
        grip goes. So the landmark holds both, and this element is what makes
        that possible.
      */}
      <div className="panel">
        <div className="sidebar-header">
          {/*
          The collapse button, and — while the panel is open — the two buttons
          that move its edge a step at a time. Those are the pointer path WCAG
          2.5.7 asks for beside the drag; see PanelWidthButtons.tsx.
        */}
          {state.collapsed ? (
            /*
            BadgePosition is rendered whether or not there is a badge, on
            purpose. It is a `<span>` wrapper, and a wrapper appearing around
            the button is a different element to React — the button would be
            unmounted and replaced the moment an answer brought sources, with
            the user's focus possibly on it. Rendering the wrapper always means
            only the badge comes and goes, and the button beside it stays put.

            Tooltip has to sit INSIDE it, directly around the button: Tooltip
            sets `data-tooltip` on its own child, and on the wrapper that would
            put the tooltip and the accessible name on a span instead of on the
            control.
          */
            <BadgePosition placement="top-right" overlap="rectangle">
              {showBadge ? (
                <Badge count={sourceCount} maxCount={99} data-size="sm" aria-hidden />
              ) : null}
              <Tooltip content={toggleName}>{toggleButton}</Tooltip>
            </BadgePosition>
          ) : (
            toggleButton
          )}
          {state.collapsed ? null : <PanelWidthButtons slot={slot} />}
        </div>

        <div id={contentId} ref={content} hidden={state.collapsed} className="sidebar-content">
          {/*
            The view head, and it is FIRST in the scrolling region on purpose.

            A pinned head covers whatever is above it in the same scrolling
            box, and «above» includes the tab order: the browser scrolls a
            focused control into view at the top of the region, which is
            precisely where the head is. That is what #55 measured — a head
            pinned under the «Tråder» button took the clicks meant for it —
            and it is why the place is the shell's rather than each view's.
            Put the head first and there is nothing above it to cover; a view
            that wants its own button to stay put puts the button IN the head.

            Empty until a view fills it, and an empty head draws no line.
          */}
          <div className="view-head" ref={viewHeadRef} />

          <ViewHeadContext value={viewHead}>
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
          </ViewHeadContext>
        </div>
      </div>

      {/*
        The edge this panel shares with the answer column. One per OPEN panel:
        a rail has a fixed width and nothing to drag, and a tab stop that
        cannot do anything is a tab stop in the way.

        An open panel is not on its own enough — the separator drops itself
        when the WINDOW has no room to give either, which is the state at
        1440 with both sidebars open. That test needs the width range, so it
        lives in the component rather than here. Same for the width buttons
        above. See PanelSeparator.tsx.

        Inside the landmark, beside the panel box rather than in it. What it
        resizes is this slot, so this is where it belongs — and it is also
        what the `region` rule asks: a control outside every landmark is
        content nobody can navigate to by landmark.
      */}
      {state.collapsed ? null : <PanelSeparator slot={slot} />}
    </Element>
  );
}
