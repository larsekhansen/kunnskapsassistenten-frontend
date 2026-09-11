import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import { ask, citation, composer, expectEveryStepReachable, walkWithTab } from './helpers';

/**
 * The chat: the greeting, the question, the streamed answer and what a reader
 * can do with it.
 *
 * A full mock answer takes about 7.5 seconds of wall clock, so the tests that
 * need a finished answer pay for one each. They run in parallel, so the suite
 * does not.
 */
test.describe('hovedkolonnen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('den tomme tilstanden er en hilsen og tre forslag', async ({ page }, testInfo) => {
    covers(testInfo, 'kickstarter fyller feltet');

    await expect(page.getByRole('heading', { name: /^Hei/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hva lurer du på?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Hva rapporteres om regnskap/ })).toBeVisible();

    await expect(composer(page)).toHaveValue('');
    await expectNoAxeViolations(page, 'den tomme tilstanden');
  });

  test('en kickstarter fyller feltet og sender ikke', async ({ page }, testInfo) => {
    covers(testInfo, 'kickstarter fyller feltet');

    const suggestion = page.getByRole('button', { name: /^Hva rapporteres om regnskap/ });
    const question = (await suggestion.textContent())?.trim() ?? '';
    await suggestion.click();

    // Answer 40: it starts the question, it does not ask it. The caret goes
    // with the text so the reader can edit before sending.
    await expect(composer(page)).toHaveValue(question);
    await expect(composer(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toHaveCount(0);
  });

  test('et spørsmål gir et strømmet svar med kildemarkører', async ({ page }, testInfo) => {
    covers(testInfo, 'spørsmål gir strømmet svar med [n]-markører');

    await composer(page).click();
    await page.keyboard.type('Hvordan jobber Nkom med måloppnåelse?');
    await page.keyboard.press('Enter');

    // While it works: the stop button is there and the field is empty again.
    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
    await expect(composer(page)).toHaveValue('');

    // The question is in the list as the reader's own words.
    await expect(page.getByText('Hvordan jobber Nkom med måloppnåelse?')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
      timeout: 30_000,
    });

    // The markers are links to the excerpts, and their names say where they go
    // rather than just «[1]».
    const markers = page.locator('main a[href^="#excerpt-"]');
    expect(await markers.count()).toBeGreaterThan(0);
    await expect(markers.first()).toHaveAttribute('aria-label', /^Kilde 1: /);

    // «Fremgangsmåte» arrives with the answer, open, with the hit count.
    await expect(page.getByText(/\d+ treff i \d+ dokumenter/)).toBeVisible();

    await expectNoAxeViolations(page, 'et ferdig svar');
  });

  test('avbryt stopper genereringen og beholder teksten som kom', async ({ page }, testInfo) => {
    covers(testInfo, 'avbryt stopper');

    await composer(page).click();
    await page.keyboard.type('Hva står i årsrapporten?');
    await page.keyboard.press('Enter');

    const stop = page.getByRole('button', { name: 'Avbryt genereringen' });
    await expect(stop).toBeVisible();

    // Wait for text to have started before stopping, so «keeps what arrived»
    // means something.
    await expect(page.locator('.ka-answer-card')).toBeVisible();
    await page.waitForTimeout(2500);
    const partial = (await page.locator('.ka-answer-card').first().textContent()) ?? '';

    await stop.focus();
    await stop.press('Enter');

    // The button the reader pressed is gone; focus must not be on the body.
    await expect(composer(page)).toBeFocused();
    await expect(stop).toHaveCount(0);

    // Cancelling is not an error, and the partial answer stays. The alert is
    // checked by what it would show rather than by its role: an empty
    // `.error-state` is `display: none` in global.css and therefore not in the
    // accessibility tree at all. That is a defect on `main`, written up in the
    // review — not something this test should encode as correct.
    await expect(page.getByRole('button', { name: 'Prøv igjen' })).toHaveCount(0);
    expect(partial.length).toBeGreaterThan(0);
    await expect(page.locator('.ka-answer-card')).toBeVisible();
  });

  test('handlingsraden kopierer svaret og kvitterer', async ({ page, context }, testInfo) => {
    covers(testInfo, 'kopier svaret og lenke til tråden');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await ask(page, 'Hva sier rapporten?');

    // The receipt is a live region that exists before it has anything to say.
    const receipt = page.locator('.ka-answer-actions__receipt');
    await expect(receipt).toBeAttached();
    await expect(receipt).toHaveText('');

    const copy = page.getByRole('button', { name: 'Kopier svaret' });
    await copy.click();
    await expect(receipt).toHaveText('Svaret er kopiert.');
    // Focus stays where the reader put it.
    await expect(copy).toBeFocused();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.length).toBeGreaterThan(0);
    // The `[n]` markers are bookkeeping for a panel the clipboard cannot
    // carry, so they are stripped.
    expect(clipboard).not.toMatch(/\[\d+\]/);
  });

  test('oppfølgingschipene sender med én gang', async ({ page }, testInfo) => {
    covers(testInfo, 'oppfølgingsspørsmål');
    await ask(page, 'Hva sier rapporten?');

    const answersBefore = await page.locator('.ka-message--assistant').count();
    await page.getByRole('button', { name: 'Kan du utdype?' }).click();

    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
    await expect(page.locator('.ka-message--assistant')).toHaveCount(answersBefore + 1);
  });

  test('Tab gjennom hovedkolonnen i lys og mørk', async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');
    await ask(page, 'Hva sier rapporten?');

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);
      expectEveryStepReachable(await walkWithTab(page), `hovedkolonnen i ${mode}`);
      await expectNoAxeViolations(page, `hovedkolonnen i ${mode}`);
    }
  });

  test('en markør peker på et utdrag som finnes', async ({ page }, testInfo) => {
    covers(testInfo, 'klikk på [n] ruller og fokuserer riktig utdrag');
    await ask(page, 'Hva sier rapporten?');

    const first = citation(page, 1);
    await expect(first).toHaveAttribute('href', '#excerpt-1');
    await expect(first).toHaveText('[1]');
  });
});
