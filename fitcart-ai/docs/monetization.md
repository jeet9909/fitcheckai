# Monetization

## 1. Principle
Revenue must start on **day one** (affiliate) and compound as trust and data grow (subscription → B2B). We are an **intelligence layer**, so we monetize *decisions and confidence*, not inventory.

## 2. Revenue streams (staged)

| # | Stream | When | Model | Notes / Label |
|---|---|---|---|---|
| 1 | **Affiliate commissions** | MVP | ~5–10% on influenced purchases via networks (Admitad/Cuelinks/Amazon Associates) | Day-one revenue; `UNVERIFIED` exact rates |
| 2 | **Freemium → Pro subscription** | MVP/V2 | ₹99–₹299/mo (`ASSUMPTION`) | Unlimited HD renders, saved outfits, advanced fit, compare, priority processing |
| 3 | **AI Studio renders** | V2 | Per-render or credit pack | High-res "lookbook" shareable renders for enthusiasts |
| 4 | **Brand partnerships / featured** | V2 | Placement / sponsored try-on | Must be labelled; never compromise fit honesty |
| 5 | **B2B try-on + fit SDK / white-label** | V3 | SaaS licensing | Sell the tech to retailers/brands (validated demand: Walmart/Zeekit, Reactive Reality) |
| 6 | **Fashion analytics** | V3 | Aggregated, anonymized trend/fit insights | Strict privacy; aggregate-only; consent-gated |

## 3. Freemium boundary (the conversion lever)
| Capability | Free | Pro |
|---|---|---|
| Avatar generation | ✅ (1 active avatar) | ✅ (multiple, re-gen) |
| Try-on renders/month | Limited (e.g., 10) | Unlimited |
| Render quality | Standard | HD / Studio |
| Fit report | Basic score | Full region breakdown + history |
| Outfit intelligence | Basic | Advanced + compare-two |
| Saved outfits | Few | Unlimited |
| Processing priority | Standard queue | Priority |

**Rationale:** the free tier must deliver the *aha* (avatar + one great try-on + a fit score). Pro sells *volume, quality, and depth* to engaged users (Working Professional, Fashion Enthusiast personas).

### 3.1 Guest tier (fast capture, revenue-safe)
Below "Free" sits a **no-login Guest "Explore"** tier for fast capture (`docs/guest-trial-strategy.md`): preset/demo-avatar try-on, watermarked + capped, no save. It is **revenue-safe** because (a) affiliate tags ride on handoff links even for anonymous users, (b) the expensive personalized-avatar step is gated behind lightweight signup, and (c) preset-avatar renders are cached/shared → negligible marginal cost. Guest exists to **feed signups + affiliate clicks**, not to replace Free/Pro.

## 4. Unit economics (illustrative — see `docs/market-analysis.md` + `business/cost-model.md`)
Per active user/month (`ASSUMPTION`):
- Affiliate: ₹108 · Pro (blended 5% × ₹199): ₹10 → **Gross ≈ ₹118**
- Must exceed **infra cost/active user** (target < ₹30–₹50 at scale) + amortized CAC.
- **The single most important number to validate in the pilot: affiliate revenue per active user vs. inference cost per active user.**

## 5. Why not charge for try-on directly (MVP)?
Charging up-front kills the funnel before the aha. Free try-on drives affiliate volume (our real MVP revenue) and builds the data moat. Monetize *depth and volume*, not *access*.

## 6. Pricing risks & mitigations
| Risk | Mitigation |
|---|---|
| Affiliate rates compress | Diversify to Pro + B2B early; deepen partner deals |
| Low Pro conversion | Tie Pro to clear value (unlimited HD, advanced fit); price for India |
| Inference cost > affiliate revenue | Cost controls: caching, batching, free-tier caps, self-host at volume (see cost model) |
| Brand placements erode trust | Hard rule: sponsored ≠ altered fit honesty; always labelled |

## 7. Recommended initial model (the decision)
**Affiliate-led freemium.** Ship free try-on + fit + outfit intelligence, earn affiliate commission on handoffs from day one, layer Pro subscription as engagement proves out, and build toward the **B2B SDK** as the durable high-margin stream once the fit engine is differentiated. Cart-sync, when partnership-unlocked, becomes both a UX win and a stronger affiliate/partner-revenue position.
