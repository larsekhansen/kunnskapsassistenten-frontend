import { expect, type Locator, type Page } from '@playwright/test';

/**
 * A full mock answer takes about 7.5 seconds of wall clock: four thinking
 * steps at 500 ms, then the answer token by token at 18 ms. The waits here
 * poll, so a test costs what the answer costs and not a second more — but the
 * budget has to be generous enough that a loaded machine does not fail a
 * test that would have passed.
 */
const ANSWER_TIMEOUT = 30_000;

/** Asks a question from the compose field and waits for the finished answer. */
export async function ask(page: Page, question: string): Promise<void> {
  await composer(page).click();
  await page.keyboard.type(question);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Kopier svaret' })).toBeVisible({
    timeout: ANSWER_TIMEOUT,
  });
}

/**
 * A filter field, found through its `<label for>`.
 *
 * Not by role: Designsystemet's Suggestion leaves the input without
 * `role="combobox"` until the user first clicks or focuses it, so a
 * role-based locator finds nothing on a page nobody has touched. Measured on
 * the built app, 2.5 s after load, with every custom element upgraded and the
 * list already a `listbox` with its options. That is a defect in the
 * component and it is written up in
 * design/designsystemet/funn-tverrgaaende.md; the label is what is stable.
 */
export function facetField(page: Page, label: string): Locator {
  return page
    .locator('ds-suggestion input.ds-input')
    .filter({
      has: page.locator('xpath=.'),
    })
    .and(
      page.locator(
        `xpath=//label[normalize-space(text())="${label}"]/ancestor::ds-field//input[contains(@class,"ds-input")]`,
      ),
    );
}

/**
 * One option in ONE facet field's list.
 *
 * Scoped to the field, and that is the whole point. All three facet lists are
 * in the DOM at once — measured 2026-09-16: 275 options, every one of them
 * inside a `ds-suggestion` — and the two closed ones are hidden rather than
 * absent. A page-wide `[role="option"]` filtered on text therefore matches
 * across fields, and `.first()` takes whichever comes first in the DOM.
 *
 * «2026» is the case that showed it: it matches «2026 (180)» in År and
 * «Regelrådet (avviklet 2026) (3)» in Virksomheter, and the hidden one is
 * first. The wait then sat on an element that would never become visible, and
 * the test hung rather than failed. Found by #5 in #75, who worked around it
 * by using 2025 — this is the fix that lets 2026 be used again.
 *
 * The same trap is written up in `docs/review/README.md` under the pitfalls,
 * which is where I had put the warning and not the guard.
 */
export function facetOption(page: Page, dimension: string, value: string): Locator {
  return page
    .locator(
      `xpath=//label[normalize-space(text())="${dimension}"]/ancestor::ds-field//*[@role="option"]`,
    )
    .filter({ hasText: value })
    .first();
}

/**
 * Picks one value in a facet field, the way a reader does.
 *
 * Typing and then ArrowDown, not clicking the option: the list filters
 * asynchronously, and ArrowDown on a list that has not caught up lands on
 * whatever option is still first. Waiting for the option to be visible is
 * what makes the keypress land on the right one.
 *
 * It lived in `primary-sidebar.spec.ts` until three specs needed it.
 */
export async function chooseFacetValue(
  page: Page,
  dimension: string,
  value: string,
): Promise<void> {
  const field = facetField(page, dimension);
  await field.click();
  await page.keyboard.type(value);
  await expect(facetOption(page, dimension, value)).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText(/^1 av \d+ valgt$/).first()).toBeVisible();

  /*
   * Close the list before handing the page back.
   *
   * A multi-select keeps its list open after a pick — deliberately, so the
   * next value is one keystroke away — and an open popover eats the first
   * click that lands outside it, as light dismiss. A test that picks a value
   * and then clicks «Tråder» therefore spends that click on closing the list
   * and finds itself still in the filter view.
   *
   * Measured at 1280 × 720: first click 0 view switches, second click 1. It
   * is not a defect in the panel, it is what a popover does, and every caller
   * of this helper wants the field at rest afterwards rather than mid-pick.
   */
  await page.keyboard.press('Escape');
  await expect(page.locator('u-datalist:not([hidden])')).toHaveCount(0);
}

export function composer(page: Page): Locator {
  return page.locator('.ka-composer__field textarea');
}

/** The `[n]` marker in the answer, by its number. */
export function citation(page: Page, number: number): Locator {
  return page.locator(`main a[href="#excerpt-${number}"]`).first();
}

/** Switches the primary sidebar to the view named by its own button. */
export async function showThreads(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tråder', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filtrer dokumenter' })).toBeVisible();
}

export async function showFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Filtrer dokumenter' }).click();
  await expect(page.getByRole('button', { name: 'Tråder', exact: true })).toBeVisible();
}

/** Opens the sources panel the way a user does, by activating a marker. */
export async function openSources(page: Page, number: number): Promise<void> {
  await citation(page, number).click();
  await expect(page.getByRole('button', { name: 'Skjul kilder' })).toBeVisible();
}

/**
 * What the keyboard reaches, in order, with the ring it draws.
 *
 * Stops on element identity rather than on name plus position: a panel that
 * scrolls the focused element to the same place repeats the position, and two
 * buttons can share a name.
 */
export type FocusStep = {
  tag: string;
  name: string;
  outline: string;
  boxShadow: string;
  /** An ancestor draws the ring instead, through `:focus-within`. */
  ringOnAncestor: boolean;
  /** Designsystemet's `SkipLink`, which carries focus without an outline. */
  skipLink: boolean;
};

export async function walkWithTab(page: Page, limit = 80): Promise<FocusStep[]> {
  const steps: FocusStep[] = [];

  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press('Tab');

    const step = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      if (element.hasAttribute('data-e2e-seen')) return 'wrapped' as const;
      element.setAttribute('data-e2e-seen', '');

      const styles = getComputedStyle(element);
      const clean = (value: string | null) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim();

      return {
        tag: element.tagName.toLowerCase(),
        name:
          clean(element.getAttribute('aria-label')) ||
          // A form field is named by its `<label for>` or by
          // `aria-labelledby`, and neither shows up in textContent. Without
          // these two lines every labelled input reads as nameless.
          clean(
            (element.getAttribute('aria-labelledby') ?? '')
              .split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent ?? '')
              .join(' '),
          ) ||
          clean(
            element.id === ''
              ? ''
              : (document.querySelector(`label[for="${element.id}"]`)?.textContent ?? ''),
          ) ||
          clean(element.textContent).slice(0, 60) ||
          clean(element.getAttribute('title')),
        outline: styles.outlineStyle === 'none' ? 'none' : styles.outline,
        boxShadow: styles.boxShadow === 'none' ? 'none' : styles.boxShadow,
        // The compose field and its buttons read as one control, so the frame
        // around them carries the ring with `:focus-within` and the textarea
        // gives up its own. What the rule asks is that the user can see where
        // focus is, not which element the browser painted it on.
        // Designsystemet's own class, not our markup: every skip link the app
        // grows carries it, and the exception then follows the component
        // instead of a list of Norwegian labels somebody has to remember to
        // extend. `ds-skip-link` sets `outline: 0` and draws focus with a
        // surface and an underline.
        skipLink: element.classList.contains('ds-skip-link'),
        ringOnAncestor: (() => {
          let parent = element.parentElement;
          while (parent && parent !== document.body) {
            if (parent.matches(':focus-within')) {
              const style = getComputedStyle(parent);
              if (style.outlineStyle !== 'none' || style.boxShadow !== 'none') return true;
            }
            parent = parent.parentElement;
          }
          return false;
        })(),
      };
    });

    if (step === null || step === 'wrapped') break;
    steps.push(step);
  }

  await page.evaluate(() =>
    document
      .querySelectorAll('[data-e2e-seen]')
      .forEach((element) => element.removeAttribute('data-e2e-seen')),
  );

  return steps;
}

/**
 * Every step has a Norwegian name and a ring the user can see.
 *
 * Two exceptions, and both follow the component rather than the label:
 *
 * `skipLink` — Designsystemet's `SkipLink` sets `outline: 0` on purpose and
 * carries focus with a surface and an underline instead. It used to be a list
 * of Norwegian names with «Hopp til hovedinnhold» in it, and the second skip
 * link the app grew («Hopp til skrivefeltet») failed four Tab walks on a rule
 * that was about the component all along. The class is what the component
 * puts there, so the exception now covers every skip link there will ever be.
 *
 * `ringOnAncestor` — a control whose frame draws the ring through
 * `:focus-within`. Same idea: what the rule asks is that the user can see
 * where focus is, not which element the browser painted it on.
 */
export function expectEveryStepReachable(steps: FocusStep[], what: string): void {
  expect(
    steps.filter((step) => step.name === ''),
    `navnløse fokuserbare elementer i ${what}`,
  ).toEqual([]);

  expect(
    steps.filter(
      (step) =>
        !step.skipLink &&
        step.outline === 'none' &&
        step.boxShadow === 'none' &&
        !step.ringOnAncestor,
    ),
    `steg uten synlig fokusring i ${what}`,
  ).toEqual([]);
}
