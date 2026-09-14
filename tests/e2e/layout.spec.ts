import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations, saveScreenshot, setColorScheme } from './a11y';
import { ask, citation } from './helpers';

/**
 * The layout at the widths the product is actually used at.
 *
 * Two kinds of test live here. The first two came out of the visual review
 * against Figma (`docs/review/visuell-2026-09-11.md`) and are here so the
 * same two cannot come back. The rest hold the V1 decision the conductor made
 * on 2026-09-14 (`design/_briefs/bygg/rolle-5c-layout-v1.md`), which is what
 * #5 is building: the sources panel gives way, one sidebar at a time below
 * 1440, and no horizontal scrolling at 1280 or above in any state.
 *
 * 1440 is not an arbitrary number twice over. Every frame in
 * `design/omraader/` is drawn at 1440, so it is the one width the design
 * speaks about — and it is also the sum below, which is why the decision made
 * it the app's first breakpoint.
 */

/**
 * The widths from the decision, in CSS pixels, as they occupy the row.
 *
 * Written out here rather than imported from `src/layout/viewModel.ts` on
 * purpose: these tests measure what the window does, and a test that imports
 * the numbers it is checking would agree with the code even when the code and
 * the decision disagree. If #5 changes a number, this file has to change too,
 * and that is the point — the decision is the fixture, not the source.
 */
const NAV_OPEN = 400;
const NAV_COLLAPSED = 232;
const MAIN_FLOOR = 640;
const MAIN_CEILING = 800;
const SOURCES_PREFERRED = 432;
const SOURCES_FLOOR = 336;
const SOURCES_COLLAPSED = 198;
const GAP = 32;

/**
 * The narrowest window where both sidebars fit open with the answer column on
 * its floor and the sources panel on its minimum. This is the breakpoint, and
 * it is a sum rather than a round number: 400 + 32 + 640 + 32 + 336 = 1440.
 */
const BOTH_SIDEBARS_MIN_VIEWPORT = NAV_OPEN + GAP + MAIN_FLOOR + GAP + SOURCES_FLOOR;

/**
 * The narrowest window where all three slots fit at their preferred widths:
 * 400 + 32 + 640 + 32 + 432 = 1536, the common laptop width exactly.
 */
const PREFERRED_VIEWPORT = NAV_OPEN + GAP + MAIN_FLOOR + GAP + SOURCES_PREFERRED;

/**
 * 1280 is the floor of V1 (answer 45: desktop and large tablet first).
 * Narrower than this is undesigned — the sources panel becomes a drawer over
 * the answer column, later — so nothing here measures below it.
 */
const V1_MIN_VIEWPORT = 1280;

/**
 * The answer column's floor while the sources panel is collapsed.
 *
 * 640 exists so the sources can be read BESIDE the answer (answers 46, 49,
 * 59). With the panel collapsed there is nothing beside it, so the reason
 * does not apply in that state — and the state has to fit at 1280, which 640
 * does not: 400 + 32 + 640 + 32 + 198 = 1302. The conductor settled this on
 * 2026-09-14 (`rolle-5c-layout-v1.md`, lever a) after this file measured the
 * 22 px; 618 is not a new number but what V1's narrowest window leaves once
 * the other three are paid.
 */
const MAIN_FLOOR_SOURCES_COLLAPSED = V1_MIN_VIEWPORT - NAV_OPEN - GAP - GAP - SOURCES_COLLAPSED;

const WIDTHS = [V1_MIN_VIEWPORT, BOTH_SIDEBARS_MIN_VIEWPORT, PREFERRED_VIEWPORT];

const HEIGHT = 900;

type SlotState = 'open' | 'collapsed';

type LayoutState = {
  /** For test titles and screenshot names. Norwegian, like everything visible. */
  id: string;
  label: string;
  nav: SlotState;
  sources: SlotState;
};

const STATES: LayoutState[] = [
  {
    id: 'begge-kollapset',
    label: 'begge sidekolonner kollapset',
    nav: 'collapsed',
    sources: 'collapsed',
  },
  // What `defaultLayout` opens on, so this is the state a user meets.
  { id: 'nav-aapent', label: 'bare navigasjonspanelet åpent', nav: 'open', sources: 'collapsed' },
  { id: 'kilder-aapent', label: 'bare kildepanelet åpent', nav: 'collapsed', sources: 'open' },
  { id: 'begge-aapne', label: 'begge sidekolonner åpne', nav: 'open', sources: 'open' },
];

/** A state by name, so the tests read as what they are rather than as an index. */
function stateNamed(id: string): LayoutState {
  const state = STATES.find((candidate) => candidate.id === id);
  if (!state) throw new Error(`ukjent layouttilstand: ${id}`);
  return state;
}

/** Rule B: both sidebars open is only a state the product allows from 1440. */
function statesAt(width: number): LayoutState[] {
  return STATES.filter(
    (state) => width >= BOTH_SIDEBARS_MIN_VIEWPORT || state.id !== 'begge-aapne',
  );
}

/**
 * Puts the two sidebars in the asked-for state the way a user does: with the
 * buttons that carry `aria-expanded`, not by reaching into the layout state.
 *
 * The sources panel is opened without asking a question. That is deliberate:
 * an empty panel is the narrowest the slot ever is, and the question is
 * whether the SLOT fits, not whether its content does. One test further down
 * does the same measurement with a real answer behind it.
 */
async function setSidebars(page: Page, state: LayoutState): Promise<void> {
  const toggles = {
    nav: page.getByRole('button', { name: /^(Vis|Skjul) tråder og filter$/ }),
    sources: page.getByRole('button', { name: /^(Vis|Skjul) kilder$/ }),
  };

  const set = async (slot: 'nav' | 'sources', wanted: SlotState) => {
    const toggle = toggles[slot];
    const expanded = String(wanted === 'open');
    if ((await toggle.getAttribute('aria-expanded')) !== expanded) await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', expanded);
  };

  // The sources panel first, the navigation panel second. Below 1440 opening
  // one sidebar collapses the other, so whichever is asked for last is the
  // one that survives — and the navigation panel is the one `defaultLayout`
  // starts open, so it is the one whose state has to be settled last.
  await set('sources', state.sources);
  await set('nav', state.nav);

  // Read back after both moves. If rule B fired while the second one was set
  // and quietly undid the first, the state under test is not the state on
  // screen, and every measurement below would be measuring something else.
  await expect(
    toggles.sources,
    `kildepanelet skal fortsatt være ${state.sources === 'open' ? 'åpent' : 'kollapset'}`,
  ).toHaveAttribute('aria-expanded', String(state.sources === 'open'));
}

type Measurement = {
  documentWidth: number;
  windowWidth: number;
  /** Excludes a document-level scrollbar; equal to windowWidth when there is none. */
  clientWidth: number;
  navLeftEdge: number;
  navWidth: number;
  mainWidth: number;
  sourcesWidth: number;
};

async function measure(page: Page): Promise<Measurement> {
  // Wait for the web font before measuring anything. Inter comes from a CDN
  // and the fallback's metrics are not Inter's; a label that fits on one line
  // in the fallback and wraps in Inter changes a panel's height, and in a
  // narrow window it can change what fits.
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate(() => {
    const width = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? Math.round(element.getBoundingClientRect().width) : -1;
    };

    return {
      documentWidth: document.documentElement.scrollWidth,
      windowWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      navLeftEdge: Math.round(
        document.querySelector('.primary-sidebar')!.getBoundingClientRect().x,
      ),
      navWidth: width('.primary-sidebar'),
      mainWidth: width('.main'),
      sourcesWidth: width('.secondary-sidebar'),
    };
  });
}

/**
 * The guarantee from the decision, in one place: nothing sticks out of the
 * window, nothing is pushed off the left edge, and every slot is inside the
 * bounds the model gives it.
 */
function expectLayoutFits(measured: Measurement, state: LayoutState, where: string): void {
  // The comparison the decision names is scrollWidth against innerWidth, and
  // the two are only the same measurement while the document itself never
  // scrolls vertically — the shell is 100% tall and each slot scrolls inside
  // itself. Asserted rather than assumed, so the day that changes this test
  // says which of the two broke.
  expect(measured.clientWidth, `dokumentet skal ikke ha egen rullefelt i ${where}`).toBe(
    measured.windowWidth,
  );
  expect(measured.documentWidth, `ingen vannrett rulling i ${where}`).toBe(measured.windowWidth);

  // Everything above the fold in the navigation panel — the collapse button,
  // the way back to the threads — goes with it when it is pushed off.
  expect(measured.navLeftEdge, `navigasjonspanelet skal starte ved venstre kant i ${where}`).toBe(
    0,
  );

  expect(measured.navWidth, `bredden på navigasjonspanelet i ${where}`).toBe(
    state.nav === 'open' ? NAV_OPEN : NAV_COLLAPSED,
  );

  if (state.sources === 'open') {
    // The sources panel is the slot that gives way, between its floor and its
    // preferred width. Anything outside that is the shell inventing a number.
    expect(
      measured.sourcesWidth,
      `kildepanelet skal ikke krympe under gulvet i ${where}`,
    ).toBeGreaterThanOrEqual(SOURCES_FLOOR);
    expect(
      measured.sourcesWidth,
      `kildepanelet skal ikke bli bredere enn ønsket i ${where}`,
    ).toBeLessThanOrEqual(SOURCES_PREFERRED);
  } else {
    expect(measured.sourcesWidth, `bredden på det kollapsede kildepanelet i ${where}`).toBe(
      SOURCES_COLLAPSED,
    );
  }

  // Two floors, one per state, and which one applies is the whole of lever a:
  // the 640 floor is about reading the sources beside the answer, so it is
  // only the floor while there are sources beside the answer.
  const mainFloor = state.sources === 'open' ? MAIN_FLOOR : MAIN_FLOOR_SOURCES_COLLAPSED;
  expect(
    measured.mainWidth,
    `hovedkolonnen skal aldri under gulvet sitt (${mainFloor}) i ${where}`,
  ).toBeGreaterThanOrEqual(mainFloor);
  expect(measured.mainWidth, `hovedkolonnen skal aldri over taket i ${where}`).toBeLessThanOrEqual(
    MAIN_CEILING,
  );
}

test.describe('layouten', () => {
  test('tre åpne plasser får plass i 1440, uten vannrett rulling', async ({ page }, testInfo) => {
    covers(testInfo, 'layout: tre åpne plasser ved 1440');
    await page.setViewportSize({ width: BOTH_SIDEBARS_MIN_VIEWPORT, height: HEIGHT });
    await page.goto('/');

    // Opened the way a user opens it: by activating a citation marker, which
    // is the moment the third slot appears whether the window has room or not.
    await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
    await citation(page, 1).click();
    await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

    const measured = await measure(page);

    expect(measured.navLeftEdge, 'navigasjonspanelet skal starte ved venstre kant').toBe(0);
    expect(
      measured.documentWidth,
      'sida skal ikke være bredere enn vinduet, altså ingen vannrett rulling',
    ).toBeLessThanOrEqual(measured.windowWidth);
  });

  test('etiketten på kollapsknappen står på én linje', async ({ page }, testInfo) => {
    covers(testInfo, 'layout: kollapset panel rommer sin egen etikett');
    await page.setViewportSize({ width: BOTH_SIDEBARS_MIN_VIEWPORT, height: HEIGHT });
    await page.goto('/');

    // Wait for the web font. Inter is fetched from a CDN, and until it lands
    // the fallback's metrics apply — «Vis kilder» fits on one line in the
    // fallback and wraps in Inter, so measuring too early passes a test that
    // should fail. Any assertion about text layout has to wait for this.
    await page.evaluate(() => document.fonts.ready);

    // The secondary sidebar starts collapsed, so this is the first thing a
    // user sees of it. A label that wraps is the panel saying it is narrower
    // than the only control it holds.
    const lines = await page.evaluate(() => {
      const button = document.querySelector('aside')?.querySelector('button');
      const text = [...(button?.childNodes ?? [])].find((node) => node.nodeType === Node.TEXT_NODE);
      if (!text) return null;
      const range = document.createRange();
      range.selectNode(text);
      return range.getClientRects().length;
    });

    expect(lines, '«Vis kilder» skal få plass på én linje i det kollapsede panelet').toBe(1);
  });

  /**
   * The whole matrix the decision promises: three widths, every state the
   * product allows at that width, measured in both colour schemes.
   *
   * Both schemes in one test rather than two, because the interesting
   * question is not whether dark mode has a layout of its own — it must not —
   * but whether it is the SAME layout. Measuring both in one page and
   * comparing answers that directly, and costs one page load instead of two.
   *
   * One cell of this matrix is the reason the decision grew a paragraph.
   * 1280 with only the navigation panel open needed
   * 400 + 32 + 640 + 32 + 198 = 1302 px, and the decision's own arithmetic
   * only checked the state where the navigation panel is collapsed — while
   * this is the state `defaultLayout` opens on, so it is what a user at 1280
   * meets. The conductor answered it with lever a on 2026-09-14: the answer
   * column's floor is 618 while the sources panel is collapsed. See
   * `docs/review/layout-v1-2026-09-14.md`, finding 1.
   */
  test.describe('ingen vannrett rulling fra 1280 og opp', () => {
    for (const width of WIDTHS) {
      for (const state of statesAt(width)) {
        test(`${width}, ${state.label}`, async ({ page }, testInfo) => {
          covers(testInfo, `layout: ${width} med ${state.label}`);
          await page.setViewportSize({ width, height: HEIGHT });
          await page.goto('/');
          await setSidebars(page, state);

          // Both images first, then the assertions. A reference image is not
          // an assertion artifact: the states that do NOT fit are exactly the
          // ones the conductor needs to look at, and a screenshot taken after
          // a failed expect is a screenshot that never gets taken.
          const light = await measure(page);
          await saveScreenshot(page, `layout-${width}-${state.id}-lys`);

          await setColorScheme(page, 'dark');
          const dark = await measure(page);
          await saveScreenshot(page, `layout-${width}-${state.id}-mork`);

          expectLayoutFits(light, state, `${width} med ${state.label}, lys modus`);
          expectLayoutFits(dark, state, `${width} med ${state.label}, mørk modus`);
          expect(dark, 'mørk modus skal gi nøyaktig samme layout som lys').toEqual(light);
        });
      }
    }
  });

  /**
   * The three widths where the sum is exact. They are the reason the numbers
   * are what they are, so a change to any width shows up here first, with the
   * arithmetic written out rather than hidden in a tolerance.
   */
  test('ved 1280 med bare navigasjonspanelet åpent står hovedkolonnen på 618', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'layout: 1280 med kollapset kildepanel går opp på 618');
    await page.setViewportSize({ width: V1_MIN_VIEWPORT, height: HEIGHT });
    await page.goto('/');
    await setSidebars(page, stateNamed('nav-aapent'));

    const measured = await measure(page);

    // Lever a, measured rather than assumed: the answer column gives up the
    // 22 px the row was short, and gives up exactly those, so the state that
    // `defaultLayout` opens on fits in V1's narrowest window.
    expect(measured.navWidth).toBe(NAV_OPEN);
    expect(measured.sourcesWidth).toBe(SOURCES_COLLAPSED);
    expect(measured.mainWidth, 'hovedkolonnens gulv med kildepanelet kollapset').toBe(
      MAIN_FLOOR_SOURCES_COLLAPSED,
    );
    expect(
      measured.navWidth + GAP + measured.mainWidth + GAP + measured.sourcesWidth,
      'summen er 1280, gulvet i V1',
    ).toBe(V1_MIN_VIEWPORT);
  });

  test('ved 1440 går de tre plassene nøyaktig opp, med kildepanelet på gulvet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'layout: 1440 er summen av bredder og gap');
    await page.setViewportSize({ width: BOTH_SIDEBARS_MIN_VIEWPORT, height: HEIGHT });
    await page.goto('/');
    await setSidebars(page, stateNamed('begge-aapne'));

    const measured = await measure(page);

    expect(measured.navWidth).toBe(NAV_OPEN);
    expect(measured.mainWidth, 'hovedkolonnen står på gulvet sitt ved 1440').toBe(MAIN_FLOOR);
    expect(measured.sourcesWidth, 'kildepanelet står på gulvet sitt ved 1440').toBe(SOURCES_FLOOR);
    expect(
      measured.navWidth + GAP + measured.mainWidth + GAP + measured.sourcesWidth,
      'summen er brytepunktet',
    ).toBe(BOTH_SIDEBARS_MIN_VIEWPORT);
  });

  test('ved 1536 står alle tre på ønsket bredde', async ({ page }, testInfo) => {
    covers(testInfo, 'layout: 1536 er ønsket bredde for alle tre');
    await page.setViewportSize({ width: PREFERRED_VIEWPORT, height: HEIGHT });
    await page.goto('/');
    await setSidebars(page, stateNamed('begge-aapne'));

    const measured = await measure(page);

    expect(measured.navWidth).toBe(NAV_OPEN);
    expect(measured.mainWidth, 'hovedkolonnen på gulvet, kildepanelet på ønsket bredde').toBe(
      MAIN_FLOOR,
    );
    expect(measured.sourcesWidth).toBe(SOURCES_PREFERRED);
    expect(
      measured.navWidth + GAP + measured.mainWidth + GAP + measured.sourcesWidth,
      'summen er 1536, den vanlige laptop-bredden',
    ).toBe(PREFERRED_VIEWPORT);
  });

  /**
   * Rule B: below 1440 only one sidebar is open at a time, and the provider
   * owns the rule — not CSS, because collapsed is state a button reports with
   * `aria-expanded`. Three ways in, because all three have to obey it: the
   * user opens a panel, the window shrinks, and a citation asks to be shown.
   */
  test.describe('én åpen sidekolonne om gangen under 1440', () => {
    test('å åpne kildepanelet under 1440 kollapser navigasjonspanelet', async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'layout: regel B ved åpning');
      await page.setViewportSize({ width: V1_MIN_VIEWPORT, height: HEIGHT });
      await page.goto('/');

      const nav = page.getByRole('button', { name: /^(Vis|Skjul) tråder og filter$/ });
      await expect(nav, 'navigasjonspanelet er åpent som standard').toHaveAttribute(
        'aria-expanded',
        'true',
      );

      await page.getByRole('button', { name: 'Vis kilder' }).click();

      await expect(nav, 'navigasjonspanelet ga plass til kildepanelet').toHaveAttribute(
        'aria-expanded',
        'false',
      );
      const measured = await measure(page);
      expectLayoutFits(
        measured,
        stateNamed('kilder-aapent'),
        '1280 etter at kildepanelet ble åpnet',
      );
    });

    test('vinduet krymper under 1440 mens begge er åpne: kildepanelet gir etter', async ({
      page,
    }, testInfo) => {
      covers(testInfo, 'layout: regel B ved krymping');
      await page.setViewportSize({ width: PREFERRED_VIEWPORT, height: HEIGHT });
      await page.goto('/');
      await setSidebars(page, stateNamed('begge-aapne'));

      await page.setViewportSize({ width: BOTH_SIDEBARS_MIN_VIEWPORT - 1, height: HEIGHT });

      // The sources panel is the one that gives way, so it is the one that
      // collapses. The navigation panel keeps what the user put there.
      await expect(
        page.getByRole('button', { name: /^(Vis|Skjul) kilder$/ }),
        'kildepanelet er det som gir etter',
      ).toHaveAttribute('aria-expanded', 'false');
      await expect(
        page.getByRole('button', { name: /^(Vis|Skjul) tråder og filter$/ }),
      ).toHaveAttribute('aria-expanded', 'true');

      const measured = await measure(page);
      expectLayoutFits(measured, stateNamed('nav-aapent'), '1439 etter krymping');
    });

    test('en kildemarkør åpner panelet gjennom samme regel', async ({ page }, testInfo) => {
      covers(testInfo, 'layout: regel B gjennom showCitation');
      await page.setViewportSize({ width: V1_MIN_VIEWPORT, height: HEIGHT });
      await page.goto('/');

      // The real path, with a real answer behind it: this is how the panel
      // opens for a user who never touches the collapse buttons, and it is
      // the state the conductor measured by hand on 2026-09-14.
      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      await citation(page, 1).click();

      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^(Vis|Skjul) tråder og filter$/ }),
        'markøren åpnet kildepanelet, så navigasjonspanelet kollapset',
      ).toHaveAttribute('aria-expanded', 'false');

      const measured = await measure(page);
      expectLayoutFits(
        measured,
        stateNamed('kilder-aapent'),
        '1280 med et ekte svar og åpne kilder',
      );
      await saveScreenshot(page, `layout-${V1_MIN_VIEWPORT}-svar-kilder-lys`);

      // Real content, not an empty panel: an excerpt with a long unbroken
      // string in it is the other way a slot gets wider than its box.
      await expectNoAxeViolations(page, `layouten ved ${V1_MIN_VIEWPORT}`);
    });
  });
});
