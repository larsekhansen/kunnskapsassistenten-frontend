import { expect, test, type Page } from '@playwright/test';
import { covers, expectNoAxeViolations, saveScreenshot, setColorScheme } from './a11y';
import { ask, citation } from './helpers';

/**
 * The layout at the widths the product is actually used at.
 *
 * Two kinds of test live here. The first two came out of the visual review
 * against Figma (`docs/review/visuell-2026-09-11.md`) and are here so the
 * same two cannot come back. The rest hold the V1 decision the conductor made
 * on 2026-09-14 (`design/_briefs/bygg/rolle-5c-layout-v1.md`): the sources
 * panel gives way, one sidebar at a time below 1440, and no horizontal
 * scrolling at 1280 or above in any state.
 *
 * The decision was amended twice on 2026-09-14, both times because something
 * here measured it: the answer column's floor dropped to 618 while the
 * sources panel was collapsed (the addendum «hullet ved 1280»), and the
 * collapsed navigation panel became 236 rather than 232. The review of #5's
 * PR is in `docs/review/feat-foundation-2026-09-14.md`.
 *
 * Both of those are gone again, replaced on 2026-09-15 by the rail
 * (`rolle-5d-kollapset-rail.md`): a collapsed sidebar is 67 px, sits flush
 * against the answer column, and the answer column's floor is 640 in every
 * state. The two amendments were both ways of buying room at 1280, and the
 * rail bought more of it than either.
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
/**
 * A collapsed sidebar is a rail, and both collapse to the same one.
 *
 * Decided 2026-09-15 (`rolle-5d-kollapset-rail.md`) after Lars looked at the
 * collapsed navigation panel in dark mode: 236 px of empty surface with one
 * button at the top did not read as a panel folded away. 67 is the icon-only
 * toggle button at 42 px, 12 px of padding on each side, and the rail's own
 * 1 px border — `railWidth` in src/layout/viewModel.ts writes out the sum.
 *
 * It was 236 for the navigation panel and 198 for the sources panel, each
 * wide enough to draw its own label on one line. The labels are gone from the
 * rail; they are the button's accessible name and its tooltip now.
 */
const RAIL = 67;
const NAV_COLLAPSED = RAIL;
const MAIN_FLOOR = 640;
const MAIN_CEILING = 800;
const SOURCES_PREFERRED = 432;
const SOURCES_FLOOR = 336;
const SOURCES_COLLAPSED = RAIL;
/**
 * Between an OPEN panel and the answer column. A rail sits flush against it,
 * with no gap at all, which is what made the 618 floor unnecessary.
 */
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

  // One floor again. It had a second, lower one of 618 for the state that did
  // not fit at 1280; the rail gave that state 131 px back and took the reason
  // away. Decision 2026-09-15.
  expect(
    measured.mainWidth,
    `hovedkolonnen skal aldri under gulvet sitt (${MAIN_FLOOR}) i ${where}`,
  ).toBeGreaterThanOrEqual(MAIN_FLOOR);
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

  /*
   * «etiketten på kollapsknappen står på én linje» stood here until
   * 2026-09-15. The collapsed button carries no label on screen any more — it
   * is an icon with an accessible name and a tooltip — so there is no text
   * node left to count lines in, and the question the test asked is one the
   * rail decision answered by removing it. Deleted rather than rewritten:
   * what a rail needs asserted instead (the name, the tooltip, the 67 px) is
   * KA CC's to write.
   */

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
   * meets. See `docs/review/layout-v1-2026-09-14.md`, finding 1.
   *
   * The same cell is now the slackest of the six: the rail made it
   * 400 + 32 + 640 + 67 = 1139.
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
  /*
   * «ved 1280 med bare navigasjonspanelet åpent står hovedkolonnen på 618»
   * stood here until 2026-09-15. There is no 618 to stand on: the rail made
   * that state 400 + 32 + 640 + 67 = 1139, and the floor went back to 640
   * everywhere. The state itself is still covered, by the matrix above —
   * `1280, nav-aapent` asserts no horizontal scrolling, both slot widths and
   * the floor — so deleting this loses no coverage, only a number that has
   * stopped being true.
   */

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

    /**
     * Rule B takes a panel away. Whoever was standing in it has to be put
     * somewhere, and `document.body` is not somewhere.
     *
     * The two ways a user opens a sidebar both leave focus on a control that
     * survives — the toggle button they pressed, or the excerpt a citation
     * scrolled to. The crossing does not: nobody pressed anything, the
     * content is hidden with `hidden`, and focus falls to the top of the
     * document with no announcement. Measured on the built app 2026-09-14;
     * see `docs/review/feat-foundation-2026-09-14.md`, finding 1.
     *
     * Reached by dragging a window narrower here, and by browser zoom in
     * real use: the query reads CSS pixels, so zooming to 125 % at 1600
     * lands at 1280 — and a user who zooms is disproportionately likely to
     * be the keyboard user this strands.
     */
    test('regel B mister ikke tastaturet når den tar panelet', async ({ page }, testInfo) => {
      covers(testInfo, 'layout: regel B beholder fokus ved krymping');
      await page.setViewportSize({ width: PREFERRED_VIEWPORT, height: HEIGHT });
      await page.goto('/');

      await ask(page, 'Hvordan jobber Nkom med måloppnåelse?');
      await citation(page, 1).click();
      await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();

      // Stand inside the panel, not on the button that opens it.
      const stood = await page.evaluate(() => {
        const inside = document.querySelector<HTMLElement>(
          'aside .sidebar-content a, aside .sidebar-content button, aside .sidebar-content input, aside .sidebar-content summary',
        );
        inside?.focus();
        return inside !== null;
      });
      expect(stood, 'kildepanelet har noe fokuserbart å stå i').toBe(true);

      await page.setViewportSize({ width: BOTH_SIDEBARS_MIN_VIEWPORT - 1, height: HEIGHT });
      await expect(page.getByRole('button', { name: /^(Vis|Skjul) kilder$/ })).toHaveAttribute(
        'aria-expanded',
        'false',
      );

      const landed = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return 'body';
        return (
          element.getAttribute('aria-label') ||
          (element.textContent ?? '').trim().slice(0, 45) ||
          element.tagName.toLowerCase()
        );
      });

      // The toggle button of the panel that was taken away is where focus
      // belongs: it is the control that now says «Vis kilder», it is where
      // the panel went, and it is one keystroke from bringing it back.
      expect(landed, 'fokus skal ikke falle til dokumentet når panelet kollapses').not.toBe('body');
    });
  });
});
