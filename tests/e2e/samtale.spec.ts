import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { ask, composer, facetField, showThreads } from './helpers';

/**
 * What a conversation does beyond the answer itself: getting an address,
 * asking back, showing its work, and narrowing the corpus.
 *
 * These are the paths that only became testable once several PRs had landed
 * together — the thread URL needed both the plumbing (#25) and the caller
 * (#28), and the facet counts needed the real corpus (#33).
 */
test.describe('samtalen', () => {
  /**
   * C16 in `design/funksjonssjekk-v1.md`, which stood ❌ from 2026-09-11 until
   * tonight: a conversation started on `/` produced a thread and an answer
   * while the URL still said `/`, so «Kopier lenke til tråden» copied the
   * front page.
   *
   * The address is given with `replaceState` rather than a navigation, on
   * purpose — the router would remount the chat slot and take the streaming
   * answer with it — so the thing to assert is that the address changed
   * *without* the conversation being disturbed.
   */
  test('et spørsmål fra forsida gir samtalen en adresse', async ({ page, context }, testInfo) => {
    covers(testInfo, 'C16: tråd-URL og «Kopier lenke til tråden»');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);

    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

    // The address arrives, and the answer is still on screen — that is the
    // whole reason it is `replaceState` and not `navigate()`.
    await expect(page).toHaveURL(/\/threads\/[\w-]+$/);
    await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible();

    const url = page.url();

    // And the link the reader copies is that address, not the front page.
    const copyLink = page.getByRole('button', { name: 'Kopier lenke til tråden' });
    await copyLink.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()), {
        message: '«Kopier lenke til tråden» kopierer trådens egen adresse',
      })
      .toBe(url);

    // What the address does NOT do yet, pinned so the day it changes is
    // noticed: the thread is minted in the browser because the backend has no
    // thread API (gap 4 in design/eksisterende/api-for-frontend.md), so it
    // exists only in this tab. It is not in the thread list, and the copied
    // link opens an empty front page for anyone who follows it — including
    // the reader after a reload. See docs/review/e2e-runde2-2026-09-15.md.
    await showThreads(page);
    const id = url.split('/').pop();
    await expect(
      page.locator(`nav a[href="/threads/${id}"]`),
      'kjent begrensning: en nettleser-mintet tråd er ikke i lista',
    ).toHaveCount(0);
  });

  test('en avklaring er et spørsmål tilbake, ikke et svar', async ({ page }, testInfo) => {
    covers(testInfo, 'avklaring: kort, plassholder og fokus');
    await page.goto('/');

    await composer(page).click();
    await page.keyboard.type('simuler avklaring');
    await page.keyboard.press('Enter');

    // The card says who asked, and says it is a question rather than dressing
    // it up as an answer.
    await expect(page.getByText('Trenger avklaring')).toBeVisible();
    await expect(page.getByText('Kunnskapsassistenten spurte:')).toBeAttached();

    // None of the furniture an answer brings: an answer that cannot be given
    // has nothing to follow up, nothing to cite and no search to show.
    await expect(page.locator('main .ds-chip')).toHaveCount(0);
    await expect(page.locator('main a[href^="#excerpt-"]')).toHaveCount(0);
    await expect(page.getByText(/treff i \d+ dokumenter/)).toHaveCount(0);

    // And the field takes over: it says what it wants and it has the caret,
    // because the next thing to happen is the reader answering.
    const field = composer(page);
    await expect(field).toHaveAttribute('placeholder', 'Svar på spørsmålet over …');
    await expect(field).toBeFocused();

    await expectNoAxeViolations(page, 'avklaringen');
  });

  test('et vanlig svar etter en avklaring er et helt svar igjen', async ({ page }, testInfo) => {
    covers(testInfo, 'avklaring: tilstanden henger ikke igjen');
    await page.goto('/');

    await composer(page).click();
    await page.keyboard.type('simuler avklaring');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Trenger avklaring')).toBeVisible();

    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

    // Chips, markers and the search are back. The clarification left nothing
    // behind it — which is the half of the feature that is easy to get wrong.
    await expect(page.locator('main .ds-chip').first()).toBeVisible();
    expect(await page.locator('main a[href^="#excerpt-"]').count()).toBeGreaterThan(0);
    await expect(composer(page)).toHaveAttribute('placeholder', 'Hva vil du vite mer om?');
  });

  /**
   * The thinking panel, as far as this suite can see it.
   *
   * The suite builds with `VITE_MOCK_SPEED=fast`, so the steps arrive too
   * quickly to watch them land one by one. What is asserted here is what is
   * true at any speed: the panel is a disclosure, it ends up closed, and it
   * says how long it took. Watching it open and fill is a `realistic` build
   * and a person — `npm run dev` does that by default, which is why the
   * default is the slow one.
   */
  test('tenkepanelet legger seg sammen og sier hvor lenge det tenkte', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'tenkepanelet: sammenlagt tilstand');
    await page.goto('/');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

    const panel = page.locator('main details').first();
    const summary = panel.locator('summary').first();
    await expect(summary).toHaveText(/Tenkte i \d+ sekunder?/);
    await expect(panel).not.toHaveAttribute('open', '');

    // It opens on demand, and the steps are in it. Counted as elements
    // rather than read as text: `innerText` on a `details` reports only the
    // summary until the browser has laid the content out, which made an
    // earlier version of this test measure an empty string on a panel that
    // was full.
    await summary.click();
    await expect(panel).toHaveAttribute('open', '');
    const steps = panel.locator('.ka-thinking__step');
    expect(await steps.count(), 'panelet har stegene i seg').toBeGreaterThan(0);
    await expect(steps.first()).toBeVisible();
  });

  test('dokumentlista viser det svaret bygger på, med vei til Kudos', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'dokumentlista «Fra Kudos»');
    await page.goto('/');

    const panel = page.getByRole('navigation', { name: 'Tråder og filter' });
    // Before an answer there is nothing to list, and the panel says so rather
    // than showing an empty box.
    await expect(panel.getByText('Dokumentene som er relevante', { exact: false })).toBeVisible();

    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

    const links = panel.locator('a[href^="https://kudos"]');
    expect(await links.count(), 'svaret har dokumenter, og de peker til Kudos').toBeGreaterThan(0);

    // A link that leaves the app says so in words, and opens where the reader
    // expects. `noreferrer` implies `noopener`.
    const first = links.first();
    await expect(first).toHaveAttribute('target', '_blank');
    await expect(first).toContainText('(åpnes i ny fane)');
  });

  /**
   * Conditional facet counts, which is the thing the real corpus bought.
   *
   * Picking an organisation has to change what the years say — otherwise the
   * counts are just corpus totals and tell the reader nothing about what
   * their own filter would find. A dimension never narrows its own counts,
   * so «Virksomheter» is read before and after and must NOT move.
   *
   * RØD MED VILJE. Measured 2026-09-15: the years do not move. The client
   * takes the selection (`listFacets(signal, selection)`, #33) and the mock
   * computes conditioned counts from it, but `FiltersView.tsx` asks with
   * `listFacets(abort.signal)` and never passes what the reader has ticked.
   * So «2025 (344)» is the whole corpus both before and after picking one of
   * 259 organisations.
   *
   * Left failing rather than loosened: the parameter exists, the computation
   * exists, and the one line that joins them is missing. See
   * `docs/review/e2e-runde2-2026-09-15.md`.
   */
  test('å velge en virksomhet endrer tellerne på år, men ikke på seg selv', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'korpus: betingede fasettellere');
    // No `showFilters` here: `defaultLayout` opens on the filter (answer 1),
    // so the button that switches to it does not exist yet.
    await page.goto('/');

    const counts = (dimension: string) =>
      page.evaluate((label) => {
        const field = document.evaluate(
          `//label[normalize-space(text())="${label}"]/ancestor::ds-field//input`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLElement | null;
        const list = field?.closest('ds-suggestion')?.querySelector('u-datalist');
        return [...(list?.querySelectorAll('[role="option"]') ?? [])]
          .map((option) => option.textContent?.trim() ?? '')
          .slice(0, 12);
      }, dimension);

    await expect(facetField(page, 'År')).toBeVisible();
    const yearsBefore = await counts('År');
    const orgsBefore = await counts('Virksomheter');
    expect(yearsBefore.length, 'årslista har verdier å telle').toBeGreaterThan(0);

    const org = facetField(page, 'Virksomheter');
    await org.click();
    await page.keyboard.type('Nasjonal kommunikasjonsmyndighet');
    await expect(
      page
        .locator('[role="option"]')
        .filter({ hasText: 'Nasjonal kommunikasjonsmyndighet' })
        .first(),
    ).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/1 av \d+ valgt/).first()).toBeVisible();

    await expect
      .poll(() => counts('År'), { message: 'årstellerne følger valget av virksomhet' })
      .not.toEqual(yearsBefore);
    expect(await counts('Virksomheter'), 'en dimensjon smalner ikke sine egne tellere').toEqual(
      orgsBefore,
    );
  });
});
