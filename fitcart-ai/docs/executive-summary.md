# Executive Summary

**FitCart AI — the AI try-on & outfit-intelligence layer for the stores you already shop.**

## The one-liner
FitCart AI lets shoppers build complete outfits across Myntra, Ajio, Amazon Fashion, Flipkart, Nykaa and more, preview them on a **personalized 3D body avatar** made from their own photos, and get a **fit score** and **outfit-compatibility score** before they buy — then hands off to the original store for checkout.

## The problem
Online fashion in India suffers **25–40% return rates** (`UNVERIFIED` exact figure; industry-directional), driven overwhelmingly by **size/fit uncertainty** and **"will this actually look good on me / with the rest of my outfit?"** doubt. Shoppers juggle **5+ apps**, cannot visualize a full outfit across stores, and rely on flat model photos that look nothing like their own body. Returns crush retailer margins and shopper confidence alike.

## The solution
A **mobile-first intelligence layer** — not another marketplace — that:
1. Aggregates products from the user's existing fashion platforms (via affiliate feeds + Amazon PA-API today; partner APIs later).
2. Generates a personalized avatar from 1–3 uploaded photos.
3. Renders selected garments on the avatar with a **360°-feeling multi-angle viewer**.
4. Returns a **Fit Score + confidence** and an **Outfit Compatibility Score** (color, occasion, body-shape, style).
5. Routes the user to the real store to check out (with affiliate attribution).

## Why now
- Generative try-on has crossed the quality threshold (Google Doppl, Walmart, Snap all shipped in 2024–2025) — validating demand while none of them solve **cross-store outfit fit intelligence**.
- India's fashion e-commerce is large, young, mobile-first, and return-plagued.
- Open perception models + hosted try-on APIs let a small team ship a credible MVP without a research lab.

## The honest constraint (stated up front)
The dream feature — *"sync your outfit straight into the store's cart"* — is **not possible via any official API** on the target platforms and is **ToS-violating via automation**. Our MVP therefore ships a **compliant affiliate + deep-link handoff**, and treats true cart-sync as a **partnership-gated V3 feature**. We would rather under-promise on a slide than build on a legal fault line. See `research/platform-api-research.md`.

## Differentiation
| Everyone else | FitCart AI |
|---|---|
| Shows *how it looks* | Tells you *whether it fits + whether the outfit works* |
| Single store / single brand | **Cross-store** outfit building |
| Single garment | **Full-outfit** composition & scoring |
| US-centric | **India-first** body diversity, sizing, price sensitivity |

## Business model
Freemium consumer app → **Pro subscription** (unlimited HD renders, saved outfits, advanced fit), **affiliate commissions** on routed purchases (day-one revenue), and later a **B2B try-on/fit SDK** and **fashion analytics** for brands.

## Market (India-first, global-next)
- **TAM** (global online fashion try-on/personalization opportunity): tens of $B.
- **SAM** (India online fashion shoppers needing fit/visual assurance): large and growing.
- **SOM** (reachable, monetizable via freemium+affiliate in 24–36 months): a focused, winnable beachhead.
- Figures and derivation in `docs/market-analysis.md` (all assumptions labelled).

## Traction plan (90 days)
Validated problem → clickable prototype → MVP with real try-on on real catalog images → closed pilot. See `roadmap/90-day-plan.md`.

## The ask (illustrative)
A pre-seed/seed round to fund a **small senior team (5–7)** for **12–18 months** to reach a monetizing MVP with early retention and affiliate revenue, and to secure the **first platform/brand partnership** that unlocks cart-sync. Detailed cost model in `business/cost-model.md`.

## Why we win
Try-on models are commoditizing. **Our moat is the fit + outfit data flywheel, cross-store neutrality that marketplaces structurally cannot copy, and an India-first trust-and-privacy brand around body data.** See `investor/competitive-moat.md`.

---
*Read next: [`docs/problem.md`](./problem.md) → [`docs/solution.md`](./solution.md) → [`STAKEHOLDER_MASTER_DOCUMENT.md`](../STAKEHOLDER_MASTER_DOCUMENT.md).*
