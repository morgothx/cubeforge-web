# Implementation Tasks — dashboard-appearance

The design handoff at `Documents/design_handoff_cubeforge_dashboard/` is this
feature's requirements *and* its design. It is more specific than a spec cycle
would have produced — colours, spacing, copy and states are final in it — so
there is no `requirements.md` or `design.md` here. What this file adds is the
order, the decisions the handoff could not make, and what each task must prove.

`frontend-shell` decided how this application *behaves*. Nothing here may change
that. Where the handoff and the behaviour disagree, the disagreement is written
down below rather than resolved silently in a component.

## Decisions taken before starting

Four came from Camilo, one from a check against the backend.

1. **An editor sees no email addresses.** The handoff describes three levels of
   disclosure and the platform has two: `list-tenant-members.use-case.ts`
   discloses addresses when `role === 'admin'` and never otherwise. Editors get
   the withheld listing, exactly as viewers do. Changing that is an
   authorization change and belongs to the API's spec cycle, not to a repaint.
2. **A withheld address becomes an opaque identifier, not an absent column.**
   This reverses part of requirement 7.2's implementation. The reason 7.2 gave
   still holds — *a blank reads as missing data* — and `person_8c41f2` is not a
   blank: it identifies the row without disclosing anything. The rule becomes
   "never render an empty cell where an address would be", which is what 7.2 was
   protecting all along.
3. **`throttled` gets no retry button**, against the handoff's table. The
   backend's cooldown is **900 seconds**: a retry offered next to that copy
   cannot succeed for fifteen minutes, and a person who presses it and is
   refused identically concludes the product is broken. The copy also stops
   saying "wait a moment", which understates a quarter of an hour.
4. **Switching tenants still navigates.** The handoff says switching "does not
   navigate"; in this application the tenant *is* the address, which is what
   makes a reload keep the selection (5.4). The intent — stay in the section,
   only change the tenant — is honoured.
5. **The theme is in scope**, because the captures want both.
6. **Tailwind and daisyUI, decided mid-feature.** Camilo asked for them after
   task 4.2, having realised the design brief never named a CSS approach. Taken
   then rather than later on his reasoning that the rework only grows. It
   forces one thing: the handoff's stylesheet and daisyUI both define `.btn`,
   `.card`, `.input`, `.table`, `.radio` and most of the `btn-*` family, and two
   sheets claiming one name is not a mixture but a race. **daisyUI owns the
   components; the handoff owns the values.** Task 1.1's byte-for-byte vendored
   sheet is therefore deleted, and its guarantee — that the design can be
   replaced wholesale — is replaced by a narrower one: every number in the theme
   is read out of `styles.css` rather than re-derived.
7. **A revoked membership is offered no revoking** — taken during task 3.1,
   because the handoff asks for an empty Change cell and that narrows what an
   administrator is offered. Revoking a revoked membership is an action with no
   meaning, and a greyed control would still say it exists and that the caller
   is the one being refused. 7.3 is unaffected: an administrator may still
   revoke every membership there is to revoke.

## 1. The ground

- [x] 1.1 Bring in the design system, and nothing else yet
  - Vendor the handoff's `styles.css` into the repository, add the fonts and the
    icon package, and import the sheet once at the application root
  - Both themes as **the same tokens re-tuned**, never a second palette, and the
    theme chosen by an explicit attribute rather than by the media query alone
  - Do not touch a single component in this task: the point is to be able to see
    exactly what the sheet alone changes
  - Done when the suite is still green, the build still passes, and a probe that
    removes the import changes what is rendered
  - _Design: "Design tokens", "Assets"_
  - _Boundary: Styles, application root_

## 2. The shell

- [x] 2.1 The side panel
  - `AppLayout` becomes a two-column grid with a fixed 262px panel and no header
  - Brand, the tenant list, the section list and the identity block, in that
    order, with the identity block pinned to the bottom
  - **Two** navigations with their own labels — tenants and sections — and
    `aria-current` on the active row of each
  - Done when a tenant row carries `aria-current`, the operator fact is still a
    label that opens nothing, and the destinations offered are still identical
    for an operator and everybody else
  - _Design: "Screens / 3. Members — Panel"_
  - _Boundary: App layout, tenant switcher_

- [x] 2.2 Analytics, marked as a hole rather than hidden
  - A section entry that names where the analytics will live, carries `SOON`,
    and is **inert**: no href, no handler, no hover
  - Done when it is in the document, is not a link or a button, and adding one
    fails a test
  - _Design: "Section list"_
  - _Boundary: App layout_

## 3. The working screen

- [x] 3.1 The members table
  - The four columns, the status tags, the inline role select per row, and the
    revoked treatment: muted, role select disabled, **Change cell empty**
  - The caller's own row says so
  - The Member column shows the address when the backend disclosed it and an
    opaque identifier derived from the person id when it did not — and **never
    an empty cell**
  - Done when a viewer sees identifiers and no actions column, an administrator
    sees addresses and both controls, and a probe that renders a blank where an
    address was withheld fails
  - _Design: "Table"_
  - _Boundary: Members screen_
  - _Note: this is where requirement 7.2's implementation changes; update its
    entry in `frontend-shell/design.md` rather than leaving the old reading._

- [x] 3.2 The invite card, and the screen's own words
  - The blueprint card, the field row, and the heading line that states the
    caller's role **in words** — the sentence that tells somebody what they may
    do here, which is the whole reason this repaint exists
  - Done when the sentence names the role the caller holds in the tenant they
    are actually in, and changing tenants changes it
  - _Design: "Content", "Invite form"_
  - _Boundary: Members screen_

## 4. Saying what happened

- [x] 4.1 Two kinds of notice
  - A notice with a cause, tinted and anchored to the field the backend blamed;
    a neutral notice for everything else
  - `unreachable` keeps its retry; `throttled` does not get one (decision 3)
  - Done when the anchored notice is still tied to its input by
    `aria-describedby`, every notice is still a single component, and the source
    scan still finds one voice
  - _Design: "Refusals"_
  - _Boundary: Refusal notice_

- [x] 4.2 Waiting, and empty, as two different things
  - Waiting: dashed frame, ghost bars, `aria-busy`
  - Answered and empty: solid frame, its own words
  - Done when neither can be mistaken for the other and they remain separate
    components
  - _Design: "Waiting vs empty"_
  - _Boundary: Waiting, members screen_

## 5. The three cards

- [ ] 5.1 Sign in, no tenants, not available
  - One centred blueprint card, three sets of words and three sets of real exits
  - "Not available" is reached with and without a session: with the shell when
    there is one, and as a card alone when there is not — "Back to Members"
    means nothing to somebody who has not signed in
  - "No tenants" offers asking again, and offers nothing the product cannot do
  - Done when the signed-out route renders no shell, and each screen's exits all
    lead somewhere that exists
  - _Design: "Screens / 1, 2, 4"_
  - _Boundary: Screens_

## 6. Both themes

- [ ] 6.1 A theme somebody chose, remembered
  - A control that switches, a preference that survives a reload, and the
    system's preference as the default before anybody has chosen
  - Done when the choice outlives a reload, an unset preference follows the
    system, and no component reads a colour that is not a token
  - _Design: "Theme toggle", "Dark theme"_
  - _Boundary: Theme_

## Implementation Notes

Findings recorded during implementation belong here.

- **The handoff's stylesheet has no dark theme.** Its README lists the dark
  tokens in prose and instructs "take these from `styles.css` — do not
  re-declare them", but the sheet declares only the light ground. The dark
  re-tune is therefore ours to write, and it lives in `theme.css` so
  `design-system.css` can stay a byte-for-byte copy that is replaced wholesale
  when the design changes. Square corners are ours too: the system ships a
  radius scale this product sets to zero.
- **The runner empties `?raw` stylesheet imports.** Vitest stubs CSS by default,
  so the token test read two empty strings and asserted happily against nothing
  — three tests passing on no evidence. `css: true` in the Vite config fixes it,
  and the cost is nil because nothing else in the suite imports a stylesheet.
- **A "known tokens" set built from the whole file validates itself.** The first
  version of the dark-theme test collected every token in `theme.css`, including
  the ones inside the dark block, so an invented dark-only token arrived as its
  own evidence of being known and the probe passed. The set now excludes
  `[data-theme]` blocks and media queries, and the same probe fails. Same shape
  as the objection/refusal probe in 6.1 of `frontend-shell`: **a probe that
  fails nothing is a claim about the probe.**
- **Nothing here can see a colour.** jsdom does not apply a stylesheet, so the
  gate for appearance is the build plus a real browser. What the suite asserts
  is the structure the handoff asks for — same names, re-tuned, with an explicit
  choice that outranks the system preference — and that is all it claims to.
- **The panel replaces a sentence with a structure, and tests followed the
  sentence.** Thirteen assertions across five files awaited the frame by
  matching `/acting in Acme as admin/`. The claim they were making — *this is
  the tenant being acted in* — survives the repaint; the prose does not. They
  now ask `findActingIn` in `test/render.tsx`, which reads the row carrying
  `aria-current`. Querying by attribute is the point rather than a shortcut: a
  row that lost `aria-current` would still hold the right text, and the panel's
  accent fill makes exactly this claim to somebody who can see it.
- **`NavLink` marks the current section, not a comparison written here.** The
  router already knows which address it is serving; deciding it a second time in
  the panel would be a second answer to keep in step with the first.
- **A section list is a list of what is in a tenant.** Where no tenant is
  selected — somebody who belongs nowhere, or an address naming a tenant they
  cannot reach — the sections are absent rather than empty, on the same footing
  as the switcher. "In this tenant" over nothing is a heading for a promise the
  frame cannot keep.
- **The identity block is pinned with `margin-top: auto`, which jsdom cannot
  see.** What survives without a stylesheet is document order, and it is also
  what a screen reader follows — so the test asserts brand, then where you are,
  then who you are, by `compareDocumentPosition`. The pinning itself is checked
  in a browser, like every other appearance claim in this feature.
- **Two tests for the inert row, and neither is redundant.** Turning it into an
  `<a href>` fails only the markup test — a bare anchor inside `MemoryRouter`
  does not navigate under `fireEvent.click`, so the behavioural test sees
  nothing. Giving the `<span>` an `onClick` fails only the behavioural one. Each
  probe is caught by exactly one of the two, which is the answer to whether the
  pair earns its keep.
- **The absence of a hover tint is part of the claim.** Before it is pressed, a
  cursor is all somebody has to tell a control from a label, so the inert row
  gets no `:hover` rule of its own — the tint on the rows above it is what makes
  its stillness legible.
- **Requirement 7.2's implementation is reversed, and `frontend-shell/design.md`
  now says so** rather than being left stating the old reading. The column
  always exists; what changed is that a withheld address becomes
  `person_8c41f2` instead of the column disappearing. Before this, a viewer's
  screen was three rows of roles and statuses about nobody.
- **The identifier is hashed, not sliced.** Slicing the id was four characters
  shorter and would have printed `person_caller` for a seeded fixture and a real
  id's prefix for everybody else. This is legibility, not secrecy — the id is
  already in the payload the browser received — but an identifier that spells
  something is one somebody will read as meaning something.
- **The name is decided per row, not per listing.** The old code asked whether
  *every* member had an address, which was the reading that could not produce a
  blank while the column was droppable. With a per-row fallback, `some` and
  `every` stop mattering: no cell can be empty regardless of what the backend
  mixes.
- **The role select lives in the Role column.** It was in Change with the
  revoking, which made one column mean "the two things you may do" while the
  Role column stated a value the select restated three pixels away — and it
  made every row two lines tall.
- **Three tests kept a request pending with `await delay(30)`, which is a wager
  rather than a mechanism.** Thirty milliseconds is the entire window in which
  "Inviting…" exists, and on a machine also running a browser, a database and
  two dev servers the click, the render and the resolution all landed inside it
  — twice, in two different tests. They now hold the request open with
  `held()` in `test/server.ts` and release it when the assertions are done.
  Testing Library's one-second ceiling for eventual assertions was the same
  wager one level up, and is now five; nothing in this suite waits on a timer,
  so the ceiling only ever costs time when something is already broken.
- **The sentence is derived from `may`, never written out per role.** A
  hand-written line beside a control is a second authorization model: quieter
  than the first, answerable to nobody, and wrong the day a permission moves.
  The tests assert the *derivation* rather than the prose — the words may be
  rewritten freely and may not come to disagree with the table — and a probe
  that hard-codes the administrator's sentence fails four of them.
- **The blamed notice moved out from between the two fields.** "Beside the
  field the backend blamed" is carried by `aria-describedby`, which is what
  actually reaches somebody using a screen reader; rendering the notice
  physically between the email field and the role field bought them nothing and
  pushed the row apart for everybody else. It now sits under the row, as the
  handoff draws it, and the input still names it. A probe removing
  `aria-describedby` fails, so the tie is the assertion rather than the
  placement.
- **The title block waits for the standing.** A line naming a role before the
  backend has said which would be a guess, and the guess would be about what
  the reader is allowed to do — the one subject on this screen where being
  briefly wrong is worst.
- **The throttled copy was the real change; the missing button already was.**
  `RefusalNotice` only ever offered a retry for `unreachable`, so decision 3 was
  already the behaviour — what contradicted it was the words. "Please wait a
  moment and try again" is off by a factor of nine hundred against a
  900-second cooldown, and it offered trying again in prose beside a notice that
  deliberately offers no button. It now says the thing is locked for a while and
  to come back later, which agrees with both the backend and the absence.
- **The cooldown is not read from the response, and that was checked rather than
  assumed.** NestJS's throttler does set a `Retry-After` header — but suffixed
  with the throttler's *name*, and this backend registers named throttlers per
  address and per origin. Reading it would make the dashboard depend on a
  NestJS naming detail in another repository to print a number. Vague and true
  beat precise and coupled; if the number is ever wanted, the honest route is
  the backend putting it in the body it already controls.
- **"Two kinds" is a colour, and one test says so out loud.** The variants
  differ by a class name, which is the only handle jsdom has. That test asserts
  the component *makes* the distinction and claims nothing about what it looks
  like; the appearance was checked in a browser, where the caused notice renders
  tinted with its info mark under the invite row.
- **The handoff's empty-state line is a lie to a viewer.** "Invite someone
  above and they will appear here" — above a viewer there is no form, because
  7.4 deliberately did not give them one. Sending somebody to look for a control
  they were denied is worse than saying nothing, so the line is chosen by the
  same `may` the form is: an administrator is told what to do, and everybody
  else is told who can do it.
- **The empty state is very nearly unreachable, and is built anyway.** A caller
  reaches a tenant *by being a member of it*, so the listing always contains at
  least their own row. What makes it worth having is that the alternative to an
  answered-and-empty frame is not a blank — it is the waiting frame never
  resolving, or a table with a header and no rows. The state costs one small
  component and removes a whole category of "did it break?".
- **`asyncUtilTimeout` was set equal to the test timeout, which hides the
  diagnosis.** A query that never matches then exhausts the *test* rather than
  itself, and the report is "timed out in 5000ms" instead of the element it
  could not find and the ones it found instead. Found the honest way: the new
  waiting frame says "Waiting" *and* "Loading the members…", so a pattern
  matching either matched twice, and the retry loop ran until the test died.
  Now 3s under a 10s test timeout.
- **The ghost bars needed a token the handoff's dark list does not mention.**
  They are drawn from `--color-neutral-300`, whose light value is near-white:
  two bright rectangles on a dark ground, the loudest thing on a screen whose
  entire message is "wait". Re-tuned with the rest, which is what "the same
  tokens re-tuned" means when the list turns out to be incomplete.

## Tailwind and daisyUI (decision 6)

- **The handoff's spacing scale is a 3.4px base**, so `--spacing: 3.4px` lands
  Tailwind's numeric utilities exactly on it: `p-1` is 3.4, `p-4` is 13.6, `p-8`
  is 27.2. Nothing has to be translated and "no raw numbers off the scale"
  enforces itself — an off-scale value can only be written as an arbitrary one,
  which is visible in review.
- **Every semantic slot is steel, including `error`.** daisyUI hands each theme
  an `error`, `success` and `warning` colour whether the design wants one or
  not, and this one says "no decorative colour beyond the steel accent — state
  is said in words". Rather than trusting nobody to type `alert-error`, the
  theme leaves no red to reach for: a stray one is quiet and wrong instead of
  red and wrong. A test asserts those slots equal `primary`, by comparison
  rather than by hex, so re-tuning the accent cannot leave a red behind.
- **The steel ramp is named `steel`, not `accent`.** daisyUI already has an
  `accent` slot meaning something else; two ramps a letter apart is a bug
  waiting for a tired afternoon.
- **`btn-outline` is not the design's secondary button.** daisyUI outlines in
  `base-content` — white on the dark ground — where this design's secondary
  button carries the same divider hairline as every other edge. `btn-hairline`
  is defined once for that.
- **A probe passed against `--radius-box: 0.5rem`**, because `\s*0` matches the
  leading zero of `0.5rem`. Anchored on the semicolon now. Third time in this
  feature that a probe turned out to be a claim about the probe.
- **The suite barely noticed.** 229 of 232 tests passed untouched through a
  rewrite of every stylesheet and every component's classes: the only casualty
  was `styles/tokens.test.ts`, which existed to assert the vendored sheet and is
  replaced by `src/styles.test.ts`. Nothing else asserts appearance, which was
  the point of writing them that way.
- **Open, and Camilo's to decide: the primary button in the light theme.** The
  handoff specifies accent fill with `--color-bg` text, which is `#f2f2f3` on
  `#5980a6` — about 3.9:1, under the 4.5:1 that normal-size text wants. The
  handoff is contrast-aware elsewhere (it moves paragraph accent text to 700 for
  exactly this reason) so this reads as an oversight rather than a choice, but
  changing it means changing the accent. Left as designed and flagged.
