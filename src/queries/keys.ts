/**
 * Every query key, in one place.
 *
 * Invalidation is the only way a cached answer is ever re-read, and it works by
 * matching a key. A key written where it is used is a key that will eventually
 * be written slightly differently in the place that invalidates it — and the
 * failure is silent: nothing errors, the screen simply keeps showing the answer
 * from before the change.
 */
import type { QuestionBody } from '../api/types';

export const keys = {
  /** Who the caller is and where they may act. One per session (4.1). */
  standing: ['standing'] as const,

  /** The members of one tenant. Invalidated by all three mutations (7.5). */
  members: (tenantId: string) => ['members', tenantId] as const,

  /** What one tenant's platform offers. Asked once per tenant per session. */
  vocabulary: (tenantId: string) => ['vocabulary', tenantId] as const,

  /**
   * One answer, keyed by the tenant **and** the canonical question body.
   *
   * The tenant is in the key because an answer for one tenant must never be
   * read for another (1.2), and because an answer arriving after the person
   * switched away lands under a key nothing on screen is reading (1.3). The
   * body is canonical, so two spellings of one question share one key and one
   * request.
   */
  answer: (tenantId: string, body: QuestionBody | null) =>
    ['answer', tenantId, body] as const,
};
