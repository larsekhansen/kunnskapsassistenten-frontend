import { expect, test, type Page } from '@playwright/test';
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
/**
 * «1 av N valgt», whatever N happens to be.
 *
 * It said «1 av 6 valgt» while the facets were six hand-written values. They
 * are now counted from the real Kudos corpus, where «Virksomheter» has 259 —
 * and it will be a different number the next time the corpus is fetched. What
 * this test is about is that picking one value shows one as picked, and that
 * does not depend on how large the corpus is.
 */
const SELECTED_ONE = /^1 av \d+ valgt$/;

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

    // Nothing selected is «no restriction», and the description says that and
    // not «Alle valgt» — an untouched field and one where every value has been
    // picked used to read word for word the same (brukerblikk, funn 3).
    await expect(panel.getByText('Ingen avgrensning').first()).toBeVisible();
    await expect(panel.getByText('Alle 6 valgt')).toHaveCount(0);

    await expectNoAxeViolations(page, 'filtreringen');
  });

  test('et valg blir en chip i feltet, og tellingen følger med', async ({ page }, testInfo) => {
    covers(testInfo, 'filtre kan velges og gir chips');

    // The whole name, not a prefix. `ArrowDown` + `Enter` takes the first
    // match, and «Nasjonal» matched six organisations in the real corpus —
    // the first of them «Nasjonalarkivet», which is not the one this test
    // then looks for. Typed in full there is one match and it is that one.
    const field = facetField(page, 'Virksomheter');
    await field.click();
    await page.keyboard.type('Nasjonal kommunikasjonsmyndighet');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    // The chip lives in the Suggestion's shadow root, so it is read through
    // the accessible name rather than a CSS selector.
    await expect(
      page.getByRole('navigation', { name: 'Tråder og filter' }).getByText(SELECTED_ONE),
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

  /**
   * N6 in `design/funksjonssjekk-v1.md`, which stood unverified: #2 saw it
   * work in a browser on 2026-09-11 and the conductor's script could not
   * settle it.
   *
   * What is at stake is an architecture claim, not a feature. The two views
   * are modes of one slot, so switching UNMOUNTS the filter view completely —
   * chips, counts and all. The selection survives only because it lives in
   * `LayoutProvider` and not in the view, which is the same reason the chat
   * view can read it (see filterContext.ts). A regression here would look
   * like an ordinary refactor: move the state into `FiltersView` where it
   * seems to belong, and nothing fails except this.
   *
   * Every read of the chips goes through `expect.poll`. Suggestion renders a
   * chosen value a tick after Enter, so a plain read right after the keypress
   * returns an empty list — which is how both of these first failed, against
   * a product that was doing the right thing.
   */
  const chipTexts = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('ds-suggestion')].flatMap((suggestion) =>
        [...suggestion.querySelectorAll('data')].map((chip) => chip.textContent?.trim() ?? ''),
      ),
    );

  /** Picks one value in a facet the way a keyboard user does, and waits for the chip. */
  async function chooseFacetValue(page: Page, dimension: string, value: string): Promise<void> {
    const field = facetField(page, dimension);
    await field.click();
    await page.keyboard.type(value);
    // The list filters asynchronously; ArrowDown on a list that has not
    // caught up lands on whatever option is still first.
    await expect(page.locator('[role="option"]').filter({ hasText: value }).first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => chipTexts(page)).toContain(value);
  }

  test('filtervalget overlever veksling til trådene og tilbake', async ({ page }, testInfo) => {
    covers(testInfo, 'filtervalget overlever veksling (N6)');

    // Two dimensions, not one: a selection kept per field and a selection
    // kept for the panel as a whole fail differently, and one field cannot
    // tell them apart.
    await chooseFacetValue(page, 'Virksomheter', 'Nasjonal kommunikasjonsmyndighet');
    await chooseFacetValue(page, 'Dokumenttyper', 'Årsrapport');

    const before = (await chipTexts(page)).sort();

    await showThreads(page);
    // Gone from the DOM, not merely hidden. If the panel only hid the view,
    // this test would pass while proving nothing.
    await expect(facetField(page, 'Virksomheter')).toHaveCount(0);

    await showFilters(page);

    await expect
      .poll(async () => (await chipTexts(page)).sort(), {
        message: 'chipsene er de samme etter veksling',
      })
      .toEqual(before);

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    await expect(panel.getByText(SELECTED_ONE).first()).toBeVisible();
    // And the field is back to a resting state rather than holding the search
    // text that produced the chip.
    await expect(facetField(page, 'Virksomheter')).toHaveValue('');
  });

  test('filtervalget overlever at brukeren åpner en tråd og går tilbake', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'filtervalget overlever ruteskifte');

    await chooseFacetValue(page, 'Virksomheter', 'Nasjonal kommunikasjonsmyndighet');

    // A route change is the harder case and the one a user actually does:
    // open a thread from the list, then go back to the filter. The provider
    // sits above `Routes` in App.tsx, so the selection is expected to hold —
    // this is the test that says so out loud.
    await showThreads(page);
    await page.getByRole('link', { name: 'NKOM måloppnåelse' }).click();
    await expect(page).toHaveURL(/\/threads\/nkom-maaloppnaaelse$/);

    await showFilters(page);
    await expect
      .poll(() => chipTexts(page), { message: 'valget overlevde ruta' })
      .toContain('Nasjonal kommunikasjonsmyndighet');

    await expectNoAxeViolations(page, 'filtreringen på en trådrute');
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
