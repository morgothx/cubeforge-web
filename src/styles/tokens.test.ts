/**
 * The one claim about the stylesheets that a rendered test cannot make.
 *
 * jsdom does not apply an imported stylesheet, so nothing in this suite can see
 * a colour. What *is* checkable is the structure the design handoff asks for:
 * **the dark theme is the same tokens re-tuned, never a second palette.** A
 * token that exists only in the dark block is a colour the light theme has no
 * answer for, and the first component to use it renders wrong on one of the two
 * — silently, because there is nothing to notice until somebody looks.
 */

const sheets = import.meta.glob('./*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function declaredIn(block: string): Set<string> {
  return new Set(
    [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
  );
}

/**
 * The tokens the *light* ground declares — the ones a dark re-tune may re-tune.
 *
 * Blocks selected by `[data-theme]`, and everything inside a media query, are
 * removed first. Counting them would make the set self-fulfilling: the dark
 * block's own inventions would arrive as evidence that they were known, and the
 * probe that invents one passed exactly that way before this was fixed.
 */
function baseTokens(css: string): Set<string> {
  const withoutThemed = css
    .replace(/@media[\s\S]*?\n\}/g, '')
    .replace(/:root\s*\[data-theme[^{]*\{[^}]*\}/g, '');
  return declaredIn(withoutThemed);
}

describe('the design tokens', () => {
  const system = String(sheets['./design-system.css'] ?? '');
  const theme = String(sheets['./theme.css'] ?? '');

  it('are vendored rather than re-derived', () => {
    // The handoff's sheet is the source of truth for the system's look, and it
    // is copied in unmodified so it can be replaced wholesale when the design
    // changes. Re-typing its values here is how the two drift.
    expect(system).toContain('--color-accent:');
    expect(system).toContain('--space-8:');
  });

  it('re-tune the same names for the dark theme, and invent none', () => {
    const known = new Set([...baseTokens(system), ...baseTokens(theme)]);

    const dark = [
      ...theme.matchAll(/\[data-theme=['"]dark['"]\][^{]*\{([^}]*)\}/g),
    ].flatMap((match) => [...declaredIn(match[1] ?? '')]);

    expect(dark.length).toBeGreaterThan(0);
    expect(dark.filter((token) => !known.has(token))).toEqual([]);
  });

  it('name a theme the person chose, not only the one their system prefers', () => {
    // Both, and in this order: the attribute wins when it is set, and the
    // system decides before anybody has chosen. A theme that only followed the
    // media query would have a toggle that does nothing.
    expect(theme).toMatch(/\[data-theme=['"]dark['"]\]/);
    expect(theme).toMatch(/prefers-color-scheme:\s*dark/);
  });
});
