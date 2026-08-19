# Technology

*Updated: 2026-08-18*

## Stack

| Concern | Choice |
|---|---|
| Language / runtime | TypeScript on Node 22 (pinned via `.nvmrc`) |
| Package manager | pnpm 11 (pinned via `packageManager`) |
| Build tool / dev server | Vite 8 |
| UI library | React 19 |
| Tests | Vitest 4 + Testing Library, in jsdom |
| Lint / format | ESLint 9 (type-checked) + Prettier, Prettier run as a lint rule |
| Deployment | Static build to S3, served through CloudFront |

## Commands

```
pnpm install
pnpm dev                      # Vite, proxying /api to the backend
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm build` runs `tsc -b` before `vite build`, so a type error fails the build
rather than shipping. Vite itself strips types without checking them.

## Decisions worth remembering

Each of these was a trade-off, not a default.

**ESLint and Prettier, not oxlint.** The Vite template now ships oxlint, and it
was removed. The two repositories are read together by anyone reviewing this
project, and `cubeforge-api` uses ESLint with type-checked rules and Prettier as
a lint rule; a reviewer should not have to learn two lint setups to read one
project. Revisit only if both repositories move together.

**TypeScript 5.9, not the 6.x the template pins.** `typescript-eslint` 8 does not
support 6.x yet, and losing type-checked lint rules costs more than the newer
compiler gains. Revisit when `typescript-eslint` supports it.

**Vitest 4, not 3.** Vitest 3 depends on Vite 7, and having two copies of Vite
in the tree makes `@vitejs/plugin-react` fail to type-check against the config —
the plugin is a `Plugin` from one copy and a `PluginOption` from the other. This
was hit during the scaffold, not predicted.

**One config file for the dev server, the build and the tests.** `vite.config.ts`
imports `defineConfig` from `vitest/config`, which is the same function widened
with a `test` key. A separate `vitest.config.ts` is the alternative, and it
drifts: the aliases and plugins the tests run under stop being the ones the app
builds with, and the difference surfaces as a test that passes against code that
does not work.

**The backend is reached through a dev-server proxy, not an absolute URL.**
`/api/*` is proxied to `CUBEFORGE_API_ORIGIN` (default `http://localhost:3000`)
with the prefix stripped. So the browser makes same-origin requests, there is no
CORS configuration to keep in sync, and no base URL is baked into the bundle. In
production CloudFront routes `/api` the same way, and the code cannot tell the
two apart.

**pnpm blocks lifecycle scripts, and every exception is reviewed.**
`pnpm-workspace.yaml` records each decision with the reason. `esbuild` is
**denied**: its platform binaries ship as optional dependencies, so the
postinstall link step is unnecessary — verified here by running the dev server,
the production build and the test suite with it denied. `cubeforge-api` denies
it for the same reason.

## The one boundary the linter enforces

`src/api` is the only place that may call `fetch`. Everything else goes through
it. This is not architecture for its own sake — it is what keeps the access
token, the refresh-on-401 dance, and the fact that *every refusal is an
identical 404* in one place instead of scattered across components. The rule is
narrow on purpose; the rest of the app follows plain React conventions.

## Testing

Component and unit tests only, in jsdom. **Backend responses are mocked** — a
frontend test must never need the API, Floci, or a database running, because a
test suite that needs infrastructure is a test suite that stops being run.

The contract those mocks imitate is defined by `cubeforge-api`. When a response
shape changes there, the mocks here are what goes stale, and nothing will say
so — so mock shapes belong in one place per endpoint, not inline per test.
