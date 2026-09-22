/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

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
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.KA_API_URL || 'http://localhost:8080';
  const apiKey = env.KA_API_KEY;

  if (env.VITE_API_MODE === 'live' && !apiKey) {
    console.warn('[ka] VITE_API_MODE=live, men KA_API_KEY er ikke satt. Spørringer vil gi 401.');
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
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
