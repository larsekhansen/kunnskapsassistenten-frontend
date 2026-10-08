import { Dropdown } from '@digdir/designsystemet-react';
import { MenuElipsisHorizontalIcon, PencilIcon, TrashIcon } from '@navikt/aksel-icons';
import { useState, type Ref } from 'react';
import type { Thread } from '../../model';

export type ThreadMenuProps = {
  thread: Thread;
  onRename: () => void;
  onDelete: () => void;
  /** The button that opens the menu, so focus can come back to it. */
  ref?: Ref<HTMLButtonElement>;
};

/**
 * «Endre navn» and «Slett» for one thread, behind a button on its row.
 *
 * Designsystemet's `Dropdown`, a list of buttons and not an ARIA menu, as
 * Designsystemet recommends: two actions with Tab between them read plainly,
 * and a `role="menu"` without the arrow keys and typeahead of the pattern
 * would be worse than none.
 *
 * Beside the row and not inside it. The row is a link over its whole width,
 * and a button inside a link is invalid markup and two controls in one tab
 * stop.
 *
 * Controlled, because a press inside the list does not close it: the
 * popover only closes on its trigger, outside, or Escape. A list left open
 * would float over the rename field the action just opened.
 */
export function ThreadMenu({ thread, onRename, onDelete, ref }: ThreadMenuProps) {
  const [open, setOpen] = useState(false);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <Dropdown.TriggerContext>
      {/*
        The title is in the name: «Flere valg» alone on every row is a control
        a screen reader user cannot tell apart from the next.
      */}
      <Dropdown.Trigger
        ref={ref}
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        icon
        aria-label={`Flere valg for ${thread.title}`}
        className="threads-view__menu-trigger"
      >
        <MenuElipsisHorizontalIcon aria-hidden="true" />
      </Dropdown.Trigger>
      <Dropdown
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        data-size="sm"
      >
        <Dropdown.List>
          <Dropdown.Item>
            <Dropdown.Button onClick={() => choose(onRename)}>
              <PencilIcon aria-hidden="true" />
              Endre navn
            </Dropdown.Button>
          </Dropdown.Item>
          <Dropdown.Item>
            <Dropdown.Button onClick={() => choose(onDelete)}>
              <TrashIcon aria-hidden="true" />
              Slett
            </Dropdown.Button>
          </Dropdown.Item>
        </Dropdown.List>
      </Dropdown>
    </Dropdown.TriggerContext>
  );
}
