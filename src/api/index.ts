import { apiMode, type ApiMode } from './apiMode';
import type { ChatClient } from './chatClient';
import { BffChatClient } from './bff';
import { activeCorpusKey } from './corpus';
import { kaEnv } from './runtimeConfig';

/*
 * The mock and the live client, loaded only in the mode that uses them.
 *
 * A dynamic `import()` is a chunk of its own, fetched when it runs. A bff
 * build therefore carries neither in the JavaScript a reader downloads: not
 * the mock's corpus and summaries, and not the live client, which calls the
 * backend's own API. Top-level `await`, so clients are still built
 * synchronously everywhere else. The tests load both, because they switch
 * mode per test.
 *
 * Nothing either of them imports may import this module back, or the
 * `await` waits for itself.
 */
const loadAll = import.meta.env?.MODE === 'test';
const mock = loadAll || apiMode() === 'mock' ? await import('./mock') : undefined;
const live = loadAll || apiMode() === 'live' ? await import('./live') : undefined;

function loaded<T>(module: T | undefined, mode: ApiMode): T {
  if (module === undefined) throw new Error(`Klienten for ${mode} er ikke med i dette bygget.`);
  return module;
}

export type { AskParams, ChatClient } from './chatClient';
export type { UploadClient, UploadProgress } from './uploadClient';
export { createUploadClient } from './uploadFactory';
export {
  loadUserDocuments,
  removeUserDocument,
  subscribeToUserDocuments,
  uploadUserDocument,
  userDocuments,
} from './userDocuments';
export type { CorpusOption } from './corpus';
export {
  activeCorpus,
  activeCorpusKey,
  adoptServerCorpus,
  corpusDisplayName,
  corpusDisplayNameFor,
  corpusIsChoosable,
  corpusOption,
  corpusOptions,
  setActiveCorpusKey,
  subscribeToCorpus,
} from './corpus';

/**
 * Which backend the app talks to. One switch, `VITE_API_MODE`, read when the
 * app is built (apiMode.ts). The live client arrives with the Vite proxy that holds the API key;
 * the key never reaches the bundle, because the backend sends no CORS headers
 * and a browser could not call it directly anyway.
 * See design/eksisterende/api-for-frontend.md.
 *
 * `bff` is the third: the BFF in digdir/kunnskapsassistenten in front of the
 * backend, holding the key and the sign-in, and serving this client from its
 * own origin
 * (docs/arkitektur/0002-klienten-bak-bff.md).
 */
export function createChatClient(): ChatClient {
  const env = kaEnv();
  const mode = apiMode();
  if (mode === 'bff') {
    const bff = new BffChatClient({ datasetConfigKey: activeCorpusKey });
    // The corpus's name comes from the BFF (docs/arkitektur/0003); ask for it
    // now rather than when the filter panel first draws.
    bff.prime();
    return bff;
  }
  if (mode !== 'live') {
    // `VITE_MOCK_SPEED` decides how long the mock takes to answer. The default
    // is the slow, lifelike one on purpose: a mock that answers instantly
    // cannot show the skeleton, the thinking panel or the streaming, which is
    // most of what there is to look at. The e2e suite sets `fast`.
    const { defaultMockSpeed, MockChatClient, mockSpeeds } = loaded(mock, mode);
    const speed = env.VITE_MOCK_SPEED ?? defaultMockSpeed;
    return new MockChatClient(mockSpeeds[speed] ?? mockSpeeds[defaultMockSpeed]);
  }

  // Which corpus to ask. Both or neither; the client drops a lone one and says
  // so. Unset is the behaviour up to now: the backend picks, which on the
  // local stack is the demo corpus.
  //
  // A function rather than a value, because the corpus is the reader's to
  // change while the app runs. The client calls it when it builds a request,
  // so the question goes to whatever is selected then — not to whatever was
  // selected when this factory ran. See src/api/corpus.ts.
  const { LiveChatClient } = loaded(live, mode);
  return new LiveChatClient({
    tenant: env.VITE_KA_TENANT,
    datasetConfigKey: activeCorpusKey,
  });
}
