# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Nooc is a monolithic Next.js 14 (App Router) workspace reservation marketplace. Single deployable — no microservices, no Docker.

### Key commands

See `package.json` scripts and `README.md` for full list. Quick reference:

| Task | Command |
|---|---|
| Dev server | `npm run dev` (port 3000) |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Tests | `npm test -- --run` |
| Prisma generate | `npx prisma generate` |

### Gotchas

- **ESLint config**: The repo ships without an `.eslintrc.json`. On first `npm run lint`, Next.js prompts interactively. Create `.eslintrc.json` with `{"extends": "next/core-web-vitals"}` before running lint to avoid the interactive prompt.
- **`lib/stripe.ts` throws at import time** if `STRIPE_SECRET_KEY` is not set. This blocks the dev server from compiling any page that transitively imports it. Set a dummy value in `.env` (e.g. `STRIPE_SECRET_KEY=sk_test_dummy`).
- **`.env` file is required** — copy `.env.example` and add at minimum: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Dummy values work for running the dev server and tests (tests mock externals).
- **Prisma client must be generated** after `npm install` — run `npx prisma generate`. The generated client is not committed.
- **Node 20.19+ is required to run the tests.** `jsdom@27` (used by every `@vitest-environment jsdom` test) needs `^20.19 || ^22.12 || >=24`. On Node 18 the jsdom worker dies with `ERR_REQUIRE_ESM` from `html-encoding-sniffer` and *every* component test fails to start — that is a local Node version problem, not a repo bug. `.nvmrc` pins the CI version; run `nvm use` first.
- **Pre-existing test failures (as of 2026-08-12)**: 6 failures across `__tests__/api/venues-availability.test.ts`, `__tests__/business/availability-label.test.ts`, and `__tests__/e2e/venue-open-status.test.ts`. They are time- and timezone-sensitive (the count changes under `TZ=UTC`), so they pass or fail depending on when you run them. CI on `main` is currently red for this reason. Check these against a clean tree before assuming your change caused them.
- **No local database needed for tests** — all tests mock Prisma. The dev server will show DB connection errors in the console but pages that don't hit the DB will render fine with dummy `DATABASE_URL`.
- **Node.js 22** is used in CI (`.github/workflows/ci.yml`).
