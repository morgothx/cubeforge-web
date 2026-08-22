/**
 * Which of the two grounds the application is drawn on, and who decided.
 *
 * Three states, not two: a person may have chosen light, chosen dark, or not
 * chosen at all — and the third is not a synonym for either. Somebody who has
 * expressed no preference should follow their system and keep following it when
 * it changes at dusk; somebody who has chosen should be obeyed even when their
 * system disagrees. Storing a resolved value on first load would quietly
 * convert everybody into the second group.
 *
 * The mechanism is one attribute on the document element, which is what daisyUI
 * reads. **Absent** means follow the system: both the theme and the steel ramp
 * are declared under `:root:not([data-theme])` inside a `prefers-color-scheme`
 * query, so removing the attribute is not a fallback but the answer.
 */

export const THEME_STORAGE_KEY = 'cubeforge.theme';

export type Theme = 'light' | 'dark';

/** The document attribute daisyUI reads, per theme. */
const ATTRIBUTE: Readonly<Record<Theme, string>> = {
  light: 'cubeforge',
  dark: 'cubeforge-dark',
};

/**
 * What was chosen, if anything was.
 *
 * Anything unrecognised is treated as nothing chosen rather than as an error: a
 * stale or hand-edited value should leave somebody following their system, not
 * staring at a screen that refuses to render.
 */
export function storedTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/** What the system asks for, which is the answer until somebody overrules it. */
export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Puts a choice on the document, or takes the choice away.
 *
 * `null` removes the attribute rather than writing the system's current value,
 * which is the difference between following the system and having agreed with
 * it once.
 */
export function applyTheme(theme: Theme | null): void {
  if (theme === null) {
    document.documentElement.removeAttribute('data-theme');
    return;
  }
  document.documentElement.setAttribute('data-theme', ATTRIBUTE[theme]);
}

/** Chooses, and remembers — the two halves of requirement "outlives a reload". */
export function chooseTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Applied before the first render, from `main.tsx`.
 *
 * A choice applied in an effect is a choice applied one paint late, and the
 * paint in between is the other theme — the flash every themed application
 * either handles here or apologises for.
 */
export function restoreTheme(): void {
  applyTheme(storedTheme());
}
