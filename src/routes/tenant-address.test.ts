import { sameSectionIn } from './tenant-address';

/**
 * The same place, in another tenant (1.2).
 *
 * Nothing in a section or a composition belongs to a tenant, so switching
 * tenant keeps both. What belongs to the tenant is the answer, and that is
 * asked again under the new tenant's key rather than carried here.
 */
describe('the same section, in another tenant', () => {
  it('keeps the section and the whole query', () => {
    expect(
      sameSectionIn(
        't-globex',
        '/t/t-acme/analytics/explore',
        '?measures=net_quantity&groupings=kind&from=2026-08-12&to=2026-09-10&by=recorded',
      ),
    ).toBe(
      '/t/t-globex/analytics/explore?measures=net_quantity&groupings=kind&from=2026-08-12&to=2026-09-10&by=recorded',
    );
  });

  it('keeps a section that has no query', () => {
    expect(sameSectionIn('t-globex', '/t/t-acme/members', '')).toBe(
      '/t/t-globex/members',
    );
    expect(sameSectionIn('t-globex', '/t/t-acme/analytics', '')).toBe(
      '/t/t-globex/analytics',
    );
  });

  /**
   * An address that names no tenant, or a tenant and no section, has no
   * section to keep. The members listing is where arriving in a tenant lands
   * everywhere else, and a query written for no section is dropped rather than
   * attached to one it was never about.
   */
  it('lands on the members listing when there is no section to keep', () => {
    expect(sameSectionIn('t-globex', '/nowhere', '?x=1')).toBe(
      '/t/t-globex/members',
    );
    expect(sameSectionIn('t-globex', '/t/t-acme', '?x=1')).toBe(
      '/t/t-globex/members',
    );
    expect(sameSectionIn('t-globex', '/t/t-acme/', '')).toBe(
      '/t/t-globex/members',
    );
  });

  it('replaces only the tenant, never a segment that happens to look like one', () => {
    expect(sameSectionIn('t-globex', '/t/t-acme/t/t-acme', '')).toBe(
      '/t/t-globex/t/t-acme',
    );
  });
});
