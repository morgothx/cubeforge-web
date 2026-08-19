import { render, screen } from '@testing-library/react';
import { App } from './App';

/**
 * One test, and its job is the toolchain rather than the component: JSX
 * compiles, jsdom renders, Testing Library queries, and the jest-dom matchers
 * are registered. A scaffold whose tests were never run is a scaffold that
 * does not work yet.
 */
describe('the application', () => {
  it('renders its name', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'CubeForge' }),
    ).toBeInTheDocument();
  });
});
