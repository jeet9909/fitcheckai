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
   supabase functions deploy search-products
   ```

7. **Point a Stripe webhook at `stripe-webhook`.** Stripe Dashboard (test mode) → Developers → Webhooks → Add endpoint → URL is `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` → events: `checkout.session.completed`, `customer.subscription.updated`. Copy the signing secret into step 5's `STRIPE_WEBHOOK_SECRET`.

7b. **(Optional) Enable live Amazon/Flipkart search on Discover.** `search-products` powers the "search live listings" box — without credentials (and without `MOCK_MARKETPLACES`, see below) it correctly returns `not_configured` per-provider rather than any placeholder data (that's deliberate, not a bug to work around). To turn it on:

   > **Why this section looks nothing like older Amazon integration writeups.** Amazon's Product Advertising API v5 (PA-API v5) was deprecated April 30, 2026 and fully retired May 15, 2026 — every PA-API v5 call now returns a hard `403 AccessDeniedException`, regardless of how correct the old AWS-SigV4-signed integration is. This migration to the **Amazon Creators API** (OAuth2, not AWS request signing) was necessitated by that retirement, not a stylistic preference. If you find PA-API v5 setup instructions elsewhere (older blog posts, AI-generated code, etc.), they will not work against a live account anymore. Sources:
   > - https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
   > - https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi
   > - https://dev.to/th3nate/amazon-pa-api-v5-is-shutting-down-april-30-2026-here-is-what-changes-at-the-auth-layer-22ek

   - **Amazon Creators API**: apply for an Amazon Associates account, then create a Creators API app at Associates Central -> Tools -> CreatorsAPI -> Create App to get a Client ID (`amzn1.application-oa2-client...`) and Client Secret — these are OAuth2 credentials, not AWS Access/Secret Keys, and old PA-API keys do not carry over. **Eligibility bar is materially harder than PA-API v5's old rule and must be actively maintained, not just reached once**: Creators API requires **10+ qualified sales in the trailing 30 days** (PA-API v5 required only 3+ sales in the trailing 180 days) — this is a rolling window, so access is temporarily revoked if any 30-day period passes with fewer than 10 qualifying sales, even for a previously-approved account. Once approved, set:
     ```
     supabase secrets set AMAZON_CREATORS_CLIENT_ID=...
     supabase secrets set AMAZON_CREATORS_CLIENT_SECRET=...
     supabase secrets set AMAZON_CREATORS_PARTNER_TAG=...
     ```
     Optional overrides:
     ```
     supabase secrets set AMAZON_CREATORS_TOKEN_URL=https://api.amazon.com/auth/o2/token
     supabase secrets set AMAZON_CREATORS_MARKETPLACE=www.amazon.in
     ```
     `AMAZON_CREATORS_TOKEN_URL` defaults to the standard Login-with-Amazon token endpoint. **Unverified**: we could not confirm during this integration pass whether the India marketplace requires a region-specific token host — confirm against your actual Associates Central region docs before relying on the default in production, and override via this secret if it differs.
   - **Flipkart Affiliate API**: apply at affiliate.flipkart.com — unchanged, still current (confirmed against the [official docs](https://affiliate.flipkart.com/api-docs/af_prod_ref.html)). Once approved, set:
     ```
     supabase secrets set FLIPKART_AFFILIATE_ID=...
     supabase secrets set FLIPKART_AFFILIATE_TOKEN=...
     ```
   - Myntra, AJIO, Meesho, and Nykaa Fashion have no public catalog/search API — they stay on `fetch-product`'s paste-a-link flow (Home page) rather than the Discover search box.

7c. **(Optional, dev/demo only) Mock marketplace mode.** If you want Discover's search box to return something without either affiliate account approved yet, set:
   ```
   supabase secrets set MOCK_MARKETPLACES=true
   ```
   With this on, `search-products` skips real Amazon/Flipkart calls entirely and returns fake listings (obviously-fake `example.com` URLs, tagged `source: 'mock'` in the response and persisted as `amazon-mock`/`flipkart-mock` in the `products.source` column — see `schema.sql`). **Never set this on a production Supabase project** — there is no structural separation between mock and real catalog rows beyond that string tag, so a real+mock collision would let demo rows silently blend into the real catalog. Every invocation while this is active logs a loud warning server-side.

7d. **Request/response contract.** `search-products` takes `{ query: string, marketplace?: 'amazon' | 'flipkart' | 'all' }` (`marketplace` defaults to `'all'`) and always responds `200` for a well-formed request — per-provider outcomes (including `not_configured` or an upstream failure) live inside the `providers` object, not the HTTP status, so one provider's trouble never masks the other's results:
   ```jsonc
   {
     "query": "men's shirt",
     "mock": false,
     "results": [ /* merged StoreListing[] across all queried providers */ ],
     "providers": {
       "amazon":   { "status": "success", "count": 4, "upserted": 4 },
       "flipkart": { "status": "not_configured", "count": 0, "upserted": 0, "message": "Flipkart search isn't connected yet." }
     }
   }
   ```
   `400` is returned only for malformed input (missing/empty `query`, `query` over 200 characters, or an unrecognized `marketplace` value). `500` is returned only for a genuine unhandled error, with a sanitized client-facing message — full detail (which may include upstream response bodies) goes to `console.error` server-side only, never to the client or logged verbatim with un-sanitized input.

8. **Give the frontend the project URL/key.** Locally: copy `.env.example` to `.env.local` in `fitcart-ai/apps/web` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. For the GitHub Pages deploy: add both as repo secrets (Settings → Secrets and variables → Actions) and reference them in `.github/workflows/deploy.yml`'s build step — this is a deliberate decision to make (see the PR/commit description for the open question of whether to keep the mock-API fallback for signed-out visitors once this is live).

## Known limitations

- The `fetch-product` parsers are plain-`fetch` HTML scrapers with no headless browser. Several target stores render price and size-chart data via client-side JS, which a plain fetch never sees — those parsers fall back to JSON-LD (`schema.org/Product`) when the page includes it, and return `null` otherwise. This is a structural ceiling, not a bug — a headless-browser fetch service would be a separate, heavier follow-up.
- **Confirmed against real live product pages (2026-09-01), all six target stores currently fail**, each in a different way, all consistent with the point above:
  - Meesho, AJIO, Nykaa Fashion: the fetch itself is rejected with `403` (server-side bot detection blocking the request before any HTML is returned).
  - Myntra: the fetch fails at the HTTP/2 protocol level (`stream error ... unexpected internal error`) — Akamai-style edge mitigation resetting the connection, not a code bug.
  - Amazon, Flipkart: the fetch itself succeeds (`200`), but the parser can't extract anything (`422 Could not parse this page`) — almost certainly a bot-check/placeholder page served instead of real content, not the real product page a browser sees.
  - None of this is fixable by tweaking headers/User-Agent — it's the sites' bot detection (Akamai/Cloudflare-class), the same reason PA-API/the affiliate program exist as the *intended* route for Amazon/Flipkart. Making the others work for real would need a headless-browser fetch (real Chrome, not a plain `fetch()`) and likely rotating egress IPs — a materially bigger, costlier undertaking than this scraper, and one to decide on deliberately rather than assume.
- Each parser file has a comment noting what to check in that store's `robots.txt` before pointing real traffic at it. Amazon and Flipkart's terms are the most restrictive of the six — their parsers are included for architecture completeness but should likely stay off in production in favor of their affiliate APIs.
- `search-products`'s Amazon Creators API OAuth2 request (`amazonPaapi.ts`) and its Flipkart Affiliate API request (`flipkartAffiliate.ts`) are both implemented from each provider's published API spec but **unverified against a live account** — neither has been exercised against real credentials. Confirm both once you have approved accounts. The Amazon token endpoint host in particular (`AMAZON_CREATORS_TOKEN_URL`) is a judgment call for the India marketplace — see 7b above.
- `search-products` only covers Amazon and Flipkart because those are the only two of the six target stores with a public product-search API at all. There is no bulk multi-item search for Myntra/AJIO/Meesho/Nykaa Fashion — only the existing single-URL `fetch-product` paste flow.
- **Outbound-link allowlist.** `search-products` drops (logs + omits, doesn't error the whole provider) any listing whose `productUrl` isn't on that store's allowlisted domain set (`urlAllowlist.ts`: Amazon must be `*.amazon.in` or `amzn.to`; Flipkart must be `*.flipkart.com`, `fkrt.it`, or `dl.flipkart.com`) — defense against a compromised/buggy upstream response smuggling an untrusted outbound link into the catalog. This check is skipped for mock-mode listings (which intentionally point at `example.com`).
- **Tests.** `orchestrator.ts`, `mockData.ts`, `urlAllowlist.ts`, `amazonPaapi.ts`, and `flipkartAffiliate.ts` each have a `*.test.ts` file using Deno's built-in test runner with `globalThis.fetch` mocked — no real Amazon/Flipkart network calls happen. Run from `supabase/functions/search-products`:
  ```
  deno test --allow-env
  ```
