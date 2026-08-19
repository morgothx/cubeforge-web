# Implementation Tasks — frontend-shell

Ordering follows Foundation → Core → Integration → Validation. Task N implicitly
depends on everything before it; `_Depends:_` marks only non-obvious or
cross-group dependencies. `(P)` marks tasks safe to run concurrently with their
immediate peers.

The two screens come last on purpose. Neither can be built honestly until an
answer can be classified, a role can be questioned, and a request can survive an
expired credential — and each of those is worth getting right on its own.

## 1. Foundation

- [x] 1.1 Bring in the libraries, wire the application, and write down the
      backend's shapes
  - Add the router, the server-state library and the request-mocking library,
    the last as a development dependency only
  - Wrap the application in a query client and a router, with retries disabled
    at the query level — the one retry this feature allows belongs to the
    request layer, which is the only place that knows why it is retrying
  - Write down the shapes the backend actually answers with, taking the member
    address as **optional rather than nullable**, because the backend omits the
    field for a caller who may not see it
  - Done when the existing placeholder test still passes, all four gates are
    clean, and treating a withheld address as an explicit empty value fails to
    compile
  - _Requirements: 7.2, 9.3_
  - _Boundary: Types, application root_

- [x] 1.2 Stand up a harness that answers the way the real backend does
  - One handler per route, written from the contracts recorded during
    discovery, able to answer every refusal kind including the refusal that
    carries no reason at all
  - A helper that renders a subject inside the real providers at a given
    address, so no test has to assemble them
  - The harness must make the **number of requests observable**, because two of
    this feature's properties are only expressible as a count
  - This is also where the runtime prerequisite gets proven: the interceptor has
    to patch the request function the browser environment actually provides, and
    a harness that silently intercepts nothing would make every later test pass
    for the wrong reason. Assert a request reached a handler before trusting
    anything built on top
  - Done when a test drives a handler through the real request path rather than
    through a stand-in, and can assert how many times a route was called
  - _Requirements: 3.1, 3.3_
  - _Boundary: Test harness_

## 2. Reading an answer

Everything downstream depends on these two, and neither depends on the other.

- [x] 2.1 One vocabulary for every answer the backend gives
  - Turn a response into one closed set of outcomes: a rejection that carries a
    cause and sometimes the field at fault, a refusal that carries nothing, a
    throttled attempt, an unreachable service, and an ended session
  - Be the only place in the application that reads a status code
  - Turn each outcome into words exactly once. The wordless refusal must be
    reported as unavailability and nothing more — not an expired session, not
    missing permission, not a missing record, because the backend answers all
    three identically so that one customer cannot confirm another's records
  - Done when every status maps to its outcome, a rejection keeps the backend's
    own message and field, and a test that scans the words for the forbidden
    vocabulary fails the moment someone adds a helpful-sounding explanation
  - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - _Boundary: Refusal vocabulary_

- [x] 2.2 (P) What a role may do here
  - A single answer to "may this role do this", expressed as a table rather
    than as comparisons scattered where they are needed
  - Consulted later by both the navigation and the screen, so a control cannot
    be hidden in one and left enabled in the other
  - Done when the whole role-by-permission matrix is asserted, and the three
    roles differ exactly where the backend's own guards differ
  - _Requirements: 6.1, 7.3, 7.4_
  - _Boundary: Permissions_

## 3. A session that survives

- [x] 3.1 Decide where the credential lives
  - Hold the short-lived access in memory and persist only the long-lived
    refresh, so a reload can recover the session without the shorter credential
    ever being written down
  - Expose it as a module value rather than as React state: the request layer
    needs the current token, and a token read through a closure can be one
    render stale during exactly the refresh this design is built around
  - Done when adopting a session makes access readable and leaves it absent
    from storage — asserted by reading storage directly — and ending a session
    leaves nothing behind
  - _Requirements: 1.6, 2.1, 2.4_
  - _Boundary: Session state_

- [x] 3.2 Make a request that survives its credential expiring
  - Attach access; when the answer could mean expiry and a session is held,
    renew once and retry once, so the person sees only the result
  - Serialize renewals, so several requests expiring together produce one
    renewal and one outcome rather than several
  - Do not renew access that was just renewed — a screen holding several
    genuinely refused resources would otherwise rotate the credential once per
    resource, each refusal looking exactly like expiry to a layer that cannot
    see the others
  - Retry nothing else, and never let the renewal request itself be renewable
  - Done when three requests expiring together produce **exactly one** renewal
    by count, a rejection is never retried, several genuine refusals in a row
    renew once between them rather than once each, and a failed renewal reports
    the session as ended
  - _Depends: 2.1, 3.1_
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: Authorized request_

- [x] 3.3 One function per route, and three that bypass the authorized path
  - Every route the feature uses gets exactly one function, so a URL is written
    down once
  - Signing in, renewing and signing out carry no access and must not travel
    the authorized path
  - Done when each route in the recorded contract has one function, and a failed
    renewal produces one request rather than two — the assertion that the
    renewal cannot renew itself
  - _Requirements: 9.2_
  - _Boundary: Endpoints_

- [ ] 3.4 The session as the application sees it
  - Three states: restoring a stored session, signed out, signed in. Restoring
    is its own state so that a session about to be recovered never flashes past
    a sign-in screen the person did not need
  - Signing out ends the session with the backend, discards what was retained,
    **and clears the cached server state**, so the next person to sign in on
    this browser cannot be shown the previous one's data
  - Done when a stored credential restores the session without the sign-in form
    ever entering the document, an unusable one is discarded and the form
    appears, and a second person signing in on the same browser sees none of
    the first person's data
  - _Depends: 3.2, 3.3_
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 4.4_
  - _Boundary: Session provider_

## 4. Who the caller is

- [ ] 4.1 Read the caller's standing
  - Ask the backend who the caller is and where they may act, before showing
    anything that depends on the answer
  - Render the tenants it returns without filtering them: the backend already
    excludes the ones that no longer grant access, and a second filter here
    would be a second answer to one question
  - Done when the standing is read once per session, is never read from storage,
    and a tenant absent from the answer is absent from the application
  - _Requirements: 4.1, 9.3_
  - _Boundary: Standing query_

- [ ] 4.2 Show the caller their own identity
  - The person's own address, and whether the platform records them as an
    operator
  - Done when the address from the standing is on screen, and the operator fact
    is shown while opening no destination that a non-operator lacks
  - _Requirements: 4.2, 6.4_
  - _Boundary: App layout_

## 5. Getting to a tenant

- [ ] 5.1 The route table, and the gate in front of it
  - Every address the feature serves, declared in one place
  - While a session is being restored, show neither the form nor the
    application; while signed out, send the person to the form and **remember
    the address they were trying to reach**
  - Done when an address reached while signed out is the address reached after
    signing in, rather than a default one
  - _Depends: 3.4_
  - _Requirements: 2.2, 2.5, 2.6_
  - _Boundary: Routing_

- [ ] 5.2 Choosing a tenant, and keeping the choice
  - One reachable tenant is selected without asking; several are offered as a
    choice, with the current one always visible
  - **The address is the only source of truth for the selection**, which is what
    makes surviving a reload cost nothing. A separately remembered tenant exists
    for one purpose — deciding where to send someone who arrived at the root —
    and is never consulted while a tenant is named in the address
  - Done when reloading a tenant's address keeps that tenant, arriving at the
    root lands on the one last used, and switching changes both the data shown
    and what the navigation offers for a person who is an administrator in one
    tenant and a viewer in another
  - _Depends: 4.1_
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Boundary: Routing, tenant switcher_

- [ ] 5.3 The addresses that lead nowhere
  - A tenant the caller can no longer reach: say the previous selection is gone
    and offer the ones that remain
  - An address that does not exist: say it is unavailable and offer somewhere
    reachable. Note that **no address this feature serves is restricted by
    role** — all three roles may read the members listing, and what a role
    changes is which actions appear on it. The role-restricted-address half of
    the requirement is therefore satisfied by there being no such address, and
    becomes live when a later feature adds one
  - A person who belongs nowhere at all: say so plainly, and do not render a
    tenant switcher with nothing in it
  - Done when all three render their own view, and **none of them is presented
    as a failure to load** — an empty answer is an ordinary answer
  - _Requirements: 4.3, 5.5, 6.2_
  - _Boundary: Routing, screens_

## 6. The two screens

- [ ] 6.1 Signing in
  - Address and password; on success, the destination remembered in 5.1
  - Report a refusal as the pair not matching, never which half was wrong, and
    never whether the address is known to the platform
  - Report too many attempts distinctly from a wrong password
  - Check for empty fields locally and present that as the form's own objection,
    never as an answer from the platform — which also means adding no format
    check that implies the platform verified something it did not
  - Done when the handler is never called for an empty field, a refusal names
    neither half, and the form cannot be submitted twice while the first attempt
    is in flight
  - _Depends: 3.4_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Boundary: Sign-in screen_

- [ ] 6.2 (P) The members of the selected tenant
  - Each member with the role they hold and whether their membership is
    currently active, which means revoked ones are in the listing
  - Show addresses when the backend sent them, and when it did not, **leave no
    column where an address would be** — a blank reads as missing data, and the
    absence means withheld
  - Done when an administrator sees addresses, a viewer sees a listing with no
    address column at all, and a listing still loading is never rendered as an
    empty one
  - _Depends: 4.1_
  - _Requirements: 7.1, 7.2, 8.4_
  - _Boundary: Members screen_

- [ ] 6.3 What an administrator may change
  - Invite a person with a role, change a member's role, revoke a membership —
    each offered only to a role the permission table admits
  - Every change refreshes the listing without a reload; the two that can change
    the caller's **own** standing refresh that too, so the navigation stops
    offering what the new role does not permit
  - While a change is in flight, show it and refuse a second submission
  - Done when the listing reflects each change without a reload, an editor and a
    viewer are offered none of the three, and an administrator who demotes
    themselves sees the navigation change on the next render
  - _Depends: 2.2, 6.2_
  - _Requirements: 4.5, 6.1, 7.3, 7.4, 7.5, 7.8_
  - _Boundary: Members screen, member changes_

- [ ] 6.4 Say what happened, in one voice — **integration task**
  - Deliberately crosses every screen rather than living inside one: the whole
    point is that there is a single voice, and a per-screen version of this
    would be four voices agreeing by coincidence
  - Every outcome from task 2.1 rendered through one component: a rejection
    against the field at fault when the backend named one, a wordless refusal as
    unavailability alone, an unreachable service with a way to try again
  - Handle the backend refusing an action the application had offered — a role
    can change between drawing a control and using it, and hiding a control is a
    convenience, never the reason an action is safe
  - Done when a conflict on inviting an existing member appears against the
    address field, a wordless refusal on an offered action says only that it is
    unavailable, and no component outside the vocabulary reads a status code
  - _Depends: 2.1, 6.3_
  - _Requirements: 6.3, 7.6, 7.7, 8.1, 8.2, 8.3, 8.5_
  - _Boundary: Refusal notice, screens_

## 7. Validation

- [ ] 7.1 The whole journey, and the properties only it exposes
  - Sign in, read the standing, reach a tenant, list its members, change a role,
    see the change, sign out
  - A role changed between two asks shows in the second **with the credential
    unchanged** — the property the backend was built to have, and the reason
    standing is a query rather than a claim
  - An action the application offered and the backend refuses is handled as an
    ordinary outcome, which is what "authorization is not this layer's job"
    means in practice
  - Done when the journey passes against the harness and **each property fails
    when what guards it is removed** — caching the standing across the change,
    or treating the backend's refusal as impossible, must each turn a test red
  - _Depends: 6.3, 6.4_
  - _Requirements: 1.1, 4.1, 4.4, 6.3, 7.5, 9.1, 9.4_
  - _Boundary: End to end_

- [ ] 7.2 Keep the excluded things excluded
  - Assert the served addresses against the list this feature committed to, so
    a route added later fails by name rather than slipping in
  - The excluded areas — provisioning tenants, issuing setup tokens,
    deactivating people, managing keys, any metric or chart, setting a password
    from a token — are excluded by there being no address that reaches them
  - Done when the assertion names every address the feature serves, and adding
    one without updating it fails
  - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - _Boundary: Routing_

## Implementation Notes

Findings recorded during implementation belong here, so the next feature
inherits them rather than rediscovering them.

- **The scaffold was never in strict mode, and this task is what found it.**
  Vite 8's TypeScript template sets `noUnusedLocals` and friends but no
  `strict`, so `strictNullChecks` was off and `null` was assignable to
  `string`. The first `@ts-expect-error` written for requirement 7.2 reported
  *"Unused '@ts-expect-error' directive"* — the type was not wrong, the compiler
  was not checking. Two days of scaffold had been type-checked by a compiler
  that would have accepted almost anything. `strict` is now on in both project
  references, and turning it back off fails the same test.
- **Type-level assertions belong to `pnpm typecheck`, not to the runner.** Vite
  transpiles without checking, exactly as `ts-jest` does in `cubeforge-api`, so
  the whole of `types.test.ts` reported *five passing* while `tsc` reported five
  errors. `@ts-expect-error` is the mechanism that makes those assertions rather
  than comments: a directive with nothing to suppress is itself an error, so the
  test fails when the shape it guards stops being wrong. **The runner cannot be
  trusted alone for anything about a type.**
- **The query client lives in `src/queries/client.ts`, not in `App.tsx`.** The
  design put it in the root, which would have made "retries are off" unassertable
  — and exporting a factory from `App.tsx` trips `react-refresh/only-export-components`.
  It sits beside the query keys it configures. Design updated.
- **`msw`'s postinstall is denied.** It copies a service worker into `public/`,
  which is only used when intercepting inside a browser; these tests intercept
  in Node. Task 1.2 is what proves the denial was safe, by intercepting a real
  request.

- **A test file in `test/` was silently never collected, and nothing said so.**
  The scaffold's `include` pattern named only `src/`, so the first version of
  `harness.test.tsx` reported the suite green while running none of it. The
  pattern now covers both roots. **This hazard has no test that can catch it
  from the inside** — a dropped root simply reports fewer files passing, which
  reads like success. When adding a test directory, check the file count moved.
- **"It threw" is not an assertion, and a probe caught it.** The test for
  refusing an unhandled request asserted only that the promise rejected — and
  in this environment nothing is listening on the address, so it rejected
  whether or not the harness had a policy at all. Switching the policy to
  `bypass` failed nothing. The harness now throws its own named error, MSW
  surfaces it as a distinctive answer, and the test asserts *that*. Same shape
  as the API's "an error that echoes its input can answer for its own reason".
- **The refusal bodies are copied byte for byte from the backend.** A handler
  answering a friendlier `404` would make authorization and absence
  distinguishable in tests while they stay indistinguishable in production —
  which would let a component branch on something real code can never see.
  Changing the message fails a test.
- **`msw`'s denied postinstall was safe**, as task 1.1 predicted: interception in
  Node needs no service worker, and the harness proves it by intercepting.
- **Two lint rules the harness needs.** `ignoreRestSiblings`, because
  `const { email, ...rest }` is how this codebase *omits* a field — the shape
  the backend itself uses — and `react-refresh/only-export-components` off for
  test helpers, which are never a hot-reload boundary.

- **`erasableSyntaxOnly` forbids constructor parameter properties**, and the
  design's own snippet used one. `class ApiError { constructor(readonly refusal:
  Refusal) }` fails `tsc` under the Vite template's settings, because a
  parameter property is syntax that must be compiled away rather than erased.
  Same family as `cubeforge-api`'s ambient-const-enum problem: a build setting
  that only the type-checker enforces, invisible to the runner. Write the field
  out. Design corrected.
- **A `500` is read as unreachable, not unavailable.** The design's table did
  not cover server errors. Unavailability offers the person nothing to do, and
  the service *was* reached and did fail — so trying again is the right offer.
  Recorded here because it is a reading, not a fact: no requirement names a
  server error.
- **The `404`'s message is discarded on purpose.** It is the same sentence for
  a caller who may not act, one with no credential, and a record that never
  existed, so repeating it dresses an absence of information up as information.
  A probe that passes it through fails a test.
- **`session-ended` may say "sign in again"; `unavailable` may not.** The
  forbidden-vocabulary scan applies to the wordless refusal alone. The
  distinction is the whole point: after a failed renewal the session really is
  over, which is a fact — the same words on a `404` would be a guess, and wrong
  most of the time, because by then a renewal has usually just succeeded.

- **"A table rather than comparisons" is a compile-time claim, and no runtime
  test could see it.** A probe replacing the table's body with
  `role === 'admin' || permission === 'members:read'` produced **identical
  answers for all four permissions** and failed nothing. The two are
  behaviourally the same today; what comparisons lose is that the *fifth*
  permission gets no decision and no complaint. The guarantee now lives in an
  exported `RoleAdmission` type asserted with `@ts-expect-error`, and the same
  probe fails `pnpm typecheck` with two errors. **A design property that only
  matters for code not yet written cannot be tested behaviourally — encode it in
  a type or admit it is unenforced.**
- **The table was transcribed from `tenant-members.controller.ts`, and the test
  restates it as the expected value.** Deliberate duplication: the test's copy
  is the backend's declarations, and the source's copy is what the UI acts on.
  They are two answers to the same question on purpose, so a drift between the
  repositories fails here rather than surfacing as a button that only ever
  produces a refusal. There is no contract test across the two repositories, so
  this is the closest thing to one.
- **An editor and a viewer are identical on this screen, asserted on purpose.**
  They differ elsewhere on the platform and will differ on later data screens;
  here the backend admits both to the read and neither to the writes. Asserted
  so nobody "fixes" the apparent redundancy by inventing a distinction the
  guards do not make.

- **The storage assertions read the whole of storage, not the one key.** "We did
  not write the access token under *our* key" is a weaker claim than "the access
  token is nowhere a script can read it", and only the second is the property
  worth having. `JSON.stringify({ ...localStorage })` and a substring check does
  it, and it catches a second key added later by someone with good intentions.
  A probe writing the access token under `cubeforge.access` fails it.
- **The reload test discards the module's memory rather than trusting that it
  would be discarded.** `vi.resetModules()` plus a dynamic re-import is what
  makes it a test of the two tokens being kept *differently*; without it the
  in-memory access token would still be there and the assertion would prove
  nothing. This is the one place in the suite where module identity matters.
- **`sessionExpiresAt` is deliberately not persisted, and a test says so.** It
  comes back from the backend and nothing reads it. A stored value nobody reads
  is one somebody eventually trusts by mistake — and the design's reason for
  ignoring it stands: renewing reactively on a refusal is correct even when the
  client's clock is wrong.
- **An empty stored entry is not a session.** A cleared browser, a
  half-finished write, or somebody else's bug all produce one, and none of them
  should be a crash on the first paint. Returning the raw `getItem` result fails
  a test.

- **The cooldown had a hole, and the review found it rather than a test.** A
  request that expires while another is already renewing resumes *after* that
  renewal completes: the renewal promise is gone, the cooldown is active, and
  the request would be told the thing is unavailable — refused for no reason
  beyond unlucky timing. The fix is not a longer window but a different
  question: `send` now reports which credential it actually presented, and if
  the one in hand differs, the request simply retries and renews nothing. The
  probe that removes that comparison fails a test written for it.
- **Serialization is not an optimization here, it is correctness.** The backend
  rotates refresh tokens and invalidates the whole family when a used one is
  presented, so three unserialized renewals would have the second one *end* the
  session the first was rescuing. That is why the assertion is a request count:
  three renewals answer exactly the same as one, right up until the session
  dies.
- **The renewal cannot renew itself, structurally rather than by rule.** It is
  issued with a bare `fetch` inside this module, carrying no access token, and
  it cannot reach `request`. The probe that routes it through the authorized
  path does not fail an assertion — it **times out**, which is the recursion
  actually happening.
- **`http.ts` cannot import `endpoints.ts`,** which is why the renewal is a raw
  `fetch` here. The dependency direction runs `http → endpoints`, and task 3.3
  builds the latter. This is the one place in the application outside
  `endpoints.ts` that names a route, and it names exactly one.
- **A failed renewal ends the session immediately.** Leaving the dead credential
  in place would make the next request spend another round trip discovering the
  same thing, and the person would watch two failures instead of one.

- **A behavioural test cannot see "a URL is written down once", so a test reads
  the source.** A component with its own `fetch('/api/me')` answers exactly the
  same as one calling `fetchStanding`. `import.meta.glob` with `?raw` over
  `src/**` gives the file contents, and the assertion is the *list of files
  naming a route*: `endpoints.ts` and `http.ts`, nothing else. Adding a route
  literal to `App.tsx` fails it. Same family as 2.2's `RoleAdmission` — when the
  property is structural, assert the structure or admit it is unenforced.
- **`listMembers` must ask for the revoked, and review is what found it.** The
  backend excludes inactive memberships unless `includeInactive=true`, while
  requirement 7.1 asks the screen to show whether a membership is active. The
  two only contradict each other at the line that builds the URL, and the
  design's signature had no query at all. The harness now filters the way the
  backend does, so forgetting the query fails a test rather than producing a
  column that reads `true` on every row.
- **A backend that could not be reached no longer ends the session.** Factoring
  the credential-free path out of `http.ts` exposed that a failed renewal ended
  the session whatever the reason — including a dropped connection, which says
  nothing about the credential. `unreachable` now propagates and the session
  survives; everything else is the backend refusing this refresh token, and that
  session really is over.
- **`unauthorized` is why the three exceptions are structural.** Signing in,
  renewing and signing out share one function that has no credential to attach
  and no retry to reach, rather than three functions each remembering not to.
  The renewal uses it too, which leaves `http.ts` naming a route but not
  duplicating the request.
