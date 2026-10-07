import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffChatClient } from './bff';
import { createChatClient } from './index';
import { LiveChatClient } from './live';
import { MockChatClient } from './mock';

/**
 * Which backend the app talks to is decided when it is built, and only then.
 *
 * Read at runtime, the mode kept every client in the bundle, the mock corpus
 * included, because nothing could tell the bundler which one would be used.
 * And a production build without a mode answered from the mock: invented
 * answers that look like real ones, with nothing saying so.
 */
afterEach(() => {
  delete window.__KA_CONFIG__;
  vi.unstubAllEnvs();
});

describe('modusen', () => {
  it('er bff i et produksjonsbygg uten VITE_API_MODE', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_MODE', undefined);

    expect(createChatClient()).toBeInstanceOf(BffChatClient);
  });

  it('er mock i utvikling og i testene uten VITE_API_MODE', () => {
    vi.stubEnv('VITE_API_MODE', undefined);

    expect(createChatClient()).toBeInstanceOf(MockChatClient);
  });

  it('følger VITE_API_MODE fra bygget', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_API_MODE', 'live');

    expect(createChatClient()).toBeInstanceOf(LiveChatClient);
  });

  it('kan ikke byttes av /config.js etter bygget', () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    window.__KA_CONFIG__ = { VITE_API_MODE: 'live' };

    expect(createChatClient()).toBeInstanceOf(BffChatClient);
  });
});
