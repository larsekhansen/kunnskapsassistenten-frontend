import { expect, test } from '@playwright/test';
import { covers, expectNoAxeViolations } from './a11y';
import { composer, MOCK } from './helpers';

/**
 * The page that stands where the app was, after an error React cannot recover
 * from (#221).
 *
 * Lars got a white page in the test environment on 30.09, starting a new
 * thread: `NotFoundError: Failed to execute 'removeChild' on 'Node'`. The cause
 * in his browser is not known. The mechanism is: something outside React —
 * a page translator, an extension — replaces text nodes while an answer
 * streams, and React, removing a node that is no longer where it left it,
 * throws in its commit phase and unmounts the whole root. Measured by #5 in
 * design/_briefs/bygg/maalt-hvit-skjerm-ny-traad.md, and by KA CC: on `main`
 * before #221, 8 of 8 white pages, with `#root` empty; with #221, 8 of 8 times
 * the page below.
 *
 * The imitation is what Google Translate does: every text node in `body`
 * swapped for a `<font>` with the same text, once, while the answer is still
 * coming. Narrower or repeated swaps inside the chat alone did not trigger it
 * in the measuring, so this is the one that does.
 */
function translatePage(): number {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const tag = text.parentElement?.tagName;
    if (text.textContent?.trim() && tag !== 'SCRIPT' && tag !== 'STYLE' && tag !== 'TEXTAREA') {
      texts.push(text);
    }
  }
  for (const text of texts) {
    const font = document.createElement('font');
    font.textContent = text.textContent;
    text.replaceWith(font);
  }
  return texts.length;
}

test.describe('feilgrensen', () => {
  test(
    'en sideoversetter mens svaret strømmer gir «Noe gikk galt», ikke hvit skjerm',
    MOCK,
    async ({ page }, testInfo) => {
      covers(testInfo, 'en feil React ikke kommer seg fra, gir en side med «Last inn på nytt»');

      // An error the boundary catches is reported with `console.error`; one
      // that gets past it reaches the page as `pageerror`, and that is the
      // white page.
      const uncaught: string[] = [];
      page.on('pageerror', (error) => uncaught.push(`${error.name}: ${error.message}`));

      await page.goto('/');
      await composer(page).click();
      await page.keyboard.type('Hva sier dokumentene om romfart?');
      await page.keyboard.press('Enter');

      // While it streams: the answer's text has started, and it is not
      // finished. The card alone is too early — it stands as a skeleton before
      // any text, and a swap then gave no error in the measuring (600 ms in,
      // #5's note).
      await expect(page.locator('.ka-answer-card .markdown p').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Avbryt genereringen' })).toBeVisible();
      expect(await page.evaluate(translatePage)).toBeGreaterThan(0);

      const heading = page.getByRole('heading', { name: 'Noe gikk galt', level: 1 });
      await expect(heading).toBeVisible();
      // Whatever held the focus is gone, so the heading takes it.
      await expect(heading).toBeFocused();
      await expect(
        page.getByText(/utvidelse i nettleseren, eller oversettelse av siden/),
      ).toBeVisible();
      expect(uncaught, 'feilen skal fanges, ikke nå siden').toEqual([]);

      await expectNoAxeViolations(page, 'feilsiden', { keepFocus: true });

      // The one thing that helps: loading again.
      await page.getByRole('button', { name: 'Last inn på nytt' }).click();
      await expect(composer(page)).toBeVisible();
      await expect(heading).toHaveCount(0);
    },
  );
});
