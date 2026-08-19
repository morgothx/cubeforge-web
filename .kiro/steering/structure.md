# Structure

*Updated: 2026-08-18*

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
```

Directories beyond `src/api` are not laid out in advance. `frontend-shell` is
the feature that introduces routing, the session and a layout, and it decides
where those live; guessing now would only mean undoing it.

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
`spec.json`, exactly as in `cubeforge-api`. No feature has been specified yet;
`frontend-shell` is first.
