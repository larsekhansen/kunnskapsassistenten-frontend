import type { IncomingMessage, ServerResponse } from 'node:http';
import { configScript, type ServerConfig } from './config.ts';
import { proxy } from './proxy.ts';
import { serveStatic } from './static.ts';

/** Everything under this goes to the backend, and nothing else does. */
const API_PREFIX = '/api/';

/**
 * The one request handler: the API forwarded, the client served, and two
 * small routes of the server's own.
 *
 * Exported apart from the listening socket so a test can mount it on a port
 * of its own choosing — the server is the thing under test, not the port
 * 8787 it happens to use in a container.
 */
export function createHandler(config: ServerConfig) {
  return function handle(request: IncomingMessage, response: ServerResponse): void {
    const path = (request.url ?? '/').split('?')[0] ?? '/';

    if (path === '/healthz') {
      /*
       * `mode` and not just `ok`. A test environment that answers from
       * fixtures looks exactly like one answering from the backend until you
       * ask it a question, and «which of the two is this» is the first thing
       * anybody wants to know about a deployed instance.
       */
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify({ ok: true, mode: config.mode }));
      return;
    }

    if (path === '/config.js') {
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        // Never cached: it is how a redeploy changes the mode, and a cached
        // copy would keep an old one alive in a browser nobody can reach.
        'Cache-Control': 'no-store',
      });
      response.end(configScript(config.clientConfig));
      return;
    }

    if (path.startsWith(API_PREFIX)) {
      void proxy(request, response, config);
      return;
    }

    /*
     * `/api` exactly, with nothing under it, is not the client's either. It
     * falls here rather than into the proxy on purpose — there is nothing at
     * the backend's root worth forwarding a browser to — and it must not
     * become `index.html`, or a mistyped endpoint answers with a page and the
     * client fails while parsing HTML as JSON.
     */
    if (path === '/api') {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'Ukjent endepunkt.' }));
      return;
    }

    void serveStatic(response, config.distDir, path);
  };
}
