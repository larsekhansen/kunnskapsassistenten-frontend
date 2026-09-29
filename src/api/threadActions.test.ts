import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Thread } from '../model';
import { mockThreadDetail, mockThreadList, resetMockThreads } from './mock/sessionThreads';
import { bffThreadActions, createThreadActions, resetThreadActions } from './threadActions';

const now = new Date().toISOString();
const thread: Thread = {
  id: 'conv-1',
  conversationId: 'conv-1',
  title: 'Måloppnåelse i Nkom',
  createdAt: now,
  updatedAt: now,
};

describe('the BFF’s rename and delete', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    resetThreadActions();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renames with PUT and the title in the body', async () => {
    await bffThreadActions().rename(thread, 'Nkom 2024');

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/conversations/conv-1');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ title: 'Nkom 2024' });
  });

  it('deletes with DELETE', async () => {
    await bffThreadActions().remove(thread);

    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/api/conversations/conv-1');
    expect(init?.method).toBe('DELETE');
  });

  it('names the conversation safely in the path', async () => {
    await bffThreadActions().remove({ ...thread, conversationId: 'a/b?c' });

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/conversations/a%2Fb%3Fc');
  });

  it('fails when the BFF says no, so the list can take the change back', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"Kunne ikke endre navn."}', { status: 502 }),
    );

    await expect(bffThreadActions().rename(thread, 'Nkom 2024')).rejects.toThrow('502');
  });

  it('goes to the sign-in when the session has run out', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/threads/conv-1',
      search: '',
      assign,
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(bffThreadActions().remove(thread)).rejects.toThrow('401');
    expect(assign).toHaveBeenCalledWith('/auth/login?next=%2Fthreads%2Fconv-1');
  });
});

describe('the mock’s rename and delete', () => {
  beforeEach(() => {
    resetMockThreads();
    vi.stubEnv('VITE_API_MODE', 'mock');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps a new name for a thread it did not make, in the list and when opened', async () => {
    await createThreadActions()?.rename(thread, 'Nkom 2024');

    expect(mockThreadList([thread]).map((row) => row.title)).toEqual(['Nkom 2024']);
    expect(mockThreadDetail(thread.id, { ...thread, messages: [] })?.title).toBe('Nkom 2024');
  });

  it('forgets a deleted thread, in the list and when opened', async () => {
    const other = { ...thread, id: 'conv-2', conversationId: 'conv-2', title: 'Årsrapport' };
    await createThreadActions()?.remove(thread);

    expect(mockThreadList([thread, other]).map((row) => row.id)).toEqual(['conv-2']);
    expect(mockThreadDetail(thread.id, { ...thread, messages: [] })).toBeNull();
  });
});

describe('which actions a deployment has', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('has none in live, whose backend has no call for either', () => {
    vi.stubEnv('VITE_API_MODE', 'live');

    expect(createThreadActions()).toBeUndefined();
  });

  it('has both in bff and in mock', () => {
    vi.stubEnv('VITE_API_MODE', 'bff');
    expect(createThreadActions()).toBeDefined();

    vi.stubEnv('VITE_API_MODE', 'mock');
    expect(createThreadActions()).toBeDefined();
  });
});
