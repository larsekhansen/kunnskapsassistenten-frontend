import { defineConfig, devices } from '@playwright/test';
import { ARTIFACTS, PORT, RUN_ARTIFACTS } from './tests/e2e/paths';

/**
 * End-to-end tests for kunnskapsassistenten-frontend.
 *
 * They run against `vite preview`, not the dev server: the built app is what
 * a user gets, and a bug that only exists after minification or after the
 * production `import.meta.env` substitution would otherwise never be caught.
 * `npm run build` is part of the server command for the same reason.
 *
 * `VITE_API_MODE=mock` is set on the whole command rather than only on the
 * preview, because Vite substitutes that variable at BUILD time. Setting it
 * on the preview alone would build a default bundle and change nothing.
 *
 * Artifacts — traces, the HTML report, failure screenshots — are written
 * outside the repository, to ~/.cache/ka-review/e2e/. Prettier reads
 * .prettierignore and not .gitignore, and .prettierignore belongs to the
 * foundation, so anything this suite writes inside the tree would break
 * `npm run format:check` for everyone. The deliberate screenshots are a
 * different matter and go to design/skjermbilder-frontend/e2e/, which the
 * build rules ask for and which is not a git repository.
 *
 * Chromium only, and that is a choice worth knowing about: this suite tests
 * the product, not browser compatibility. `field-sizing: content` in the
 * compose field is one known place where Firefox behaves differently, and it
 * is documented where it is used rather than tested here.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // Per run, not per suite: see RUN_ARTIFACTS in tests/e2e/paths.ts for
  // what a shared one costs.
  outputDir: RUN_ARTIFACTS,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: `${ARTIFACTS}/report`, open: 'never' }]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'nb-NO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /*
   * The viewport belongs HERE and not in the `use` above, and that is the
   * whole point of this block.
   *
   * `devices['Desktop Chrome']` carries a viewport of its own — 1280 × 720 —
   * and a project's `use` is merged over the top-level one. So a
   * `viewport: { width: 1440, height: 900 }` written above the spread was
   * silently replaced, and the suite ran at 1280 × 720 for four days while
   * every comment in it, and `docs/review/funksjonssjekk.md`, said 1440 × 900.
   * Found by #2 in PR #55 and measured here with a throwaway spec that
   * printed `window.innerWidth`.
   *
   * 1440 is the width the page template is drawn at, and 900 the height the
   * design frames use; every measurement in design/omraader/ assumes both.
   * The specs that test the layout itself — `layout.spec.ts`, `resize.spec.ts`
   * — set their own viewport per test and were never affected.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never reuse. A preview server already on the port belongs to somebody
    // else — another run of this suite, or a worker's own server — and
    // attaching to it is how a run ends up serving a `dist` it did not build
    // (funksjonssjekk.md, «Et bygg som ikke er ferdig, lyver») or losing the
    // server mid-suite when its owner finishes. With `false` and
    // `--strictPort` a collision fails here, loudly, with the port in the
    // message, instead of turning into a scatter of failed tests further in.
    //
    // `KA_E2E_PORT` is how two runs coexist; see tests/e2e/paths.ts.
    reuseExistingServer: false,
    timeout: 180_000,
    // `VITE_MOCK_SPEED=fast` for the same reason `VITE_API_MODE` is here:
    // Vite substitutes both at BUILD time, so they have to be on the command
    // that builds. The mock's own default is `realistic`, which is what makes
    // the skeleton, the thinking panel and the streaming visible to a person
    // — and what would make this suite sit and wait out every answer.
    env: { VITE_API_MODE: 'mock', VITE_MOCK_SPEED: 'fast' },
  },
});
