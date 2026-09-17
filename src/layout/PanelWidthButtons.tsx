import { Button, Tooltip } from '@digdir/designsystemet-react';
import type { ReactNode } from 'react';
import { InlineEndIcon, InlineStartIcon } from '../components/icons';
import { usePanelWidth } from './usePanelWidth';
import { slotLabel, type SidebarSlot } from './viewModel';
import { useLayout } from './useLayout';

/**
 * «Smalere» and «Bredere» in the panel head: the same edge the separator
 * moves, one step per click.
 *
 * This is the pointer path WCAG 2.5.7 Dragging Movements (AA) asks for. The
 * separator answers 2.1.1 with its arrow keys, and the two criteria are not
 * the same question: 2.5.7 is about POINTER input, and says that anything
 * operated by dragging must also be operable with a single pointer without a
 * drag. A keyboard does not satisfy it — the people it is written for use a
 * pointer and can click, but cannot hold and travel: a head pointer, a
 * tremor, a joystick. An 8 px grip is hard to drag for more of them than
 * that. Found by KA CC reviewing PR #50; the exception for an «essential»
 * drag does not apply, because a width can be set with buttons.
 *
 * Drawn only while the panel is open. A rail has one width and nothing to
 * change, and the buttons would be two controls in a 67 px column that cannot
 * do anything.
 */
export function PanelWidthButtons({ slot }: { slot: SidebarSlot }) {
  const { layout } = useLayout();
  const { range, width, direction, fixed, step } = usePanelWidth(slot);

  /*
   * «Gjør tråder og filter smalere», not «Smalere»: two panels can be open at
   * once, and two controls with the same name are two controls a screen
   * reader user has to tell apart by where they happen to sit. The name comes
   * from the views in the slot, like every other name in the shell, so a view
   * that is moved takes it along.
   */
  const label = slotLabel(layout, slot)?.toLocaleLowerCase('nb-NO') ?? '';

  /*
   * The glyph points the way the edge will travel, which is not the same
   * side for the two panels: widening the one before the answer column moves
   * its edge toward the inline end, and widening the one after it moves the
   * edge the other way. `growthDirection` is the single place that knows,
   * and these two read it. See src/components/icons.ts.
   */
  const WiderIcon = direction === 1 ? InlineEndIcon : InlineStartIcon;
  const NarrowerIcon = direction === 1 ? InlineStartIcon : InlineEndIcon;

  /*
    Gone, not greyed out, when the window has nothing to give: floor, ceiling
    and the width on screen are one number, and no press on either button can
    change anything from here. That is not a control at a limit, it is a
    control with no job in this window at all, and a permanently unavailable
    control says nothing except that something is broken.

    Brukerblikk 3, funn 2: at 1440 × 900 with both sidebars open the answer
    column is on its 640 floor and the navigation panel on its 400, so ALL
    FOUR buttons and both separators stood permanently off — and 1440 is the
    width every Figma frame is drawn in. `aria-disabled` with `tabIndex={-1}`
    (PR #50) took them out of the tab order but left four dead glyphs in the
    panel heads. Lars 17.09, decision 9 option (c).

    They come back on their own when the window grows: `usePanelWidth` reads
    `useViewportWidth`, so a resize past 1440 renders them again. Focus is the
    one thing lost — a button that disappears under the pointer drops focus to
    the body — and the only way to lose it is to resize the window, which is a
    deliberate act that relays out the whole page anyway.
  */
  if (fixed) return null;

  return (
    <div className="panel-width-buttons">
      <WidthButton
        atLimit={width <= range.min}
        icon={<NarrowerIcon aria-hidden />}
        name={`Gjør ${label} smalere`}
        onPress={() => step(-1)}
      />
      <WidthButton
        atLimit={width >= range.max}
        icon={<WiderIcon aria-hidden />}
        name={`Gjør ${label} bredere`}
        onPress={() => step(1)}
      />
    </div>
  );
}

function WidthButton({
  atLimit,
  icon,
  name,
  onPress,
}: {
  /** At the end of its travel right now. Says so, keeps its tab stop. */
  atLimit: boolean;
  icon: ReactNode;
  name: string;
  onPress: () => void;
}) {
  return (
    /*
      One string for both the accessible name and the tooltip, for the reason
      the collapse button gives: @digdir/designsystemet-web writes
      `data-tooltip` into `aria-label` on an element with no text of its own,
      so a tooltip saying something shorter would quietly replace the name a
      moment after render.
    */
    <Tooltip content={name}>
      <Button
        aria-disabled={atLimit || undefined}
        aria-label={name}
        data-color="neutral"
        data-size="sm"
        icon
        /*
          `aria-disabled` and not `disabled`, the same pair the excerpt search
          uses: widening is something a reader does by pressing the same
          button several times, and a `disabled` button drops the focus to the
          body the moment it turns off — so the last step would take the
          keyboard out of the control it was working in. Designsystemet draws
          `[aria-disabled='true']` exactly like `:disabled`, and the handler
          is what makes it inert, since the browser still delivers the click.

          This is the one silence left here, and it is temporary by nature:
          `atLimit` is where the edge happens to stand, so one press on the
          other button makes this one work again. The permanent silence — a
          window with no room in it — is not drawn at all; see `fixed` above.
        */
        onClick={() => {
          if (!atLimit) onPress();
        }}
        variant="tertiary"
      >
        {icon}
      </Button>
    </Tooltip>
  );
}
