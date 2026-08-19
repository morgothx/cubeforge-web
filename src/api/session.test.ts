import type { Session } from './types';
import { REFRESH_STORAGE_KEY, session } from './session';

const ISSUED: Session = {
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  sessionExpiresAt: '2026-08-19T00:15:00.000Z',
};

/** Everything the browser is holding, whatever key it is under. */
function everythingInStorage(): string {
  return JSON.stringify({ ...localStorage });
}

describe('where the credential lives', () => {
  beforeEach(() => {
    localStorage.clear();
    session.end();
  });

  it('makes the access token readable once a session is adopted', () => {
    session.adopt(ISSUED);

    expect(session.accessToken()).toBe(ISSUED.accessToken);
    expect(session.refreshToken()).toBe(ISSUED.refreshToken);
  });

  it('never writes the access token down', () => {
    session.adopt(ISSUED);

    // Read the whole of storage, not just our key. The point is not that we
    // avoided one particular write — it is that the shorter-lived credential
    // exists nowhere a script can read it after the tab is gone.
    expect(everythingInStorage()).not.toContain(ISSUED.accessToken);
  });

  it('persists the refresh token, and nothing else about the session', () => {
    session.adopt(ISSUED);

    const stored = everythingInStorage();
    expect(stored).toContain(ISSUED.refreshToken);
    // The expiry is returned by the backend and deliberately unused: renewing
    // reactively on a refusal is correct even when the clock is wrong, and a
    // value nobody reads is a value that will one day be trusted by mistake.
    expect(stored).not.toContain(ISSUED.sessionExpiresAt);
  });

  it('answers nothing before a session exists', () => {
    expect(session.accessToken()).toBeNull();
    expect(session.refreshToken()).toBeNull();
  });

  it('leaves nothing behind when the session ends', () => {
    session.adopt(ISSUED);

    session.end();

    expect(session.accessToken()).toBeNull();
    expect(session.refreshToken()).toBeNull();
    expect(everythingInStorage()).not.toContain(ISSUED.refreshToken);
  });

  it('holds no trace of anything but the two tokens', () => {
    // Requirement 1.6: a password is never retained past the attempt it was
    // sent for. Nothing here is given one, and this asserts that the shape
    // stays that way — a session that grew a `password` field would show up
    // here rather than in a breach.
    session.adopt(ISSUED);

    expect(everythingInStorage().toLowerCase()).not.toContain('password');
  });
});

describe('a session recovered after the page is gone', () => {
  beforeEach(() => {
    localStorage.clear();
    session.end();
  });

  it('finds the refresh token a previous page left, and no access token', async () => {
    session.adopt(ISSUED);

    // A reload: the module's memory is gone, storage is not. This is the whole
    // reason the two tokens are kept differently, so the test has to actually
    // discard the memory rather than trust that it would have been discarded.
    vi.resetModules();
    const reloaded = (await import('./session')).session;

    expect(reloaded.refreshToken()).toBe(ISSUED.refreshToken);
    expect(reloaded.accessToken()).toBeNull();
  });

  it('treats a storage entry it cannot use as no session at all', async () => {
    localStorage.setItem(REFRESH_STORAGE_KEY, '');

    vi.resetModules();
    const reloaded = (await import('./session')).session;

    // An empty or junk entry is somebody else's bug, a cleared browser, or a
    // half-finished write. None of them is a session, and none of them should
    // be a crash on the first paint.
    expect(reloaded.refreshToken()).toBeNull();
  });
});
