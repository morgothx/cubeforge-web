import { Outlet, Route, Routes } from 'react-router';
import { AppLayout } from '../components/AppLayout';
import { RequireSession, ReturnAfterSignIn } from './RequireSession';

/**
 * Every address this feature serves, in one place.
 *
 * Two of these elements are still stand-ins — the form (task 6.1) and the
 * members screen (6.2) — and they are declared here anyway. The table is the
 * thing worth having early: an address that exists in the router and nowhere
 * else is the one nobody remembers to protect, and the gate is applied here
 * rather than inside each screen for exactly that reason.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          <ReturnAfterSignIn>
            <p>Sign in</p>
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
        {/* Where an arrival at the root is resolved into a tenant (5.2). */}
        <Route path="/" element={<p>Choosing a tenant</p>} />
        <Route path="/t/:tenantId/members" element={<p>Members</p>} />
        <Route path="/no-tenants" element={<p>You belong to no tenants</p>} />
      </Route>

      {/*
        Outside the gate on purpose. An address that does not exist is not a
        reason to ask somebody for a password, and telling them so costs
        nothing that a session would protect (6.2).
      */}
      <Route path="*" element={<p>Not available</p>} />
    </Routes>
  );
}
