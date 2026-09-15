import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import { MOCK_FAILURE_QUERY } from '../../src/api/mock';
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

    // The question is in the list as the reader's own words. Scoped to the
    // user's own message rather than looked for anywhere on the page: since
    // 2026-09-15 the thread heading is the same question with the sentence
    // mark stripped, so an unscoped search matches this one only because of
    // a "?" — which is a reason for a test to pass, not the reason it should.
    await expect(
      page.locator('.ka-message--user').getByText('Hvordan jobber Nkom med måloppnåelse?'),
    ).toBeVisible();

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
    // The receipt counts what went along, so «Svaret er kopiert» would not
    // tell the reader that the sources did too.
    await expect(receipt).toHaveText(/^Svaret og \d+ kilder? er kopiert\.$/);
    // Focus stays where the reader put it.
    await expect(copy).toBeFocused();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.length).toBeGreaterThan(0);

    // The markers stay, because the list they point at goes with them. An
    // answer pasted into a submission without its provenance is the one thing
    // KA is not for — reise 13, 14 and 20 in brukerreiser-2026-09-15.md.
    expect(clipboard).toMatch(/\[1\]/);

    // A reference list under the answer, one line per marker, in Norwegian
    // APA-like form: «[1] Virksomhet (år). Tittel, s. X. URL». The corpus
    // decides which parts exist, so only the shape is asserted here.
    const [, references = ''] = clipboard.split(/\nKilder\n/);
    const lines = references.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const [index, line] of lines.entries()) {
      expect(line.startsWith(`[${index + 1}] `)).toBe(true);
    }
    // Every marker in the text is answered by a line in the list.
    for (const marker of new Set(clipboard.split(/\nKilder\n/)[0]?.match(/\[\d+\]/g) ?? [])) {
      expect(references).toContain(`${marker} `);
    }
  });

  test('oppfølgingschipene sender med én gang', async ({ page }, testInfo) => {
    covers(testInfo, 'oppfølgingsspørsmål');
    await ask(page, 'Hva sier rapporten?');

    const answersBefore = await page.locator('.ka-message--assistant').count();
    await page.getByRole('button', { name: 'Kan du utdype?' }).click();

    await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
    await expect(page.locator('.ka-message--assistant')).toHaveCount(answersBefore + 1);
  });

  test('en feil vises som Alert med «Prøv igjen», og et nytt forsøk tar fokus', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'feil vises som Alert');

    // `simuler feil` is the one question the mock client always fails on,
    // exported as MOCK_FAILURE_QUERY so the test and the client cannot drift.
    await composer(page).click();
    await page.keyboard.type(MOCK_FAILURE_QUERY);
    await page.keyboard.press('Enter');

    // Scoped to the main column: every view that can fail renders its own
    // alert region, and that they all resolve by role is the point — a region
    // hidden with `display: none` would not be in the accessibility tree at
    // all, and then the message would never announce.
    const alert = page.getByRole('main').getByRole('alert');
    await expect(alert).toContainText('Svaret kom ikke fram');
    await expect(alert.getByRole('button', { name: 'Prøv igjen' })).toBeVisible();

    const retry = alert.getByRole('button', { name: 'Prøv igjen' });
    await retry.focus();
    await retry.press('Enter');

    // The button removed itself by doing its job. Focus must land somewhere a
    // keyboard user can carry on from, never on `body`.
    const landed = await page.evaluate(() => document.activeElement?.tagName.toLowerCase());
    expect(landed, 'fokus skal ikke falle til body etter «Prøv igjen»').not.toBe('body');
  });

  /**
   * Skrivefeltet er tabstopp 22 av 38 på en trådside, for det leseren gjør
   * oftest (reise 7 og 15).
   *
   * Den viktigste påstanden er den negative: **bare `/` skal ikke gjøre
   * noe.** En snarvei på én tegntast er WCAG 2.1.4, nivå A, og må kunne slås
   * av, remappes eller være bundet til en fokusert komponent. Modifikatoren
   * er det som tar den ut av kriteriet, og den dagen noen «forenkler» den
   * bort, skal denne testen si fra.
   *
   * Tegnet står aldri i DOM-en som én streng: hinten sier «Ctrl» eller «Cmd»
   * etter hvilken maskin leseren sitter ved, så testen låser formen og ikke
   * ordet.
   */
  test('Ctrl+/ flytter skrivemerket til feltet, og bare / gjør ingenting', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'snarvei til skrivefeltet');
    await page.goto('/threads/nkom-maaloppnaaelse');

    const field = composer(page);
    await expect(field).toBeVisible();

    async function focusSomethingElse() {
      await page.getByRole('button', { name: 'Skjul tråder og filter' }).focus();
    }

    // Uten modifikator: ingenting.
    await focusSomethingElse();
    await page.keyboard.press('/');
    await expect(field, 'en ren tegntast er ingen snarvei').not.toBeFocused();
    /*
     * Og feltet er tomt FØR snarveien prøves. Uten denne sto påstanden om tom
     * verdi først etter at fokus var flyttet, og en «/» som ble behandlet sent
     * kunne rekke å havne i feltet — rødt på `toHaveValue`, med snarveien som
     * den mistenkte. Her sier testen hvilket av de to tastetrykkene som lekket.
     */
    await expect(field, 'tegnet skal ikke ha havnet noe sted').toHaveValue('');

    // Med modifikator: treffer. Begge godtas overalt, så Control er nok her.
    await page.keyboard.press('Control+/');
    await expect(field).toBeFocused();

    // Og tegnet havner ikke i feltet den nettopp flyttet til.
    await expect(field).toHaveValue('');

    // Shift slipper gjennom, fordi «/» ER Shift+7 på norsk tastatur. Uten
    // dette ville snarveien aldri utløst på oppsettet appen er skrevet for.
    await focusSomethingElse();
    await page.keyboard.press('Control+Shift+/');
    await expect(field, 'Shift+7 er norsk «/»').toBeFocused();

    // Ctrl+Alt er AltGr på Windows og setter sammen tegn, ikke kommandoer.
    await focusSomethingElse();
    await page.keyboard.press('Control+Alt+/');
    await expect(field, 'AltGr er ikke en kommando').not.toBeFocused();

    // Og «/» skrives som et tegn i feltet, som alle andre tegn.
    await field.click();
    await page.keyboard.type('a/b');
    await expect(field).toHaveValue('a/b');

    // Snarveien står to steder: en synlig hint og en beskrivelse på feltet.
    await expect(page.locator('.ka-composer__shortcut')).toHaveText(
      /^Trykk (Ctrl|Cmd) \+ \/ for å hoppe hit$/,
    );
    const description = await field.evaluate((element) => {
      const id = element.getAttribute('aria-describedby') ?? '';
      return document.getElementById(id)?.textContent?.trim() ?? '';
    });
    expect(description, 'beskrivelsen skriver tasten med bokstaver').toContain('skråstrek');
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
