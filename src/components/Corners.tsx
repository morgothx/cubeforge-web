/**
 * The four registration marks that make a card read as a drawing of an object
 * rather than as a box.
 *
 * Purely decorative and deliberately empty: they carry no text, so nothing
 * announces them, and the card's own heading remains the only thing that says
 * what it is. Factored out because every blueprint surface in this design has
 * exactly these four and repeating them is how three of them end up on one.
 */
export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}
