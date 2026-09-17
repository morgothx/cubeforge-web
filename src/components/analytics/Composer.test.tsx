import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backend } from '../../../test/handlers';
import type { Composition, Draft } from '../../analytics/composition';
import type { Vocabulary } from '../../api/types';
import { Composer } from './Composer';

const vocabulary = backend.analytics.vocabulary;

const aDraft = (over: Partial<Draft> = {}): Draft => ({
  measures: ['net_quantity'],
  groupings: [],
  from: '2026-08-12',
  to: '2026-09-10',
  by: 'recorded',
  ...over,
});

function compose(
  options: {
    initial?: Draft;
    held?: number;
    vocabulary?: Vocabulary;
  } = {},
) {
  const asked: Composition[] = [];
  render(
    <Composer
      vocabulary={options.vocabulary ?? vocabulary}
      initial={options.initial ?? aDraft()}
      held={options.held ?? 0}
      onAsk={(composition) => asked.push(composition)}
    />,
  );
  return { asked };
}

const asking = () => screen.getByRole('button', { name: /ask|show/i });

describe('composing a question', () => {
  /**
   * 3.2: exactly what the platform answers, in its own terms. The check that
   * matters is not that today's five names appear — it is that the offered
   * choices come from the vocabulary, so a platform that offered different
   * ones would be followed without a line changing here.
   */
  it('offers the vocabulary’s measures, groupings and moments, in its order', () => {
    compose();

    for (const { name } of vocabulary.measures) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    for (const { name } of vocabulary.groupings) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument();
    }
    for (const moment of vocabulary.readBy) {
      expect(screen.getByRole('radio', { name: moment })).toBeInTheDocument();
    }

    const measures = screen
      .getByRole('group', { name: /measures/i })
      .querySelectorAll('input[type="checkbox"]');
    expect(
      Array.from(measures).map((box) => box.getAttribute('value')),
    ).toEqual(vocabulary.measures.map(({ name }) => name));
  });

  it('follows a platform that offers something else, with no code changed', () => {
    compose({
      vocabulary: {
        ...vocabulary,
        measures: [{ name: 'revenue', cumulative: false }],
      },
      initial: aDraft({ measures: [] }),
    });

    expect(
      screen.getByRole('checkbox', { name: 'revenue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'net_quantity' })).toBeNull();
  });

  it('will not ask without a measure, and says a measure is needed', async () => {
    const { asked } = compose({ initial: aDraft({ measures: [] }) });

    expect(asking()).toBeDisabled();
    expect(screen.getByText(/at least one measure/i)).toBeInTheDocument();

    await userEvent.click(asking());
    expect(asked).toEqual([]);
  });

  it('will not ask a period that ends before it starts', () => {
    compose({ initial: aDraft({ from: '2026-09-10', to: '2026-09-01' }) });

    expect(asking()).toBeDisabled();
    expect(screen.getByText(/ends before it starts/i)).toBeInTheDocument();
  });

  /**
   * 3.4: the limit is the platform's, named as the platform stated it, so a
   * platform that answered ninety days would say ninety here.
   */
  it('will not ask a period longer than the platform answers, and names the limit', () => {
    compose({ initial: aDraft({ from: '2025-09-09', to: '2026-09-10' }) });

    expect(asking()).toBeDisabled();
    expect(
      screen.getByText(new RegExp(String(vocabulary.longestPeriodDays))),
    ).toBeInTheDocument();
  });

  it('will not ask while the platform has said to wait, and says how long', () => {
    compose({ held: 42 });

    expect(asking()).toBeDisabled();
    expect(screen.getByText(/42 seconds/)).toBeInTheDocument();
  });

  it('asks the composition somebody put together', async () => {
    const { asked } = compose({ initial: aDraft({ measures: [] }) });

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'net_quantity' }),
    );
    await userEvent.click(screen.getByRole('checkbox', { name: 'kind' }));
    await userEvent.click(screen.getByRole('radio', { name: 'occurred' }));
    await userEvent.click(asking());

    expect(asked).toEqual([
      {
        measures: ['net_quantity'],
        groupings: ['kind'],
        from: '2026-08-12',
        to: '2026-09-10',
        by: 'occurred',
      },
    ]);
  });

  it('checks the draft as it changes, rather than only when asked', async () => {
    compose({ initial: aDraft() });

    expect(asking()).toBeEnabled();

    // Unchecking the only measure makes the draft unaskable, and the composer
    // says so before anybody presses anything.
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'net_quantity' }),
    );

    expect(asking()).toBeDisabled();
    expect(screen.getByText(/at least one measure/i)).toBeInTheDocument();
  });
});
