import type { ChatClient } from './chatClient';
import { MockChatClient } from './mock';

export type { AskParams, ChatClient } from './chatClient';

/**
 * Which backend the app talks to. One switch, `VITE_API_MODE`, default
 * `mock`. The live client arrives with the Vite proxy that holds the API key;
 * the key never reaches the bundle, because the backend sends no CORS headers
 * and a browser could not call it directly anyway.
 * See design/eksisterende/api-for-frontend.md.
 */
export function createChatClient(): ChatClient {
  const mode = import.meta.env.VITE_API_MODE ?? 'mock';
  if (mode === 'live') {
    throw new Error('VITE_API_MODE=live er ikke støttet ennå. Bruk mock inntil videre.');
  }
  return new MockChatClient();
}
