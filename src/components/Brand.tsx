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
    <span className="flex items-center gap-2 font-heading text-brand font-semibold tracking-[0.04em]">
      <Box size={19} strokeWidth={1.5} className="text-primary" aria-hidden />
      CUBEFORGE
    </span>
  );
}
