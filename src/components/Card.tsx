import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { Corners } from './Corners';

/**
 * The one centred card three screens share.
 *
 * Signing in, belonging nowhere and reaching an address that does not exist are
 * three different pieces of news, and the design gives them one shape on
 * purpose: the words differ, the exits differ, and the frame does not — so what
 * a person notices is the sentence rather than the furniture.
 *
 * `alone` says this card *is* the page rather than sitting inside the frame, and
 * it decides two things that turn out to be the same thing. It fills the
 * viewport, because with no panel beside it there is no other content to give
 * the page height; and it carries the brand, because somebody who has not
 * signed in has no other clue what they are looking at. Inside the frame both
 * are already true — the shell has the height and the panel has the brand, and
 * twice is once too many.
 */
export function Card({
  title,
  kicker,
  alone = false,
  width = 'w-[460px]',
  children,
}: {
  title: string;
  kicker?: string;
  alone?: boolean;
  /**
   * The card's width, as a class rather than a number. Two reasons, and the
   * second is the load-bearing one: an inline style is off the token path, and
   * `width={400}` is a bare `400` in a file above the request layer — which the
   * scan in `refusals.test.tsx` reads as a status code, correctly, because a
   * scan that made an exception for this one would make it for the next one.
   */
  width?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid place-items-center p-8 ${alone ? 'min-h-screen' : 'flex-1'}`}
    >
      <div
        className={`relative flex max-w-full flex-col gap-4 border border-divider p-6 ${width}`}
      >
        <Corners />
        {alone && <Brand />}
        <div className="flex flex-col gap-1">
          {kicker !== undefined && (
            <p className="text-kicker uppercase tracking-[0.1em] text-primary">
              {kicker}
            </p>
          )}
          <h1 className="font-heading text-block font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
