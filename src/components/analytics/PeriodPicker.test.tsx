import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { backend } from '../../../test/handlers';
import type { Day } from '../../analytics/calendar';
import { PeriodPicker } from './PeriodPicker';

const vocabulary = backend.analytics.vocabulary;

function pick(initial = { from: '2026-08-12', to: '2026-09-10' }) {
  const chosen: { from: Day; to: Day }[] = [];
  render(
    <PeriodPicker
      vocabulary={vocabulary}
      initial={initial}
      onChoose={(period) => chosen.push(period)}
    />,
  );
  return { chosen };
}

const from = () => screen.getByLabelText(/from/i);
const to = () => screen.getByLabelText(/to/i);
const choosing = () => screen.getByRole('button', { name: /show|apply/i });

async function replace(field: HTMLElement, value: string) {
  await userEvent.clear(field);
  await userEvent.type(field, value);
}

describe('choosing the period an overview covers', () => {
  it('starts from the period it was given', () => {
    pick();

    expect(from()).toHaveValue('2026-08-12');
    expect(to()).toHaveValue('2026-09-10');
  });

  it('hands back the two days somebody chose (2.6)', async () => {
    const { chosen } = pick();

    await replace(from(), '2026-09-01');
    await userEvent.click(choosing());

    expect(chosen).toEqual([{ from: '2026-09-01', to: '2026-09-10' }]);
  });

  /**
   * The same check the composer uses, so a period refused in one place is
   * refused in the other and said the same way. Two checks would be two
   * answers to one question, and the looser one would win somewhere.
   */
  it('refuses a period that ends before it starts, and asks nothing', async () => {
    const { chosen } = pick();

    await replace(to(), '2026-08-01');

    expect(screen.getByText(/ends before it starts/i)).toBeInTheDocument();
    expect(choosing()).toBeDisabled();

    await userEvent.click(choosing());
    expect(chosen).toEqual([]);
  });

  it('refuses a period longer than the platform answers, naming its limit', async () => {
    const { chosen } = pick();

    await replace(from(), '2025-09-09');

    expect(
      screen.getByText(new RegExp(String(vocabulary.longestPeriodDays))),
    ).toBeInTheDocument();
    expect(choosing()).toBeDisabled();
    expect(chosen).toEqual([]);
  });

  it('refuses a day that is not a day', async () => {
    const { chosen } = pick();

    await replace(from(), '2026-02-30');

    expect(choosing()).toBeDisabled();
    expect(chosen).toEqual([]);
  });
});
