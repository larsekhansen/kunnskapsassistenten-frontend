import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSession } from '../../api/session';
import { SignedIn } from './SignedIn';

describe('SignedIn', () => {
  it('names who is signed in, and signs out through the BFF', () => {
    render(
      <SignedIn
        session={{ name: 'Kari Nordmann', email: 'kari@digdir.no', logoutUrl: '/auth/logout' }}
      />,
    );

    expect(screen.getByText('Kari Nordmann')).toBeTruthy();
    expect(screen.getByText('Innlogget som')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Logg ut' }).getAttribute('href')).toBe('/auth/logout');
  });

  it('draws nothing when nobody is signed in', () => {
    const { container } = render(<SignedIn session={null} />);

    expect(container.textContent).toBe('');
    expect(screen.queryByRole('link', { name: 'Logg ut' })).toBeNull();
  });
});

describe('fetchSession', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const me = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_API_MODE', 'bff');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads the name from /api/me when sign-in is on', async () => {
    me({ authEnabled: true, user: { name: 'Kari Nordmann', email: 'kari@digdir.no' } });

    expect(await fetchSession()).toEqual({
      name: 'Kari Nordmann',
      email: 'kari@digdir.no',
      logoutUrl: '/auth/logout',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/me');
  });

  it('falls back to the address when the sign-in gave no name', async () => {
    me({ authEnabled: true, user: { name: '', email: 'kari@digdir.no' } });

    expect((await fetchSession())?.name).toBe('kari@digdir.no');
  });

  it('has nothing to show with sign-in turned off, as in the local pod', async () => {
    me({ authEnabled: false, user: null });

    expect(await fetchSession()).toBeUndefined();
  });

  it('offers no «Logg ut» with sign-in off, even if a user came along', async () => {
    // There is no session to end then, and /auth/logout would send the
    // reader to Entra for nothing.
    me({ authEnabled: false, user: { name: 'Lokal bruker', email: '' } });

    expect(await fetchSession()).toBeUndefined();
  });

  it('has nothing to show when /api/me fails', async () => {
    me({ error: 'feil' }, 502);
    expect(await fetchSession()).toBeUndefined();

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchSession()).toBeUndefined();
  });

  it('does not ask anywhere but behind the BFF', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock');

    expect(await fetchSession()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
