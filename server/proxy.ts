import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ServerConfig } from './config.ts';

/**
 * The client's headers that are forwarded, and nothing else.
 *
 * An allowlist rather than «everything except a few», because this server
 * stands between a browser and a credentialled backend: a header nobody
 * thought about should not travel by default. The four that do are the ones
 * the protocol needs — `Mcp-Method`, `Mcp-Name` and `MCP-Protocol-Version`
 * must agree with the body or the server answers 400 with -32020 — plus
 * `X-User-Id`, which is how `/api/conversations` knows whose threads these
 * are.
 *
 * `Authorization` is deliberately absent. Nothing in this app sends one, and
 * a proxy that passes one along is a proxy that can be used to try somebody
 * else's credential against the backend.
 */
const FORWARDED = /^(content-type|accept|x-user-id|mcp-.*)$/i;

/** Response headers worth keeping. Length and encoding are ours to decide. */
const RETURNED = /^(content-type|cache-control)$/i;

function forwardedHeaders(request: IncomingMessage, config: ServerConfig): Headers {
  const headers = new Headers();

  for (const [name, raw] of Object.entries(request.headers)) {
    if (!FORWARDED.test(name) || raw === undefined) continue;
    headers.set(name, Array.isArray(raw) ? raw.join(', ') : raw);
  }

  // The credential, added here and only here. See config.ts.
  if (config.apiKey) headers.set('X-API-Key', config.apiKey);

  /*
   * No compression on the streaming route. A gzip stream buffers, and then
   * the whole answer arrives at once at the end — which is the difference
   * between watching an answer build for 30–90 seconds and staring at nothing
   * for 30–90 seconds. Same line, same reason, as `vite.config.ts` has in
   * development.
   */
  headers.set('Accept-Encoding', 'identity');
  return headers;
}

/** The whole request body. Small enough to hold; see `proxy`. */
async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Forwards one `/api/*` call, with the key attached and the answer streamed.
 *
 * The REQUEST is buffered and the RESPONSE is streamed, and the asymmetry is
 * the point. A question is a few hundred bytes of JSON that arrives at once;
 * an answer is a server-sent event stream that takes 30–90 seconds and has to
 * reach the browser frame by frame. Buffering the request costs nothing and
 * saves the half-duplex dance that streaming it would need.
 *
 * No timeout is set here. Node's own `requestTimeout` is 300 s and the fetch
 * client's body timeout is 300 s, both above the 240 s a long answer may
 * need; a timeout of ours would only be a shorter one.
 */
export async function proxy(
  request: IncomingMessage,
  response: ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const target = `${config.apiBase}${request.url ?? ''}`;

  /*
   * The reader pressing stop closes this socket, and the backend should hear
   * about it: an abandoned answer that keeps generating costs tokens and
   * holds a connection nobody is reading.
   */
  const controller = new AbortController();
  response.on('close', () => controller.abort());

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: forwardedHeaders(request, config),
      body: await readBody(request),
      signal: controller.signal,
    });
  } catch (error) {
    // The reader left; there is nobody to tell and nothing to log about.
    if (controller.signal.aborted) return;
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Fikk ikke kontakt med backend.' }));
    console.error('[ka] proxy mot %s feilet: %s', target, String(error));
    return;
  }

  const headers: Record<string, string> = {};
  upstream.headers.forEach((entry, name) => {
    if (RETURNED.test(name)) headers[name] = entry;
  });
  // Tells any intermediate proxy not to buffer the event stream. Azure
  // Container Apps' ingress is one such intermediate.
  headers['x-accel-buffering'] = 'no';

  response.writeHead(upstream.status, headers);

  if (!upstream.body) {
    response.end();
    return;
  }

  try {
    await pipeline(Readable.fromWeb(upstream.body), response);
  } catch {
    // A stream that broke mid-answer. The status line is long gone, so there
    // is nothing left to say in HTTP; closing is the whole of it.
    response.destroy();
  }
}
