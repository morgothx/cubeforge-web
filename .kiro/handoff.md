# Handoff — cubeforge-web

Written 2026-08-18. Receiver: the next agent session. Read this, then
`.kiro/steering/tech.md`.

## Where things stand

- **`frontend-shell` in progress: 9/19 tasks.** Groups 1, 2 and 3 are complete.
  `spec.json` phase `tasks-generated`, all three approvals `true`.
- Tarea activa: **4.1 complete and VERIFIED** — the caller's standing, read once
  per session and never written down. Next actionable is **4.2**, showing the
  caller their own identity.
- Ciclo TDD: 4.1 RED → GREEN → VERIFIED by seven probes. One probe found that
  the harness answered `/api/me` without a credential; every authorized route
  now refuses an uncredentialed request the way the guard does, which is what
  makes "do not read the standing during the restore" a testable claim. 4.2
  NOT_STARTED.
- Último commit: `f02c0f3` feat(frontend-shell): three states, and the two
  transitions nothing else makes. **Uncommitted in the tree:** task 4.1, plus
  the amended commit rule in `CLAUDE.md` — Camilo is folding that into the next
  task's commit on purpose, so its message says nothing about it.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (101 passing, 11 files) and
  `pnpm build` all pass.
- Próximo paso exacto: `/kiro-impl frontend-shell 4.2` — **with the task
  number**, which is what selects manual mode. Manual mode has no commit step at
  all; without numbers it commits per task and breaks the rule below.

Camilo commits. Propose a message, never run `git commit`.

## The rule that overrides everything

No agent runs `git commit`, `git push`, or anything that creates or rewrites a
commit, in either repository, **on its own initiative** — including when a skill
suggests it. Reach a checkpoint, summarize, propose a Conventional Commits
message in English, and wait.

Camilo can lift this for one named task, and only that one: when he explicitly
asks for a rebase, an amend or a push, do it. The permission does not carry to
the next task, and "listo el commit" is a report, not a grant.

## What the backend already offers

`cubeforge-api` has four features implemented, and the last of them exists for
this repository:

```
POST /auth/sign-in                                200 {accessToken, refreshToken, sessionExpiresAt}
POST /auth/refresh                                200 same shape
POST /auth/sign-out                               204
POST /auth/credentials                            204  (redeem a setup token)
GET  /me                                          200 {personId, email, isOperator, memberships[]}
POST /tenants                                     201  operator only
GET  /tenants                                     200  operator only
DELETE /tenants/:tenantId                         204  operator only
POST /platform/people/:personId/setup-tokens      201  operator only
DELETE /platform/people/:personId                 204  operator only
GET  /tenants/:tenantId/members                   200  any member
POST /tenants/:tenantId/members                   201  admin
PATCH /tenants/:tenantId/members/:membershipId    204  admin
DELETE /tenants/:tenantId/members/:membershipId   204  admin
POST /tenants/:tenantId/api-keys                  201  admin
GET  /tenants/:tenantId/api-keys                  200  admin
DELETE /tenants/:tenantId/api-keys/:apiKeyId      204  admin
```

`GET /me` is the first call after signing in. Its `memberships[]` carries
`{tenantId, tenantName, role}` and contains **only** tenants the caller can
currently reach — a revoked membership and a deactivated tenant are already
absent, so the UI never has to filter it.

## Things that will bite you

- **Every refusal is an identical `404`,** with body
  `{"statusCode":404,"message":"the requested record does not exist"}`. No
  credential, wrong role, wrong tenant, and a genuinely missing record are
  indistinguishable, deliberately. **The UI cannot diagnose a refusal**; do not
  write a message that claims to.
- **A token names a person and nothing else** — `{sub, iss, exp}`. No tenant, no
  role. Never decode it for anything but the subject; ask `GET /me`.
- **Roles change without the credential changing.** `GET /me` is read per
  request on the backend for exactly that reason, so caching its answer for the
  life of a session throws away the property it was built to have.
- **`PATCH /tenants/:tenantId/members/:membershipId` answers 204, not 200.** So
  do most mutations here; only creation answers 201 with a body.
- **`pnpm build` type-checks, `pnpm dev` and `pnpm test` do not.** Vite strips
  types without checking them, so `types.test.ts` reported five passing tests
  while `tsc` reported five errors on the same file. Run `pnpm typecheck` at
  every checkpoint; for anything about a type, it is the only gate that counts.
- **`strict` was missing from the scaffold** and was added in task 1.1. Vite 8's
  template does not set it. If a new tsconfig is ever added, set it there too.
- **Check the test *file* count, not just the passing count.** A test file
  outside `vitest`'s `include` pattern is never collected, and the suite reports
  green with it missing. It happened once already, to the harness itself.
- **The harness refuses unhandled requests with its own named error**, not
  MSW's built-in `'error'` strategy — in this environment an unhandled request
  fails anyway, so a test asserting "it threw" would pass with the policy off.
  Assert the named message.
- **Refusal bodies in `test/handlers.ts` are copied byte for byte** from the
  backend's filter. Do not tidy them; the identical `404` is the property.
- **`request` renews on a `404`, because this backend gives expiry and refusal
  the same answer.** Three guards keep that from being ruinous: one renewal at a
  time for everybody, no renewal within five seconds of the last, and a plain
  retry when the credential changed under the request. Removing any of the three
  fails a test. Do not "simplify" them.
- **The renewal is a bare `fetch` inside `http.ts`, not an endpoint call.** That
  is what makes it unable to renew itself. Routing it through `request` does not
  fail a test — it hangs.
- **`session` is a module value, not React state, on purpose.** The request
  layer needs whichever token is current *now*; a token read through a closure
  is one render stale, and the render it would be stale during is the renewal
  the whole design is built around. Do not "modernize" it into a context.
- **Assert against the whole of storage, never one key.** "We did not write it
  under our key" is not the property; "it is nowhere a script can read it" is.
- **`src/access/permissions.ts` mirrors the backend's `@Access` declarations by
  hand.** There is no contract test across the two repositories, so the test's
  copy of those declarations is the closest thing to one. If a role changes in
  `tenant-members.controller.ts`, change it in both places or the UI offers a
  button that only ever produces a refusal.
- **`erasableSyntaxOnly` is on**, so no constructor parameter properties, no
  enums, no namespaces. `tsc` catches it; the runner does not.
- **Never add an explanation to the wordless refusal.** `describeRefusal` for
  `unavailable` is scanned against a forbidden vocabulary — session, expired,
  permission, not found, sign in. The scan exists because every one of those
  guesses is wrong most of the time.
- **Type-level assertions use `@ts-expect-error`.** A directive with nothing to
  suppress is itself an error, which is what turns those lines into assertions.
  Do not "clean them up".
- **The linter forbids `fetch` outside `src/api`.** That directory does not
  exist yet — `frontend-shell` creates it. The rule is already in place so the
  first component that needs the backend cannot quietly bypass it.
- **Vitest and Vite must stay compatible.** Vitest 3 pulls Vite 7 alongside
  Vite 8 and `@vitejs/plugin-react` then fails to type-check against the config.
  Vitest 4 fixed it here; check the peer range before upgrading either.
- **TypeScript is held at 5.9** because `typescript-eslint` 8 does not support
  6.x. Upgrading the compiler alone silently costs the type-checked lint rules.

## Conventions

- Converse with Camilo in Spanish; every repository artifact in English.
- Strict TDD: RED, GREEN, REFACTOR, VERIFY. Verify by breaking what the test
  guards, not by watching it pass.
