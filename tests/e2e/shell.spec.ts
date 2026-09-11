import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations, saveScreenshot, setColorScheme } from './a11y';
import { expectEveryStepReachable, walkWithTab } from './helpers';

/**
 * The shell: the three slots, the routes, the skip link and dark mode.
 *
 * This is the first spec, and it covers what is actually merged. The four
 * views are still `ViewPlaceholder` on `main` — nothing mounts them — so
 * there is no filter, no thread list, no chat and no sources panel to test
 * yet. `docs/review/funksjonssjekk.md` keeps the score.
 *
 * Every test asserts what a user does, not how it is built: a landmark by
 * its accessible name rather than a class, a button by its Norwegian label
 * rather than a test id.
 */

/**
 * The level 1 heading names the application on every route, and the thread
 * title is the level 2 under it. A page named after the thread would rename
 * itself mid-session, the first time a title is generated from a question.
 */
const ROUTES = {
  newConversation: { path: '/', heading: 'Kunnskapsassistenten', name: 'ny-samtale' },
  thread: {
    path: '/threads/nkom-maaloppnaaelse',
    heading: 'Kunnskapsassistenten',
    subheading: 'NKOM måloppnåelse',
    name: 'traad',
  },
} as const;

test.describe('skallet', () => {
  for (const route of Object.values(ROUTES)) {
    test(`${route.path} laster med landemerker og én h1`, async ({ page }, testInfo) => {
      covers(testInfo, 'rutene lastes · landemerkene finnes');
      await page.goto(route.path);

      // The page title first: a route that renders an error boundary would
      // still have landmarks.
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      if ('subheading' in route) {
        await expect(page.getByRole('heading', { level: 2, name: route.subheading })).toBeVisible();
      }

      // The thread title is a section of the page, not the page itself.
      if ('subheading' in route) {
        await expect(page.getByRole('heading', { level: 2, name: route.subheading })).toBeVisible();
      }

      // The slots are named after the views in them, never after the side
      // they sit on. That is the rule the names have to prove.
      await expect(page.getByRole('navigation', { name: 'Tråder og filter' })).toBeVisible();
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Kilder' })).toBeAttached();

      await expect(page.locator('html')).toHaveAttribute('lang', 'nb');

      await expectNoAxeViolations(page, `${route.path} i lys modus`);
    });
  }

  test('hopp-lenka er første Tab-stopp og hopper forbi navigasjonspanelet', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'hopp-lenke fungerer med Tab');

    // The thread route, not the front page: the promise a skip link makes is
    // «you land in the content», and only a route with something focusable in
    // it can keep that promise. The front page is checked separately below,
    // for the weaker promise it can keep.
    await page.goto(ROUTES.thread.path);

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Hopp til hovedinnhold' });
    await expect(skipLink).toBeFocused();

    // Designsystemet's SkipLink is only visible while it has focus, which is
    // the whole point of it.
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main-content$/);

    await page.keyboard.press('Tab');
    const landing = await page.evaluate(() => ({
      inMain: Boolean(document.getElementById('main-content')?.contains(document.activeElement)),
      inNav: Boolean(document.querySelector('nav')?.contains(document.activeElement)),
    }));
    expect(landing.inMain, 'neste Tab etter hoppet skal stå inne i hovedinnholdet').toBe(true);
    expect(landing.inNav, 'hoppet skal ikke lande i navigasjonspanelet').toBe(false);
  });

  test('hopp-lenka forbigår navigasjonspanelet også når hovedinnholdet er tomt', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'hopp-lenke fungerer med Tab');

    // On the front page `main` holds no focusable element, so the browser
    // leaves `document.activeElement` on `<body>` and continues the walk from
    // the fragment target. Focus therefore lands AFTER main, not inside it.
    // That is the browser doing the right thing with an empty region, not a
    // defect: what matters is that the walk does not start over in the
    // sidebar. Measured before it was asserted.
    await page.goto(ROUTES.newConversation.path);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');

    const inNav = await page.evaluate(() =>
      Boolean(document.querySelector('nav')?.contains(document.activeElement)),
    );
    expect(inNav, 'hoppet skal ikke lande i navigasjonspanelet').toBe(false);
  });

  test('panelene kan skjules og vises igjen, og knappen sier hvilken tilstand den er i', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'panelene kan skjules/vises');
    await page.goto(ROUTES.newConversation.path);

    const hide = page.getByRole('button', { name: 'Skjul tråder og filter' });
    await expect(hide).toHaveAttribute('aria-expanded', 'true');

    await hide.click();

    const show = page.getByRole('button', { name: 'Vis tråder og filter' });
    await expect(show).toHaveAttribute('aria-expanded', 'false');
    // The content stays in the DOM and is hidden with `hidden`, so
    // aria-controls keeps pointing at something that exists.
    await expect(page.getByRole('navigation', { name: 'Tråder og filter' })).toHaveAttribute(
      'data-collapsed',
      'true',
    );

    // The button the user pressed must still hold focus. A control that
    // unmounts itself drops the keyboard at the top of the document.
    await expect(show).toBeFocused();

    await show.click();
    await expect(page.getByRole('button', { name: 'Skjul tråder og filter' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await expectNoAxeViolations(page, 'skallet etter skjul og vis');
  });

  test('mørk modus byttes uten at sida lastes på nytt', async ({ page }, testInfo) => {
    covers(testInfo, "window.ka.colorScheme.set('dark') bytter tema uten reload");
    await page.goto(ROUTES.newConversation.path);

    // A sentinel on the window: it survives a re-render and not a reload, so
    // it is what proves the switch did not reload the page.
    await page.evaluate(() => {
      (window as unknown as { kaSentinel?: number }).kaSentinel = 1;
    });

    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).background);

    await setColorScheme(page, 'dark');

    const darkBackground = await page.evaluate(() => getComputedStyle(document.body).background);
    expect(darkBackground, 'mørk modus skal male en annen flate enn lys').not.toBe(lightBackground);

    const survived = await page.evaluate(
      () => (window as unknown as { kaSentinel?: number }).kaSentinel,
    );
    expect(survived, 'sida skal ikke ha lastet på nytt').toBe(1);

    await expectNoAxeViolations(page, 'skallet i mørk modus');

    // The choice is stored per browser, so a reload keeps it.
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');

    await setColorScheme(page, 'light');
  });

  test('Tab gjennom hele skallet: hvert steg har et norsk navn og en synlig fokusring', async ({
    page,
  }, testInfo) => {
    covers(testInfo, 'tastatur: Tab gjennom viewet, synlig fokus og rekkefølge');
    await page.goto(ROUTES.thread.path);

    const steps = await walkWithTab(page);

    expect(steps.length, 'Tab skal nå noe i det hele tatt').toBeGreaterThan(3);
    expectEveryStepReachable(steps, 'skallet');

    // Reading order: the slots come in the order the shell renders them, and
    // the first stop after the skip link is the primary sidebar's own button.
    expect(steps[0]?.name).toBe('Hopp til hovedinnhold');
    expect(steps[1]?.name).toBe('Skjul tråder og filter');
  });

  test('skjermbilder av rutene i lys og mørk modus', async ({ page }, testInfo) => {
    covers(testInfo, 'visuell gjennomgang per merge');
    for (const route of Object.values(ROUTES)) {
      await page.goto(route.path);
      await setColorScheme(page, 'light');
      await saveScreenshot(page, `${route.name}-lys`);
      await setColorScheme(page, 'dark');
      await saveScreenshot(page, `${route.name}-mork`);
      await expectNoAxeViolations(page, `${route.path} i mørk modus`);
      await setColorScheme(page, 'light');
    }
  });
});
