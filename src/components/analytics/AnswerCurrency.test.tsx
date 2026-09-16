import { render, screen } from '@testing-library/react';
import { AnswerCurrency } from './AnswerCurrency';

/**
 * How current an answer is, and where it came from.
 *
 * Both sit beside every answer, and their relative weight is the requirement:
 * how current it is belongs to the figure (4.1), and where it came from is a
 * fact about the platform that must not compete with it (4.3).
 */
describe('how current an answer is', () => {
  it('states the moment the platform reported, in its calendar', () => {
    render(
      <AnswerCurrency
        completeThrough="2026-09-10T14:59:59.999Z"
        servedFrom="prepared"
        calendar="UTC"
      />,
    );

    expect(screen.getByText(/complete through/i)).toBeInTheDocument();
    expect(screen.getByText(/14:59/)).toBeInTheDocument();
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });

  /**
   * 4.2: truncated, never rounded. Rounding 14:59:59 up to 15:00 presents the
   * answer as complete through a minute it is not — later than the platform
   * said, which is the one direction this may never err in.
   */
  it('never rounds the moment up', () => {
    render(
      <AnswerCurrency
        completeThrough="2026-09-10T14:59:59.999Z"
        servedFrom="prepared"
        calendar="UTC"
      />,
    );

    expect(screen.queryByText(/15:00/)).toBeNull();
  });

  it('says where the answer came from, differently for each way', () => {
    const { unmount } = render(
      <AnswerCurrency
        completeThrough="2026-09-10T03:00:00.000Z"
        servedFrom="prepared"
        calendar="UTC"
      />,
    );
    const prepared = screen.getByText(/prepared/i).textContent;
    unmount();

    render(
      <AnswerCurrency
        completeThrough="2026-09-10T03:00:00.000Z"
        servedFrom="exported-objects"
        calendar="UTC"
      />,
    );

    expect(screen.getByText(/exported/i).textContent).not.toBe(prepared);
  });

  /**
   * 4.3: available, and less prominent than the answer and than how current it
   * is. Asserted as document order plus "not a heading" — the two things a
   * reader and a screen reader both take as prominence.
   */
  it('puts provenance after how current the answer is, and not as a heading', () => {
    render(
      <AnswerCurrency
        completeThrough="2026-09-10T03:00:00.000Z"
        servedFrom="prepared"
        calendar="UTC"
      />,
    );

    const currency = screen.getByText(/complete through/i);
    const provenance = screen.getByText(/prepared/i);

    expect(
      currency.compareDocumentPosition(provenance) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
