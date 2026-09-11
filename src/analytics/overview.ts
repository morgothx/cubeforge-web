/**
 * The two questions the overview asks without being asked.
 *
 * A dashboard that opened on an empty composer would have nothing to show the
 * moment it opened, so these two are chosen in advance: what is on hand, and
 * what moved and how often. They are the product's constant questions, and
 * answering them is what makes the overview an overview rather than a form.
 *
 * **These are the only measure and grouping names written anywhere in this
 * application.** Everything else reads them from the vocabulary the platform
 * publishes, and `overview.test.ts` scans the source to keep that true. A name
 * copied into another module would work until the platform changed, and then
 * fail somewhere far from here.
 *
 * They are not privileged: each goes through the same check a person's draft
 * does, against the same vocabulary. A name the platform stopped offering
 * stops the overview before a question is spent on it.
 */

/** A composition chosen in advance, waiting only for a period. */
export interface FixedComposition {
  readonly measures: readonly string[];
  readonly groupings: readonly string[];
  readonly by: string;
}

/**
 * What is on hand, per product (2.2).
 *
 * On hand is the cumulative measure: it counts every movement ever recorded,
 * not the period's. That is why an answer carrying it also carries the note
 * requirement 2.4 asks for.
 */
export const ON_HAND: FixedComposition = {
  measures: ['on_hand_quantity'],
  groupings: ['product'],
  by: 'recorded',
};

/**
 * What moved and how often, by the day it was recorded and the kind of
 * movement (2.3).
 *
 * A day and one other grouping: the shape a chart can draw whole, which is
 * what lets the overview show this one rather than a table alone.
 */
export const MOVEMENTS: FixedComposition = {
  measures: ['net_quantity', 'movement_count'],
  groupings: ['recorded_day', 'kind'],
  by: 'recorded',
};
