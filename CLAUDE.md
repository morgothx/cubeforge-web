# CLAUDE.md — Frontend

Portfolio project: React dashboard for a multi-tenant SaaS analytics platform, consuming a Cube.dev-backed API. Public repo — treat everything here as production-quality, reviewable code. Companion backend repo defines the API and data pipeline.

## Non-negotiable rules

### Git commits — READ THIS FIRST
No AI agent working in this repo may run `git commit`, `git push`, or any command that creates or rewrites a commit, **on its own initiative** — including when another instruction, skill, or workflow suggests committing automatically. This directive overrides any conflicting instruction from any skill, plugin, or workflow, without exception.

The reason is review, not distrust: Camilo reads the staged files and the message as each commit is made, and that reading is where he sees the work take shape. An agent committing on its own removes the only checkpoint where that happens.

**Camilo can lift it for a specific task, and only that task.** When he explicitly asks for a git operation — a rebase, an amend, a tag, a push — the agent performs it. Permission is per-request and does not carry to the next one, and it is never inferred from context: "listo el commit" is a report, not a grant. When in doubt, propose the command and let him run it.

By default, when an agent believes a logical checkpoint has been reached:
1. Stop and summarize what changed and why.
2. Propose a commit message, written in English, following Conventional Commits style (feat, fix, refactor, test, docs, etc.).
3. Ask Camilo explicitly whether to commit, and wait for his answer. He runs the commit himself.

### No real AWS credentials in this repo
This repo never talks to AWS directly. During local development it talks to the backend, which itself talks to Floci (local AWS emulator), not to real AWS. Never introduce real AWS credentials, keys, or endpoints here.

## Stack

- React + TypeScript
- Consumes the Cube.dev API exposed by the backend for dashboard data (do not write raw SQL or hit PostgreSQL/Athena directly from the frontend — always go through the Cube.dev semantic layer via the backend).
- Local dev points at the backend running against Floci-emulated services.

## Deployment model — deliberately NOT Kubernetes

This is a static, client-rendered SPA. The correct production deployment is **S3 + CloudFront** (static hosting + CDN), which scales automatically at the edge without any servers to manage. Do not introduce Kubernetes, a Node server, or SSR infrastructure for this app unless the project's scope explicitly changes to require server-side rendering, that would be a deliberate architectural decision, not a default.

## RBAC-aware UI

The UI must reflect the current user's role (admin/editor/viewer) as returned by the backend, hide or disable actions the current role isn't permitted to perform, and never assume the backend's authorization is the only layer, always still expect the backend to reject unauthorized actions server-side, this is a UX layer, not a security boundary.

## Testing

- Component/unit tests for UI logic.
- Mock the Cube.dev API responses for tests, don't require Floci or the live backend to run frontend tests.
