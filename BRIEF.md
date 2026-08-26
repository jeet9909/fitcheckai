# FitCheck AI — Brief

## Status: Phase 2 (full site). Phase 1 (validation MVP) is shipped and live.

Phase 1 shipped a single static page (upload photo + garment → AI try-on preview,
no auth, no DB) to validate the core bet before investing in a full platform. It's
live at https://fitcheckai-9if.pages.dev, backed by `functions/api/tryon.ts` (an
AI-provider adapter — currently Eden AI preferred, Gemini fallback, chosen by
whichever `*_API_KEY` env var is present) and `functions/api/feedback.ts`. That
code stays as-is and becomes the "Free tier" feature of the full site — **do not
rewrite the try-on/feedback logic or its request/response contract**; wire pages
around it.

**Which AI provider/model actually powers generation is explicitly deferred** —
both current provider integrations are hitting billing/quota walls (Gemini
free-tier rate limit, Eden AI needs funding) and that's fine for now. Don't spend
build effort on this; the adapter pattern already makes swapping trivial later.

## Origin / product idea
See `J:\Raw Input\` for the hand-made proof of concept this is based on: a real
reference photo of a person turned into a convincing image of that same person
wearing a different garment. The product: an AI try-on + fit-confidence layer
between shoppers and the stores they already use.
- **Free tier:** upload a photo + a garment → see yourself wearing it. (Shipped.)
- **Pro tier:** a 3D model of the user built from multiple photos, viewable from
  any angle wearing the outfit. **Not being built for real in this phase** — see
  below.

## What Phase 2 adds

### 1. Full multi-page site
Turn the single utility page into a real product: a landing/home page, the
existing try-on flow (now under something like `/studio`), a pricing page showing
Free vs Pro tiers honestly, an account area (sign up / log in / profile / manage
subscription), and a "Studio 3D" section for the Pro tier.

### 2. Real accounts
Sign-up, log-in, sessions. This needs a database — use **Cloudflare D1**
(SQLite-compatible, binds natively into Pages Functions, same "buy/managed,
zero-new-infra" approach as the rest of this stack — no Postgres/Docker). Store
users, password hashes (use the Workers runtime's Web Crypto SubtleCrypto for
hashing — no external auth service required for this scope), and sessions.
Keep it simple: email + password is sufficient; no social login, no email
verification flow required for this phase (note it as a follow-up, don't build
it now).

### 3. Real payments — Stripe, **test mode only**
A Pro subscription via Stripe Checkout, in **test mode** (test API keys, test
card numbers) so it can be exercised end-to-end without moving real money. Needs:
- A Checkout Session created server-side (Pages Function) for the Pro plan.
- A webhook handler (Pages Function) that verifies Stripe's signature and updates
  the user's subscription status in D1 on `checkout.session.completed` /
  subscription-updated / subscription-deleted events.
- Pro-gated UI (the Studio 3D waitlist section, any "Pro" badge/upsell) driven by
  that stored subscription status.
- **No Stripe keys are available yet.** Wire the integration for real via env
  vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, likely a publishable key on
  the client for Checkout redirect), but when they're absent, fail honestly (same
  pattern already established for `GEMINI_API_KEY`/`EDENAI_API_KEY` in
  `tryon.ts`: a clear "payments not yet configured" state — never a fake
  "upgraded" status, never a broken checkout button with no explanation).

### 4. Pro tier / "Studio 3D" — honest placeholder, not real 3D
Do **not** build real 3D body reconstruction in this phase — it needs a licensed
body model (SMPL-X has real licensing cost), GPU-hosted inference, and a 3D
viewer; that's a separate, much larger project. Instead: a well-designed "Studio
3D — coming soon" section explaining what it'll do, gated behind being logged in
as a Pro subscriber (or offering a waitlist capture for non-Pro users). This
mirrors the old `fitcart-ai` project's own already-made decision (D-002: MVP 360°
is a multi-angle render set, not real-time 3D) — don't re-litigate it here.

## Explicitly OUT of scope for Phase 2
Real 3D generation, live/production Stripe payments, email verification, social
login, password reset flow, mobile app, cross-store catalog, cart/checkout
handoff, Fit/Outfit Score engines. These are real and documented in the old
`fitcart-ai/MASTER_BUILD_GUIDE.md` for later — not being rebuilt now.

## Constraints
- **Database:** Cloudflare D1. Add the binding to `wrangler.toml`, write
  migrations, keep schema minimal (users, sessions, subscriptions — nothing the
  brief doesn't call for).
- **Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, session-signing
  secret — all server-side only, same discipline already established (never in
  client code, never logged, never committed — `.dev.vars` stays gitignored,
  `.dev.vars.example` stays a safe empty template).
- **Security is high-stakes here** — this phase adds real auth (password
  handling, session management) and real payment webhook handling for the first
  time. The security review pass on this phase needs to be thorough: password
  hashing correctness, session fixation/hijacking, webhook signature
  verification, SQL injection via D1 queries (use parameterized queries), CSRF on
  state-changing routes.
- Keep the existing `functions/api/tryon.ts` / `functions/api/feedback.ts` and
  their contracts untouched; new pages/functions are additive.
- Deploy target stays Cloudflare Pages, project `fitcheckai`, same repo
  (`git@github.com:jeet9909/fitcheckai.git`).

## Success signal for Phase 2
A real visitor can land on the site, understand what it does, try the free
generation flow, sign up, log in, see the pricing page, go through a Stripe
*test-mode* checkout for Pro, and see their account reflect Pro status — with the
3D feature honestly presented as coming soon rather than faked.
