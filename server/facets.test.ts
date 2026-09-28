// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessToken } from './access.ts';
import { createHandler } from './app.ts';
import { readConfig, type ServerConfig } from './config.ts';
import { MAX_FACET_VALUES, facetConfigFrom, parseCollections, shapeOptions } from './facets.ts';

/**
 * `/api/facets` målt gjennom serverens egen socket, mot en Typesense som
 * svarer med en fixtur formet etter et ekte svar fra Kudos (28.09).
 */
const FIXTURE = readFileSync(new URL('./fixtures/typesense-facets.json', import.meta.url), 'utf8');
const KEY = 'ts_hemmelig_sokenokkel';
const FIELDS = 'kudos-full=documentType:type|organisation:orgs_long|year:concerned_years:integer';

let server: Server | undefined;
let typesense: Server | undefined;
let backend: Server | undefined;
let base: string;
/** Hvert kall Typesense fikk. */
let asked: { url: URL; key: string | undefined }[];
/** Hvert kall backend fikk. Skal alltid være tomt her. */
let forwarded: string[];
/** Hva Typesense svarer med neste gang. */
let answer: { status: number; body: string };

async function listen(instance: Server): Promise<string> {
  await new Promise<void>((done) => instance.listen(0, '127.0.0.1', done));
  const address = instance.address();
  if (address === null || typeof address === 'string') throw new Error('Ingen port.');
  return `http://127.0.0.1:${address.port}`;
}

function stop(instance: Server | undefined): Promise<void> {
  return instance ? new Promise<void>((done) => instance.close(() => done())) : Promise.resolve();
}

/** Serveren med Typesense og backend begge på egne porter. */
async function start(env: NodeJS.ProcessEnv = {}, ttlMs?: number, accessSecret?: string) {
  typesense = createServer((request, response) => {
    asked.push({
      url: new URL(request.url ?? '', 'http://typesense'),
      key: request.headers['x-typesense-api-key'] as string | undefined,
    });
    response.writeHead(answer.status, { 'Content-Type': 'application/json' });
    response.end(answer.body);
  });
  backend = createServer((request, response) => {
    forwarded.push(request.url ?? '');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"facets":[{"field":"fra-backend","label":"feil","options":[]}]}');
  });
  const typesenseUrl = await listen(typesense);
  const apiBase = await listen(backend);

  const config: ServerConfig = {
    ...readConfig({}, '/dist'),
    // Live, fordi serveren i mock ikke sender noe til backend, og testen
    // under måler at alt annet enn /api/facets går dit.
    mode: 'live',
    apiBase,
    accessSecret,
    facets: {
      ...facetConfigFrom({
        TYPESENSE_URL: `${typesenseUrl}/`,
        TYPESENSE_API_KEY: KEY,
        KA_FACET_COLLECTIONS: 'kudos-full=KUDOS_docs v4',
        VITE_KA_FILTER_FIELDS: FIELDS,
        ...env,
      }),
      ...(ttlMs === undefined ? {} : { ttlMs }),
    },
  };
  server = createServer(createHandler(config));
  base = await listen(server);
}

beforeEach(() => {
  asked = [];
  forwarded = [];
  answer = { status: 200, body: FIXTURE };
});

afterEach(async () => {
  await stop(server);
  await stop(typesense);
  await stop(backend);
  server = typesense = backend = undefined;
});

describe('/api/facets', () => {
  it('svarer i det generiske formatet, med policyen brukt', async () => {
    await start();

    const response = await fetch(`${base}/api/facets?dataset=kudos-full`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      facets: [
        {
          field: 'type',
          label: 'dokumenttyper',
          // Etter antall, og den tomme verdien er borte.
          options: [
            { value: 'Tildelingsbrev', count: 3378 },
            { value: 'Årsrapport', count: 1418 },
          ],
        },
        {
          field: 'orgs_long',
          label: 'virksomheter',
          // Etter antall, og alfabetisk når antallet er likt.
          options: [
            { value: 'Kunnskapsdepartementet', count: 920 },
            { value: 'Advokattilsynet', count: 40 },
            { value: 'Statens vegvesen', count: 40 },
          ],
        },
        {
          field: 'concerned_years',
          label: 'år',
          // Nyeste først, og bare 1990–2035: «2436», «1989», «2036» og «0» er støy.
          options: [
            { value: '2035', count: 7 },
            { value: '2024', count: 1883 },
            { value: '2023', count: 1851 },
            { value: '1990', count: 5 },
          ],
        },
      ],
    });
  });

  it('spør Typesense bare om de konfigurerte feltene, med nøkkelen, og aldri backend', async () => {
    await start();

    await fetch(`${base}/api/facets?dataset=kudos-full`);

    expect(forwarded).toEqual([]);
    expect(asked).toHaveLength(1);
    const [call] = asked;
    expect(call?.key).toBe(KEY);
    // Samlingen fra konfigurasjonen, kodet inn i stien.
    expect(call?.url.pathname).toBe('/collections/KUDOS_docs%20v4/documents/search');
    expect(Object.fromEntries(call?.url.searchParams ?? [])).toEqual({
      q: '*',
      per_page: '0',
      facet_by: 'type,orgs_long,concerned_years',
      max_facet_values: String(MAX_FACET_VALUES),
    });
  });

  it('setter ingenting fra nettleseren inn i spørringen til Typesense', async () => {
    // Bare datasettnøkkelen leses, og den brukes bare til å slå opp i
    // konfigurasjonen. Et filter eller et felt i adressen når ikke fram.
    await start();

    await fetch(
      `${base}/api/facets?dataset=kudos-full&filter_by=orgs_long:=x&facet_by=title&q=hemmelig`,
    );

    expect(Object.fromEntries(asked[0]?.url.searchParams ?? [])).toEqual({
      q: '*',
      per_page: '0',
      facet_by: 'type,orgs_long,concerned_years',
      max_facet_values: String(MAX_FACET_VALUES),
    });
  });

  it('svarer tom liste uten å spørre for et datasett som ikke er konfigurert', async () => {
    await start();

    for (const query of [
      '?dataset=kudos',
      '?dataset=',
      '',
      // Et vanlig objekt har disse som egne egenskaper via prototypen.
      '?dataset=constructor',
      '?dataset=__proto__',
      '?dataset=toString',
    ]) {
      const response = await fetch(`${base}/api/facets${query}`);

      expect({ query, status: response.status }).toEqual({ query, status: 200 });
      expect({ query, body: await response.json() }).toEqual({ query, body: { facets: [] } });
    }
    expect(asked).toEqual([]);
    expect(forwarded).toEqual([]);
  });

  it('svarer tom liste når Typesense ikke er satt opp', async () => {
    for (const env of [
      { TYPESENSE_API_KEY: '' },
      { TYPESENSE_URL: ' ' },
      { KA_FACET_COLLECTIONS: '' },
    ]) {
      await start(env);

      const body = await (await fetch(`${base}/api/facets?dataset=kudos-full`)).json();

      expect({ env, body }).toEqual({ env, body: { facets: [] } });
      await stop(server);
      await stop(typesense);
      await stop(backend);
    }
    expect(asked).toEqual([]);
  });

  it('lar et felt uten verdier være ute', async () => {
    await start();
    answer = {
      status: 200,
      body: JSON.stringify({
        facet_counts: [
          { field_name: 'type', counts: [{ value: 'Årsrapport', count: 3 }] },
          { field_name: 'orgs_long', counts: [{ value: '', count: 9 }] },
        ],
      }),
    };

    const body = (await (await fetch(`${base}/api/facets?dataset=kudos-full`)).json()) as {
      facets: { field: string }[];
    };

    expect(body.facets.map((facet) => facet.field)).toEqual(['type']);
  });

  it('svarer 502 når Typesense feiler, uten nøkkelen, og prøver igjen neste gang', async () => {
    await start();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer = { status: 401, body: `{"message":"Forbidden - a valid x-typesense-api-key: ${KEY}"}` };

    const failed = await fetch(`${base}/api/facets?dataset=kudos-full`);
    const text = await failed.text();

    expect(failed.status).toBe(502);
    expect(failed.headers.get('content-type')).toContain('application/json');
    expect(text).not.toContain(KEY);
    expect(logged).toHaveBeenCalledOnce();
    expect(String(logged.mock.calls[0])).not.toContain(KEY);

    // En feil lagres ikke: neste forespørsel spør på nytt, og får svar.
    answer = { status: 200, body: FIXTURE };
    const retried = await fetch(`${base}/api/facets?dataset=kudos-full`);

    expect(retried.status).toBe(200);
    expect(asked).toHaveLength(2);
  });

  it('spør Typesense én gang for mange forespørsler, også samtidige', async () => {
    // Panelet spør ved hvert klikk, og det skal ikke bli et kall til Benjamins
    // Typesense hver gang.
    await start();

    await Promise.all([
      fetch(`${base}/api/facets?dataset=kudos-full`),
      fetch(`${base}/api/facets?dataset=kudos-full`),
    ]);
    await fetch(`${base}/api/facets?dataset=kudos-full`);

    expect(asked).toHaveLength(1);
  });

  it('spør på nytt når tiden er ute', async () => {
    // `ttlMs: 0` er utløpt med en gang.
    await start({}, 0);

    await fetch(`${base}/api/facets?dataset=kudos-full`);
    await fetch(`${base}/api/facets?dataset=kudos-full`);

    expect(asked).toHaveLength(2);
  });

  it('ligger bak den delte hemmeligheten når den er på', async () => {
    // Porten står før ruta i app.ts. Uten kapsel skal Typesense ikke bli spurt.
    const secret = 'Zk3_q9vX-2LmPa7tQwE8rYu1sDfGh4jK6lZx0cVbNm';
    await start({}, undefined, secret);

    const denied = await fetch(`${base}/api/facets?dataset=kudos-full`);
    expect(denied.status).toBe(401);
    expect(asked).toEqual([]);

    const allowed = await fetch(`${base}/api/facets?dataset=kudos-full`, {
      headers: { Cookie: `ka_access=${accessToken(secret)}` },
    });
    expect(allowed.status).toBe(200);
    expect(asked).toHaveLength(1);
  });

  it('godtar bare GET', async () => {
    await start();

    const response = await fetch(`${base}/api/facets?dataset=kudos-full`, { method: 'POST' });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    expect(asked).toEqual([]);
    expect(forwarded).toEqual([]);
  });

  it('sender alt annet under /api/ til backend som før, også stier under /api/facets/', async () => {
    await start();

    await fetch(`${base}/api/facets/noe`);
    await fetch(`${base}/api/conversations`);

    expect(forwarded).toEqual(['/api/facets/noe', '/api/conversations']);
    expect(asked).toEqual([]);
  });

  it('skriver aldri Typesense-nøkkelen i /config.js', async () => {
    await start();

    const body = await (await fetch(`${base}/config.js`)).text();

    expect(body).not.toContain(KEY);
  });
});

describe('policyen', () => {
  it('holder år innenfor spennet og som hele tall', () => {
    expect(
      shapeOptions('year', [
        { value: '2024.5', count: 1 },
        { value: ' ', count: 1 },
        { value: 'tjue', count: 1 },
        { value: '2001', count: 1 },
      ]),
    ).toEqual([{ value: '2001', count: 1 }]);
  });
});

describe('KA_FACET_COLLECTIONS', () => {
  it('leser datasett=samling, og hopper over feil og gjentakelser med én advarsel', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const collections = parseCollections(
      ' kudos-full = KUDOS_docs ; bare-nokkel ; =uten-nokkel ; kudos-full=andre ; pilot=pilot_docs ;',
    );

    expect([...collections]).toEqual([
      ['kudos-full', 'KUDOS_docs'],
      ['pilot', 'pilot_docs'],
    ]);
    expect(warned).toHaveBeenCalledOnce();
    expect(String(warned.mock.calls[0])).toContain('kudos-full=andre');
  });

  it('er tom uten variabel, og uten advarsel', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseCollections(undefined).size).toBe(0);
    expect(warned).not.toHaveBeenCalled();
  });
});
