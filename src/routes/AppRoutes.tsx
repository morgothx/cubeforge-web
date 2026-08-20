import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AppLayout } from '../components/AppLayout';
import { useStanding } from '../queries/standing';
import { NoTenantsScreen } from '../screens/NoTenantsScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { NotAvailableScreen } from '../screens/NotAvailableScreen';
import { TenantRoute } from './TenantRoute';
import { lastTenant } from './last-tenant';
import { RequireSession, ReturnAfterSignIn } from './RequireSession';

/**
 * Every address this feature serves, in one place.
 *
 * The table is the thing worth having in one place: an address that exists in
 * the router and nowhere else is the one nobody remembers to protect, and the
 * gate is applied here rather than inside each screen for exactly that reason.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <ReturnAfterSignIn>
            <SignInScreen />
          </ReturnAfterSignIn>
        }
      />

      <Route
        element={
          <RequireSession>
            <AppLayout>
              <Outlet />
            </AppLayout>
          </RequireSession>
        }
      >
        <Route path="/" element={<ChooseTenant />} />
        <Route element={<TenantRoute />}>
          <Route path="/t/:tenantId/members" element={<MembersScreen />} />
        </Route>
        <Route path="/no-tenants" element={<NoTenantsScreen />} />
      </Route>

      {/*
        Outside the gate on purpose. An address that does not exist is not a
        reason to ask somebody for a password, and telling them so costs
        nothing that a session would protect (6.2).
      */}
      <Route path="*" element={<NotAvailableScreen />} />
    </Routes>
  );
}

/**
 * Where an arrival at the root is resolved into a tenant.
 *
 * The remembered tenant is consulted here and nowhere else, and only after the
 * standing has confirmed the caller can still reach it — a membership can be
 * revoked between sessions, and a convenience must never outrank the
 * authority. With nothing usable remembered it takes the first tenant the
 * backend named rather than presenting a chooser: the switcher is in the frame
 * at all times, so landing somewhere is a better first move than asking a
 * question the person can answer whenever they like.
 */
function ChooseTenant() {
  const { data: standing } = useStanding();

  if (standing === undefined) return null;

  const reachable = standing.memberships;
  if (reachable.length === 0) return <Navigate to="/no-tenants" replace />;

  const remembered = lastTenant();
  const selected =
    reachable.find((membership) => membership.tenantId === remembered) ??
    reachable[0];

  return <Navigate to={`/t/${selected.tenantId}/members`} replace />;
}
