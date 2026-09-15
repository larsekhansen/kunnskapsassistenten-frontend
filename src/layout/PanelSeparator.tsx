/*
 * `prefer-tag-over-role` wants an `<hr>` wherever `role="separator"` appears,
 * and an `<hr>` is the wrong element here twice over: it is a thematic break
 * between pieces of content, and it cannot hold a tab stop. ARIA 1.2 calls a
 * separator WITH a tab stop the splitter — the resizable one — and that is
 * the whole of what this file builds.
 *
 * The file rather than the line: the rule reports the `role` attribute, which
 * sits in the middle of a sorted attribute list, and a `disable-next-line`
 * pinned there stops working the next time an attribute is added above it.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent,
} from 'react';
import { clampWidth, growthDirection, widthRange, widthStep, widthStride } from './resize';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { defaultLayout, fittedWidths, slotLabel, type SidebarSlot } from './viewModel';

/**
 * The edge between an open panel and the answer column, which the reader can
 * move.
 *
 * Designsystemet has no splitter and no resize handle — checked against the
 * 1.21.0 export list, and written up in
 * design/designsystemet/behov-til-komponent.md — so this is our own, and it
 * gets semantics and a keyboard from the first commit rather than from a
 * follow-up. WCAG 2.5.7 asks that anything a pointer drags can be done
 * without dragging; WCAG 2.1.1 asks that it can be done from the keyboard at
 * all.
 *
 * `role="separator"` with a tab stop is the splitter role: a screen reader
 * announces it, reads `aria-valuenow` as the panel's width in pixels, and
 * says how far it can go. No live region — the value is the announcement, and
 * a second one saying the same thing on every arrow key would talk over the
 * reader.
 *
 * Both edges use one component and the direction is read off the model, in
 * `growthDirection`. A panel that sits before the answer column grows as the
 * pointer moves toward the inline end, one that sits after it shrinks, and
 * neither fact is written down per slot.
 */
export function PanelSeparator({ slot }: { slot: SidebarSlot }) {
  const { layout, setWidth } = useLayout();
  const viewport = useViewportWidth();
  const [dragging, setDragging] = useState(false);
  /** Where the drag started, and the width it started from. */
  const origin = useRef({ x: 0, width: 0 });

  const range = widthRange(layout, slot, viewport);
  const direction = growthDirection(slot);
  // What the panel is DRAWN at, which is what the reader is moving. The model
  // may still be holding a wider number it asked for in a wider window; see
  // `fittedWidths`.
  const width = fittedWidths(layout, viewport)[slot];
  const label = slotLabel(layout, slot) ?? '';

  const resize = (next: number) => setWidth(slot, clampWidth(next, range));

  /**
   * Back to the width the design draws, and the stored one is forgotten with
   * it: `writeStoredLayout` only writes down a width that differs from the
   * default.
   */
  const reset = () => {
    const sizing = defaultLayout.slots[slot].sizing;
    if (sizing.mode !== 'flexible') setWidth(slot, sizing.width);
  };

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Left button and touch and pen; a right-click is a menu, not a drag.
    if (event.button !== 0) return;

    // Stops the browser selecting the text on either side while the pointer
    // travels over it, and stops a touch drag from scrolling the page with
    // the `touch-action: none` in the stylesheet. Focus is then ours to move,
    // and it goes here: the reader has just taken hold of this control, and
    // the arrow keys should carry on from where they let go.
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);

    origin.current = { x: event.clientX, width };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    resize(origin.current.width + direction * (event.clientX - origin.current.x));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // `ArrowLeft` and `ArrowRight` are the platform's names for two keys on
    // the keyboard, like `padding-inline-start` is CSS's name for a side.
    // They are the vendor exception to the naming rule, not our own words for
    // a side of the screen: what they mean here is «move the edge that way»,
    // and which panel grows is `growthDirection`'s business.
    const step = event.shiftKey ? widthStride : widthStep;

    const next = (() => {
      switch (event.key) {
        case 'ArrowLeft':
          return width - direction * step;
        case 'ArrowRight':
          return width + direction * step;
        // Home and End are about the VALUE and not about the screen: Home is
        // the narrowest this panel may be, wherever on the row it sits. That
        // is what a screen reader reports, and it is the only one of the two
        // readings a reader who cannot see the edge can act on.
        case 'Home':
          return range.min;
        case 'End':
          return range.max;
        case 'Enter':
          reset();
          event.preventDefault();
          return undefined;
        default:
          return undefined;
      }
    })();

    if (next === undefined) return;
    // Arrow keys scroll and Home/End jump to the end of the document. The
    // reader is resizing a panel, not leaving it.
    event.preventDefault();
    resize(next);
  }

  return (
    // The rule wants an `<hr>` for anything with `role="separator"`, and an
    // `<hr>` is the wrong element here twice: it is a thematic break between
    // pieces of content, and it cannot be focused. ARIA 1.2 says a separator
    // WITH a tab stop is the splitter — the resizable one — and that is the
    // whole of what this element is.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div
      aria-label={`Endre bredde på ${label.toLocaleLowerCase('nb-NO')}`}
      aria-orientation="vertical"
      aria-valuemax={range.max}
      aria-valuemin={range.min}
      aria-valuenow={width}
      className="panel-separator ds-focus"
      data-before-main={direction === 1 || undefined}
      data-dragging={dragging || undefined}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      onLostPointerCapture={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      role="separator"
      tabIndex={0}
    />
  );
}
