/**
 * The one claim about the stylesheet that a rendered test cannot make.
 *
 * jsdom applies no stylesheet, so nothing in this suite can see a colour. What
 * *is* checkable is the structure the design handoff asks for, and since the
 * move to Tailwind and daisyUI there are three claims worth holding:
 *
 * - **the dark theme is the same slots re-tuned, never a second palette** — a
 *   token that exists only in the dark block is a colour the light theme has no
 *   answer for, and the first component to use it renders wrong on one of the
 *   two, silently;
 * - **the theme is chosen, not merely inherited** — a design with a toggle and
 *   only a media query has a toggle that does nothing;
 * - **there is no decorative colour to reach for.** The design says state is
 *   said in words and carries no red, green or amber. daisyUI hands every theme
 *   an `error`, `success` and `warning` slot regardless, so the guarantee is
 *   that those slots hold steel — a stray `alert-error` is then quiet and
 *   wrong rather than red and wrong.
 *
 * This replaces `styles/tokens.test.ts`, which asserted that the handoff's
 * stylesheet was vendored byte-for-byte. That file is gone: daisyUI owns the
 * component classes now, because both of them define `.btn`.
 */

const sheet = String(
  import.meta.glob('./index.css', {
    query: '?raw',
    import: 'default',
    eager: true,
  })['./index.css'] ?? '',
);

/** The declarations inside a `name: '<theme>'` daisyUI theme block. */
function themeBlock(name: string): string {
  const start = sheet.indexOf(`name: '${name}'`);
  if (start === -1) return '';
  return sheet.slice(start, sheet.indexOf('\n}', start));
}

function tokensIn(block: string): Set<string> {
  return new Set(
    [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] ?? ''),
  );
}

const light = themeBlock('cubeforge');
const dark = themeBlock('cubeforge-dark');

describe('the theme', () => {
  it('declares both grounds', () => {
    expect(light).not.toBe('');
    expect(dark).not.toBe('');
  });

  it('re-tunes the same slots for the dark theme, and invents none', () => {
    const known = tokensIn(light);
    const invented = [...tokensIn(dark)].filter((token) => !known.has(token));

    expect(invented).toEqual([]);
  });

  it('answers every slot the light theme answers', () => {
    // The other direction, and the one that actually bites: a slot left out of
    // the dark theme silently keeps its light value, which is how a single
    // near-white surface ends up on a dark screen.
    const missing = [...tokensIn(light)].filter(
      (token) => !tokensIn(dark).has(token),
    );

    expect(missing).toEqual([]);
  });

  it('names a theme the person chose, not only the one their system prefers', () => {
    // Both, and in this order: the attribute wins when it is set, and the
    // system decides before anybody has chosen.
    expect(sheet).toMatch(/\[data-theme='cubeforge-dark'\]/);
    expect(sheet).toMatch(/prefers-color-scheme:\s*dark/);
  });

  it('leaves no decorative colour to reach for', () => {
    // Every semantic slot is steel. Asserted as "the same as primary" rather
    // than by listing hex values, so re-tuning the accent cannot quietly leave
    // a red `error` behind.
    for (const block of [light, dark]) {
      const primary = /--color-primary:\s*(#[0-9a-f]{6})/.exec(block)?.[1];
      expect(primary).toBeDefined();

      for (const slot of ['error', 'success', 'warning', 'info']) {
        const value = new RegExp(`--color-${slot}:\\s*(#[0-9a-f]{6})`).exec(
          block,
        )?.[1];
        expect(value).toBe(primary);
      }
    }
  });

  it('squares every corner the component library would round', () => {
    for (const block of [light, dark]) {
      for (const radius of ['selector', 'field', 'box']) {
        // Anchored on the semicolon: `\\s*0` alone matches `0.5rem`, and the
        // probe that rounded a corner passed until this was tightened.
        expect(block).toMatch(new RegExp(`--radius-${radius}:\\s*0\\s*;`));
      }
    }
  });
});
