import { useEffect } from 'react';
import { useMatch } from 'react-router';

/**
 * The selected tenant: the one in the address, and the one to fall back on.
 *
 * Two mechanisms, one seam, and it is worth being precise about which is which.
 * **The address is the selection** — `/t/t-acme/members` *is* a person acting in
 * Acme — so restoring it across a reload costs nothing, because it never left.
 * The value written down here answers exactly one other question: where to send
 * somebody who arrived at the root with no tenant named. It is a convenience,
 * never an authority, and it is never consulted while the address names a
 * tenant.
 */

/** Exported so a test asserts against the real key rather than guessing it. */
export const TENANT_STORAGE_KEY = 'cubeforge.tenant';

/**
 * The tenant last acted in, if one was written down.
 *
 * Whether the caller can still reach it is not this module's business — a
 * membership can be revoked between sessions, and only the standing knows.
 * Callers check it against the standing before using it.
 */
export function lastTenant(): string | null {
  const stored = localStorage.getItem(TENANT_STORAGE_KEY);
  return stored !== null && stored.length > 0 ? stored : null;
}

export function rememberTenant(tenantId: string): void {
  localStorage.setItem(TENANT_STORAGE_KEY, tenantId);
}

/**
 * The tenant named in the address, remembered as a side effect of being there.
 *
 * Reading and writing live together because they are one idea: what is
 * remembered is wherever the person actually was. An address naming no tenant
 * leaves the memory alone rather than clearing it — arriving at the sign-in
 * form should not forget where somebody was working.
 */
export function useSelectedTenant(): string | null {
  const tenantId = useMatch('/t/:tenantId/*')?.params.tenantId ?? null;

  useEffect(() => {
    if (tenantId !== null) rememberTenant(tenantId);
  }, [tenantId]);

  return tenantId;
}
