import { RefusalNotice } from './RefusalNotice';
import { render, screen, within } from '../../test/render';
import { describeRefusal, type Refusal } from '../api/refusal';

/**
 * The one place a refusal becomes words, and the two shapes it takes.
 *
 * A refusal that named a cause is about something the person did and can fix,
 * so it is tinted and sits against the field the backend blamed. Everything
 * else is about the platform rather than about them, so it is neutral and sits
 * above the block it concerns. Both are the same component: two components
 * would be two vocabularies, agreeing until one of them is edited.
 *
 * jsdom applies no stylesheet, so nothing here can see the tint. What it can
 * see is that the component *distinguishes* the two at all — and what a retry
 * is offered for, which is the part that matters most and is not a colour.
 */

const EVERY: readonly Refusal[] = [
  { kind: 'rejected', message: 'That person is already a member.' },
  { kind: 'unavailable' },
  { kind: 'throttled' },
  { kind: 'unreachable' },
  { kind: 'session-ended' },
];

describe('saying that something was refused', () => {
  it('says it out loud, whatever it was', () => {
    for (const refusal of EVERY) {
      const { unmount } = render(<RefusalNotice refusal={refusal} />);

      // `role="alert"` on every one: a refusal nobody is told about is a
      // screen that simply did not do what was asked.
      expect(screen.getByRole('alert')).toHaveTextContent(
        describeRefusal(refusal),
      );
      unmount();
    }
  });

  it('offers to try again when the service could not be reached', () => {
    render(
      <RefusalNotice
        refusal={{ kind: 'unreachable' }}
        onRetry={() => undefined}
      />,
    );

    // 8.3: the button's presence is the distinction. A service that could not
    // be reached is worth asking again; a refusal is not.
    expect(
      within(screen.getByRole('alert')).getByRole('button', { name: /again/i }),
    ).toBeInTheDocument();
  });

  it('offers nothing to press when the attempts were throttled', () => {
    render(
      <RefusalNotice
        refusal={{ kind: 'throttled' }}
        onRetry={() => undefined}
      />,
    );

    // Decision 3, and the reason it is a decision rather than an oversight:
    // the backend's cooldown is 900 seconds. A retry offered beside this copy
    // cannot succeed for a quarter of an hour, and somebody who presses it and
    // is refused identically concludes the product is broken.
    expect(within(screen.getByRole('alert')).queryByRole('button')).toBeNull();
  });

  it('offers nothing to press when the refusal named a cause', () => {
    render(
      <RefusalNotice
        refusal={{ kind: 'rejected', message: 'Already a member.' }}
        onRetry={() => undefined}
      />,
    );

    // Asking again with the same input gets the same answer. What has to
    // change is the input, which is why this notice sits against it.
    expect(within(screen.getByRole('alert')).queryByRole('button')).toBeNull();
  });

  it('can be named, so an input describes itself with it', () => {
    render(
      <>
        <label htmlFor="a-field">An address</label>
        <input id="a-field" aria-describedby="a-notice" />
        <RefusalNotice
          refusal={{ kind: 'rejected', message: 'Already a member.' }}
          id="a-notice"
        />
      </>,
    );

    // What "beside the field the backend blamed" actually means for somebody
    // who cannot see where it is.
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
      /already a member/i,
    );
  });

  it('tells the two kinds apart', () => {
    const caused = render(
      <RefusalNotice refusal={{ kind: 'rejected', message: 'A cause.' }} />,
    );
    const causedClass = screen.getByRole('alert').className;
    caused.unmount();

    render(<RefusalNotice refusal={{ kind: 'unavailable' }} />);

    // A class name is a weak handle and it is the only one jsdom has: the
    // difference between these two is a colour, and no rendered assertion in
    // this suite can see a colour. What this holds is that the component makes
    // the distinction at all — the appearance itself is checked in a browser,
    // like every other appearance claim in this feature.
    expect(screen.getByRole('alert').className).not.toBe(causedClass);
  });
});
