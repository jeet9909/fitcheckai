# Platform API & Integration Feasibility Research

> **This is the single most important feasibility document in the repository.** The product's headline promise — "build an outfit here, sync it to the real store's cart" — lives or dies here. This document is deliberately pessimistic and evidence-based.

**Research date:** August 2026. **Method:** public documentation review + affiliate-network availability. Any claim not confirmed from a primary source is marked `UNVERIFIED`.

---

## 1. Executive verdict

> **There is no official, public API from any target Indian fashion platform that allows a third party to (a) read the live catalog, or (b) write to a user's server-side cart. The "unified cart sync" feature, as literally described, is NOT feasible via compliant means at MVP. It is `PARTNERSHIP REQUIRED` or `AUTOMATION-ONLY` (HIGH RISK).**

This does not kill the product. It reshapes the MVP: FitCart AI ships as a **try-on + outfit-intelligence + affiliate-deeplink** layer, and pursues true cart-sync through partnerships and (optionally) a user-consented browser extension later.

---

## 2. Per-platform capability matrix

Legend: ✅ available & compliant · ⚠️ conditional/limited · ❌ not available · 🔒 partner-only

| Capability | Myntra | Ajio | Amazon Fashion | Meesho | Flipkart | Nykaa Fashion |
|---|---|---|---|---|---|---|
| **Public product/catalog API** | ❌ | ❌ | ⚠️ PA-API* | ❌ | ❌ | ❌ |
| **OAuth login for 3rd parties** | ❌ | ❌ | ⚠️ Login-with-Amazon (not for shopping data) | ❌ | ❌ | ❌ |
| **Read user cart (API)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Write user cart (API)** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Checkout API** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Affiliate / deep-link program** | ✅ (via Admitad/Cuelinks/EarnKaro) | ✅ (via networks) | ✅ Amazon Associates + PA-API | ⚠️ limited | ✅ (via networks) | ✅ (via networks) |
| **Product data via affiliate feed** | ⚠️ network-provided feed | ⚠️ | ✅ PA-API (rate-limited) | ⚠️ | ⚠️ | ⚠️ |

\* **Amazon Product Advertising API (PA-API 5.0)** is the only genuine first-party product API in the set, but: it is gated behind the **Amazon Associates** program, requires **qualifying sales to keep access**, is **heavily rate-limited** (throughput tied to revenue), and its terms **restrict caching and display**. It returns catalog data, **not** cart-write ability. `MVP FEASIBLE (read-only, constrained)`.

---

## 3. What actually IS available (the compliant surface)

### 3.1 Affiliate networks (the realistic data + monetization path) — `MVP FEASIBLE`
Indian fashion retailers are reachable through aggregators — **Admitad, Cuelinks, EarnKaro, INRDeals, vCommission**. These provide:
- **Deep links** with affiliate attribution (user clicks → lands on the real product page → we earn commission on purchase).
- In some tiers, **product feeds** (title, image, price, URL) refreshed periodically — *not* real-time, *not* guaranteed complete, coverage varies by merchant.
- **Commission** typically ~5–10% depending on category and network (`UNVERIFIED` exact current rates; treat as directional).

**Implication:** FitCart AI can legally show products, images and prices (subject to feed terms), and monetize via commission — but the "catalog" is a *periodically-synced, partial mirror*, not a live store API.

### 3.2 Amazon PA-API 5.0 — `MVP FEASIBLE (constrained)`
Best-quality first-party product data in the set. Use it as the **reference/quality-anchor integration** to prove the product experience while affiliate feeds cover the rest.

### 3.3 Deep-link handoff for checkout — `MVP FEASIBLE`
Every platform supports being opened via URL / app deep-link to a product page. This is the compliant "checkout handoff": we cannot *place* items in their cart, but we can *route the user to the exact product* with our affiliate tag.

---

## 4. The three ways to attempt true "cart sync" — and their verdicts

| Approach | How it works | Verdict | Notes |
|---|---|---|---|
| **A. Official cart API** | Store exposes authenticated cart-write endpoints | ❌ **NOT FEASIBLE** — no such public API exists on any target platform | Would be ideal; does not exist |
| **B. Partner API** | Commercial agreement grants private endpoints | 🔒 **PARTNERSHIP REQUIRED** | Realistic only after we have traffic/leverage; long sales cycle |
| **C. Browser automation / headless session** | Drive the store's web/app session using the user's credentials to inject items | ⚠️ **AUTOMATION-ONLY / HIGH RISK** | **Violates ToS** on essentially every platform; breaks on UI changes, CAPTCHAs, bot-defense; requires holding user credentials → severe security & DPDP liability. **Not recommended for MVP.** |
| **D. User-consented browser extension** | User installs an extension that adds items to the cart *in their own browser session* (user-driven, not our server) | ⚠️ **HIGH RISK / conditional** | Shifts action to the user's own authenticated session (better legally than server-side automation) but still likely breaches ToS and is desktop-only; poor fit for a mobile-first product |

### Why we explicitly reject server-side automation for MVP
1. **Legal:** Automated access + credential handling breaches ToS and creates litigation exposure.
2. **Security/DPDP:** Storing/using third-party shopping passwords is a red-line liability under the DPDP Act (see `compliance/privacy.md`).
3. **Reliability:** Anti-bot systems (Akamai, PerimeterX-style), CAPTCHAs and frequent UI changes make it a permanent maintenance sinkhole.
4. **Trust:** A single publicized "app that logs into your Myntra account" incident is existential for a young brand.

---

## 5. Recommended integration strategy (the decision)

**Adopt a `StoreIntegration` adapter interface** (see `architecture/integration-architecture.md`) with a **capability declaration** per store, so the app degrades gracefully:

```
interface StoreIntegration {
  authenticate()        // most stores: NOT SUPPORTED → returns Unsupported
  getProducts()         // affiliate feed / PA-API where available
  getProductDetails()
  getVariants()
  getCart()             // most stores: NOT SUPPORTED
  addToCart()           // FitCart-internal cart only for most stores
  updateCart()
  removeFromCart()
  checkoutRedirect()    // deep-link handoff with affiliate tag  ← the real path
}
```

Each adapter returns an explicit `CapabilitySet` so the UI knows whether to show "Sync to store cart" (partner stores only) or "Open in store" (everyone else).

### MVP cart model (the honest version)
- **FitCart internal cart** = the outfit/basket the user builds *in our app*.
- **Checkout** = per-item (or grouped) **deep-link handoff** to each store with affiliate attribution.
- **"Sync to store cart"** = shown **only** for platforms where a partnership grants it; otherwise the UI says *"Open in Myntra to complete purchase"*.

This is honest, compliant, monetizable on day one, and keeps the aspirational cart-sync as a **partnership upsell**.

---

## 6. Capability roadmap

| Phase | Catalog | Cart | Checkout |
|---|---|---|---|
| **MVP** | Amazon PA-API + affiliate feeds (partial) | FitCart-internal only | Deep-link handoff + affiliate tag |
| **V2** | More affiliate feeds, richer normalization | Internal cart with per-store grouping | Batched deep-link handoff, "1-tap open all" |
| **V3** | 1–2 **partner** direct integrations | True cart-sync **for partner stores only** | Partner in-context checkout where granted |

---

## 7. Open questions to resolve before Phase 2
1. Which affiliate network offers the best India fashion coverage + product feed quality? (Admitad vs Cuelinks — pilot both.) `UNVERIFIED`
2. Can we secure Amazon Associates approval + PA-API throughput given low initial sales? (Chicken-and-egg on rate limits.)
3. Is any platform (likely a challenger like Ajio/Nykaa) open to a pilot partner integration in exchange for qualified traffic?

**Bottom line for stakeholders:** *We can ship a compelling, legal MVP without cart-sync. Cart-sync is a V3, partnership-gated feature — not an MVP promise. Anyone who tells you otherwise is underestimating platform ToS and anti-bot reality.*
