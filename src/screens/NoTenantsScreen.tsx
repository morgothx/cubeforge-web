/**
 * A person who holds no membership anywhere.
 *
 * Plainly, and not as an error (4.3). Belonging nowhere is an ordinary state of
 * a real account — a first day before anyone has been added, a last day after
 * everything was revoked — and telling somebody that something went wrong
 * invites them to wait for it to be fixed, when there is nothing to wait for.
 *
 * Signing out is the only thing left to do here — the switcher is absent by
 * design and there is no tenant to reach — and it is offered by the frame
 * rather than by this screen. Belonging nowhere is not what makes signing out
 * available; being signed in is.
 */
export function NoTenantsScreen() {
  return (
    <section>
      <h1>You belong to no tenants</h1>
      <p>
        Nobody has added you to one yet. An administrator of a tenant can invite
        you, and it will appear here.
      </p>
    </section>
  );
}
