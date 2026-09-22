// @vitest-environment node
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createServer, request as httpRequest, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHandler } from './app.ts';
import { readConfig, type ServerConfig } from './config.ts';

/**
 * Serveren målt gjennom sin egen socket.
 *
 * Port 0 og ikke 8787: det er serveren som er under test, ikke porten en
 * container tilfeldigvis bruker — og en fast port hadde kollidert med seg
 * selv når fire arbeidere kjører `npm test` samtidig.
 */
let server: Server;
let base: string;
let dist: string;
let backend: Server | undefined;
/** Det siste kallet backend så. Nok til å måle hva som ble sendt videre. */
let seen: { url: string; headers: Record<string, string | string[] | undefined> } | undefined;

/**
 * `seen`, lest gjennom et kall.
 *
 * TypeScript snevrer variabelen til `undefined` etter en tilordning og vet
 * ikke at backendens tilbakekall kjører mellom den og lesingen. Et kall
 * opphever innsnevringen, som er nøyaktig hva som er sant her.
 */
function lastSeen(): typeof seen {
  return seen;
}

async function listen(instance: Server): Promise<number> {
  await new Promise<void>((done) => instance.listen(0, '127.0.0.1', done));
  const address = instance.address();
  if (address === null || typeof address === 'string') throw new Error('Ingen port.');
  return address.port;
}

/** En backend som svarer med en strøm, slik MCP-endepunktet gjør. */
async function startBackend(): Promise<string> {
  backend = createServer((request, response) => {
    seen = { url: request.url ?? '', headers: request.headers };
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'X-Skal-Bort': 'ja' });
    response.write('data: {"jsonrpc":"2.0"}\n\n');
    response.end();
  });
  return `http://127.0.0.1:${await listen(backend)}`;
}

async function start(overrides: Partial<ServerConfig> = {}): Promise<void> {
  dist = await mkdtemp(join(tmpdir(), 'ka-dist-'));
  await mkdir(join(dist, 'assets'));
  await writeFile(
    join(dist, 'index.html'),
    '<!doctype html><html><head><title>KA</title></head><body><div id="root"></div><script type="module" src="/assets/index-abc.js"></script></body></html>',
  );
  await writeFile(join(dist, 'assets', 'index-abc.js'), 'console.log(1);\n');

  const config: ServerConfig = { ...readConfig({}, dist), ...overrides };
  server = createServer(createHandler(config));
  base = `http://127.0.0.1:${await listen(server)}`;
}

/**
 * En forespørsel med stien akkurat som den er skrevet.
 *
 * `fetch` normaliserer adressen sin før den sender — `/api/../x` blir `/x` hos
 * KLIENTEN — så den kan ikke stille spørsmålet dette handler om. En angriper
 * bruker ikke fetch, og serveren må tåle stien rå.
 */
function raw(
  port: number,
  path: string,
  method = 'POST',
): Promise<{ status: number; contentType: string; body: string }> {
  return new Promise((done, fail) => {
    const call = httpRequest({ host: '127.0.0.1', port, path, method }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => (body += chunk));
      response.on('end', () =>
        done({
          status: response.statusCode ?? 0,
          contentType: response.headers['content-type'] ?? '',
          body,
        }),
      );
    });
    call.on('error', fail);
    call.end('{}');
  });
}

/** Porten serveren under test lytter på, lest av adressen. */
function portOf(url: string): number {
  return Number(new URL(url).port);
}

function stop(instance: Server | undefined): Promise<void> {
  return instance ? new Promise<void>((done) => instance.close(() => done())) : Promise.resolve();
}

beforeEach(() => {
  seen = undefined;
  backend = undefined;
});

afterEach(async () => {
  await stop(server);
  await stop(backend);
});

describe('/healthz', () => {
  it('svarer 200 med modusen den kjører i', async () => {
    // Modusen og ikke bare `ok`: et testmiljø som svarer fra fixturer ser
    // likt ut som ett som svarer fra backend til noen stiller et spørsmål.
    await start({ mode: 'live' });

    const response = await fetch(`${base}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, mode: 'live' });
  });

  it('sier mock når ingenting er satt', async () => {
    await start();
    expect(await (await fetch(`${base}/healthz`)).json()).toEqual({ ok: true, mode: 'mock' });
  });
});

describe('/config.js', () => {
  it('skriver bare de variablene som er satt, og aldri nøkkelen', async () => {
    await start({
      apiKey: 'rag_hemmelig_verdi',
      clientConfig: { VITE_API_MODE: 'live', VITE_KA_TENANT: 'demo' },
    });

    const body = await (await fetch(`${base}/config.js`)).text();

    expect(body).toContain('"VITE_API_MODE":"live"');
    expect(body).toContain('"VITE_KA_TENANT":"demo"');
    expect(body).not.toContain('VITE_KA_DATASETS');
    expect(body).not.toContain('rag_hemmelig_verdi');
  });

  it('bryter ikke ut av script-taggen på en etikett med spisse klammer', async () => {
    // Verdiene kommer fra en containers miljø og havner inne i en <script>.
    await start({ clientConfig: { VITE_KA_DATASETS: 'k=</script><script>alert(1)' } });

    const body = await (await fetch(`${base}/config.js`)).text();

    expect(body).not.toContain('</script>');
    expect(body).toContain('\\u003c/script');
  });

  it('lagres aldri, for det er slik en ny utrulling bytter modus', async () => {
    await start();
    expect((await fetch(`${base}/config.js`)).headers.get('cache-control')).toBe('no-store');
  });
});

describe('proxy mot backend', () => {
  it('setter nøkkelen på serveren og slipper gjennom protokollhodene', async () => {
    const apiBase = await startBackend();
    await start({ apiBase, apiKey: 'rag_hemmelig_verdi' });

    const response = await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'ka-test',
        'Mcp-Name': 'builtin.agent',
        'Mcp-Method': 'tools/call',
      },
      body: '{"jsonrpc":"2.0"}',
    });

    expect(response.status).toBe(200);
    expect(seen?.url).toBe('/api/mcp');
    expect(seen?.headers['x-api-key']).toBe('rag_hemmelig_verdi');
    expect(seen?.headers['x-user-id']).toBe('ka-test');
    expect(seen?.headers['mcp-name']).toBe('builtin.agent');
    expect(seen?.headers['mcp-method']).toBe('tools/call');
    // Ingen komprimering på strømmeruta: en gzip-strøm buffrer, og da kommer
    // hele svaret på én gang til slutt.
    expect(seen?.headers['accept-encoding']).toBe('identity');
  });

  it('lar ikke nettleseren sende sin egen nøkkel eller Authorization videre', async () => {
    // Allowlista er poenget: en proxy som sender Authorization videre er en
    // proxy noen kan prøve andres legitimasjon gjennom.
    const apiBase = await startBackend();
    await start({ apiBase, apiKey: 'rag_serverens_egen' });

    await fetch(`${base}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'rag_fra_nettleseren',
        Authorization: 'Bearer tull',
      },
      body: '{}',
    });

    expect(seen?.headers['x-api-key']).toBe('rag_serverens_egen');
    expect(seen?.headers.authorization).toBeUndefined();
  });

  it('ber mellomledd la være å buffre svaret', async () => {
    const apiBase = await startBackend();
    await start({ apiBase });

    const response = await fetch(`${base}/api/mcp`, { method: 'POST', body: '{}' });

    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('content-type')).toBe('text/event-stream');
    // Bare de to hodene som er våre å gi videre.
    expect(response.headers.get('x-skal-bort')).toBeNull();
    expect(await response.text()).toContain('data: {"jsonrpc":"2.0"}');
  });

  it('slipper ikke ut av /api/ med punktum-segmenter', async () => {
    /*
     * Funnet av KA CC på #151. `startsWith('/api/')` sto på råstrengen, mens
     * URL-parseren fjerner `..`-segmenter etterpå — så kallet landet på
     * konsoll-API-et med denne serverens nøkkel på. Backenden skal ikke se
     * noe av det i det hele tatt.
     */
    const apiBase = await startBackend();
    await start({ apiBase, apiKey: 'rag_hemmelig_verdi' });

    for (const path of ['/api/../console-api/x', '/api/%2e%2e/auth', '/api/..%2fauth']) {
      const response = await raw(portOf(base), path);

      expect({ path, status: response.status }).toEqual({ path, status: 404 });
      expect(response.contentType).toContain('application/json');
      expect({ path, sett: seen }).toEqual({ path, sett: undefined });
    }
  });

  it('avviser stier der backendens dekoding avgjør hva de betyr', async () => {
    /*
     * KA CC på #151: alle tre overlever normaliseringen her og kan bli
     * `/api/../auth` der borte — semikolonet som en stiparameter noen servere
     * stryker, `%25` som en escapet escape, og `....//` som det en filtrering
     * av `../` gjør om til nettopp `../`. Hva de betyr er ikke vår regel, så
     * de videresendes ikke.
     */
    const apiBase = await startBackend();
    await start({ apiBase, apiKey: 'rag_hemmelig_verdi' });

    for (const path of [
      '/api/..;/auth',
      '/api/%252e%252e/auth',
      '/api/....//auth',
      // Doble skråstreker uten punktumer i det hele tatt: den ene av de fire
      // reglene som ellers ikke ville vært målt, siden `....//` fanges av
      // prikk-regelen før den tomme-segment-regelen får se noe.
      '/api/conversations//abc',
    ]) {
      const response = await raw(portOf(base), path);

      expect({ path, status: response.status }).toEqual({ path, status: 404 });
      expect({ path, sett: seen }).toEqual({ path, sett: undefined });
    }
  });

  it('lar de legitime adressene være i fred', async () => {
    // Vakta over er en blokkeringsliste, og en blokkeringsliste som tar med
    // seg vanlige adresser er verre enn ingen. Målt begge veier.
    const apiBase = await startBackend();
    await start({ apiBase });

    for (const path of [
      '/api/mcp',
      '/api/conversations?page_size=100',
      '/api/conversations/5G7i1YoIdX432vrCDLrwk',
      '/api/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '/api/conversations/rapport.2025',
      '/api/conversations/',
      '/api/',
    ]) {
      seen = undefined;
      const response = await raw(portOf(base), path);

      expect({ path, status: response.status }).toEqual({ path, status: 200 });
      expect({ path, sett: lastSeen()?.url }).toEqual({ path, sett: path });
    }
  });

  it('lar en vanlig sti med spørrestreng gå gjennom som før', async () => {
    // Vakta over skal stenge omveier, ikke veien.
    const apiBase = await startBackend();
    await start({ apiBase });

    const response = await fetch(`${base}/api/conversations?page_size=100`);

    expect(response.status).toBe(200);
    expect(seen?.url).toBe('/api/conversations?page_size=100');
  });

  it('avviser en forespørsel som er større enn taket', async () => {
    // Uten tak er det bare klientens egen tilbakeholdenhet som står mellom
    // en strøm og containerens minne.
    const apiBase = await startBackend();
    await start({ apiBase, maxBodyBytes: 64 });

    const response = await fetch(`${base}/api/mcp`, { method: 'POST', body: 'x'.repeat(200) });

    expect(response.status).toBe(413);
    expect(seen).toBeUndefined();
  });

  it('slipper en forespørsel under taket gjennom', async () => {
    const apiBase = await startBackend();
    await start({ apiBase, maxBodyBytes: 64 });

    const response = await fetch(`${base}/api/mcp`, { method: 'POST', body: 'x'.repeat(32) });

    expect(response.status).toBe(200);
    expect(seen?.url).toBe('/api/mcp');
  });

  it('svarer 502 når backend ikke er der, ikke en side', async () => {
    // En klient som får HTML der den ventet JSON feiler i parseren, og da
    // sier feilmeldingen noe helt annet enn det som er galt.
    await start({ apiBase: 'http://127.0.0.1:1' });

    const response = await fetch(`${base}/api/mcp`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});

describe('den bygde klienten', () => {
  it('serverer index.html med config-taggen før bundelen', async () => {
    await start();

    const body = await (await fetch(`${base}/`)).text();

    expect(body).toContain('<script src="/config.js"></script>');
    expect(body.indexOf('/config.js')).toBeLessThan(body.indexOf('type="module"'));
  });

  it('faller tilbake til index.html på en rute som bare finnes i klienten', async () => {
    // Uten dette får en leser som oppdaterer på en tråd 404 fra sin egen app.
    const response = await fetch(`${base}/threads/abc-123`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('id="root"');
  });

  it('lar aldri index.html ligge i hurtiglageret', async () => {
    expect((await fetch(`${base}/`)).headers.get('cache-control')).toBe('no-cache');
  });

  it('gir hashede filer evig levetid, og resten ikke', async () => {
    const asset = await fetch(`${base}/assets/index-abc.js`);

    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(asset.headers.get('content-type')).toContain('text/javascript');
  });

  it('svarer JSON og ikke en side på et ukjent API-endepunkt', async () => {
    const response = await fetch(`${base}/api`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('slipper ingen ut av dist-mappa', async () => {
    // `..` i adressen skal ikke kunne lese noe utenfor den bygde klienten.
    const response = await fetch(`${base}/assets/../../../etc/passwd`, { redirect: 'manual' });

    // Fallback til index.html er riktig svar: stien finnes ikke som fil her.
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('id="root"');
  });

  beforeEach(async () => {
    if (!server?.listening) await start();
  });
});
