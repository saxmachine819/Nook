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
- **1 pre-existing test failure** in `__tests__/api/stripe-webhook.test.ts` ("should finalize existing reservation instead of creating a new one") — this is a known issue in the codebase, not an environment problem.
- **No local database needed for tests** — all tests mock Prisma. The dev server will show DB connection errors in the console but pages that don't hit the DB will render fine with dummy `DATABASE_URL`.
- **Node.js 22** is used in CI (`.github/workflows/ci.yml`).
