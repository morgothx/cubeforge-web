import { Link } from 'react-router';
import { Card } from '../components/Card';
import { useSession } from '../session/useSession';

/**
 * An address this application does not serve.
 *
 * "Not available" rather than "not found", and deliberately so: this
 * application cannot always tell the two apart, and the backend is built so
 * that it cannot — a refusal and an absence are the same answer (9.4). Saying
 * the same words in both cases is what keeps the client from leaking a
 * distinction the platform withholds.
 *
 * **The exit depends on who arrived**, which is the whole of this screen's
 * share of task 5.1. "Back to Members" names a room somebody who has not signed
 * in has never been in; the door in is the only real exit they have. Somebody
 * with a session has the panel around them and every tenant already in it, so
 * one destination is enough — the handoff draws a second button reading "Switch
 * tenant", and beside a panel that lists the tenants that is a control meaning
 * "look to your left".
 */
export function NotAvailableScreen() {
  const { status } = useSession();
  const signedIn = status.state === 'signed-in';

  return (
    <Card title="This is not available" alone={!signedIn}>
      <p className="text-control opacity-55">
        It may not exist, or it may not be yours to see. Either way there is
        nothing here.
      </p>
      {signedIn ? (
        <Link to="/" className="btn btn-primary btn-sm self-start">
          Back to Members
        </Link>
      ) : (
        <Link to="/sign-in" className="btn btn-primary btn-sm self-start">
          Sign in
        </Link>
      )}
    </Card>
  );
}
