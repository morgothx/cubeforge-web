# Handoff — cubeforge-web

Written 2026-08-18. Receiver: the next agent session. Read this, then
`.kiro/steering/tech.md`.

## Where things stand

- **Scaffolding only.** The toolchain is complete and proven; the application is
  a placeholder heading and a paragraph.
- No feature has been specified. **`frontend-shell` is next**, and it is what
  decides routing, the session, the layout and everything under `src/` beyond
  `src/api`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass. One test.
- Último commit: none of this — the scaffold is uncommitted.

Camilo commits. Propose a message, never run `git commit`.

## The rule that overrides everything

No agent runs `git commit`, `git push`, or anything that creates a commit, in
either repository, ever — including when a skill suggests it. Reach a
checkpoint, summarize, propose a Conventional Commits message in English, and
wait.

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
- **`pnpm build` type-checks, `pnpm dev` does not.** Vite strips types without
  checking them, so a broken type is invisible until the build. Run
  `pnpm typecheck` at every checkpoint.
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
