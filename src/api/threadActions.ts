import type { Thread } from '../model';
import { deleteMockThread, renameMockThread } from './mock/sessionThreads';
import { kaEnv } from './runtimeConfig';

/**
 * What the reader can do to a thread besides open it: give it a new name, and
 * delete it.
 *
 * Beside the ChatClient and not in it, for now. The BFF has had both all
 * along (`PUT` and `DELETE` on `/api/conversations/:id`), and the client did
 * not use them (design/plan-monorepo-2026-09-29.md, «Det klienten vår må
 * få»). The BFF client was being rewritten for D16 on the same night, and
 * these two calls share nothing with it but the address, so they got a file
 * of their own instead of a merge in the middle of it.
 *
 * Both throw when the backend says no. The thread list updates first and
 * takes it back on a throw, so what the caller needs is only that it failed.
 */
export type ThreadActions = {
  rename(thread: Thread, title: string): Promise<void>;
  remove(thread: Thread): Promise<void>;
};

/**
 * The actions this deployment has, or undefined when it has none.
 *
 * Live talks to the backend's MCP endpoint, which has no call for either, so
 * the list shows neither there rather than offering something that would
 * fail on every press.
 */
export function createThreadActions(): ThreadActions | undefined {
  const mode = kaEnv().VITE_API_MODE ?? 'mock';
  if (mode === 'bff') return bffThreadActions();
  if (mode === 'live') return undefined;
  return mockThreadActions;
}

/**
 * The BFF's conversation, which is the thread's own id there: the BFF names
 * its conversations and the thread takes that name (bff/mapping.ts).
 */
function conversationPath(thread: Thread): string {
  return `/api/conversations/${encodeURIComponent(thread.conversationId ?? thread.id)}`;
}

let redirecting = false;

/**
 * To the BFF's sign-in when the session has run out, and back to this page —
 * what the BFF client does on a 401 (BffChatClient.ts, `toLogin`). A copy of
 * its five lines rather than an import, for the reason the file says above.
 */
function toLogin(): void {
  if (redirecting || window.location.pathname.startsWith('/auth/')) return;
  redirecting = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/auth/login?next=${next}`);
}

async function send(path: string, init: RequestInit): Promise<void> {
  const response = await fetch(path, { credentials: 'same-origin', ...init });
  if (response.status === 401) toLogin();
  if (!response.ok) throw new Error(`${init.method} ${path} ${response.status}`);
}

export function bffThreadActions(): ThreadActions {
  return {
    rename: (thread, title) =>
      send(conversationPath(thread), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    remove: (thread) => send(conversationPath(thread), { method: 'DELETE' }),
  };
}

/** The mock's own store, so both can be tried without a backend. */
const mockThreadActions: ThreadActions = {
  rename: async (thread, title) => renameMockThread(thread, title),
  remove: async (thread) => deleteMockThread(thread),
};

/** For tests: forget that a sign-in redirect has been started. */
export function resetThreadActions(): void {
  redirecting = false;
}
