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
  const { range, width, direction, step } = usePanelWidth(slot);

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
