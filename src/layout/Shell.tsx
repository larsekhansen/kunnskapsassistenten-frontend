import { Button, Heading, Paragraph } from '@digdir/designsystemet-react';
import { Outlet } from 'react-router';
import { defaultLayout, slotLabel, views } from './viewModel';

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
 * Widths and which view is active come from defaultLayout, see viewModel.ts.
 */
export function Shell() {
  const primary = defaultLayout.slots['primary-sidebar'];
  const secondary = defaultLayout.slots['secondary-sidebar'];

  return (
    <>
      <a className="skip-link" href="#main-content">
        Hopp til hovedinnhold
      </a>

      <div className="shell">
        <nav aria-label={slotLabel(defaultLayout, 'primary-sidebar')} className="primary-sidebar">
          <div className="stack">
            <Heading level={2} data-size="xs">
              {views[primary.activeView].label}
            </Heading>
            <Paragraph data-size="sm">
              Dokumentfilter og trådliste kommer her. En førstegangsbruker lander på filtrering.
            </Paragraph>
            <Button variant="tertiary" data-color="neutral">
              {views.threads.label}
            </Button>
          </div>
        </nav>

        <main id="main-content" className="main">
          <Outlet />
        </main>

        <aside
          aria-label={slotLabel(defaultLayout, 'secondary-sidebar')}
          className="secondary-sidebar"
        >
          <Button variant="tertiary" data-color="neutral">
            {secondary.collapsed ? 'Vis kilder' : 'Skjul kilder'}
          </Button>
        </aside>
      </div>
    </>
  );
}
