import { http, HttpResponse } from 'msw';
import { AppRoutes } from '../routes/AppRoutes';
import { SignInScreen } from './SignInScreen';
import { backend, refusals } from '../../test/handlers';
import userEvent from '@testing-library/user-event';
import {
  fireEvent,
  renderAt,
  screen,
  waitFor,
  within,
} from '../../test/render';
import { countRequests, held, server } from '../../test/server';
import { session } from '../api/session';
import { SessionProvider } from '../session/SessionProvider';

/**
 * The form, and mostly what it refuses to say.
 *
 * The backend answers every failed sign-in identically and never with a `400`,
 * deliberately: telling somebody their guess was never going to match is the
 * thing the identical rejections exist to withhold. The screen's job is to not
 * undo that at the edge — no wording that names a half, and no local check that
 * implies the platform verified something it did not.
 */

/** Words that would name a half, or admit whether an address is known. */
const TELLS =
  /unknown|not registered|no account|does not exist|doesn't exist|no such|incorrect password|wrong password|invalid email|check your email|email is/i;

function renderForm() {
  return renderAt(
    <SessionProvider>
      <SignInScreen />
    </SessionProvider>,
    { at: '/sign-in' },
  );
}

const user = userEvent.setup();

async function fillIn({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const address = await screen.findByLabelText(/email/i);
  const secret = screen.getByLabelText(/password/i);

  if (email !== '') await user.type(address, email);
  if (password !== '') await user.type(secret, password);
}

/** A real click, which a disabled button will not accept. */
async function submit() {
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

/**
 * What pressing Enter in a field does, and what a disabled button does not
 * prevent. The in-flight guard has to be in the handler, not only in the
 * button — a test that clicked a disabled button would pass without one.
 */
function submitByKeyboard() {
  fireEvent.submit(screen.getByRole('form', { name: /sign in/i }));
}

beforeEach(() => {
  localStorage.clear();
  session.end();
});

describe('signing in', () => {
  it('establishes a session and shows the application', async () => {
    renderAt(
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>,
      { at: '/sign-in' },
    );
    await fillIn({ email: 'caller@example.com', password: 'secret' });

    await submit();

    // 1.1, end to end: the form is gone and the frame is there.
    expect(await screen.findByText(backend.caller.email)).toBeInTheDocument();
  });

  it('reports the pair, and never which half', async () => {
    server.use(refusals.wordless('post', '/api/auth/sign-in'));
    renderForm();
    await fillIn({ email: 'caller@example.com', password: 'wrong' });

    await submit();

    const said = await screen.findByRole('alert');
    // The claim, not the sentence: whatever it says, it says it about the
    // attempt and never about one half of it. The words are the handoff's —
    // "Those details were not accepted" is more neutral still than "did not
    // match", which quietly implies both halves were checked together.
    expect(said.textContent ?? '').not.toBe('');
    expect(said.textContent ?? '').not.toMatch(TELLS);
    expect(said.textContent ?? '').not.toMatch(/email|password|address/i);
  });

  it('reports too many attempts as its own thing', async () => {
    server.use(refusals.throttled('post', '/api/auth/sign-in'));
    renderForm();
    await fillIn({ email: 'caller@example.com', password: 'secret' });

    await submit();

    const said = await screen.findByRole('alert');
    // 1.3: distinct from a wrong pair. Told "that did not match", somebody
    // types it again more carefully; told they are locked out, they come back.
    expect(said).toHaveTextContent(/too many attempts/i);
    expect(said).toHaveTextContent(/later/i);
    expect(said.textContent ?? '').not.toMatch(/did not match/i);
    // And nothing to press. The cooldown is 900 seconds, so a button here
    // could not succeed for a quarter of an hour — and this is the screen
    // where being throttled actually happens.
    expect(within(said).queryByRole('button')).toBeNull();
  });

  it('does not claim a wrong password when the service cannot be reached', async () => {
    server.use(refusals.unreachable('post', '/api/auth/sign-in'));
    renderForm();
    await fillIn({ email: 'caller@example.com', password: 'secret' });

    await submit();

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent(/could not be reached/i);
    expect(said.textContent ?? '').not.toMatch(/did not match/i);
  });
});

describe('what the form checks itself', () => {
  it('says an empty field is empty without asking the backend', async () => {
    renderForm();
    await fillIn({ email: '', password: 'secret' });

    await submit();

    expect(await screen.findByText(/fill in/i)).toBeInTheDocument();
    // 1.5: asserted as a request that never happened. A message alone would
    // pass for a form that asked and then complained about the answer.
    expect(countRequests('POST', '/api/auth/sign-in')).toBe(0);
  });

  it('says the same for an empty password', async () => {
    renderForm();
    await fillIn({ email: 'caller@example.com', password: '' });

    await submit();

    expect(await screen.findByText(/fill in/i)).toBeInTheDocument();
    expect(countRequests('POST', '/api/auth/sign-in')).toBe(0);
  });

  it('presents its own objection as its own, not as an answer', async () => {
    renderForm();
    await fillIn({ email: '', password: '' });

    await submit();

    // The two channels are separate on purpose: nothing the platform said is
    // rendered here, and the form's objection never borrows its voice.
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/fill in/i).textContent ?? '').not.toMatch(
      /did not match|platform|account/i,
    );
  });

  it('checks nothing about the shape of an address', async () => {
    renderForm();
    await fillIn({ email: 'not-an-address', password: 'secret' });

    await submit();

    // A format check would tell somebody their guess was never going to match
    // — the same thing the backend refuses to tell them, arrived at locally.
    await waitFor(() => {
      expect(countRequests('POST', '/api/auth/sign-in')).toBe(1);
    });
  });
});

describe('while an attempt is in flight', () => {
  it('shows that it is waiting and refuses a second submission', async () => {
    const attempt = held();
    server.use(
      http.post('/api/auth/sign-in', async () => {
        await attempt.until;
        return HttpResponse.json(backend.session);
      }),
    );
    renderForm();
    await fillIn({ email: 'caller@example.com', password: 'secret' });

    await submit();

    expect(await screen.findByText(/signing in/i)).toBeInTheDocument();
    submitByKeyboard();
    submitByKeyboard();
    attempt.release();
    await waitFor(() => {
      expect(session.accessToken()).not.toBeNull();
    });
    // 1.4: one attempt, however many times the button is pressed. Two
    // sign-ins would issue two refresh tokens and leave one of them orphaned.
    expect(countRequests('POST', '/api/auth/sign-in')).toBe(1);
  });
});
