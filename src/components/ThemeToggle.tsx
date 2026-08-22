import { Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../theme/useTheme';

/**
 * The ground the application is drawn on, as a choice somebody makes.
 *
 * A segmented pair rather than a single switch, because the two grounds are two
 * options and a switch would make one of them the absence of the other. Radios
 * so that the state is carried by the platform: `checked` is what a screen
 * reader reads out, and it is what the fill says to everybody else.
 *
 * Deliberately **not** daisyUI's `theme-controller`, which flips the theme in
 * pure CSS from the checked input. It works, and it forgets — the choice has to
 * outlive a reload, so the attribute is written by `chooseTheme`. Two mechanisms
 * writing one attribute is one mechanism too many.
 */
const OPTIONS: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function ThemeToggle() {
  const { theme, choose } = useTheme();

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-heading text-kicker font-semibold uppercase tracking-[0.14em] opacity-55">
        Theme
      </legend>
      <div className="flex border border-divider">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            /*
              The focus ring is drawn on the label because the input is
              visually hidden: `sr-only` keeps it focusable, which is the point,
              but a keyboard user would otherwise be moving an invisible cursor
              through an invisible control.
            */
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1 px-3 py-1 text-label has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary [&+&]:border-l [&+&]:border-divider ${
              theme === option.value
                ? 'bg-primary text-primary-content'
                : 'hover:bg-base-content/7'
            }`}
          >
            <input
              type="radio"
              name="theme"
              className="sr-only"
              value={option.value}
              checked={theme === option.value}
              onChange={() => {
                choose(option.value);
              }}
            />
            {option.value === 'light' ? (
              <Sun size={14} strokeWidth={1.5} aria-hidden />
            ) : (
              <Moon size={14} strokeWidth={1.5} aria-hidden />
            )}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
