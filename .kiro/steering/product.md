# Product

*Updated: 2026-08-18*

## What this is

CubeForge is a multi-tenant SaaS analytics platform. Customer organizations
("tenants") record transactional data through the API, and their users explore
that data through a dashboard backed by a semantic layer that defines every
business metric exactly once.

This repository is the dashboard. The API and data pipeline live in the
companion `cubeforge-api` repository, which is where every rule about who may
see what is actually enforced.

## Why it exists

It is a portfolio project, built to demonstrate skills for full-stack roles
requiring AWS, multi-tenancy, and embedded BI. Both repositories are public and
read as production code, which changes what "done" means here: a feature is not
finished when it works, it is finished when a reviewer reading the diff would
call it production-grade.

## What this repository is responsible for

- **Signing a person in, and keeping the session alive.** The API issues a short
  access token and a refresh token; the client is what decides when to exchange
  one for the other, and what to do when it cannot.
- **Knowing where the caller may act.** `GET /me` answers with the person, their
  address, whether the platform records them as an operator, and every tenant
  they can currently reach with the role held in each. Everything the UI shows
  or hides follows from that answer.
- **Reflecting a role without pretending to enforce it.** An action the current
  role may not perform is hidden or disabled, because offering it and then
  failing is a bad experience — not because hiding it protects anything. The
  backend refuses it regardless, and the UI must still handle that refusal.
- **Presenting metrics defined elsewhere.** Every number comes from the semantic
  layer through the API. The dashboard never defines a metric of its own, and
  never reaches a database.

## What it is deliberately not responsible for

- **Authorization.** A guard in the API decides it. This layer is UX.
- **Metric definitions.** Cube.dev owns them, once, for every consumer.
- **Server-side rendering.** This is a static client-rendered SPA, served from
  S3 behind CloudFront. Introducing SSR would be a deliberate architectural
  change, not a default.

## How a caller reaches the platform

```
POST /auth/sign-in          → { accessToken, refreshToken, sessionExpiresAt }
GET  /me                    → { personId, email, isOperator, memberships[] }
POST /auth/refresh          → a new pair, and the old refresh token dies
POST /auth/sign-out         → ends this session, or every session
```

`GET /me` is the first call a signed-in client makes, and the reason the
`caller-identity` feature exists on the API side: a token names a person and
nothing else, so a client that has just signed in knows nothing about where it
may act until it asks.

## Refusals look identical on purpose

Every refusal the API produces — no credential, wrong role, wrong tenant, a
record that does not exist — arrives as the same `404` with the same body. That
is a deliberate non-disclosure property of the backend, and it constrains this
repository: **the UI cannot diagnose a refusal from its response.** It can only
say that the thing is not available, and offer signing in again. Any message
more specific than that would be a guess.
