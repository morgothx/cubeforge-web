import { Empty } from './Empty';
import { Waiting } from './Waiting';
import { render, screen } from '../../test/render';

/**
 * Waiting, and answered-and-empty (task 4.2).
 *
 * These are two different pieces of news and requirement 8.4 exists because
 * merging them tells the second one early: a listing rendered before it arrives
 * is an empty listing, and "nobody is here" is an answer somebody acts on. One
 * component with a `loading` flag is the merge wearing a disguise — it is one
 * edit away from the two branches sharing a frame, a word, or a silence.
 *
 * So they are tested as a pair: what each says, what each must not say, and
 * that they are still two modules.
 */

const sources = import.meta.glob('./*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('while the answer is on its way', () => {
  it('says so, in words and to a screen reader', () => {
    render(<Waiting what="the members of this tenant" />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('claims nothing about what the answer will be', () => {
    render(<Waiting what="the members of this tenant" />);

    // The exact failure 8.4 is about. Every one of these is a statement about
    // a listing nobody has seen yet.
    expect(screen.queryByText(/\bno\b|nobody|none|empty|0/i)).toBeNull();
  });
});

describe('when the answer was nothing', () => {
  it('says that it is an answer, not a wait', () => {
    render(<Empty title="This tenant has no members yet" />);

    expect(screen.getByText(/answered/i)).toBeInTheDocument();
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
  });

  it('is not busy, because nothing is happening', () => {
    render(<Empty title="This tenant has no members yet" />);

    // A frame that kept `aria-busy` would leave somebody waiting for a listing
    // that has already arrived and is empty.
    expect(screen.queryByRole('status')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('says nothing about loading', () => {
    render(<Empty title="This tenant has no members yet" />);

    expect(screen.queryByText(/loading|waiting/i)).toBeNull();
  });
});

describe('the two of them', () => {
  it('are still two modules', () => {
    const waiting = String(sources['./Waiting.tsx'] ?? '');
    const empty = String(sources['./Empty.tsx'] ?? '');

    expect(waiting).not.toBe('');
    expect(empty).not.toBe('');
    // Neither reaches for the other. A shared frame is how the two states come
    // to look alike, and looking alike is the whole failure.
    expect(waiting).not.toMatch(/from '\.\/Empty'/);
    expect(empty).not.toMatch(/from '\.\/Waiting'/);
  });
});
