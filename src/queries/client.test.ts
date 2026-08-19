import { createQueryClient } from './client';

describe('the query client', () => {
  it('retries nothing on its own', () => {
    const defaults = createQueryClient().getDefaultOptions();

    // The one retry this feature allows lives in the request layer, which is
    // the only place that knows *why* it is retrying — an expired credential
    // and a refusal arrive as the same answer from this backend, and a blind
    // retry here would repeat genuine refusals and slow every failure down
    // without ever fixing one.
    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
