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
 *   wrong rather than red and wrong;
 * - **the interaction states are the design's, not the browser's.** A focus
 *   ring nobody declared is still drawn — by Chrome, in Chrome's colour, and by
 *   Safari differently. It looked fine on the dark ground when I went and
 *   checked, which is precisely the problem: nothing holds it there.
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

/** The declarations of a flat rule, by the selector that opens it. */
function ruleFor(selector: string): string {
  const start = sheet.indexOf(selector);
  if (start === -1) return '';
  return sheet.slice(start, sheet.indexOf('}', start));
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

describe('the interaction states', () => {
  const focus = ruleFor(':focus-visible');

  it('draws its own focus ring', () => {
    expect(focus).not.toBe('');
    expect(focus).toMatch(/outline:/);
  });

  it('draws that ring in a colour both themes re-tune', () => {
    // A hex here would be a ring that is correct on one ground and invisible
    // on the other. Every other colour in this sheet is a token for the same
    // reason; the focus ring is the one people can least afford to lose.
    expect(focus).toMatch(/outline:[^;]*var\(--color-/);
    expect(focus).not.toMatch(/outline:[^;]*#[0-9a-f]{3}/i);
  });

  it('holds the ring off the edge it surrounds', () => {
    // Without an offset the ring sits on the 1px border and reads as a
    // slightly thicker border, which is not a signal.
    expect(focus).toMatch(/outline-offset:\s*[1-9]/);
  });

  it('never takes a focus ring away', () => {
    // The one line that undoes all of the above, and the reason it is usually
    // written is to hide a ring somebody did not like the look of.
    expect(sheet).not.toMatch(/outline:\s*(none|0)\s*;/);
  });

  it('has one ring colour, not one per component', () => {
    // daisyUI rings `.input` and `.select` itself, in a different slot. Two
    // ring colours on one screen is not a system, and the second one is the
    // kind of thing that arrives silently with a library upgrade.
    const coloured = [...sheet.matchAll(/outline(-color)?:\s*([^;]+);/g)]
      .map((match) => match[2] ?? '')
      .filter((value) => /var\(--color-|#[0-9a-f]{3}/i.test(value));

    expect(coloured.length).toBeGreaterThan(1);
    for (const value of coloured) {
      expect(value).toContain('--color-primary');
    }
  });

  it('says which text is selected', () => {
    const selection = ruleFor('::selection');

    expect(selection).toMatch(/background-color:/);
    // Anchored on the line start: a bare `/color:/` is satisfied by
    // `background-color:`, and the probe that deleted the text colour passed
    // until this was tightened. Same shape of mistake as `--radius: 0` matching
    // `0.5rem`.
    expect(selection).toMatch(/^\s*color:/m);
  });

  it('says which control is refusing', () => {
    // Disabled is a thing the design has to say, and saying it by going 45%
    // through means it is said the same way on both grounds and by every
    // control, not just the ones daisyUI knows about.
    const disabled = ruleFor(':disabled');

    expect(disabled).toMatch(/opacity:/);
    expect(disabled).toMatch(/cursor:\s*not-allowed/);
  });
});
