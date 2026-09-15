import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import {
  ask,
  chooseFacetValue,
  citation,
  composer,
  facetField,
  openSources,
  showThreads,
} from './helpers';

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

    // Hva lista IKKE gjør, festet med vilje: den hentes én gang når panelet
    // monteres, så en tråd som blir til etterpå dukker ikke opp av seg selv.
    // Den ER lagret — testen under viser at den står der etter en reload — så
    // det som mangler er en oppfriskning, ikke en lagring.
    //
    // Og tråden finnes bare i denne fanen: backend har ingen tråd-API
    // (gap 4 i design/eksisterende/api-for-frontend.md), så den kopierte
    // lenka fører ingen steder for andre enn leseren selv.
    await showThreads(page);
    const id = url.split('/').pop();
    await expect(
      page.locator(`nav a[href="/threads/${id}"]`),
      'kjent begrensning: trådlista friskes ikke opp når en tråd blir til',
    ).toHaveCount(0);
  });

  /**
   * Reise 12 og 14, punkt 16 på lista — den verste turen i appen: still et
   * spørsmål på `/`, få en adresse, last på nytt, og samtalen er borte mens
   * adressen fortsatt ser ut som den betyr noe.
   *
   * Mocken husker nå turen i `sessionStorage`, fordi backend ikke kan (A6).
   * Det er en stedfortreder for en server, ikke et arkiv: det lever så lenge
   * fanen gjør, og testen sier begge deler.
   */
  test('en samtale startet på forsida overlever en reload', async ({ page }, testInfo) => {
    covers(testInfo, 'mocken husker samtalen over reload');

    await page.goto('/');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
    await expect(page).toHaveURL(/\/threads\/[\w-]+$/);

    const url = page.url();
    const id = url.split('/').pop();
    // Selve svarteksten, ikke hele meldinga: tenkepanelet sier «Tenkte i 2
    // sekunder» live og «Tenkte i 4 sekunder» etter en reload, fordi det ene
    // er målt klokketid og det andre er summen av stegenes egne tall. Det er
    // verdt å vite, og det er ikke det denne testen handler om.
    const before = await page.locator('.ka-answer-card .markdown').innerText();

    await page.reload();

    // Samtalen er tilbake, med svaret og kildene sine.
    await expect(page.locator('.ka-message--assistant')).toHaveCount(1);
    await expect.poll(() => page.locator('.ka-answer-card .markdown').innerText()).toBe(before);
    await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible();
    // Kildene også: markørene peker fortsatt på utdrag som finnes.
    await expect(citation(page, 1)).toBeVisible();

    // Og nå står den i lista, merket som den åpne.
    await showThreads(page);
    const row = page.locator(`nav a[href="/threads/${id}"]`);
    await expect(row).toHaveCount(1);
    await expect(row).toHaveAttribute('aria-current', 'page');

    // Men bare i denne fanen. Tømmes lageret, er den borte igjen — det er
    // det `sessionStorage` betyr, og det er den ærlige levetiden for noe som
    // finnes fordi den ekte lagringen mangler.
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Fant ikke tråden' })).toBeVisible();
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
  /**
   * Reise 8: det første en ny bruker møter er en kontroll uten effekt.
   *
   * Backend filtrerer ikke på dokumenter ennå (API-bestilling A2), så mocken
   * er det eneste stedet valget kan få en virkning å se på — og da må hele
   * kjeden følge med, ikke bare kildelista: linja over svaret, markørene inne
   * i teksten, tellingen i «Fremgangsmåte» og kortene i kildepanelet.
   *
   * Fikstureringen gjør regnestykket etterprøvbart: tre årsrapporter fra
   * Nkom, 2021, 2022 og 2023, med utdrag [1][2] i 2022, [3][4] i 2023 og [5]
   * i 2021. Velger leseren 2023, står [3] og [4] igjen — og bare de.
   */
  test('filteret når spørringen: 2 treff i 1 dokument, og markørene følger med', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'filter → spørring');
    await page.goto('/');

    await chooseFacetValue(page, 'År', '2023');
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');

    // Svaret sier selv hva det ble spurt mot.
    await expect(page.getByText(/Avgrenset til: 2023/)).toBeVisible();

    // «Fremgangsmåte» teller det som faktisk overlevde, ikke det korpuset har.
    await expect(page.getByText('2 treff i 1 dokument')).toBeVisible();

    // Markørene: de to som peker inn i 2023-rapporten står, og de tre andre
    // er borte fra teksten. En død [1] ville sagt «frontenden er i stykker»
    // i stedet for «det dokumentet er utenfor utvalget ditt».
    const answer = (await page.locator('.ka-answer-card').first().innerText()).replace(/\s+/g, ' ');
    expect(answer, 'markøren inn i 2023-rapporten står').toContain('[3]');
    expect(answer).toContain('[4]');
    for (const gone of ['[1]', '[2]', '[5]']) {
      expect(answer, `${gone} peker på et dokument utenfor utvalget`).not.toContain(gone);
    }

    // Og kildepanelet viser ett kort, ikke tre.
    await openSources(page, 3);
    await expect(page.locator('.source-document')).toHaveCount(1);
    await expect(page.locator('.source-document__subtitle')).toHaveText(/2023$/);

    await expectNoAxeViolations(page, 'et svar med filteret på');
  });

  /**
   * Punkt 10 i brukerblikket: et avbrutt svar var en blindvei. Kopier-knappen
   * og trådlenka forsvinner — det er riktig, det er ingenting å kopiere — men
   * det som sto igjen var ingenting i det hele tatt.
   *
   * Testen måler begge halvdelene: at veien videre finnes, og at den virker.
   * Det siste er det som betyr noe; en knapp som bare står der er ikke en vei.
   */
  test('et avbrutt svar har en vei videre, og «Generer på nytt» går helt i mål', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'avbrutt svar: «Generer på nytt»');
    await page.goto('/');

    await composer(page).click();
    await page.keyboard.type('Hvordan jobber Nkom med måloppnåelse?');
    await page.keyboard.press('Enter');

    const stop = page.getByRole('button', { name: 'Avbryt genereringen' });
    await expect(stop).toBeVisible();
    // Vent til det står tekst der, så «avbrutt» betyr avbrutt midt i noe.
    await expect(page.locator('.ka-answer-card')).toBeVisible();
    await page.waitForTimeout(2500);
    await stop.click();

    // Halve svaret står igjen, og det sier hvorfor kildene aldri kom.
    await expect(
      page.getByText('Svaret ble avbrutt, så kildene bak det kom aldri fram.'),
    ).toBeVisible();
    const again = page.getByRole('button', { name: 'Generer på nytt' });
    await expect(again).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kopier svaret' })).toHaveCount(0);

    await expectNoAxeViolations(page, 'et avbrutt svar');

    await again.click();

    // Og det nye svaret er et helt svar: kopier-knappen er tilbake, og
    // kildene med den.
    await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Generer på nytt' })).toHaveCount(0);
  });

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
