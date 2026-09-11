/**
 * Dark mode. Lars decided 2026-09-11 that KA ships it, straight from the
 * Digdir theme's tokens — the theme carries 147 light/dark variables, so the
 * cost is verifying screens, not building anything.
 *
 * There is a switch, but no visible control, because no button has been
 * drawn. It is a console command:
 *
 *   window.ka.colorScheme.set('dark' | 'light' | 'auto')
 *   window.ka.colorScheme.get()
 *
 * `auto` follows the operating system and is the default. The choice is
 * stored per browser and read before the first paint by a small inline
 * script in index.html, so the page never flashes the wrong scheme. That
 * script and this module must agree on STORAGE_KEY and ATTRIBUTE; they are
 * the only two strings duplicated between them.
 *
 * A visible toggle, when the designer draws one, calls `set()` and nothing
 * else changes.
 */

export type ColorScheme = 'light' | 'dark' | 'auto';

export const STORAGE_KEY = 'ka.color-scheme';
const ATTRIBUTE = 'data-color-scheme';
const DEFAULT_SCHEME: ColorScheme = 'auto';

function isColorScheme(value: unknown): value is ColorScheme {
  return value === 'light' || value === 'dark' || value === 'auto';
}

/**
 * Storage can throw, not just return null: Safari in private mode and
 * browsers with site data blocked throw on access. A colour scheme is never
 * worth a blank page, so every access is guarded.
 */
function readStored(): ColorScheme | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isColorScheme(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(scheme: ColorScheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    // Ignored on purpose: the scheme still applies for this page load.
  }
}

export function getColorScheme(): ColorScheme {
  return readStored() ?? DEFAULT_SCHEME;
}

export function setColorScheme(scheme: ColorScheme): ColorScheme {
  if (!isColorScheme(scheme)) {
    throw new Error(`Ukjent fargemodus: ${String(scheme)}. Bruk 'light', 'dark' eller 'auto'.`);
  }
  writeStored(scheme);
  document.documentElement.setAttribute(ATTRIBUTE, scheme);
  return scheme;
}

declare global {
  interface Window {
    ka?: {
      colorScheme: {
        get(): ColorScheme;
        set(scheme: ColorScheme): ColorScheme;
      };
    };
  }
}

/**
 * Applies the stored scheme and exposes the console API. Called from
 * main.tsx before the first render; the inline script in index.html has
 * usually applied the same value already, and applying it twice is harmless.
 */
export function initColorScheme(): void {
  document.documentElement.setAttribute(ATTRIBUTE, getColorScheme());
  window.ka = { ...window.ka, colorScheme: { get: getColorScheme, set: setColorScheme } };
}
