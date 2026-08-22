import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '../components/Card';
import { keys } from '../queries/keys';

/**
 * A person who holds no membership anywhere.
 *
 * Plainly, and not as an error (4.3). Belonging nowhere is an ordinary state of
 * a real account — a first day before anyone has been added, a last day after
 * everything was revoked — and telling somebody that something went wrong
 * invites them to wait for it to be fixed, when there is nothing to wait for.
 *
 * **Nothing is offered that the product cannot do.** There is no "create a
 * tenant" button because tenants are not created from here (10.1). What there
 * is, is asking again: the one thing that can change this screen is somebody
 * adding them while they are looking at it, and re-reading the standing is how
 * they find out without hunting for the reload key.
 *
 * Signing out is the only other thing left, and it is offered by the frame
 * rather than by this screen. Belonging nowhere is not what makes signing out
 * available; being signed in is.
 */
export function NoTenantsScreen() {
  const client = useQueryClient();

  return (
    <Card kicker="You are signed in" title="You belong to no tenants">
      <p className="text-control opacity-55">
        Nobody has added you to one yet. An administrator of a tenant can invite
        you, and it will appear here.
      </p>
      <button
        type="button"
        className="btn btn-hairline btn-sm self-start"
        onClick={() => {
          void client.invalidateQueries({ queryKey: keys.standing });
        }}
      >
        <RefreshCw size={15} strokeWidth={1.5} aria-hidden />
        Check again
      </button>
    </Card>
  );
}
