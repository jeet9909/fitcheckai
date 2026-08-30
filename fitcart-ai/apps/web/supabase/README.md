# FitCart AI — Supabase backend setup

One-time steps to go from placeholder env vars to a live backend.

1. **Create a Supabase project** at supabase.com (free tier is enough to start).

2. **Run the schema.** Dashboard → SQL Editor → New query → paste the full contents of `schema.sql` → Run.

3. **Enable Google OAuth.** Dashboard → Authentication → Providers → Google → toggle on, then supply a Google Cloud OAuth 2.0 Client ID + Secret (create one at console.cloud.google.com → APIs & Services → Credentials → OAuth client ID → Web application; add the Supabase callback URL shown in the provider panel as an authorized redirect URI).

4. **Install the Supabase CLI** (`npm i -g supabase`) and link this project: `supabase login`, then `supabase link --project-ref <your-project-ref>` from `fitcart-ai/apps/web`.

5. **Set Edge Function secrets:**
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<from Dashboard -> Project Settings -> API>
   ```
   (`SUPABASE_URL` is injected automatically into Edge Functions — no need to set it.)

6. **Deploy the four Edge Functions:**
   ```
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase functions deploy fetch-product
   supabase functions deploy create-render
   ```
   `create-render` (the Setup → Processing → Result backend) also takes an
   optional `FAL_API_KEY` secret for real try-on inference — omit it and it
   falls back to a mock passthrough render, useful for testing the rest of
   the pipeline (upload, quota, verdict, save) without a paid key.

6b. **Enable anonymous sign-ins.** Dashboard → Authentication → Providers → Anonymous Sign-Ins → toggle on. Required for the "2 free looks, no signup" guest flow (`src/state/AuthState.tsx`) — without it, guests get no session at all and Setup's photo upload will fail.

7. **Point a Stripe webhook at `stripe-webhook`.** Stripe Dashboard (test mode) → Developers → Webhooks → Add endpoint → URL is `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` → events: `checkout.session.completed`, `customer.subscription.updated`. Copy the signing secret into step 5's `STRIPE_WEBHOOK_SECRET`.

8. **Give the frontend the project URL/key.** Locally: copy `.env.example` to `.env.local` in `fitcart-ai/apps/web` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. For the GitHub Pages deploy: add both as repo secrets (Settings → Secrets and variables → Actions) and reference them in `.github/workflows/deploy.yml`'s build step — this is a deliberate decision to make (see the PR/commit description for the open question of whether to keep the mock-API fallback for signed-out visitors once this is live).

## Known limitations

- The `fetch-product` parsers are plain-`fetch` HTML scrapers with no headless browser. Several target stores render price and size-chart data via client-side JS, which a plain fetch never sees — those parsers fall back to JSON-LD (`schema.org/Product`) when the page includes it, and return `null` otherwise. This is a structural ceiling, not a bug — a headless-browser fetch service would be a separate, heavier follow-up.
- Each parser file has a comment noting what to check in that store's `robots.txt` before pointing real traffic at it. Amazon and Flipkart's terms are the most restrictive of the six — their parsers are included for architecture completeness but should likely stay off in production in favor of their affiliate APIs.
- Because no parser above populates a structured `size_chart`, `create-render`'s verdict engine (`functions/create-render/verdict.ts`) can't do real per-garment measurement matching yet — it uses the guest/user's height & weight when present and a generic estimate otherwise. Revisit once a parser (or a headless-browser service) actually extracts numeric size-chart data.
- `functions/create-render/tryon.ts`'s fal.ai (`fal-ai/idm-vton`) request shape is **unverified against a live key** — it's a starting point for the model bake-off `ai/virtual-try-on.md` calls for, not a confirmed integration. Test it with a real `FAL_API_KEY` before relying on it.
- Billing is not fully hardened yet: day/year passes never expire in `stripe-webhook` (a `current_period_end` needs to be set at insert time, not just tracked), there's no `payment_failed`/`subscription.deleted` handling, and no `create-portal-session` function for a subscriber to self-serve cancel.
- The product-wishlist heart icon (`toggleSave`, on Discover/ProductDetail) is still backed by the pre-Supabase local mock (`src/lib/mockBackend.ts`) and is disconnected from `saved_looks` (the real saved-render table `Result.tsx`'s Save button writes to) — `Saved.tsx` only reads the former, so a saved render isn't actually visible there yet. Needs unifying onto one Supabase-backed table.
- `Result.tsx`'s Buy button doesn't attach an affiliate tag or log the click — the day-one revenue stream in `docs/monetization.md` has no backend behind it yet.
