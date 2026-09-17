import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  covers,
  expectAllContentInLandmarks,
  expectNoAxeViolations,
  saveScreenshot,
  setColorScheme,
} from './a11y';
import { walkWithTab } from './helpers';

/**
 * The edges between the panels, which the reader can move.
 *
 * Lars's vision asks for columns that can be resized in the GUI, and punkt 24
 * of the brukerreise list calls it essential: the answer and the source it
 * rests on have to be readable side by side, and 640 px of answer beside
 * 336 px of excerpt is not always the split a reader wants.
 *
 * What is measured here is the product's promise rather than the
 * implementation: the panel is DRAWN at the width the separator reports, the
 * keyboard reaches everywhere the pointer does (WCAG 2.5.7), the choice
 * survives a reload, and nothing the reader can drag produces a horizontal
 * scrollbar at the three widths the product is used at.
 *
 * The numbers are the decision's, written out rather than imported, for the
 * same reason as in layout.spec.ts: a test that imports the number it checks
 * agrees with the code even when the code and the decision do not.
 */
const NAV_DEFAULT = 400;
const NAV_MAX = 480;
const SOURCES_DEFAULT = 432;
const SOURCES_FLOOR = 336;
const SOURCES_MAX = 560;

/** Arrow keys move the edge this far; Shift makes it a stride. */
const STEP = 16;
const STRIDE = 64;

/** 1536 has room to move an edge; 1440 and 1280 are the other two states. */
const ROOMY = 1536;
const HEIGHT = 900;

const WIDTHS = [1280, 1440, 1536];

type Panel = 'tråder og filter' | 'kilder';

function separator(page: Page, panel: Panel): Locator {
  return page.getByRole('separator', { name: `Endre bredde på ${panel}` });
}

const wider = (page: Page, panel: Panel) =>
  page.getByRole('button', { name: `Gjør ${panel} bredere` });
const narrower = (page: Page, panel: Panel) =>
  page.getByRole('button', { name: `Gjør ${panel} smalere` });

function panelWidth(page: Page, selector: string): Promise<number> {
  return page.evaluate(
    (css) => Math.round(document.querySelector(css)!.getBoundingClientRect().width),
    selector,
  );
}

/**
 * The drawn width, polled.
 *
 * Polled and not read once, because two of the things that change it —
 * resizing the window, and the layout rule that collapses a sidebar — reach
 * the page as an event React answers on its next render. A single read is a
 * race, and it is the flaky kind: it passes on a fast machine.
 */
async function expectPanelWidth(page: Page, selector: string, expected: number, where: string) {
  await expect
    .poll(() => panelWidth(page, selector), { message: `bredden på ${where}` })
    .toBe(expected);
}

/**
 * Tab until the separator has focus.
 *
 * `focus()` would be quicker and would prove less: Chromium only paints
 * `:focus-visible` when the focus came from the keyboard, so a programmatic
 * focus shows no ring — and the ring is what this is about. It also measures
 * the thing WCAG 2.1.1 actually asks: that the edge can be REACHED from the
 * keyboard, not only used once it has focus.
 */
async function tabTo(page: Page, handle: Locator, limit = 60): Promise<void> {
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    if (await handle.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error('skillet ble aldri nådd med Tab');
}

/** Opens the sources panel the way a user does, with its own button. */
async function showSources(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Vis kilder' }).click();
  await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
}

/** Drags an edge by `by` CSS pixels along the row. */
async function drag(page: Page, handle: Locator, by: number): Promise<void> {
  const box = (await handle.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  // Two moves, not one: a single jump from press to release is a gesture no
  // hand makes, and it would pass over an implementation that only listens
  // while the pointer is already moving.
  await page.mouse.move(box.x + box.width / 2 + by / 2, y);
  await page.mouse.move(box.x + box.width / 2 + by, y);
  await page.mouse.up();
}

test.describe('panelbredder', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: ROOMY, height: HEIGHT });
  });

  test('musa drar navigasjonspanelet bredere, og panelet tegnes der', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: dra med mus');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);

    await drag(page, handle, 60);

    // The drawn width is the assertion, not the stored one: a model that
    // moved while the panel stood still is the bug this is here to catch.
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_DEFAULT + 60,
      'navigasjonspanelet etter dragingen',
    );
    await expect(handle).toHaveAttribute('aria-valuenow', String(NAV_DEFAULT + 60));
  });

  test('musa drar kildepanelet, som ligger på den andre sida av hovedkolonnen', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: dra med mus');
    await page.goto('/');
    await showSources(page);

    const handle = separator(page, 'kilder');
    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_DEFAULT);

    // Toward the inline end, which for this panel means narrower: the edge
    // follows the hand, and the panel is on the other side of the edge.
    await drag(page, handle, 40);

    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_DEFAULT - 40);
  });

  test('ett klikk gjør panelet bredere og smalere, uten en eneste draging', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: pekervei uten draging (WCAG 2.5.7)');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');

    // `click()` er trykk og slipp på samme punkt: ingen bevegelse mellom dem,
    // som er nettopp det 2.5.7 krever at skal holde. Ingen mouse.down/move
    // her med vilje.
    await wider(page, 'tråder og filter').click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT + STEP, 'etter ett klikk');

    await wider(page, 'tråder og filter').click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT + 2 * STEP, 'etter to klikk');

    await narrower(page, 'tråder og filter').click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT + STEP, 'etter ett klikk tilbake');

    // Og separatoren melder det samme tallet: de to kontrollene flytter den
    // samme kanten.
    await expect(separator(page, 'tråder og filter')).toHaveAttribute(
      'aria-valuenow',
      String(NAV_DEFAULT + STEP),
    );
  });

  test('knappene når helt opp til taket, og sier fra når de er der', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: pekervei uten draging (WCAG 2.5.7)');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');

    // Gulvet er der panelet står, så «smalere» er av fra første render — men
    // den blir stående i tab-rekkefølgen, for ett trykk på «bredere» gjør
    // den nyttig igjen.
    await expect(narrower(page, 'tråder og filter')).toHaveAttribute('aria-disabled', 'true');
    await expect(narrower(page, 'tråder og filter')).toHaveAttribute('tabindex', '0');

    for (let press = 0; press < 5; press += 1) await wider(page, 'tråder og filter').click();
    await expectPanelWidth(page, '.primary-sidebar', NAV_MAX, 'etter fem klikk');

    // `aria-disabled`, ikke `disabled`: knappen blir stående i tab-rekkefølgen
    // så fokus ikke faller til body midt i en serie klikk på den.
    const atTop = wider(page, 'tråder og filter');
    await expect(atTop).toHaveAttribute('aria-disabled', 'true');
    expect(await atTop.evaluate((element) => element.hasAttribute('disabled'))).toBe(false);

    // `force`, fordi Playwright regner `aria-disabled` som av og ellers venter
    // på at knappen skal bli aktiv igjen. Poenget med paret er nettopp at
    // nettleseren fortsatt leverer klikket, og at håndtereren er det som gjør
    // knappen inert — så det er det klikket som skal måles.
    await atTop.click({ force: true });
    await expectPanelWidth(page, '.primary-sidebar', NAV_MAX, 'etter et klikk på grensa');
  });

  test('en kollapset sidekolonne har ingen breddeknapper', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ett skille per åpen sidekolonne');
    await page.goto('/');

    await expect(wider(page, 'kilder')).toHaveCount(0);
    await expect(wider(page, 'tråder og filter')).toHaveCount(1);

    await page.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    await expect(wider(page, 'tråder og filter')).toHaveCount(0);
  });

  test('på 1440 finnes ingen breddekontroller i det hele tatt', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    // 400 + 32 + 640 + 32 + 336 er vinduet nøyaktig: gulv, tak og bredden på
    // skjermen er ett og samme tall for begge sidekolonnene, og ingen av de
    // seks kontrollene kan gjøre noe uansett hva leseren trykker på.
    //
    // Brukerblikk 3, funn 2: fire varig avslåtte knapper på den bredden alle
    // Figma-rammene er tegnet i. Avslått er noe som går over — dette gjør det
    // ikke, og da er det ingen kontroll, bare noe som ser ødelagt ut. Lars
    // 17.09, beslutning 9 alternativ (c).
    for (const panel of ['tråder og filter', 'kilder'] as const) {
      await expect(separator(page, panel)).toHaveCount(0);
      await expect(wider(page, panel)).toHaveCount(0);
      await expect(narrower(page, panel)).toHaveCount(0);
    }

    // Og ingen av dem dukker opp i en Tab-vandring, som er den andre måten å
    // møte dem på.
    const steps = await walkWithTab(page);
    expect(
      steps.filter((step) => /^(Endre bredde på|Gjør )/.test(step.name)),
      'breddekontrollene skal ikke finnes når de ikke kan gjøre noe',
    ).toEqual([]);

    // Panelkanten står der fortsatt. Det er gripeflata som er borte, ikke
    // grensa mellom panelet og svarkolonnen: den tegnes av panelets egen
    // ramme.
    const border = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.primary-sidebar .panel')!).borderInlineEndWidth,
    );
    expect(border, 'panelets egen ramme tegner kanten').not.toBe('0px');
  });

  test('på 1680 er alle fire knappene og begge skillene tilbake', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    // 1680: 400 + 32 + 640 + 32 + 432 = 1536, så det er 144 px å fordele og
    // begge kantene kan flyttes. Kontrollene kommer tilbake av seg selv når
    // vinduet vokser — det er den samme `fixed` som tok dem bort.
    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    for (const panel of ['tråder og filter', 'kilder'] as const) {
      await expect(separator(page, panel)).toHaveCount(1);
      await expect(separator(page, panel)).toHaveAttribute('tabindex', '0');
      await expect(wider(page, panel)).toHaveCount(1);
      await expect(narrower(page, panel)).toHaveCount(1);
    }

    // Og de virker: en knapp som er tegnet skal kunne gjøre noe.
    await wider(page, 'tråder og filter').click();
    await expectPanelWidth(
      page,
      '.primary-sidebar',
      NAV_DEFAULT + STEP,
      'etter ett klikk ved 1680',
    );
  });

  test('kontrollene forsvinner og kommer tilbake med vinduet', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ingen tomme tabbstopp');
    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await page.goto('/');
    await showSources(page);
    await expect(wider(page, 'kilder')).toHaveCount(1);

    await page.setViewportSize({ width: 1440, height: HEIGHT });
    await expect(wider(page, 'kilder')).toHaveCount(0);
    await expect(separator(page, 'kilder')).toHaveCount(0);

    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await expect(wider(page, 'kilder')).toHaveCount(1);
    await expect(separator(page, 'kilder')).toHaveCount(1);
  });

  test('piltastene gjør det samme som musa, 16 px og 64 med Shift', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tastatur er likeverdig');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await expect(handle).toBeFocused();

    await page.keyboard.press('ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STEP);

    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STEP + STRIDE);

    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('Home og End går til det smaleste og det bredeste panelet kan være', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: tastatur er likeverdig');
    await page.goto('/');
    await showSources(page);

    const handle = separator(page, 'kilder');
    await handle.focus();

    await page.keyboard.press('Home');
    expect(await panelWidth(page, '.secondary-sidebar')).toBe(SOURCES_FLOOR);

    await page.keyboard.press('End');
    // 1536 − 400 (navigasjonspanelet) − 64 (to gap) − 640 (gulvet til
    // hovedkolonnen) = 432, som er under taket på 560. Det trangeste av de to
    // vinner, og det er vinduet.
    await expectPanelWidth(page, '.secondary-sidebar', SOURCES_DEFAULT, 'kildepanelet på End');
    expect(Number(await handle.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(SOURCES_MAX);
  });

  test('Enter og dobbeltklikk setter bredden tilbake til standard', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tilbakestilling');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    await page.keyboard.press('Enter');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);

    await drag(page, handle, 50);
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + 50);

    await handle.dblclick();
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('bredden overlever at sida lastes på nytt, og tilbakestilling glemmer den', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: huskes i ka.layout.v1');
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    await page.reload();
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT + STRIDE);

    // Tilbakestilling fjerner den lagrede bredden, den skriver ikke standarden
    // ned en gang til.
    await separator(page, 'tråder og filter').focus();
    await page.keyboard.press('Enter');
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('ka.layout.v1') ?? '{}'),
    );
    expect(stored.widths).toEqual({});

    await page.reload();
    expect(await panelWidth(page, '.primary-sidebar')).toBe(NAV_DEFAULT);
  });

  test('taket er vinduets, ikke bare modellens', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: grensene holder');
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');

    const handle = separator(page, 'tråder og filter');
    await handle.focus();
    await page.keyboard.press('End');

    // 1920 har rikelig plass, så modellens tak på 480 er det trangeste.
    await expectPanelWidth(page, '.primary-sidebar', NAV_MAX, 'navigasjonspanelet ved 1920');

    // Ved 1440 med begge sidekolonner åpne står alt på gulvet sitt, og da er
    // det ingenting å dra i. Den lagrede 480-en står igjen i modellen og skal
    // verken tegnes eller meldes.
    await showSources(page);
    await page.setViewportSize({ width: 1440, height: HEIGHT });

    await expectPanelWidth(page, '.primary-sidebar', NAV_DEFAULT, 'navigasjonspanelet ved 1440');
    await expectPanelWidth(page, '.secondary-sidebar', SOURCES_FLOOR, 'kildepanelet ved 1440');
    // Og skillet er borte, for det er ingen kant å flytte. Den lagrede 480-en
    // står igjen i modellen og skal verken tegnes eller meldes.
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);

    // Så på 1680, der det er noe å gi igjen: aria-valuenow er det eneste som
    // sier hvor kanten står til en som ikke ser den, og det skal være bredden
    // på skjermen, ikke den lagrede. 400 + 32 + 640 + 32 + 432 = 1536, så de
    // 144 som er igjen tar navigasjonspanelet helt opp til sitt eget tak.
    await page.setViewportSize({ width: 1680, height: HEIGHT });
    await expectPanelWidth(page, '.primary-sidebar', NAV_MAX, 'navigasjonspanelet ved 1680');
    await expect(separator(page, 'tråder og filter')).toHaveAttribute(
      'aria-valuenow',
      String(NAV_MAX),
    );
  });

  test('en kollapset sidekolonne har ingen skille å dra i', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: ett skille per åpen sidekolonne');
    await page.goto('/');

    // Kildepanelet er kollapset som standard: en rail er én knapp bred og har
    // ingen bredde å endre, så et tab-stopp der er et tab-stopp i veien.
    await expect(separator(page, 'kilder')).toHaveCount(0);
    await expect(separator(page, 'tråder og filter')).toHaveCount(1);

    await page.getByRole('button', { name: 'Skjul tråder og filter' }).click();
    await expect(separator(page, 'tråder og filter')).toHaveCount(0);
  });

  for (const width of WIDTHS) {
    test(`ingen vannrett rulling ved ${width} uansett hva brukeren har dratt`, async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'panelbredde: ingen vannrett rulling');
      await page.setViewportSize({ width, height: HEIGHT });
      await page.goto('/');

      // Begge ytterpunkter, og med kildepanelet både åpent og kollapset: det
      // er kombinasjonen av en dratt kolonne og en kolonne som åpner seg som
      // er den trange.
      //
      // Hvilke skiller som finnes, avhenger av tilstanden — under 1440 er
      // bare én sidekolonne åpen om gangen, så navigasjonspanelets skille er
      // borte når kildepanelet åpnes. Derfor dras de som er der, ikke et
      // skille testen har bestemt seg for på forhånd.
      for (const sources of ['collapsed', 'open'] as const) {
        if (sources === 'open') await showSources(page);

        for (const key of ['End', 'Home'] as const) {
          const handles = page.getByRole('separator');
          const count = await handles.count();
          // Skrevet ut per tilstand og ikke `> 0`, for antallet er ikke det
          // samme overalt lenger og et løkketrinn som drar ingenting skal
          // ikke kunne bli stille: ved 1440 med begge sidekolonner åpne står
          // alt på gulvet sitt og det finnes ingen kant å flytte, mens ved
          // 1536 er det bare kildepanelets kant som kan gi noe.
          expect(count, `skiller ved ${width}, ${sources}`).toBe(
            width === 1440 && sources === 'open' ? 0 : 1,
          );

          for (let index = 0; index < count; index += 1) {
            await handles.nth(index).focus();
            await page.keyboard.press(key);
          }

          await expect
            .poll(
              () =>
                page.evaluate(() => ({
                  document: document.documentElement.scrollWidth,
                  window: window.innerWidth,
                  client: document.documentElement.clientWidth,
                })),
              { message: `plassen ved ${width}, ${sources}, ${key}` },
            )
            .toEqual({ document: width, window: width, client: width });
        }
      }
    });
  }

  test('skillet ligger inne i landemerket det endrer bredden på', async ({ page }, testInfo) => {
    covers(testInfo, 'panelbredde: tilgjengelig i begge moduser');
    await page.setViewportSize({ width: 1920, height: HEIGHT });

    // Regresjonen #50 slapp gjennom: skillet lå som et søsken av landemerkene
    // i stedet for inni ett, og `region` er en best-practice-regel som
    // `expectNoAxeViolations` ikke kjører. Målt av KA CC på fire ruter.
    for (const path of ['/', '/threads/nkom-maaloppnaaelse', '/tull']) {
      await page.goto(path);
      await expectAllContentInLandmarks(page, path);
    }

    // Og med begge panelene åpne, som er den eneste tilstanden der begge
    // skillene finnes samtidig.
    await page.goto('/threads/nkom-maaloppnaaelse');
    await showSources(page);
    await expectAllContentInLandmarks(page, 'begge sidekolonner åpne');

    const inside = await page.evaluate(() =>
      [...document.querySelectorAll('.panel-separator')].map((separator) =>
        separator.closest('nav, aside, main')?.tagName.toLowerCase(),
      ),
    );
    expect(inside, 'hvert skille ligger i landemerket det hører til').toEqual(['nav', 'aside']);
  });

  test('skillet har navn, fokusring og null axe-brudd i lys og mørk', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelbredde: tilgjengelig i begge moduser');
    // 1920 og ikke 1536: på 1536 med begge panelene åpne står navigasjons-
    // panelet på gulvet og taket sitt samtidig, og da er skillet ute av
    // tab-rekkefølgen med vilje. Fokusringen måles der det er noe å gjøre.
    await page.setViewportSize({ width: 1920, height: HEIGHT });
    await page.goto('/');
    await showSources(page);

    for (const scheme of ['light', 'dark'] as const) {
      await setColorScheme(page, scheme);

      const handle = separator(page, 'tråder og filter');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await tabTo(page, handle);

      // Fokusringen er Designsystemets, gjennom `ds-focus`. Uten den er
      // skillet et tastaturstopp ingen ser hvor er (WCAG 2.4.7).
      const ring = await handle.evaluate((element) => {
        const style = getComputedStyle(element);
        return { outline: style.outlineStyle, shadow: style.boxShadow };
      });
      expect(ring.outline, `fokusring i ${scheme}`).not.toBe('none');
      expect(ring.shadow, `fokusring i ${scheme}`).not.toBe('none');

      // Gripeflata, pekeren og fingeren. `touch-action: none` er det ene som
      // kan ryke uten at noe annet merker det: uten den tar nettleseren
      // bevegelsen som en rulling, og kanten står stille på berøring mens
      // musa fortsatt virker.
      const grip = await handle.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          width: Math.round(element.getBoundingClientRect().width),
          cursor: style.cursor,
          touchAction: style.touchAction,
        };
      });
      expect(grip, `gripeflata i ${scheme}`).toEqual({
        width: 8,
        cursor: 'col-resize',
        touchAction: 'none',
      });

      await expectNoAxeViolations(page, `skillene i ${scheme === 'light' ? 'lys' : 'mørk'} modus`);
    }

    await setColorScheme(page, 'light');
    await saveScreenshot(page, 'panelbredde-skille-lys');
  });
});
