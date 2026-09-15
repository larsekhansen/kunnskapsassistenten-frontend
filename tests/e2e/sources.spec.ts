import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import {
  ask,
  citation,
  composer,
  expectEveryStepReachable,
  openSources,
  walkWithTab,
} from './helpers';

/**
 * The sources panel: the excerpts the answer rests on, and the link from a
 * `[n]` marker to the excerpt it points at.
 *
 * The panel starts collapsed, and it has nothing to show before the first
 * answer, so every test here asks a question first. That is also the only
 * honest way to test the coupling: the markers are built by one view and the
 * excerpts by another, and neither imports the other.
 */
test.describe('kildepanelet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
  });

  test('panelet sier fra mens kildene er på vei', async ({ page }, testInfo) => {
    covers(testInfo, 'lastetilstand i kildepanelet');

    // Back to a page nobody has asked anything on: the loading state is what
    // the panel shows while the FIRST answer is on its way, and the empty
    // state is what it shows before that. Both are lost once an answer has
    // landed, which is the state `beforeEach` leaves behind.
    await page.goto('/');
    await page.getByRole('button', { name: 'Vis kilder' }).click();

    const empty = page.getByRole('complementary', { name: 'Kilder' });
    // Before the first question nothing is loading, and saying «henter» would
    // be a lie. Answer 36.
    await expect(empty.getByText('Ingen kilder ennå')).toBeVisible();

    await composer(page).click();
    await page.keyboard.type('Hva mer sier rapporten?');
    await page.keyboard.press('Enter');

    const panel = page.getByRole('complementary', { name: 'Kilder' });

    // Skeleton is aria-hidden, so a sentence has to carry the state, and
    // `aria-busy` has to say the region is not finished.
    await expect(panel.locator('[aria-busy="true"]')).toBeVisible();
    await expect(panel.getByText('Henter kilder …')).toBeAttached();

    // And it resolves into real sources rather than staying busy.
    await expect(panel.locator('.source-document').first()).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('panelet er lukket til noe peker inn i det', async ({ page }, testInfo) => {
    covers(testInfo, 'kildepanelet åpnes av en markør');

    // Answer 36: the panel opens once the conversation has produced sources
    // worth citing, not before.
    await expect(page.getByRole('button', { name: 'Vis kilder' })).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Kilder' })).toHaveAttribute(
      'data-collapsed',
      'true',
    );
  });

  test('en markør åpner panelet, åpner utdraget og flytter fokus dit', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'klikk på [n] ruller og fokuserer riktig utdrag');

    await citation(page, 2).click();

    // The panel opens itself: a marker pointing into a collapsed panel that
    // did nothing was the first-run case, not an edge case.
    await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

    const excerpt = page.locator('#excerpt-2');
    await expect(excerpt).toBeVisible();
    await expect(excerpt).toBeFocused();
    // The excerpt is opened, not just scrolled to.
    await expect(excerpt.getByRole('group')).toHaveAttribute('open', '');

    // Answer 19 again: a second click on the same marker has to count as a
    // new request, which is what the nonce is for.
    await page.keyboard.press('Tab');
    await citation(page, 2).click();
    await expect(excerpt).toBeFocused();
  });

  /**
   * Punkt 4 i brukerblikket: å komme TIL et utdrag er ett klikk, å komme
   * tilbake var åtte Shift+Tab som endte på oppfølgingschipene, og Escape
   * gjorde ingenting.
   *
   * To veier, fordi de leses av to slags lesere: Escape for den som kan den,
   * og en synlig kontroll sist i sitatet for alle andre. Begge måles på hvor
   * fokus havner — ikke på at knappen finnes, for en knapp som ikke flytter
   * fokus er ingen vei tilbake.
   */
  test('utdraget markøren sendte deg til har to veier tilbake til svaret', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'vei tilbake fra utdrag til svar');

    await openSources(page, 2);
    const excerpt = page.locator('#excerpt-2');
    await expect(excerpt).toBeFocused();

    // Escape, fra inne i utdraget.
    await page.keyboard.press('Escape');
    await expect(citation(page, 2), 'Escape setter fokus på markøren').toBeFocused();

    // Og knappen, som er der for den som ikke vet om Escape.
    await citation(page, 2).click();
    await expect(excerpt).toBeFocused();
    const back = excerpt.getByRole('button', { name: 'Tilbake til svaret' });
    await expect(back).toBeVisible();
    await back.click();
    await expect(citation(page, 2), '«Tilbake til svaret» setter fokus på markøren').toBeFocused();

    // Et utdrag ingen ble sendt til, har ingen vei tilbake: en kontroll som
    // fører til et sted du aldri kom fra gjør ingenting.
    const other = page.locator('#excerpt-1');
    await other.locator('summary').click();
    await expect(other.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);

    await expectNoAxeViolations(page, 'et åpnet utdrag med vei tilbake');
  });

  /**
   * Punkt 5: hvert svar nummererer utdragene sine fra 1, så `[2]` i første
   * svar og `[2]` i andre peker på hver sin ting. Ett flatt kildesett gjorde
   * at markøren i det eldste svaret åpnet det nyeste svarets utdrag to — det
   * så riktig ut og var det ikke.
   *
   * Kjeden er tre PR-er lang og testes her fra enden: #36 bygde panelet, #39
   * la røret gjennom skallet, #42 kalte det fra chat-viewet og #44 sørget for
   * at båndet blir igjen i svaret det hører til. Det er den siste biten som
   * er lettest å miste igjen, så den måles eksplisitt.
   */
  test('to svar har hvert sitt kildesett, og markøren blir i sitt', async ({ page }, testInfo) => {
    covers(testInfo, 'kilder per svar');

    // `beforeEach` har stilt ett spørsmål; dette er det andre, i samme samtale.
    await ask(page, 'Hva mer sier rapporten?');
    await expect(page.locator('.ka-message--assistant')).toHaveCount(2);

    // Markøren i det FØRSTE svaret, ikke det nyeste.
    await page
      .locator('.ka-message--assistant')
      .first()
      .locator('a[href="#excerpt-1"]')
      .first()
      .click();
    await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

    const teller = page.locator('.sources-answer-switcher__count');
    await expect(teller, 'panelet sier hvilket svar kildene hører til').toHaveText(
      'Kilder til svar 1 av 2',
    );
    await expect(page.locator('#excerpt-1')).toBeFocused();
    await expect(page.locator('.source-excerpt[data-active="true"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(1);

    // Steg til det andre svaret: båndet og veien tilbake hører til svaret
    // leseren ble sendt til, og blir igjen der.
    await page.getByRole('button', { name: 'Neste svar' }).click();
    await expect(teller).toHaveText('Kilder til svar 2 av 2');
    await expect(
      page.locator('.source-excerpt[data-active="true"]'),
      'ingen ble sendt til dette settet',
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tilbake til svaret' })).toHaveCount(0);

    // Og tilbake igjen: leseren BLE sendt dit, så begge deler kommer tilbake.
    await page.getByRole('button', { name: 'Forrige svar' }).click();
    await expect(teller).toHaveText('Kilder til svar 1 av 2');
    await expect(page.locator('.source-excerpt[data-active="true"]')).toHaveCount(1);

    await expectNoAxeViolations(page, 'kildepanelet med to svar');
  });

  test('utdragene er gruppert per dokument og nummerert mot markørene', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'utdrag gruppert per dokument');
    await openSources(page, 1);

    const panel = page.getByRole('complementary', { name: 'Kilder' });

    // Answer 57: one card per document, the excerpts under it.
    const cards = panel.locator('.source-document');
    expect(await cards.count()).toBeGreaterThan(1);

    // The shortcut list numbers documents; the excerpts carry the `[n]`
    // numbers. Both are on screen, so the heading says which is which.
    await expect(panel.getByRole('heading', { name: 'Snarveier til dokumentene' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Utdrag 1' })).toBeVisible();

    // Every marker in the answer has an excerpt to point at.
    const markers = await page
      .locator('main a[href^="#excerpt-"]')
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute('href')))]);
    for (const href of markers) {
      await expect(panel.locator(href as string)).toHaveCount(1);
    }

    await expectNoAxeViolations(page, 'kildepanelet');
  });

  test('en snarvei hopper til dokumentkortet', async ({ page }, testInfo) => {
    covers(testInfo, 'snarveislista');
    await openSources(page, 1);

    const panel = page.getByRole('complementary', { name: 'Kilder' });
    const shortcut = panel.getByRole('link', { name: /^Årsrapport/ }).first();
    const href = await shortcut.getAttribute('href');
    await shortcut.click();

    const card = panel.locator(href as string);
    await expect(card).toBeVisible();
    await expect(card).toBeFocused();
  });

  test('søk i utdragene gir en treffteller og lar tastaturet bli i feltet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'søk i utdrag gir treffteller');
    await openSources(page, 1);

    const panel = page.getByRole('complementary', { name: 'Kilder' });
    const search = panel.getByRole('searchbox', { name: 'Søk i kildene' });

    await search.click();
    await page.keyboard.type('risiko');
    // The field must survive being typed in: the counter updating used to
    // pull focus out after the second character.
    await expect(search).toHaveValue('risiko');
    await expect(search).toBeFocused();

    const counter = panel.locator('.sources-search__count');
    await expect(counter).toHaveText(/^1 av \d+ treff$/);

    // Stepping keeps the keyboard on the button so it can be pressed again.
    const next = panel.getByRole('button', { name: 'Neste treff' });
    await next.focus();
    await next.press('Enter');
    await expect(counter).toHaveText(/^2 av \d+ treff$/);
    await expect(next).toBeFocused();

    await search.fill('finnesikkeher');
    await expect(counter).toHaveText('Ingen treff');
  });

  test('Tab gjennom kildepanelet i lys og mørk', async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');
    await openSources(page, 1);

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);
      expectEveryStepReachable(await walkWithTab(page), `kildepanelet i ${mode}`);
      await expectNoAxeViolations(page, `kildepanelet i ${mode}`);
    }
  });
});
