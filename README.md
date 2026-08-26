# FitCheck AI — Backend (Cloudflare Pages Functions)

Serverless backend for FitCheck AI. Phase 2 adds real accounts (Cloudflare D1) and
real Stripe payments (test mode) on top of the Phase 1 try-on MVP — see `BRIEF.md`
for full product context. This repo owns `functions/` (the API); a frontend engineer
owns `public/` (the static site) in parallel.

## Endpoints

- `POST /api/tryon` — accepts a base64-encoded person photo + garment photo, calls
  Gemini (`gemini-2.5-flash-image`) or Eden AI to composite the garment onto the
  person, and returns the resulting image.
- `POST /api/feedback` — captures the "does this look like you / would it affect a
  purchase" signal. Logged as a structured JSON line (no KV/DB), readable via
  `wrangler pages deployment tail`.
- `POST /api/waitlist` — captures a Studio 3D waitlist signup (email + timestamp).
  Logged the same way as feedback — no DB table.
- `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/session` — email/password accounts backed by D1, with
  HMAC-signed, `HttpOnly`/`Secure`/`SameSite=Lax` session cookies (30-day
  lifetime). Passwords are hashed with PBKDF2-HMAC-SHA256 (100k iterations,
  random salt) via the Workers runtime's native `crypto.subtle` — no external
  auth service.
- `POST /api/billing/checkout`, `POST /api/billing/portal`,
  `POST /api/billing/webhook` — Stripe Checkout (subscription mode, test mode
  only) and Billing Portal sessions, plus the webhook that keeps a user's
  subscription status in D1 in sync with Stripe. All mutating auth/billing
  routes reject cross-origin POSTs via a same-origin check on the `Origin`
  header (CSRF defense, alongside `SameSite=Lax` cookies).

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the example vars file and fill in your keys:
   ```
   cp .dev.vars.example .dev.vars
   ```
   Then edit `.dev.vars` and set at least `GEMINI_API_KEY=<your key>` and
   `SESSION_SECRET=<any long random string>` (required for `/api/auth/*` to mint
   session cookies — without it those routes honestly respond `503
   { "status": "not_configured" }` rather than a broken login). `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` are only needed to exercise
   `/api/billing/*`; leave them blank otherwise. `.dev.vars` is gitignored and must
   never be committed.
3. Apply the D1 migration locally (creates `users`/`sessions`/`subscriptions` in the
   local SQLite file `wrangler pages dev` uses):
   ```
   npx wrangler d1 execute fitcheckai-db --file=migrations/0001_init.sql
   ```
4. Run the dev server (serves `public/` + `functions/` together):
   ```
   npm run dev
   ```
5. Type-check the Functions code at any time:
   ```
   npm run typecheck
   ```

If `GEMINI_API_KEY`/`EDENAI_API_KEY` are not set, `/api/tryon` correctly responds
`503 { "status": "not_configured" }` instead of attempting a call or faking a result.
The same honest-failure pattern applies to `/api/auth/*` (needs `SESSION_SECRET`) and
`/api/billing/*` (needs `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`).

## Database (Cloudflare D1)

Schema lives in `migrations/0001_init.sql` (three tables: `users`, `sessions`,
`subscriptions` — kept intentionally minimal per `BRIEF.md`). `wrangler.toml`'s
`[[d1_databases]]` block currently has a **placeholder** `database_id`; before this
works against a real (non-local) database, create it once and swap the id in:

```
npx wrangler d1 create fitcheckai-db
```

That command prints a `database_id` — paste it into `wrangler.toml` in place of
`REPLACE_WITH_REAL_D1_DATABASE_ID`. Then apply the migration:

```
# Local (used by `wrangler pages dev`):
npx wrangler d1 execute fitcheckai-db --file=migrations/0001_init.sql

# Production:
npx wrangler d1 execute fitcheckai-db --file=migrations/0001_init.sql --remote
```

Future schema changes should be added as new numbered migration files
(`0002_*.sql`, etc.) rather than editing `0001_init.sql` in place, so existing
deployed databases can be migrated forward without data loss.

## Secrets

Server-side only, never in client code, never logged, never committed:

- `EDENAI_API_KEY` / `EDENAI_MODEL` / `GEMINI_API_KEY` — AI try-on provider (Phase 1).
- `SESSION_SECRET` — HMAC key used to sign session cookies. Required for
  `/api/auth/*` to issue sessions.
- `STRIPE_SECRET_KEY` — Stripe **test-mode** secret key (`sk_test_...`). Required for
  `/api/billing/checkout` and `/api/billing/portal`.
- `STRIPE_WEBHOOK_SECRET` — signing secret for the Stripe CLI/dashboard webhook
  endpoint pointed at `/api/billing/webhook` (`whsec_...`). Required for the webhook
  to accept events (it verifies `Stripe-Signature` before trusting anything in the
  body).
- `STRIPE_PRICE_ID` — the test-mode Price id for the Pro subscription plan
  (`price_...`), used when creating Checkout Sessions.

## Deploying to Cloudflare Pages

1. In the Cloudflare dashboard, create a new Pages project connected to the GitHub
   repo `jeet9909/fitcheckai`.
2. Build settings:
   - Build command: (none)
   - Build output directory: `public`
3. Create the D1 database (see "Database" above) and bind it in the Pages project's
   **Settings → Functions → D1 database bindings** (binding name `DB`), or update
   `wrangler.toml`'s `database_id` and redeploy.
4. In the Pages project's **Settings → Environment variables**, add `GEMINI_API_KEY`
   and, once available, `SESSION_SECRET`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_ID` as **encrypted** environment
   variables (Production and Preview as needed). Do not put any of these in a
   committed file.
5. Deploy. Every push to the connected branch triggers a new deployment.

Until a given secret is set in the Pages dashboard, the corresponding feature
honestly reports `not_configured` (image generation, accounts, or payments,
respectively) rather than a fake or broken result.

## Manual deploy (optional)

```
npm run deploy
```

This runs `wrangler pages deploy public` directly, using your local `wrangler` auth
instead of the GitHub integration.
