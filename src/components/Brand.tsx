import { Box } from 'lucide-react';

/**
 * The product's name, at the top of the panel.
 *
 * The mark is decorative and says so: the word beside it already names the
 * thing, and an icon announced twice is noise to anybody listening rather than
 * looking.
 */
export function Brand() {
  return (
    <span className="panel-brand">
      <Box
        size={19}
        strokeWidth={1.5}
        color="var(--color-accent)"
        aria-hidden
      />
      CUBEFORGE
    </span>
  );
}
