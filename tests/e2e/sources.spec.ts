import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, setColorScheme } from './a11y';
import { ask, citation, expectEveryStepReachable, openSources, walkWithTab } from './helpers';

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
