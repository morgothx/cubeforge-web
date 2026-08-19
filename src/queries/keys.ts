/**
 * Every query key, in one place.
 *
 * Invalidation is the only way a cached answer is ever re-read, and it works by
 * matching a key. A key written where it is used is a key that will eventually
 * be written slightly differently in the place that invalidates it — and the
 * failure is silent: nothing errors, the screen simply keeps showing the answer
 * from before the change.
 */
export const keys = {
  /** Who the caller is and where they may act. One per session (4.1). */
  standing: ['standing'] as const,

  /** The members of one tenant. Invalidated by all three mutations (7.5). */
  members: (tenantId: string) => ['members', tenantId] as const,
};
