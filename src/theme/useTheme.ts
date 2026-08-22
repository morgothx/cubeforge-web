import { useCallback, useState } from 'react';
import { chooseTheme, storedTheme, systemTheme, type Theme } from './theme';

export type { Theme };

/**
 * The theme in force, and the way to change it.
 *
 * Resolved rather than stored: the control has to show which ground is actually
 * being drawn, and "nothing chosen" is not something a two-way control can
 * display. The distinction still matters underneath — nothing is written until
 * somebody chooses — so a person who has expressed no preference keeps
 * following their system, and the control simply shows where the system landed.
 *
 * There is no provider because there is one consumer. A second one would need
 * this state shared rather than duplicated, and the honest fix then is a
 * context rather than two hooks agreeing by luck.
 */
export function useTheme(): {
  theme: Theme;
  choose: (theme: Theme) => void;
} {
  const [theme, setTheme] = useState<Theme>(
    () => storedTheme() ?? systemTheme(),
  );

  const choose = useCallback((next: Theme) => {
    chooseTheme(next);
    setTheme(next);
  }, []);

  return { theme, choose };
}
