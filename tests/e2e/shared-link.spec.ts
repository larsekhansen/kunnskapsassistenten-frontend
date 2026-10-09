import { expect, test } from '@playwright/test';
import { covers } from './a11y';

/** Hele kvitteringen, som den står når lenken er kopiert. */
const RECEIPT = 'Lenken til tråden er kopiert. Virker bare for deg, i denne nettleseren.';

/**
 * Kvitteringen etter «Kopier lenke til tråden» må stå i lesevinduet, også for
 * den som er nederst i tråden på telefon.
 *
 * Setningen om at lenken bare virker i denne nettleseren står i kvitteringen,
 * og det er to linjer på telefon mot én før. Står leseren nederst, vokser
 * kolonnen, og andre linje havner bak skrivefeltet, som ligger fast nederst i
 * den samme rullende kolonnen. Målt 09.10 uten rettelsen: 40 px bak feltet på
 * 360, 39 på 390 og 15 på 414.
 *
 * Derfor er «innenfor vinduet» ikke påstanden her. Lesevinduet slutter der
 * toningen over skrivefeltet begynner, og det er den kanten kvitteringen
 * måles mot: tekst under toningen er bleket og ikke lest.
 *
 * #3 har unntak for denne fila, 2026-10-09: anmelderen ba om testen i runde 1
 * av #278. Ingenting annet i `tests/` er endret.
 */
test.describe('kvitteringen for lenken til tråden', () => {
  test.use({
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });

  test('står i lesevinduet når leseren er nederst i tråden @mock', async ({
    page,
    context,
  }, testInfo) => {
    covers(testInfo, 'kopier svaret og lenke til tråden');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/threads/nkom-maaloppnaaelse');
    const copyLink = page.getByRole('button', { name: 'Kopier lenke til tråden' }).last();
    await expect(copyLink).toBeVisible();

    // Helt ned, der kolonnen står etter et ferdig svar.
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = main.scrollHeight;
    });

    await copyLink.tap();

    // Innenfor de fire sekundene kvitteringen står (useCopy.ts, RECEIPT_MS).
    const receipt = page.locator('.ka-answer-actions__receipt').last();
    await expect(receipt).toHaveText(RECEIPT, { timeout: 3_000 });

    const outside = await page.evaluate(() => {
      const text = [...document.querySelectorAll('.ka-answer-actions__receipt')].at(-1);
      const composer = document.querySelector('.ka-composer-area');
      if (!text || !composer) return null;
      const box = text.getBoundingClientRect();
      // Toningen ligger over feltet som et ::before, utenfor boksen til feltet.
      const fade = Number.parseFloat(getComputedStyle(composer, '::before').blockSize) || 0;
      return {
        behindComposer: Math.round(box.bottom - (composer.getBoundingClientRect().top - fade)),
        aboveWindow: Math.round(-box.top),
      };
    });

    expect(outside, 'kvitteringen og skrivefeltet skal finnes').not.toBeNull();
    expect(
      outside!.behindComposer,
      'piksler av kvitteringen bak skrivefeltet og toningen over det',
    ).toBeLessThanOrEqual(0);
    expect(outside!.aboveWindow, 'piksler av kvitteringen over vinduet').toBeLessThanOrEqual(0);
  });
});
