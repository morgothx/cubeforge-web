/**
 * The four registration marks that make a card read as a drawing of an object
 * rather than as a box.
 *
 * Purely decorative and deliberately empty: they carry no text, so nothing
 * announces them, and the card's own heading remains the only thing that says
 * what it is. Factored out because every blueprint surface in this design has
 * exactly these four and repeating them is how three of them end up on one.
 *
 * `corner` is a custom utility (`index.css`) rather than Tailwind classes: the
 * mark is drawn with two pseudo-elements, which utilities cannot express.
 */
export function Corners() {
  return (
    <>
      <i className="corner -top-1.5 -left-1.5" />
      <i className="corner -top-1.5 -right-1.5" />
      <i className="corner -bottom-1.5 -left-1.5" />
      <i className="corner -bottom-1.5 -right-1.5" />
    </>
  );
}
