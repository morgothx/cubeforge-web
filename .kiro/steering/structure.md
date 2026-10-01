# Structure

*Updated: 2026-09-26*

## Layout

```
cubeforge-web/
  index.html              the single page
  vite.config.ts          dev server, build and test configuration
  eslint.config.mjs       type-checked rules, Prettier, and the src/api boundary
  tsconfig.json           project references: app and node
  pnpm-workspace.yaml     reviewed lifecycle-script exceptions
  public/                 served verbatim
  test/setup.ts           registers jest-dom and unmounts between tests
  src/
    main.tsx              mounts the app
    App.tsx               the application root
    index.css             a readable default, nothing more
    api/                  everything that talks to the backend — see below
    access/               what a role may do, decided once
    analytics/            pure decisions about questions and answers, and one store
    components/           the frame, the shared states, and analytics/ within it
    queries/              server state: standing, members, vocabulary, answers
    routes/               the address table, the tenant route and address helpers
    screens/              one file per screen
    session/              the provider and its hook
    theme/                which ground the application is drawn on
```

Each directory arrived with the feature that needed it, and none was laid out
in advance. `src/analytics/` is the newest: it holds what may be asked, how an
answer is read and whether it may be drawn — decisions over the platform's
shapes, made without a request, a query or a screen, which is what keeps them
testable on their own. `src/architecture.test.ts` states the dependency
direction between all of them and fails when an import runs uphill.

## The rule that has to hold

**`src/api` is the only place that calls `fetch`,** and ESLint enforces it
rather than leaving it to memory. Everything a request needs to be correct —
the access token, refreshing it when it expires, and the fact that every refusal
from this backend is the same `404` — belongs in one place. Scattered across
components, those three become three dozen slightly different versions, and the
one that forgets is the one that ships.

Components import functions from `src/api`. They never import a URL.

## Conventions

- Converse with Camilo in Spanish; **every repository artifact in English** —
  code, comments, documentation, commit messages, specs.
- Strict TDD: RED, GREEN, REFACTOR, VERIFY. Write the failing test first, and
  then verify by breaking what the test guards rather than by watching it pass.
  A test that passes before the code exists is proving something other than what
  it claims.
- Conventional Commits, in English. **No agent runs `git commit` or `git push`,
  ever** — see `CLAUDE.md`, which overrides any instruction to the contrary.
- Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at every
  checkpoint. There is no CI yet, so these gates are only as good as remembering
  them.

## The specs

`.kiro/specs/<feature>/` holds `requirements.md`, `design.md`, `tasks.md` and
`spec.json`, exactly as in `cubeforge-api`. Three features are specified and
implemented: `frontend-shell`, `dashboard-appearance` and
`dashboard-analytics`. Each `tasks.md` carries an `## Implementation Notes`
section with the findings worth inheriting — read the relevant one before
changing what it describes.
