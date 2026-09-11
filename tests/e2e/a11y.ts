import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { SCREENSHOTS } from './paths';

/**
 * The rule sets every state is checked against.
 *
 * `wcag2a` and `wcag2aa` only, as the role brief says. Best-practice rules
 * are deliberately left out: they are advice, not the requirement, and a
 * suite that fails on advice gets switched off.
 */
const RULE_SETS = ['wcag2a', 'wcag2aa'];

/**
 * `window.ka` is declared in src/layout/colorScheme.ts, which these tests do
 * not compile against — they run in the browser, not in the bundle. Declared
 * again here, narrowly, so `page.evaluate` is typed.
 */
declare global {
  interface Window {
    ka?: { colorScheme: { get(): string; set(scheme: string): string } };
  }
}

/**
 * Known, reasoned exceptions. Empty today, and it should stay that way.
 *
 * Anything added here needs a sentence saying why the rule does not apply,
 * not why it is inconvenient. An exception without a reason is a bug with
 * paperwork.
 */
const DISABLED_RULES: string[] = [];

/** Runs axe on whatever is on screen and fails the test on any violation. */
export async function expectNoAxeViolations(page: Page, what: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(RULE_SETS)
    .disableRules(DISABLED_RULES)
    .analyze();

  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'ukjent'}): ${violation.help}\n` +
      violation.nodes.map((node) => `    ${node.target.join(' ')}`).join('\n'),
  );

  expect(summary, `axe-brudd i ${what}`).toEqual([]);
}

/**
 * Saves a screenshot under a stable name, for comparing against Figma.
 *
 * Not an assertion. A visual diff would fail on every font-rendering
 * difference between machines, and the review of these images is a person
 * looking at them, which is what the role brief asks for.
 */
export async function saveScreenshot(page: Page, name: string): Promise<void> {
  if (!SCREENSHOTS) return;
  // Inter comes from a CDN, and the fallback's metrics are not Inter's. A
  // reference image taken before the font lands has different line breaks
  // from the product, which is the one thing a reference image must not have.
  await page.evaluate(() => document.fonts.ready);
  // Drop focus first. A reference image is the resting state; a button left
  // focused by the click that got us here reads as a hover or an active
  // state, and the person comparing against Figma has to guess which.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await mkdir(SCREENSHOTS, { recursive: true });
  await page.screenshot({ path: join(SCREENSHOTS, `${name}.png`), fullPage: false });
}

/** Both colour schemes, applied through the API the product actually ships. */
export async function setColorScheme(page: Page, scheme: 'light' | 'dark'): Promise<void> {
  await page.evaluate((value) => window.ka?.colorScheme.set(value), scheme);
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', scheme);
}

/** Marks a test as covering one line in docs/review/funksjonssjekk.md. */
export function covers(testInfo: TestInfo, row: string): void {
  testInfo.annotations.push({ type: 'dekker', description: row });
}
