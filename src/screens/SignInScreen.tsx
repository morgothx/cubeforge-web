import { useState, type FormEvent } from 'react';
import { ApiError, type Refusal } from '../api/refusal';
import { RefusalNotice } from '../components/RefusalNotice';
import { useSession } from '../session/useSession';

/**
 * The form, and mostly what it declines to say.
 *
 * The backend answers every failed sign-in identically and never with a `400`,
 * on purpose: a rejection that named the wrong half — or that admitted the
 * address is unknown here — would tell somebody their guess was never going to
 * match, which is what identical answers exist to withhold. This screen's whole
 * discipline is not undoing that at the edge, so it neither reads the cause of a
 * refusal nor checks the shape of an address.
 *
 * What the form *may* object to is its own emptiness, and that is kept in a
 * different place from anything the platform said (1.5). One channel for two
 * kinds of statement is how "please fill this in" ends up sounding like a
 * verdict from the backend.
 */
export function SignInScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [objection, setObjection] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [attempting, setAttempting] = useState(false);

  async function attempt(event: FormEvent) {
    event.preventDefault();

    // Guarded here and not only on the button: a disabled button still leaves
    // the form submittable with the keyboard, and two sign-ins would issue two
    // refresh tokens with one of them orphaned (1.4).
    if (attempting) return;

    if (email.trim() === '' || password === '') {
      // Not trimmed for the password: spaces are a legitimate part of one, and
      // deciding otherwise here would reject something the backend accepts.
      setObjection('Fill in both your email address and your password.');
      setRefusal(null);
      return;
    }

    setObjection(null);
    setRefusal(null);
    setAttempting(true);
    try {
      await signIn({ email, password });
    } catch (error) {
      setRefusal(
        error instanceof ApiError ? error.refusal : { kind: 'unreachable' },
      );
    } finally {
      setAttempting(false);
    }
  }

  return (
    <section>
      <h1>Sign in</h1>
      {/*
        `noValidate`, with `type="email"` kept.
        The type is worth having: it is what gives a phone the right keyboard
        and a password manager the right hint. What is not worth having is the
        browser refusing to submit a malformed address, which is a shape check
        that treats "malformed" and "well-formed but unknown" differently — a
        distinction this platform deliberately withholds. Removing `noValidate`
        fails a test that counts the request that never went out.
      */}
      <form
        aria-label="Sign in"
        noValidate
        onSubmit={(event) => void attempt(event)}
      >
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />

        {objection !== null && <p>{objection}</p>}
        {refusal !== null && <SignInRefusal refusal={refusal} />}

        <button type="submit" disabled={attempting}>
          Sign in
        </button>
        {attempting && <p>Signing in…</p>}
      </form>
    </section>
  );
}

/**
 * What the person is told, which is narrower than the refusal vocabulary.
 *
 * Two outcomes have something specific worth saying and are said in the same
 * voice as everywhere else in the application. Being throttled is actionable —
 * wait — and it is not a wrong password, so conflating them would have somebody
 * retyping a password that was right. A service that could not be reached is
 * not a rejection at all, and calling it one would be a lie.
 *
 * Everything else is this screen's own sentence, because the backend gave the
 * same answer to every failure and has told it nothing more. This is the one
 * place in the application that says something a refusal does not say — and it
 * still does not reach for `describeRefusal` to do it, so the scan requiring a
 * single voice holds.
 */
function SignInRefusal({ refusal }: { refusal: Refusal }) {
  if (refusal.kind === 'throttled' || refusal.kind === 'unreachable') {
    return <RefusalNotice refusal={refusal} />;
  }
  return <p role="alert">That email address and password did not match.</p>;
}
