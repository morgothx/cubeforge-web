import { render, screen } from '@testing-library/react';
import { App } from './App';

/**
 * One test, and its job is the assembly rather than any component: the query
 * client, the session and the router are composed in the right order and the
 * table renders. Each of those is tested properly elsewhere; what only this can
 * catch is a provider mounted inside something that needed it.
 */
describe('the application', () => {
  it('asks a person with no session for a password', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: /sign in/i }),
    ).toBeInTheDocument();
  });
});
