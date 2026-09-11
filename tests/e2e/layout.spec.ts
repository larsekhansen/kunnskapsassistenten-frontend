import { expect, test } from '@playwright/test';
import { covers } from './a11y';
import { ask, citation } from './helpers';

/**
 * The layout at the widths the product is actually used at.
 *
 * These two came out of the visual review against Figma
 * (`docs/review/visuell-2026-09-11.md`), and they are here so the same two
 * cannot come back. Neither is a deviation from a drawing: they are the shell
 * failing to fit itself into the window.
 *
 * 1440 is not an arbitrary number. Every frame in `design/omraader/` is drawn
 * at 1440, so it is the one width the design speaks about.
 */
test.describe('layouten', () => {
  test('tre åpne plasser får plass i 1440, uten vannrett rulling', async ({ page }, testInfo) => {
    covers(testInfo, 'layout: tre åpne plasser ved 1440');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Opened the way a user opens it: by activating a citation marker, which
    // is the moment the third slot appears whether the window has room or not.
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
    await citation(page, 1).click();
    await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

    const layout = await page.evaluate(() => ({
      navLeftEdge: Math.round(document.querySelector('nav')!.getBoundingClientRect().x),
      pageWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
    }));

    // The navigation panel must not be pushed off the left edge: everything
    // above the fold in it — the collapse button, the way back to the threads
    // — goes with it.
    expect(layout.navLeftEdge, 'navigasjonspanelet skal starte ved venstre kant').toBe(0);
    expect(
      layout.pageWidth,
      'sida skal ikke være bredere enn vinduet, altså ingen vannrett rulling',
    ).toBeLessThanOrEqual(layout.windowWidth);
  });

  test('etiketten på kollapsknappen står på én linje', async ({ page }, testInfo) => {
    covers(testInfo, 'layout: kollapset panel rommer sin egen etikett');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Wait for the web font. Inter is fetched from a CDN, and until it lands
    // the fallback's metrics apply — «Vis kilder» fits on one line in the
    // fallback and wraps in Inter, so measuring too early passes a test that
    // should fail. Any assertion about text layout has to wait for this.
    await page.evaluate(() => document.fonts.ready);

    // The secondary sidebar starts collapsed, so this is the first thing a
    // user sees of it. A label that wraps is the panel saying it is narrower
    // than the only control it holds.
    const lines = await page.evaluate(() => {
      const button = document.querySelector('aside')?.querySelector('button');
      const text = [...(button?.childNodes ?? [])].find((node) => node.nodeType === Node.TEXT_NODE);
      if (!text) return null;
      const range = document.createRange();
      range.selectNode(text);
      return range.getClientRects().length;
    });

    expect(lines, '«Vis kilder» skal få plass på én linje i det kollapsede panelet').toBe(1);
  });
});
