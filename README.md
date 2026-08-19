# cubeforge-web

The dashboard for CubeForge, a multi-tenant SaaS analytics platform. React 19,
TypeScript and Vite, deployed as a static SPA.

The API and data pipeline live in the companion `cubeforge-api` repository,
which is where tenant isolation and role-based access are actually enforced.
This repository reflects a caller's role; it does not decide it.

## Running it

Requires Node 22 (`.nvmrc`) and pnpm 11.

```bash
pnpm install
pnpm dev
```

The dev server proxies `/api/*` to `http://localhost:3000` with the prefix
stripped, so the browser makes same-origin requests and no base URL is baked
into the bundle. Point it somewhere else with `CUBEFORGE_API_ORIGIN`. Start the
backend from `cubeforge-api` first, or its calls answer `502`.

## Checks

```bash
pnpm lint        # ESLint, type-checked rules, Prettier as a lint rule
pnpm typecheck   # tsc across both project references
pnpm test        # Vitest in jsdom; needs no backend and no database
pnpm build       # tsc -b, then a production bundle into dist/
```

## Status

Scaffolding only. The application is a placeholder until the `frontend-shell`
feature adds routing, the session and a layout. See `.kiro/steering/` for the
decisions behind the setup and `.kiro/specs/` for the features themselves.
