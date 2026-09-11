import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the suite runs and where it writes.
 *
 * The port is 4173, `vite preview`'s own default. It deliberately sits
 * outside the 5173–5177 band the build rules hand out to the workers, so
 * running the tests never collides with somebody's dev server.
 */
export const PORT = 4173;

const here = dirname(fileURLToPath(import.meta.url));

/** Repository root: two levels up from tests/e2e/. */
export const REPO = resolve(here, '..', '..');

/**
 * Traces, the report and failure screenshots. Outside the repository on
 * purpose — see the note in playwright.config.ts.
 */
export const ARTIFACTS = join(
  process.env.HOME ?? process.env.USERPROFILE ?? '/tmp',
  '.cache',
  'ka-review',
  'e2e',
);

/**
 * The umbrella folder that holds `design/`, found by walking up until
 * `design/INDEX.md` turns up. It is not a git repository and it is not
 * inside this one, so it cannot be reached by a fixed relative path from
 * every checkout: the main checkout and each worktree sit at different
 * depths. `docs/review/tools/a11y.sh` finds it the same way.
 *
 * Returns undefined when the design folder is not there, which is what a
 * clone without the umbrella looks like. Screenshots are then skipped
 * rather than written somewhere arbitrary.
 */
function findDesignFolder(): string | undefined {
  let candidate = REPO;

  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(candidate, 'design', 'INDEX.md'))) {
      return join(candidate, 'design');
    }
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  return undefined;
}

const designFolder = findDesignFolder();

/**
 * Where the deliberate screenshots go, as the build rules ask:
 * `design/skjermbilder-frontend/e2e/<view>-<modus>.png`, always the same
 * names, so the conductor and Lars can compare them against the Figma
 * images in the `skjermbilder` folders under `design/omraader/`.
 */
export const SCREENSHOTS = designFolder
  ? join(designFolder, 'skjermbilder-frontend', 'e2e')
  : undefined;
