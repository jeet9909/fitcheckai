# Marketing Website Specification

> The front door. A visual product dies without a place to show the demo and earn trust. Ships **at MVP launch**. Companion: `docs/product-surfaces.md`, `docs/guest-trial-strategy.md`.

## 1. Goals (in priority order)
1. **Convert** visitors → **app install** or **web "Explore as Guest"** trial.
2. **Explain** the product fast (the aha in one scroll).
3. **Build trust** — privacy-first (body data), honest capability.
4. **Rank** in search (SEO) for fit/try-on/fashion-shopping intent.
5. **Support** press, investors, partners, hiring.

## 2. Primary conversion actions
- **"Try it free — no login"** → launches the **web Guest Explore** (`web/web-app.md`).
- **"Get the app"** → App Store / Play Store.
- Secondary: newsletter/waitlist, "For Brands" (B2B SDK lead), investor deck request.

## 3. Page map
| Page | Purpose | Key elements |
|---|---|---|
| **Home** | Hook + convert | Hero demo (avatar rotate + fit score), value props, "Try free," social proof, trust strip |
| **How it works** | Explain the loop | Upload → avatar → try-on → fit/outfit → buy; honest accuracy note |
| **Features** | Depth | Fit intelligence, outfit intelligence, cross-store, 360° preview, inclusivity |
| **Privacy & Trust** | De-risk body upload | Plain-language DPDP/consent/deletion; "your photos, your control" |
| **For Brands (B2B)** | SDK lead-gen | Fit-SDK pitch, contact (V2/V3 seed) |
| **Pricing** | Free vs Pro | Guest/free vs Pro; honest limits |
| **Blog / Guides** | SEO + authority | Sizing guides, outfit tips, fit science |
| **About / Careers** | Trust + hiring | Team, mission, roles |
| **Press / Investors** | Inbound | Deck request, one-pager |
| Legal | Compliance | Privacy policy, terms, grievance officer (DPDP) |

## 4. Hero concept (the one-scroll aha)
```
┌───────────────────────────────────────────┐
│  Try it on. Before you buy. Across every   │
│  store you shop.                           │
│  [ ▶ live avatar rotating in an outfit ]   │
│  Fit 8.6/10 · Outfit 8.1/10                │
│  [ Try free — no login ]  [ Get the app ]  │
│  🔒 Your photos stay private. Delete anytime│
└───────────────────────────────────────────┘
```

## 5. Tech recommendation
- **Framework:** **Next.js** (or **Astro** for max static/SEO) — SSR/SSG for SEO + speed. Separate from the interactive web app (different needs: content/SEO vs app runtime).
- **Hosting/CDN:** Vercel/Cloudflare Pages + Cloudflare CDN.
- **CMS:** lightweight headless (Sanity/Contentlayer/MDX) for blog/guides.
- **Analytics:** privacy-safe (no body data ever touches marketing analytics); consent banner for cookies (DPDP/GDPR).
- **Perf:** Core Web Vitals green; India mobile-first, data-light, fast on 4G.

## 6. SEO strategy
- Target intent: *"virtual try-on India," "will this size fit me," "outfit builder," "[brand] size guide."*
- Content engine: sizing/fit/outfit guides (also feed the outfit-intelligence brand authority).
- Structured data, fast pages, localized (India-first; English + later Hindi/regional).

## 7. Trust & compliance on the site
- Prominent, plain-language **privacy explainer** (body data) — a conversion tool, not fine print.
- Cookie consent; published **privacy policy, terms, grievance officer** (DPDP requirement).
- No dark patterns; honest claims (no "perfect 3D," no "syncs to your store cart" — say what's true).

## 8. Revenue linkage
- Every outbound product/demo path preserves **affiliate attribution**.
- "Try free" routes to guest Explore (cost-guarded per `docs/guest-trial-strategy.md`).
- "For Brands" seeds the **B2B SDK** pipeline (high-margin future).

## 9. Success metrics
Visit → "Try free" click · Visit → install · Guest-explore start rate · Organic traffic growth · Brand-lead submissions · bounce/Core Web Vitals.

## 10. Build effort
Small: a P0 marketing site is a **1–2 week** effort for one front-end dev + design, reusing the demo assets from the app. Ships alongside the MVP pilot.
