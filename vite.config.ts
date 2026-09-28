/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * The colour-scheme script, linked from `<head>` as a file of its own.
 *
 * It has to run before the first paint, so it is a classic blocking script
 * and not part of the module bundle, which runs after parsing. It used to be
 * inline in index.html; the BFF's `script-src 'self'` refuses that
 * (docs/arkitektur/0002). Vite only bundles module scripts, so this emits the
 * file itself — under /assets/ with a content hash, because /assets/ is the
 * one path the BFF serves files from, and our own server caches it for good
 * there (server/static.ts). In development it is served from src/ as it is.
 */
function colorSchemeScript(): Plugin {
  const path = 'src/layout/colorSchemeBoot.js';
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
  const fileName = `assets/color-scheme-${hash}.js`;
  let serving = false;

  return {
    name: 'ka-color-scheme-script',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source });
    },
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: { src: serving ? `/${path}` : `/${fileName}` },
        injectTo: 'head-prepend',
      },
    ],
  };
}

/**
 * The dev server is also the proxy that holds the API key.
 *
 * The key never reaches the browser, and that is not a preference: the
 * backend answers a CORS preflight with 401 and sends no CORS headers at
 * all, so a browser could not call it directly even with a key. Production
 * needs a real server doing this same job — with logging, rate limiting and
 * the tool name pinned. See design/eksisterende/api-for-frontend.md.
 *
 * KA_API_URL and KA_API_KEY have no VITE_ prefix on purpose: Vite only
 * exposes VITE_-prefixed variables to client code, so these two cannot end up
 * in the bundle even by accident.
 *
 * In `bff` mode the proxy goes to Nikolai's BFF instead, `:8788` unless
 * KA_API_URL says otherwise, and carries no key: the BFF holds its own.
 * `/auth` goes along, so a 401 can lead to the BFF's sign-in.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const bff = env.VITE_API_MODE === 'bff';
  const target = env.KA_API_URL || (bff ? 'http://localhost:8788' : 'http://localhost:8080');
  const apiKey = bff ? undefined : env.KA_API_KEY;

  if (env.VITE_API_MODE === 'live' && !apiKey) {
    console.warn('[ka] VITE_API_MODE=live, men KA_API_KEY er ikke satt. Spørringer vil gi 401.');
  }

  return {
    plugins: [react(), colorSchemeScript()],
    server: {
      proxy: {
        ...(bff ? { '/auth': { target, changeOrigin: true } } : {}),
        '/api': {
          target,
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest) => {
              if (apiKey) proxyRequest.setHeader('X-API-Key', apiKey);
              // No compression on the streaming route. A gzip stream buffers,
              // and then the answer arrives all at once at the end.
              proxyRequest.setHeader('Accept-Encoding', 'identity');
            });
            proxy.on('proxyRes', (proxyResponse) => {
              // Tells any intermediate proxy not to buffer the event stream.
              proxyResponse.headers['x-accel-buffering'] = 'no';
            });
          },
        },
      },
    },
    test: {
      /*
       * Klienten og serveren i samme kjøring, men ikke i samme miljø.
       *
       * `src/test/setup.ts` er jsdom fra første linje — den installerer
       * matchMedia, `<dialog>` og CSS.escape på `window` mens den lastes — og
       * `server/` tester en Node-HTTP-server som ikke har noe `window`. Det
       * er ikke et miljø som kan deles, så det deles ikke: to prosjekter,
       * hvert med sitt miljø og sine filer. Alt annet arves fra rota her
       * (`extends`), så antall arbeidere og `restoreMocks` står fortsatt ett
       * sted.
       */
      projects: [
        {
          extends: true,
          test: {
            name: 'klient',
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.ts'],
            include: ['src/**/*.test.{ts,tsx}'],
          },
        },
        {
          extends: true,
          test: {
            name: 'server',
            environment: 'node',
            include: ['server/**/*.test.ts'],
          },
        },
      ],
      restoreMocks: true,
      /*
       * Fire arbeidere lokalt. Vitest tar ellers én per kjerne: målt 15.09 gikk
       * vitest-prosessene fra 1 til 17 på denne maskinen, og tre—fire agenter
       * kjører `npm test` samtidig. Samme grunn og samme skille som i
       * `playwright.config.ts`, som har den lange begrunnelsen.
       */
      maxWorkers: process.env.GITHUB_ACTIONS ? undefined : 4,
    },
  };
});
