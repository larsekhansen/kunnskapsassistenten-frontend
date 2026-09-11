import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import {
  expectEveryStepReachable,
  facetField,
  showFilters,
  showThreads,
  walkWithTab,
} from './helpers';

/**
 * The primary sidebar: the document filter and the thread list.
 *
 * Two views in one slot, and the panel switches between them. A first-time
 * user meets the filter (answer 1), so that is where every test starts.
 */
test.describe('navigasjonspanelet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('en førstegangsbruker møter filtreringen, med de tre dimensjonene', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    await expect(panel.getByRole('heading', { name: 'Filtrering' })).toBeVisible();

    for (const dimension of ['Dokumenttyper', 'Virksomheter', 'År']) {
      await expect(facetField(page, dimension)).toBeVisible();
    }

    // Nothing selected is «no restriction», which is what «Alle valgt» says.
    await expect(panel.getByText('Alle valgt').first()).toBeVisible();

    await expectNoAxeViolations(page, 'filtreringen');
  });

  test('et valg blir en chip i feltet, og tellingen følger med', async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');

    const field = facetField(page, 'Virksomheter');
    await field.click();
    await page.keyboard.type('Nasjonal');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // The chip lives in the Suggestion's shadow root, so it is read through
    // the accessible name rather than a CSS selector.
    await expect(
      page.getByRole('navigation', { name: 'Tråder og filter' }).getByText('1 av 6 valgt'),
    ).toBeVisible();

    const chips = await page.evaluate(() => {
      const suggestions = [...document.querySelectorAll('ds-suggestion')];
      return suggestions.flatMap((suggestion) =>
        [...suggestion.querySelectorAll('data')].map((chip) => chip.textContent?.trim() ?? ''),
      );
    });
    expect(chips).toContain('Nasjonal kommunikasjonsmyndighet');

    // The search text is spent once the value is a chip.
    await expect(field).toHaveValue('');

    await expectNoAxeViolations(page, 'filtreringen med et valg');
  });

  test('«Velg alle» og «Tøm» lar tastaturet bli i feltet', async ({ page }, testInfo) => {
    covers(testInfo, 'tastatur: kontroller som forsvinner må si hvor fokus skal');

    const selectAll = page.getByRole('button', { name: 'Velg alle dokumenttyper' });
    await selectAll.focus();
    await selectAll.press('Enter');
    // The button removed itself by doing its job; focus must not be on body.
    await expect(facetField(page, 'Dokumenttyper')).toBeFocused();

    const clear = page.getByRole('button', { name: 'Tøm dokumenttyper' });
    await clear.focus();
    await clear.press('Enter');
    await expect(facetField(page, 'Dokumenttyper')).toBeFocused();
  });

  test('vekslingen mellom filter og tråder gir fokus til knappen i det nye viewet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelet veksler mellom filter og tråder');

    const toThreads = page.getByRole('button', { name: 'Tråder', exact: true });
    await toThreads.focus();
    await toThreads.press('Enter');
    await expect(page.getByRole('button', { name: 'Filtrer dokumenter' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Tråder', exact: true })).toBeFocused();
  });

  test('trådene er gruppert på tidsrom, nyeste først', async ({ page }, testInfo) => {
    covers(testInfo, 'tråder er gruppert');
    await showThreads(page);

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    const groups = panel.locator('.threads-view__group h3');

    // Answer 6: today, then two relative periods, then month names, then
    // years. The first three are fixed; what follows depends on today's date,
    // so only the order is asserted, not the names.
    await expect(groups.nth(0)).toHaveText('I dag');
    await expect(groups.nth(1)).toHaveText('Siste 7 dager');
    await expect(groups.nth(2)).toHaveText('Siste 30 dager');
    expect(await groups.count()).toBeGreaterThan(3);

    await expectNoAxeViolations(page, 'trådlista');
  });

  test('søk i tråder filtrerer lista og sier hvor mange treff', async ({ page }, testInfo) => {
    covers(testInfo, 'søk i tråder gir treffteller');
    await showThreads(page);

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    const search = panel.getByRole('searchbox', { name: 'Søk i tråder' });

    // The counter is a live region and must exist before it has anything to
    // say: a region that appears together with its text announces nothing.
    const counter = panel.locator('output.threads-view__search-status');
    await expect(counter).toBeAttached();
    await expect(counter).toHaveText('');

    await search.fill('stimulab');
    await expect(counter).toHaveText('2 tråder');
    await expect(panel.locator('.threads-view__thread')).toHaveCount(2);

    await search.fill('finnesikke');
    await expect(counter).toHaveText('0 tråder');
    await expect(panel.getByText('Ingen treff')).toBeVisible();

    await search.fill('');
    await expect(counter).toHaveText('');
  });

  test('en trådrad er en lenke, og den valgte er merket for skjermleser', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'tråder er gruppert');
    await showThreads(page);

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    const first = panel.getByRole('link', { name: 'NKOM måloppnåelse' });
    await first.click();

    await expect(page).toHaveURL(/\/threads\/nkom-maaloppnaaelse$/);
    // aria-current, not colour, is what carries «you are here».
    await expect(panel.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(panel.locator('[aria-current="page"]')).toHaveText('NKOM måloppnåelse');
  });

  test('Tab gjennom begge visningene: navn og synlig fokusring hele veien', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet');

    for (const mode of ['light', 'dark'] as const) {
      await setColorScheme(page, mode);

      expectEveryStepReachable(await walkWithTab(page), `filtreringen i ${mode}`);

      await showThreads(page);
      expectEveryStepReachable(await walkWithTab(page), `trådlista i ${mode}`);

      await showFilters(page);
    }
  });
});
