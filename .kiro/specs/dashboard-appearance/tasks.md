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

- [ ] 2.1 The side panel
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

- [ ] 2.2 Analytics, marked as a hole rather than hidden
  - A section entry that names where the analytics will live, carries `SOON`,
    and is **inert**: no href, no handler, no hover
  - Done when it is in the document, is not a link or a button, and adding one
    fails a test
  - _Design: "Section list"_
  - _Boundary: App layout_

## 3. The working screen

- [ ] 3.1 The members table
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

- [ ] 3.2 The invite card, and the screen's own words
  - The blueprint card, the field row, and the heading line that states the
    caller's role **in words** — the sentence that tells somebody what they may
    do here, which is the whole reason this repaint exists
  - Done when the sentence names the role the caller holds in the tenant they
    are actually in, and changing tenants changes it
  - _Design: "Content", "Invite form"_
  - _Boundary: Members screen_

## 4. Saying what happened

- [ ] 4.1 Two kinds of notice
  - A notice with a cause, tinted and anchored to the field the backend blamed;
    a neutral notice for everything else
  - `unreachable` keeps its retry; `throttled` does not get one (decision 3)
  - Done when the anchored notice is still tied to its input by
    `aria-describedby`, every notice is still a single component, and the source
    scan still finds one voice
  - _Design: "Refusals"_
  - _Boundary: Refusal notice_

- [ ] 4.2 Waiting, and empty, as two different things
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
