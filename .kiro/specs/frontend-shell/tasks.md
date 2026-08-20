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

- [x] 3.4 The session as the application sees it
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

- [x] 4.1 Read the caller's standing
  - Ask the backend who the caller is and where they may act, before showing
    anything that depends on the answer
  - Render the tenants it returns without filtering them: the backend already
    excludes the ones that no longer grant access, and a second filter here
    would be a second answer to one question
  - Done when the standing is read once per session, is never read from storage,
    and a tenant absent from the answer is absent from the application
  - _Requirements: 4.1, 9.3_
  - _Boundary: Standing query_

- [x] 4.2 Show the caller their own identity
  - The person's own address, and whether the platform records them as an
    operator
  - Done when the address from the standing is on screen, and the operator fact
    is shown while opening no destination that a non-operator lacks
  - _Requirements: 4.2, 6.4_
  - _Boundary: App layout_

## 5. Getting to a tenant

- [x] 5.1 The route table, and the gate in front of it
  - Every address the feature serves, declared in one place
  - While a session is being restored, show neither the form nor the
    application; while signed out, send the person to the form and **remember
    the address they were trying to reach**
  - Done when an address reached while signed out is the address reached after
    signing in, rather than a default one
  - _Depends: 3.4_
  - _Requirements: 2.2, 2.5, 2.6_
  - _Boundary: Routing_

- [x] 5.2 Choosing a tenant, and keeping the choice
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

- [x] 5.3 The addresses that lead nowhere
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

- [x] 6.1 Signing in
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

- **The refresh token is read from storage every time, not remembered.** The
  provider could not see a credential a test had just written, because
  `session.ts` snapshotted storage when the module loaded. The snapshot was
  never right: it is a second answer to a question storage already answers, and
  it is the wrong one whenever this page was not the last to write — another tab
  signing out clears the key while this one still believes in it. The access
  token stays in memory; only the stored half changed.
- **One guard in this task is reasoned rather than tested, and says so.**
  StrictMode double-invokes the restore effect, and a second exchange of a
  rotating refresh token would end the session the first one restored. In a
  browser both invocations land before the exchange answers, so only a ref
  stops the second. jsdom interleaves them the other way, where the state check
  suffices unaided — so removing the ref fails nothing. Removing *both* guards
  does fail. The test says which of the two it proves, and the code says the
  ref is uncovered. Third time this feature has met the shape: assert what the
  test can see, and write down what it cannot.
- **Signing out cannot fail.** The request to the backend is attempted and its
  refusal swallowed; the credential, the storage entry and the query cache go
  regardless. Leaving somebody signed in because the network dropped is the one
  outcome this must never produce, and the backend answers a sign-out for an
  unknown token successfully anyway.
- **The cache is cleared on the way in as well as on the way out.** A session
  can end without anyone signing out — an expired credential that could not be
  renewed ends it too, and leaves the previous person's answers behind. Only
  clearing on sign-in makes 4.4 hold however the last session ended.
- **A restore is not abandoned because the backend was unreachable.** 2.3
  discards a credential the backend *will not exchange*; one it never answered
  about has not been judged. Keeping it costs a sign-in form now and restores on
  the next reload; discarding it costs a password for a dropped connection.

- **The harness answered `/api/me` without a credential, and that hid a real
  hazard.** A probe enabling the standing read on "a refresh token exists"
  rather than "the session is established" failed nothing, because the fixture
  answered an unauthenticated read with `200`. In production that read is
  refused with the wordless `404`, which sends the request layer off to renew a
  credential the provider is already exchanging — two exchanges of one rotating
  token, and the read ends the session it was reading for. Every authorized
  route in the harness now refuses a request with no `Authorization`, the same
  way the guard does, and the probe fails four tests.
- **jsdom produces none of React Query's automatic re-reads.** A remount and a
  dispatched focus event both leave the request count at one whether the answer
  is held current or goes stale immediately, so two tests written that way
  passed with `staleTime` removed. The claim is asserted on the cache entry the
  refetches actually consult — `isStale()` is `false` — and the test says why it
  is written that way. Same shape as 2.2 and 3.4: the environment cannot show
  it, so assert the thing the behaviour reads.
- **A disabled query is `pending` and `idle` at once.** React Query's way of
  saying nobody asked. A screen reading `isPending` alone would show a spinner
  to somebody who is signed out, which is why every consumer of `useStanding`
  belongs behind a signed-in route.

- **"Offers no additional destination" is asserted by comparing two sets, not by
  looking for an absence.** The test collects every link and button in the frame
  for an ordinary caller, then for an operator, and requires the same set. Today
  both are empty, so it can only catch a badge that became clickable — but it is
  written to keep holding once 5.2 and 6.1 fill the frame, which is when it
  starts being worth something. Recorded so nobody reads the empty comparison as
  a test that proves nothing.
- **The frame says nothing until it knows.** Rendering the slots while the
  standing is still being read shows a person with no address and no tenants,
  which is a different claim from "not yet" — and the one somebody would act on.
  A probe that renders the header early fails a test.
- **`Partial<typeof backend.caller>` narrows to the fixture's literals.** The
  fixture is `satisfies CallerStanding`, so `isOperator` has type `false` and an
  override of `true` does not compile. `Partial<CallerStanding>` is the type
  wanted. The runner reported eight passing tests while `tsc` reported three
  errors — the same trap as task 1.1, from the opposite direction.
- **`renderSignedIn` is the one way a test arrives with a session.** It stores a
  refresh token before the first render and lets the provider exchange it, so
  the subject meets the real restore rather than a faked state — which is what
  makes a read fired too early show up as a request instead of as nothing.

- **Both halves of "you arrive where you were going" live in one file.** Sending
  somebody to the form is one mechanism and bringing them back is another; split
  across the gate and the sign-in screen they become two chances to lose the
  destination, and the form would have to know about destinations, which is not
  its subject. `RequireSession` remembers and `ReturnAfterSignIn` returns.
- **"Renders nothing while restoring" needed the address asserted, not the
  screen.** A probe treating `restoring` as signed out failed nothing: the gate
  redirected to the form, and the mirror — which also renders nothing while
  restoring — hid it. On screen the two are identical; what differs is that the
  address flapped and the wrong component was holding the line. The test now
  renders the location outside the table and asserts nobody was sent anywhere.
- **The guard on the remembered address had no test, and a probe found that.**
  Router state is written by this module alone, so `from` cannot today be
  anything but one of our paths — which is exactly how an untested guard
  survives until the day it matters. `renderAt` now accepts router state, and a
  remembered `//example.com` lands on the root.
- **`useLocation().state` is `any`, and destructuring it spreads that.** Bound
  as `unknown` instead, so the check that turns a remembered string into a
  destination is the only thing that can widen it.

- **Reading the selection and writing it down are one idea, so they live in one
  hook.** `useSelectedTenant` takes the tenant from the address and remembers it
  as a side effect of being there. What is written down is therefore always
  somewhere the person actually was, and the memory is never a second opinion
  about where they are now — a probe reading the selection from storage instead
  of the address fails seven tests.
- **The remembered tenant is checked against the standing before it is used.** A
  membership can be revoked between sessions, so the convenience must never
  outrank the authority. Two separate probes are needed here and both bite:
  never consulting the memory, and trusting it without checking.
- **An address naming no tenant leaves the memory alone rather than clearing
  it.** Arriving at the sign-in form should not forget where somebody was
  working. The probe that clears it fails two tests.
- **With nothing usable remembered, the root lands on the first tenant rather
  than presenting a chooser.** The switcher is in the frame at all times, so
  landing somewhere is a better first move than asking a question the person can
  answer whenever they like. This is a reading, not a requirement: 5.2 asks that
  they be able to choose, not that they be made to.
- **Task 4.2's empty comparison is empty no longer.** The 6.4 test now renders at
  a tenant's address, where the frame has destinations, and asserts the set is
  non-empty before comparing operator against ordinary. As predicted when it was
  written — recorded because that is the moment such a test either gets
  strengthened or quietly stops meaning anything.
- **Half of requirement 5.3 lands here and half does not.** Switching changes the
  tenant *and the role shown for it*, which is the input every later gate reads.
  The data on the screen and the navigation the role permits arrive with 6.2 and
  6.1; what is proven here is the switch itself.

- **"Not presented as a failure" is a vocabulary test, like the refusal one.**
  Three views, one shared assertion: the rendered text matches none of
  `error|failed|went wrong|try again|reload|problem`, and no `role="alert"`
  appears. A probe rewording the gone-tenant heading as "Something went wrong"
  fails four tests. Without this the rule is a comment, and the next person to
  touch the copy has nothing telling them it was deliberate.
- **Absence asserted while a view is still loading is absence proved by
  nothing.** Two tests here read that way — the missing switcher for a person
  who belongs nowhere, and the sign-out button — and both were fixed to await
  the frame first. It is the counterpart of "it threw is not an assertion": a
  `queryBy` that runs before anything has rendered passes for every
  implementation, including one that renders nothing at all.
- **Signing out is offered by the frame, not by the screen that needs it.**
  Requirement 4.3 asks for it where somebody belongs nowhere, but belonging
  nowhere is not what makes it available — being signed in is. Putting it in the
  screen would have meant task 6.1 either duplicating it or remembering to
  remove it.
- **The gone-tenant notice is the one dead end that is genuinely temporal.** A
  membership can be revoked while the page is open, so the view must not exist
  before the standing answers: rendering it early tells everybody their tenant
  is gone on every page load, and it is accidentally right for a fraction of a
  second. That is why the waiting case has a test of its own rather than being
  folded into the others.

- **`type="email"` is a format check, and a test caught it.** The browser
  refuses to submit a malformed address, so the request for `not-an-address`
  never went out and the test counting it failed. That is the shape check
  requirement 1.5 warns against arriving by the back door: it treats "malformed"
  and "well-formed but unknown" differently, which is a distinction this
  platform deliberately withholds. The type is kept for the keyboard and the
  password manager, with `noValidate` on the form; removing `noValidate` fails
  that test again.
- **The form's objection and the platform's answer are two channels.** Only the
  latter is a `role="alert"`, and only the latter may use the refusal's words.
  Both probes bite: rendering the objection through the alert, and giving it the
  refusal's sentence. One channel is how "please fill this in" ends up sounding
  like a verdict from the backend.
- **The in-flight guard is in the handler, not only on the button.** A disabled
  button still leaves the form submittable from the keyboard, so the test
  submits the form directly rather than clicking — a test that clicked a
  disabled button would pass with no guard at all. Two sign-ins would issue two
  refresh tokens and orphan one.
- **A probe can be neutralised by the line after it.** The first attempt at the
  two-channel probe set a refusal immediately before the code that clears it,
  and passed everything — not because the tests were weak but because the probe
  was. Placed where the claim actually lives, it bit at once. Worth remembering:
  a probe that fails nothing is a claim about the probe until it has been read.
