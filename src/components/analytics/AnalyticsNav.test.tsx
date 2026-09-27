import { renderAt, screen, within } from '../../../test/render';
import { AnalyticsNav } from './AnalyticsNav';

/**
 * The two ways to look at a tenant's analytics.
 *
 * Both entries keep the tenant, because which tenant is the fact every answer
 * on either screen depends on. Which one is current is the router's answer
 * rather than a comparison written here — a second answer to that question is
 * a second thing to keep in step.
 */
const TENANT = 't-acme';

function nav() {
  return screen.getByRole('navigation', { name: /analytics/i });
}

function renderAtAddress(at: string) {
  return renderAt(<AnalyticsNav tenantId={TENANT} />, { at });
}

describe('the analytics sub-navigation', () => {
  it('offers the overview and the explorer, both inside the tenant', () => {
    renderAtAddress('/t/t-acme/analytics');

    const links = within(nav()).getAllByRole('link');
    expect(
      links.map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Overview', '/t/t-acme/analytics'],
      ['Explore', '/t/t-acme/analytics/explore'],
    ]);
  });

  it('marks the overview when the overview is being served', () => {
    renderAtAddress('/t/t-acme/analytics');

    expect(
      within(nav()).getByRole('link', { name: 'Overview' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav()).getByRole('link', { name: 'Explore' }),
    ).not.toHaveAttribute('aria-current');
  });

  /**
   * The overview's entry is an exact match, unlike the section row in the
   * panel: the explorer is not the overview, and marking both would say the
   * person is in two places.
   */
  it('marks the explorer alone when the explorer is being served', () => {
    renderAtAddress('/t/t-acme/analytics/explore');

    expect(
      within(nav()).getByRole('link', { name: 'Explore' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav()).getByRole('link', { name: 'Overview' }),
    ).not.toHaveAttribute('aria-current');
  });
});
