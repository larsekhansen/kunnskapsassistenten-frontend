import { useCallback, useMemo } from 'react';
import { clampWidth, growthDirection, widthRange, widthStep, type WidthRange } from './resize';
import { useLayout } from './useLayout';
import { useViewportWidth } from './useViewportWidth';
import { defaultLayout, fittedWidths, type SidebarSlot } from './viewModel';

export type PanelWidth = {
  /** What the panel is DRAWN at. See `fittedWidths`. */
  width: number;
  /** How narrow and how wide it may be right now, in this window. */
  range: WidthRange;
  /** `+1` when the panel grows toward the inline end. See `growthDirection`. */
  direction: 1 | -1;
  /**
   * True when the window has nothing left to give: the floor, the ceiling and
   * the width on screen are one number, and no control can change anything.
   */
  fixed: boolean;
  /** Set an absolute width, clamped to `range`. */
  setWidth: (next: number) => void;
  /** Widen (`+1`) or narrow (`-1`) by one step of `widthStep`. */
  step: (towards: 1 | -1) => void;
  /** Back to the width the design draws, which also forgets the stored one. */
  reset: () => void;
};

/**
 * One panel's width, and everything that can change it.
 *
 * Two controls move the same edge — the separator between the panel and the
 * answer column, and the pair of buttons in the panel head — and they have to
 * agree about where the edge is and how far it may go. So the arithmetic is
 * here rather than in either of them.
 *
 * The buttons exist because the separator is not enough on its own: WCAG 2.5.7
 * Dragging Movements (AA) asks that anything operated by a drag can also be
 * operated with a single pointer WITHOUT dragging, and a keyboard does not
 * answer that — that is 2.1.1's question. The people 2.5.7 is for use a
 * pointer and can click; a head pointer, a tremor, a joystick. Found by KA CC
 * reviewing PR #50.
 */
export function usePanelWidth(slot: SidebarSlot): PanelWidth {
  const { layout, setWidth: write } = useLayout();
  const viewport = useViewportWidth();

  const range = widthRange(layout, slot, viewport);
  const width = fittedWidths(layout, viewport)[slot];
  const direction = growthDirection(slot);

  const setWidth = useCallback(
    (next: number) => write(slot, clampWidth(next, range)),
    [write, slot, range],
  );

  return useMemo(
    () => ({
      width,
      range,
      direction,
      fixed: range.min === range.max,
      setWidth,
      step: (towards: 1 | -1) => setWidth(width + towards * widthStep),
      reset: () => {
        const sizing = defaultLayout.slots[slot].sizing;
        if (sizing.mode !== 'flexible') write(slot, sizing.width);
      },
    }),
    [width, range, direction, setWidth, write, slot],
  );
}
