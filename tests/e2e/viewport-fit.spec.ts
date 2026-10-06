import { expect, test, type Page } from '@playwright/test';
import { covers } from './a11y';
import { ANSWER_TIMEOUT, composer } from './helpers';

/**
 * Ingenting ruller sidelengs, på noen bredde fra 320 (WCAG 1.4.10 Reflow).
 *
 * Målt 06.10 på telefon: hovedkolonnen rullet sidelengs, 37 px på 375 og 19
 * på 393, med et rullefelt nederst på skjermen. Årsaken var lange ord som
 * ikke ble brutt, i et forslag og i en trådtittel, og chips som ikke kunne
 * brytes. Denne fila passer på at det ikke kommer tilbake, uansett hva som
 * stikker ut neste gang.
 *
 * Én test per bruddpunkt, som går gjennom tilstandene i samme side. Feiler
 * noe, sier meldingen hvilken tilstand, hvilket element og hvor langt.
 *
 * Påstandene regnes ut i siden:
 * - `<html>` har ikke overflyt, og `window.scrollTo` flytter ingenting.
 * - `main` ruller ikke sidelengs.
 * - Ingen synlige elementer går utenfor vinduet sidelengs. Det som klippes av
 *   en boks med egen rulling, som tabellene i et svar, regnes ikke. Det gjør
 *   heller ikke lukkede skuffer, `inert` og `hidden`.
 * - Bare de avtalte boksene ruller (`SCROLLERS`).
 */

type Size = { name: string; width: number; height: number; dpr?: 2 | 3 };

/** Telefonene har `dpr`, og kjører med `isMobile` og `hasTouch`. */
const SIZES: Size[] = [
  { name: '320×568', width: 320, height: 568, dpr: 2 },
  { name: '360×740', width: 360, height: 740, dpr: 3 },
  { name: '375×667', width: 375, height: 667, dpr: 2 },
  { name: '393×852', width: 393, height: 852, dpr: 3 },
  { name: '430×932', width: 430, height: 932, dpr: 3 },
  { name: 'liggende 667×375', width: 667, height: 375, dpr: 2 },
  { name: 'liggende 852×393', width: 852, height: 393, dpr: 3 },
  { name: '768×1024', width: 768, height: 1024 },
  { name: '1024×768', width: 1024, height: 768 },
  { name: '1280×800', width: 1280, height: 800 },
  { name: '1440×900', width: 1440, height: 900 },
  { name: '1920×1080', width: 1920, height: 1080 },
];

/**
 * The boxes that are meant to scroll, and in which direction. Anything else
 * that scrolls is a finding.
 */
const SCROLLERS: { selector: string; x: boolean; y: boolean }[] = [
  { selector: 'main', x: false, y: true },
  { selector: '.sidebar-content', x: false, y: true },
  { selector: '.markdown__table', x: true, y: false },
  { selector: '.markdown__pre', x: true, y: false },
  { selector: '.ka-agent-picker', x: false, y: true },
  { selector: 'textarea', x: false, y: true },
];

/**
 * Panel widths stored by a desktop session, wider than a phone. The overflow
 * was first seen in a browser with stored widths, and a phone has to draw
 * from them too.
 */
const STORED_WIDE_LAYOUT = JSON.stringify({
  collapsed: { 'primary-sidebar': false, 'secondary-sidebar': false },
  widths: { 'primary-sidebar': 560, 'secondary-sidebar': 640 },
  sourcesDismissed: false,
});

/** A file name with no space in it, longer than a phone is wide. */
const LONG_FILE_NAME =
  'Arsrapport_2024_Kommunikasjonsmyndigheten_endelig_versjon_med_vedlegg_og_merknader_fra_styret_2025-03-14_v7_godkjent.pdf';

type Fit = {
  html: { x: number; y: number };
  moved: { x: number; y: number };
  main: number;
  outside: string[];
  scrolling: string[];
};

async function measure(page: Page): Promise<Fit> {
  return page.evaluate((allowed) => {
    const root = document.documentElement;
    const width = root.clientWidth;
    const main = document.querySelector('main');
    if (!main) throw new Error('fant ikke main');

    const describe = (el: Element) =>
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : '') +
      (typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '');

    const shown = (el: Element) => {
      if (el.closest('[inert], [hidden], dialog:not([open]), .ds-sr-only')) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };

    // Clipped by a box of its own, which then has to stay inside the window.
    const clipped = (el: Element) => {
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        if (getComputedStyle(up).overflowX !== 'visible') return true;
      }
      return false;
    };

    const outside: string[] = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!shown(el) || clipped(el)) continue;
      const box = el.getBoundingClientRect();
      if (box.right > width + 0.5) {
        outside.push(`${describe(el)} går ${Math.round(box.right - width)} px ut til høyre`);
      } else if (box.left < -0.5) {
        outside.push(`${describe(el)} går ${Math.round(-box.left)} px ut til venstre`);
      }
    }
    const texts = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim() || !shown(parent) || clipped(parent)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const right = Math.max(...[...range.getClientRects()].map((box) => box.right));
      if (right > width + 0.5) {
        outside.push(
          `teksten «${node.textContent.trim().slice(0, 40)}» i ${describe(parent)} går ${Math.round(right - width)} px ut`,
        );
      }
    }

    const scrolling: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      if (!shown(el)) continue;
      const style = getComputedStyle(el);
      const x = el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(style.overflowX);
      const y = el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(style.overflowY);
      if (!x && !y) continue;
      const rule = allowed.find((candidate) => el.matches(candidate.selector));
      if (x && !rule?.x) {
        scrolling.push(`${describe(el)} ruller ${el.scrollWidth - el.clientWidth} px sidelengs`);
      }
      if (y && !rule?.y) scrolling.push(`${describe(el)} ruller på langs`);
    }

    const start = { x: window.scrollX, y: window.scrollY };
    window.scrollTo(400, 400);
    const moved = { x: window.scrollX - start.x, y: window.scrollY - start.y };
    window.scrollTo(start.x, start.y);

    return {
      html: { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight },
      moved,
      main: main.scrollWidth - main.clientWidth,
      outside: outside.slice(0, 10),
      scrolling,
    };
  }, SCROLLERS);
}

function expectFits(fit: Fit, where: string): void {
  expect.soft(fit.html, `${where}: <html> har overflyt`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.moved, `${where}: window.scrollTo flyttet siden`).toEqual({ x: 0, y: 0 });
  expect.soft(fit.main, `${where}: main ruller sidelengs`).toBe(0);
  expect.soft(fit.outside, `${where}: utenfor vinduet sidelengs`).toEqual([]);
  expect.soft(fit.scrolling, `${where}: ruller uten å skulle`).toEqual([]);
}

/** Opens a sidebar by its rail or toggle, when it is not open already. */
async function openSidebar(page: Page, name: string): Promise<void> {
  const show = page.getByRole('button', { name, exact: true });
  if (await show.count()) {
    await show.click();
    await page.waitForTimeout(400);
  }
}

/** Closes whatever drawer or menu is open. */
async function closeOverlay(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      ...(size.dpr ? { isMobile: true, hasTouch: true, deviceScaleFactor: size.dpr } : {}),
    });

    test(`ingenting ruller sidelengs på ${size.name}`, async ({ page }, testInfo) => {
      covers(testInfo, 'skallet: ingenting ruller sidelengs fra 320 (WCAG 1.4.10)');
      test.setTimeout(ANSWER_TIMEOUT * 2 + 30_000);

      await page.goto('/');
      await expect(page.locator('main')).toBeVisible();
      expectFits(await measure(page), 'startsiden');

      await page.getByRole('button', { name: /^Agent:/ }).click();
      await expect(page.locator('.ka-agent-picker')).toBeVisible();
      expectFits(await measure(page), 'agentmenyen åpen');
      await closeOverlay(page);

      await composer(page).click();
      await page.keyboard.type('simuler lang lenke');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
        timeout: ANSWER_TIMEOUT,
      });
      expectFits(await measure(page), 'svar med en lang lenke');

      await page.goto('/threads/nkom-maaloppnaaelse');
      await expect(page.locator('main .markdown').first()).toBeVisible();
      expectFits(await measure(page), 'tråd med svar og kilder');

      await openSidebar(page, 'Vis tråder og filter');
      expectFits(await measure(page), 'navigasjonspanelet åpent');
      if (await page.locator('dialog[open]').count()) await closeOverlay(page);

      await openSidebar(page, 'Vis kilder');
      expectFits(await measure(page), 'kildepanelet åpent');
      if (await page.locator('dialog[open]').count()) await closeOverlay(page);

      await page.locator('.ka-composer__file-input').setInputFiles({
        name: LONG_FILE_NAME,
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
      });
      await expect(page.locator('.ka-attachments')).toBeVisible();
      expectFits(await measure(page), 'vedlegg med et langt filnavn');

      await page.evaluate(
        (stored) => localStorage.setItem('ka.layout.v1', stored),
        STORED_WIDE_LAYOUT,
      );
      await page.reload();
      await expect(page.locator('main .markdown').first()).toBeVisible();
      expectFits(await measure(page), 'brede panelbredder lagret fra en annen økt');
    });
  });
}
