import { ThemeToggle } from './ThemeToggle';
import { render, screen } from '../../test/render';
import { THEME_STORAGE_KEY, restoreTheme } from '../theme/theme';

/**
 * Choosing a ground, and being remembered (task 6.1).
 *
 * Three states behind a two-way control, and the third is the one worth
 * testing: *nothing chosen* is not a synonym for light. Somebody who has
 * expressed no preference follows their system and keeps following it; somebody
 * who has chosen is obeyed even when their system disagrees. A control that
 * wrote a resolved value on first load would quietly convert everybody into the
 * second group, and nothing on screen would show it.
 */

/** What the operating system is asking for, for the length of one test. */
function systemPrefers(scheme: 'light' | 'dark') {
  window.matchMedia = (query: string) => ({
    matches: query.includes('dark') && scheme === 'dark',
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

function ground(): string | null {
  return document.documentElement.getAttribute('data-theme');
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  systemPrefers('light');
});

describe('choosing a theme', () => {
  it('offers both grounds and says which one is in force', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('radio', { name: /light/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /dark/i })).not.toBeChecked();
  });

  it('follows the system before anybody has chosen', () => {
    systemPrefers('dark');

    render(<ThemeToggle />);

    // And writes nothing. The absent attribute *is* the answer: both palettes
    // are declared under `:root:not([data-theme])` inside the media query, so
    // stamping the system's current value would be agreeing with it once
    // rather than following it.
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
    expect(ground()).toBeNull();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('changes the ground when somebody chooses', () => {
    render(<ThemeToggle />);

    screen.getByRole('radio', { name: /dark/i }).click();

    expect(ground()).toBe('cubeforge-dark');
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });

  it('outlives a reload', () => {
    const first = render(<ThemeToggle />);
    screen.getByRole('radio', { name: /dark/i }).click();
    first.unmount();

    // What a reload really is, for these purposes: the document loses its
    // attribute and the module is asked again.
    document.documentElement.removeAttribute('data-theme');
    restoreTheme();
    render(<ThemeToggle />);

    expect(ground()).toBe('cubeforge-dark');
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });

  it('obeys a choice the system disagrees with', () => {
    systemPrefers('dark');

    render(<ThemeToggle />);
    screen.getByRole('radio', { name: /light/i }).click();

    // The whole reason the attribute exists. Following the system is the
    // default, never an override of somebody who said otherwise.
    expect(ground()).toBe('cubeforge');
  });

  it('ignores a stored value that means nothing', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    systemPrefers('dark');

    restoreTheme();
    render(<ThemeToggle />);

    // Stale or hand-edited. Treated as nothing chosen rather than as an error:
    // the worst outcome of a bad value should be following the system.
    expect(ground()).toBeNull();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });
});
