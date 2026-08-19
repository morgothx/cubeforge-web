import { Link } from 'react-router';

/**
 * An address this application does not serve.
 *
 * "Not available" rather than "not found", and deliberately so: this
 * application cannot always tell the two apart, and the backend is built so
 * that it cannot — a refusal and an absence are the same answer (9.4). Saying
 * the same words in both cases is what keeps the client from leaking a
 * distinction the platform withholds.
 *
 * The one destination offered works for anybody: signed in it resolves to a
 * tenant, and signed out the gate turns it into the form.
 */
export function NotAvailableScreen() {
  return (
    <section>
      <h1>Not available</h1>
      <p>There is nothing at this address.</p>
      <Link to="/">Go to your dashboard</Link>
    </section>
  );
}
