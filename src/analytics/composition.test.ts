import { backend } from '../../test/handlers';
import {
  addressOf,
  checkComposition,
  defaultPeriod,
  draftFromAddress,
  questionBodyOf,
  type Draft,
} from './composition';

const vocabulary = backend.analytics.vocabulary;
const NOW = new Date('2026-09-10T01:00:00.000Z');

const aDraft = (over: Partial<Draft> = {}): Draft => ({
  measures: ['net_quantity'],
  groupings: [],
  from: '2026-08-12',
  to: '2026-09-10',
  by: 'recorded',
  ...over,
});

/** The problems a draft has, or the composition it makes. */
const problemsOf = (draft: Draft) => {
  const checked = checkComposition(draft, vocabulary);
  return checked.ok ? [] : checked.problems;
};

describe('whether a composition can be asked', () => {
  it('accepts a composition made of what the vocabulary offers', () => {
    const checked = checkComposition(
      aDraft({ groupings: ['recorded_day', 'kind'] }),
      vocabulary,
    );

    expect(checked).toEqual({
      ok: true,
      composition: {
        measures: ['net_quantity'],
        groupings: ['recorded_day', 'kind'],
        from: '2026-08-12',
        to: '2026-09-10',
        by: 'recorded',
      },
    });
  });

  it('refuses to ask without a measure (3.3)', () => {
    expect(problemsOf(aDraft({ measures: [] }))).toEqual([
      { kind: 'no-measure' },
    ]);
  });

  it('names every name the vocabulary does not offer, measures and groupings alike', () => {
    expect(
      problemsOf(aDraft({ measures: ['revenue'], groupings: ['warehouse'] })),
    ).toEqual([{ kind: 'not-offered', names: ['revenue', 'warehouse'] }]);
  });

  it('refuses a day that is not one, saying which end', () => {
    expect(problemsOf(aDraft({ from: '2026-02-30' }))).toEqual([
      { kind: 'not-a-day', which: 'from', text: '2026-02-30' },
    ]);
    expect(problemsOf(aDraft({ to: 'yesterday' }))).toEqual([
      { kind: 'not-a-day', which: 'to', text: 'yesterday' },
    ]);
  });

  it('refuses a period that ends before it starts (3.4)', () => {
    expect(
      problemsOf(aDraft({ from: '2026-09-10', to: '2026-09-09' })),
    ).toEqual([{ kind: 'reversed' }]);
  });

  /**
   * The limit comes from the vocabulary, so the dashboard names the platform's
   * number rather than one it remembered — and a day under it is fine.
   */
  it('refuses a period longer than the platform answers, naming its limit (3.4)', () => {
    expect(
      problemsOf(aDraft({ from: '2025-09-10', to: '2026-09-10' })),
    ).toEqual([]);
    expect(
      problemsOf(aDraft({ from: '2025-09-09', to: '2026-09-10' })),
    ).toEqual([{ kind: 'too-long', longestDays: 366 }]);
  });

  it('refuses a moment the vocabulary does not offer', () => {
    expect(problemsOf(aDraft({ by: 'written' }))).toEqual([
      { kind: 'unknown-moment', text: 'written' },
    ]);
  });

  /**
   * Somebody who chose no measure and reversed the period should learn both
   * at once — fixing one to be told of the next is a question fixed one
   * attempt at a time.
   */
  it('reports every problem at once, not the first one', () => {
    expect(
      problemsOf({
        measures: [],
        groupings: ['warehouse'],
        from: '2026-09-10',
        to: '2026-09-01',
        by: 'written',
      }),
    ).toEqual([
      { kind: 'no-measure' },
      { kind: 'not-offered', names: ['warehouse'] },
      { kind: 'reversed' },
      { kind: 'unknown-moment', text: 'written' },
    ]);
  });

  it('puts a composition in the vocabulary’s order, and drops a name named twice', () => {
    const checked = checkComposition(
      aDraft({
        measures: ['movement_count', 'net_quantity', 'movement_count'],
        groupings: ['kind', 'recorded_day'],
      }),
      vocabulary,
    );

    expect(checked.ok && checked.composition.measures).toEqual([
      'net_quantity',
      'movement_count',
    ]);
    expect(checked.ok && checked.composition.groupings).toEqual([
      'recorded_day',
      'kind',
    ]);
  });
});

describe('a composition and its address', () => {
  it('defaults the period to the thirty days ending on the platform’s today (2.5)', () => {
    expect(defaultPeriod(vocabulary, NOW)).toEqual({
      from: '2026-08-12',
      to: '2026-09-10',
    });
  });

  it('fills every absent part with its default', () => {
    expect(draftFromAddress(new URLSearchParams(''), vocabulary, NOW)).toEqual({
      measures: [],
      groupings: [],
      from: '2026-08-12',
      to: '2026-09-10',
      // The platform's first moment, not a word written here.
      by: vocabulary.readBy[0],
    });
  });

  /**
   * 3.9: a wrong part is reported, never quietly replaced. An address that
   * silently turned `revenue` into nothing, or a reversed period into the
   * default one, would show an answer to a question nobody asked.
   */
  it('keeps a present but wrong part as it was written, so it can be reported', () => {
    const draft = draftFromAddress(
      new URLSearchParams(
        'measures=revenue,net_quantity&from=2026-02-30&to=2026-09-10&by=written',
      ),
      vocabulary,
      NOW,
    );

    expect(draft).toEqual({
      measures: ['revenue', 'net_quantity'],
      groupings: [],
      from: '2026-02-30',
      to: '2026-09-10',
      by: 'written',
    });
    expect(problemsOf(draft).map((problem) => problem.kind)).toEqual([
      'not-offered',
      'not-a-day',
      'unknown-moment',
    ]);
  });

  it('comes back from its own address exactly (3.8)', () => {
    const checked = checkComposition(
      aDraft({
        measures: ['net_quantity', 'on_hand_quantity'],
        groupings: ['occurred_day', 'product'],
        by: 'occurred',
      }),
      vocabulary,
    );
    if (!checked.ok) throw new Error('expected a composition');

    const back = checkComposition(
      draftFromAddress(addressOf(checked.composition), vocabulary, NOW),
      vocabulary,
    );

    expect(back).toEqual(checked);
  });

  it('writes one address for two spellings of the same question', () => {
    const address = (draft: Draft) => {
      const checked = checkComposition(draft, vocabulary);
      if (!checked.ok) throw new Error('expected a composition');
      return addressOf(checked.composition).toString();
    };

    expect(
      address(aDraft({ measures: ['movement_count', 'net_quantity'] })),
    ).toBe(
      address(
        aDraft({
          measures: ['net_quantity', 'movement_count', 'net_quantity'],
        }),
      ),
    );
  });

  it('asks the question it composes, and nothing the platform would refuse', () => {
    const checked = checkComposition(
      aDraft({ groupings: ['kind'] }),
      vocabulary,
    );
    if (!checked.ok) throw new Error('expected a composition');

    expect(questionBodyOf(checked.composition)).toEqual({
      measures: ['net_quantity'],
      groupings: ['kind'],
      from: '2026-08-12',
      to: '2026-09-10',
      by: 'recorded',
    });
  });
});
