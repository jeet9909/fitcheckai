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

7b. **(Optional) Enable live Amazon/Flipkart search on Discover.** `search-products` powers the "search live listings" box — without credentials it correctly returns "not configured" rather than any placeholder data (that's deliberate, not a bug to work around). To turn it on:
   - **Amazon Product Advertising API**: apply for an Amazon Associates account, then request PA-API access from Associates Central. Amazon only grants PA-API credentials once the account has 3+ qualifying sales in the trailing 180 days — a brand-new account will be rejected regardless of how correct the integration code is. Once approved, set:
     ```
     supabase secrets set AMAZON_PAAPI_ACCESS_KEY=...
     supabase secrets set AMAZON_PAAPI_SECRET_KEY=...
     supabase secrets set AMAZON_PAAPI_PARTNER_TAG=...
     ```
     (Optional overrides for a non-India marketplace: `AMAZON_PAAPI_HOST`, `AMAZON_PAAPI_REGION`, `AMAZON_PAAPI_MARKETPLACE` — defaults target `amazon.in`.)
   - **Flipkart Affiliate API**: apply at affiliate.flipkart.com. Once approved, set:
     ```
     supabase secrets set FLIPKART_AFFILIATE_ID=...
     supabase secrets set FLIPKART_AFFILIATE_TOKEN=...
     ```
   - Myntra, AJIO, Meesho, and Nykaa Fashion have no public catalog/search API — they stay on `fetch-product`'s paste-a-link flow (Home page) rather than the Discover search box.

8. **Give the frontend the project URL/key.** Locally: copy `.env.example` to `.env.local` in `fitcart-ai/apps/web` and fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. For the GitHub Pages deploy: add both as repo secrets (Settings → Secrets and variables → Actions) and reference them in `.github/workflows/deploy.yml`'s build step — this is a deliberate decision to make (see the PR/commit description for the open question of whether to keep the mock-API fallback for signed-out visitors once this is live).

## Known limitations

- The `fetch-product` parsers are plain-`fetch` HTML scrapers with no headless browser. Several target stores render price and size-chart data via client-side JS, which a plain fetch never sees — those parsers fall back to JSON-LD (`schema.org/Product`) when the page includes it, and return `null` otherwise. This is a structural ceiling, not a bug — a headless-browser fetch service would be a separate, heavier follow-up.
- **Confirmed against real live product pages (2026-09-01), all six target stores currently fail**, each in a different way, all consistent with the point above:
  - Meesho, AJIO, Nykaa Fashion: the fetch itself is rejected with `403` (server-side bot detection blocking the request before any HTML is returned).
  - Myntra: the fetch fails at the HTTP/2 protocol level (`stream error ... unexpected internal error`) — Akamai-style edge mitigation resetting the connection, not a code bug.
  - Amazon, Flipkart: the fetch itself succeeds (`200`), but the parser can't extract anything (`422 Could not parse this page`) — almost certainly a bot-check/placeholder page served instead of real content, not the real product page a browser sees.
  - None of this is fixable by tweaking headers/User-Agent — it's the sites' bot detection (Akamai/Cloudflare-class), the same reason PA-API/the affiliate program exist as the *intended* route for Amazon/Flipkart. Making the others work for real would need a headless-browser fetch (real Chrome, not a plain `fetch()`) and likely rotating egress IPs — a materially bigger, costlier undertaking than this scraper, and one to decide on deliberately rather than assume.
- Each parser file has a comment noting what to check in that store's `robots.txt` before pointing real traffic at it. Amazon and Flipkart's terms are the most restrictive of the six — their parsers are included for architecture completeness but should likely stay off in production in favor of their affiliate APIs.
- `search-products`'s Amazon PA-API request signing (AWS Signature V4, `amazonPaapi.ts`) and its Flipkart Affiliate API request (`flipkartAffiliate.ts`) are both implemented from each provider's published API spec but **unverified against a live account** — neither has been exercised against real credentials. Confirm both once you have approved accounts; a signing bug would most likely surface as an auth-rejection from Amazon, not silently-wrong data.
- `search-products` only covers Amazon and Flipkart because those are the only two of the six target stores with a public product-search API at all. There is no bulk multi-item search for Myntra/AJIO/Meesho/Nykaa Fashion — only the existing single-URL `fetch-product` paste flow.
