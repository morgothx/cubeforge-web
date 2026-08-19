# Research — frontend-shell

*Discovery type: full.* The repository is a scaffold, so there is no existing
implementation to extend and every structural decision below is being made for
the first time. What constrains it is not this codebase but the adjacent one:
`cubeforge-api` is finished for this purpose, and its contracts and its refusal
semantics are facts, not choices.

## Scope of discovery

1. The backend's actual contracts, read from source rather than from memory.
2. Whether the routing, server-state and mocking problems are already solved.
3. Where the caller's standing, the session and the selected tenant live.
4. The risks the requirements imply but do not name.

---

## 1. The backend, read from source

Verified in `cubeforge-api` on 2026-08-18. These are contracts this feature
codes against, and getting one wrong is a defect the type system cannot catch.

| Route | Request | Success | Notes |
|---|---|---|---|
| `POST /auth/sign-in` | `{email, password}` | `200 {accessToken, refreshToken, sessionExpiresAt}` | Never answers `400`; see below |
| `POST /auth/refresh` | `{refreshToken}` | `200` same shape | Rotates; reuse invalidates the whole family |
| `POST /auth/sign-out` | `{refreshToken, everywhere?}` | `204` | Succeeds even for an unknown token |
| `GET /me` | — | `200 {personId, email, isOperator, memberships[]}` | `memberships[]` is `{tenantId, tenantName, role}` |
| `GET /tenants/:t/members?includeInactive=` | — | `200 MemberResponse[]` | |
| `POST /tenants/:t/members` | `{email, role}` | `201 {membershipId, personId, role}` | |
| `PATCH /tenants/:t/members/:m` | `{role}` | `204` | **Not `200`** |
| `DELETE /tenants/:t/members/:m` | — | `204` | |

### Finding: `email` is *omitted*, not `null`

```ts
export interface MemberResponse {
  readonly membershipId: string;
  readonly personId: string;
  /** Absent entirely for a caller who is not an administrator here. */
  readonly email?: string;
  readonly role: string;
  readonly active: boolean;
}
```

The backend's own comment: "The field is omitted rather than sent as `null`, so
a listing without addresses says 'not for you' instead of implying these people
have none." This is what makes requirement 7.2 implementable honestly — the
client can tell withheld from absent, and does not have to infer it from the
caller's role.

### Finding: refusals are three kinds, not one

Read from `domain-error.filter.ts`. The Project Description originally claimed
every refusal was an identical `404`; that is false and the requirements were
corrected before they were written.

| Kind | Status | Body | Can the UI explain it? |
|---|---|---|---|
| `forbidden`, `not-found` | `404` | `{statusCode, message: "the requested record does not exist"}` | **No.** Byte-identical by design |
| `validation`, `invalid-role` | `400` | `{message, field}` | Yes, with the field |
| `already-a-member`, `tenant-name-taken` | `409` | `{message, field}` | Yes, with the field |
| `last-administrator` | `409` | `{message}` | Yes, no field |
| throttled sign-in | `429` | throttler's own body | Yes, as "wait" |

The guard's refusal is a Nest `NotFoundException` and produces the same body as
the filter's `404`, which an integration test in `caller-identity` 5.1 asserts
byte for byte. So the client cannot separate "the guard refused you" from "the
record is gone", and must not try.

### Finding: sign-in deliberately never answers `400`

```
 * A 400 for a malformed address or a too-short password would undo that at the
 * edge: it tells the caller their guess was never going to match, which is
 * precisely what the identical rejections are there to withhold.
```

Consequence for this feature: the client may validate emptiness locally for the
person's benefit, but must present its own validation as its own — never as the
backend's answer — and must not add format validation that implies the platform
checked something it did not.

### Finding: the access token lifetime is 900 seconds

Fifteen minutes, from `loadTokenConfig`. Expiry mid-session is the normal case,
not the edge case, which is why requirement 3 is a section and not a bullet.

---

## 2. Build vs. adopt

### Routing — **adopt `react-router` 8.3**

Requires React `>=19.2.7`; the project has 19.2.8. Used in its declarative mode:
a router, routes, and `useNavigate`. No loaders, no actions, no framework mode —
those are for server-rendered apps, and `product.md` commits this one to a
static client-rendered SPA on S3.

*Rejected: `@tanstack/react-router` 1.170.* Its typed route and search params are
genuinely better than react-router's `useParams(): Record<string, string>`, and
that matters here because the selected tenant lives in the path. It was rejected
for cost, not quality: it wants a generated route tree and a second mental model
in the first feature this repository has ever had. **Revisit at
`dashboard-frontend`**, when there are enough routes for typed params to pay for
the build step.

*Rejected: hand-rolled routing.* Requirements 2.5, 2.6 and 6.2 need a remembered
destination, redirects and unknown-address handling. That is a router.

### Server state — **adopt `@tanstack/react-query` 5.101**

Peer range `^18 || ^19`. It is not adopted for caching; it is adopted because
five requirements are literally its feature list:

| Requirement | What Query provides |
|---|---|
| 7.5 — the list reflects a mutation without a reload | invalidation after mutation |
| 7.8, 8.4 — show that we are waiting, never an empty result as an answer | `isPending` distinct from empty data |
| 4.5 — re-read standing after the caller changed their own membership | targeted invalidation |
| 8.3 — a network failure is not a refusal | thrown error vs. resolved response |
| 3.1 — one retry, and only for expired access | retry disabled at the Query level; the single retry belongs to the request layer, which is the only place that knows *why* |

*The risk it introduces* is requirement 4.4: standing must be read afresh rather
than reused from a previous session. Query's cache is in memory and dies with
the tab, so the danger is not persistence but a cache surviving **sign-out** in
the same tab. The design commits to clearing the cache on sign-out, and to never
adding a persister.

*Rejected: hand-rolled `useEffect` fetching.* Possible for two screens, and it
gets 8.4 wrong the first time — the standard mistake is an initial `data = []`
that renders as "no members" while the request is in flight, which requirement
8.4 forbids by name.

### Backend mocking in tests — **adopt `msw` 2.15**

Intercepts at the network layer, so a test exercises the **real** `src/api`
code — including refresh-and-retry — instead of a stub that stands where it
should be. `tech.md` already requires that mock shapes live in one place per
endpoint rather than inline per test; MSW handlers are that place.

This is the only way to test requirement 3 honestly. A mocked `apiClient` cannot
prove that a `401` triggers a refresh and a retry, because the thing under test
is the very thing replaced.

### Session storage and refresh serialization — **build**

No library matches this backend: rotating refresh tokens whose reuse kills the
family, plus refusals that carry no reason. Roughly eighty lines, and every one
of them is a decision this project should be seen making.

### Forms — **build, with plain React**

Two forms: sign-in and invite. `react-hook-form` and friends earn their weight
at a dozen fields with cross-field rules. Requirements 1.4, 1.5 and 7.8 are
"disable while in flight" and "say when a field is empty".

---

## 3. Generalizations found

Applied before writing the design, per the synthesis rules.

**One classification, many renderings.** Requirements 1.2, 1.3, 7.6, 7.7, 8.1,
8.2 and 8.3 look like seven behaviours and are one: *what kind of answer was
that?* They collapse into a single discriminated union produced in exactly one
place. Everything else — the sign-in message, the invite error, the generic
"unavailable" — is a rendering of that union. Without this, "never invent a
reason for a 404" is a rule seven call sites have to remember, and the seventh
will not.

**One authorized request.** Requirements 3.1–3.4 are one capability, not four.
Attaching access, refreshing it once, holding concurrent callers, and refusing
to retry anything else are the same function's job, and no component above it
should know that access tokens expire at all.

**One permission question.** Requirements 6.1, 6.2, 7.3 and 7.4 all ask "may
this role do this here". A single predicate over the role in the selected
tenant, consulted by the navigation and by the screen, keeps the answer from
being spelled differently in two places — which is how a control gets hidden in
the nav and left enabled on the page.

## 4. Simplifications applied

- **No hexagonal layering.** `cubeforge-api` uses ports and adapters where they
  buy testability of tenant isolation. Nothing here needs to run behind two
  infrastructures, and a `Repository` interface with one implementation would be
  ceremony. The one boundary kept is `src/api`, which the linter already
  enforces and which exists for a concrete reason.
- **No global state library.** Server state is Query's. The only client state
  that is not server state is the session, which is one module and one context.
- **No error-boundary hierarchy, no toast system, no design system.** One way to
  render the answer union, used everywhere.

## 5. Risks

| Risk | Mitigation |
|---|---|
| A `401` on the refresh call itself triggers a refresh, recursively | The refresh request is issued outside the authorized-request path and can never retry |
| Two tabs rotate the refresh token; the loser holds a token whose family was invalidated | Accepted for this feature. The loser is signed out on its next request, which is correct behaviour, merely abrupt. Recorded as a known limitation |
| A cache surviving sign-out shows the previous person's data | Query cache cleared on sign-out; asserted by a test, not by convention |
| The refresh token in `localStorage` is readable by any injected script | Accepted and named. A static SPA cannot set an `httpOnly` cookie for a different origin, and the alternative — no persistence — was rejected by the product decision on 2026-08-18. Mitigated by keeping the access token out of storage and by the backend's rotation, which bounds how long a stolen refresh token is useful |
| `email` treated as `string \| null` instead of optional | The type makes it `email?: string`; `exactOptionalPropertyTypes` is not on, so this is a review point rather than a compiler one |
| MSW handlers drift from the backend's real shapes | Handlers are written from the contracts in section 1 and cite them. There is no contract test across repositories, and inventing one is out of scope — recorded as a known gap |

## 6. Gaps left for implementation

- Whether `sessionExpiresAt` is worth surfacing at all. The backend returns it;
  nothing in the requirements asks for it. Not designed in.
- Whether the members list should offer `includeInactive`. Requirement 7.1 asks
  for "whether their membership is currently active", which implies the listing
  includes revoked ones. The design says it requests them; whether a filter
  control is worth it is a task-level call.
