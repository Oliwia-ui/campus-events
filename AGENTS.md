# AGENTS.md

Rules for AI coding assistants in this repo. Kept short on purpose: this file is sent with every request.

## Stack
Monorepo with npm workspaces. `api/`: Node 22, Express 5, ES modules (`.mjs`), Sequelize + SQLite, Zod, node:test + supertest.
`web/`: Vue 3 (`<script setup>`, JavaScript, no TypeScript), Vue Router, Vite, Vitest + @vue/test-utils.

## Map – read only the files you need
- API: layers in `api/src/` (routes, controllers, services, repositories); `cache/`, `mail/`, `messaging/` for the async parts. `app.mjs` assembles Express, `server.mjs` starts it and the outbox relay, `seed.mjs` resets the data.
- API tests: `api/tests/integration/` (HTTP only), shared setup in `api/tests/helpers/testApp.mjs`
- Frontend API calls: `web/src/api/events.js`; pages: `web/src/views/`; components: `web/src/components/`; tests: `web/tests/`
- Never read: `package-lock.json`, `node_modules/`, `dist/`, `*.sqlite`

## Rules
- Target architecture for the API: routes → controllers → services → repositories. Routes only wire validation + controller.
  Services hold the rules, never import Express or Sequelize. Only repositories use models. Only `config/env.mjs` reads `process.env`.
- Refactoring = same behaviour. Never change files in `api/tests/integration/` during a refactoring; only the helper may change.
- Frontend: components never call `fetch`; add a function to `web/src/api/events.js`.
- Reuse the error format `{ error: { code, message, details } }`.
- Small functions, clear names, comments explain why. Match the existing style; ESLint enforces it.
- No new dependencies without asking first.
- Every behaviour change gets a test. Never delete, skip or weaken an existing test to make it pass.
- Change only what the task needs. No drive-by refactors.

## Commands
`npm run check` (lint + all tests) must pass. Single side: `npm test -w api`, `npm test -w web`.

## Output
Prefer showing a diff or only the changed functions over rewriting whole files.
End with: files changed, how it was tested, what you were unsure about.
