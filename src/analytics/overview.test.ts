import { backend } from '../../test/handlers';
import { checkComposition } from './composition';
import { MOVEMENTS, ON_HAND, type FixedComposition } from './overview';

const vocabulary = backend.analytics.vocabulary;

const checkedWith = (fixed: FixedComposition) =>
  checkComposition(
    { ...fixed, from: '2026-08-12', to: '2026-09-10' },
    vocabulary,
  );

describe('the questions the overview asks in advance', () => {
  it('asks what is on hand, by product', () => {
    expect(ON_HAND.measures).toHaveLength(1);
    expect(ON_HAND.groupings).toEqual(['product']);

    const checked = checkedWith(ON_HAND);
    expect(checked.ok).toBe(true);
    // The measure it names is the cumulative one: what is on hand counts
    // everything that ever moved, which is why 2.4 needs its note.
    expect(
      vocabulary.measures.find(({ name }) => name === ON_HAND.measures[0])
        ?.cumulative,
    ).toBe(true);
  });

  it('asks what moved and how often, by recorded day and kind', () => {
    expect(MOVEMENTS.measures).toHaveLength(2);
    expect(MOVEMENTS.groupings).toHaveLength(2);
    expect(checkedWith(MOVEMENTS).ok).toBe(true);

    // Grouped by a day and one other thing: the shape a chart can draw whole.
    const shapes = MOVEMENTS.groupings.map(
      (name) =>
        vocabulary.groupings.find((grouping) => grouping.name === name)?.shape,
    );
    expect(shapes).toContain('day');
    expect(shapes).toContain('category');
  });

  it('reads both by a moment the platform offers', () => {
    for (const fixed of [ON_HAND, MOVEMENTS]) {
      expect(vocabulary.readBy).toContain(fixed.by);
    }
  });

  /**
   * The check is the same one a person's draft goes through, so a name that
   * stopped being offered stops the overview before a question is spent on it.
   */
  it('is checked exactly as anything else a person composes', () => {
    const withoutOnHand = {
      ...vocabulary,
      measures: vocabulary.measures.filter(
        ({ name }) => name !== ON_HAND.measures[0],
      ),
    };

    const checked = checkComposition(
      { ...ON_HAND, from: '2026-08-12', to: '2026-09-10' },
      withoutOnHand,
    );

    expect(checked.ok).toBe(false);
    expect(!checked.ok && checked.problems).toContainEqual({
      kind: 'not-offered',
      names: [ON_HAND.measures[0]],
    });
  });
});

/**
 * The rule that keeps every other module honest.
 *
 * The platform publishes what may be asked, and the dashboard reads it — that
 * is the whole point of the vocabulary route. A name written into any other
 * module is a copy of the platform's answer that nothing keeps in step, and it
 * would work perfectly until the day the platform changed.
 *
 * The overview is the one exception: choosing two questions in advance means
 * naming them. Those two live here, where this test can see them.
 */
describe('where the platform’s names may appear', () => {
  const sources = import.meta.glob('../**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  /** Source with comments stripped: prose about a measure is not a use of one. */
  function code(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
  }

  const names = [
    ...vocabulary.measures.map(({ name }) => name),
    ...vocabulary.groupings.map(({ name }) => name),
    ...vocabulary.groupings.flatMap((grouping) =>
      grouping.shape === 'labelled'
        ? [grouping.codeColumn, grouping.nameColumn]
        : [grouping.column],
    ),
  ];

  it('finds the platform’s names in the overview’s two questions and nowhere else', () => {
    const naming = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, source]) =>
        names.some((name) =>
          new RegExp(`['"\`]${name}['"\`]`).test(code(source)),
        ),
      )
      .map(([path]) => path)
      .sort();

    // One file, and it is this module. Written as a length plus an ending
    // rather than as a path, because the glob's keys are relative to this test
    // and their prefix is the bundler's business, not the rule's.
    expect(naming).toHaveLength(1);
    expect(naming[0]).toMatch(/\/overview\.ts$/);
  });
});
