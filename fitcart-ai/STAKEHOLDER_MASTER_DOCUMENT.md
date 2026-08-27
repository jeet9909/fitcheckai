# FitCart AI — Stakeholder Master Document

> **The single narrative document for a stakeholder room.** It combines the vision, market, product, AI strategy, architecture, competition, feasibility, roadmap, risks, economics, and the investment case into one coherent story. Every supporting detail links to a deeper file. Prepared as a CTO / Principal Architect / Product-Strategy deliverable.
>
> **Reading time:** ~20 min. **Companion files:** everything under `docs/`, `research/`, `architecture/`, `ai/`, `engineering/`, `compliance/`, `ux/`, `roadmap/`, `investor/`, `diagrams/`, `business/`.
>
> **Status:** Phase-1 blueprint. **No application code has been built** — awaiting the stakeholder green-light per the founder's instruction.

---

## 1. What FitCart AI is
FitCart AI is a **mobile-first AI shopping companion** that lets a shopper **build a complete outfit across the fashion stores they already use** (Myntra, Ajio, Amazon Fashion, Flipkart, Nykaa, Meesho…), **preview it on a personalized 3D avatar** generated from their own photos, and receive a **Fit Score** and **Outfit Compatibility Score** before buying — then routes them to the original store to check out.

It is **not a marketplace**. It holds no inventory and runs no checkout. It is the **intelligence and visualization layer that sits between shoppers and existing fashion commerce.** *(Positioning: `docs/solution.md`.)*

---

## 2. The problem
Online fashion has a **confidence problem that shows up as returns** — commonly cited at **~25–40%** for online apparel (`UNVERIFIED`; validate in pilot), driven overwhelmingly by **size/fit uncertainty** and **"will this look good on me and with the rest of my outfit?"** doubt.

Four compounding frictions (`docs/problem.md`):
1. **Fit/sizing uncertainty** — sizes vary by brand; model photos aren't your body.
2. **Outfit uncertainty** — no tool composes and critiques a *complete look*.
3. **Cross-platform friction** — shoppers juggle 5+ apps; no way to combine across stores.
4. **Visualization gap** — existing try-ons are single-brand, single-garment, or camera-AR.

The cost: wasted money and decision fatigue for shoppers; **margin-crushing returns** for retailers; waste for the planet.

---

## 3. Why current solutions are insufficient
| Solution | Gap |
|---|---|
| Marketplace size charts / size-rec | Numbers not embodiment; single-store; no outfit view |
| Marketplace/beauty AR | Narrow, single-catalog, no fit *score* |
| **Google Doppl / Shopping Try-On** (2025) | Beautiful visuals, but **no fit analysis, no outfit composition, not tied to your connected stores' checkout** |
| Walmart / Zeekit | US + Walmart catalog only |
| Snap / Vyking AR | Camera-AR, accessory/footwear focus, brand-by-brand |
| Free returns | Treats the symptom; expensive, high-friction |

Nobody combines **cross-store outfit building + personalized fit-scored full-body avatar + outfit intelligence**. That empty quadrant is FitCart's opening. *(`docs/competitive-analysis.md`, `diagrams/competitive-positioning.md`.)*

---

## 4. How our solution works
The core loop (`docs/solution.md`):
```
DISCOVER (cross-store) → SELECT items → TRY ON (avatar) → INSPECT (360° + texture)
→ FIT CHECK (score+confidence) → OUTFIT SCORE → ADD TO FITCART → CHECKOUT HANDOFF (store)
```
Four layers create the value: **Visualization** (the hook) · **Fit Intelligence** and **Outfit Intelligence** (the moat) · **Cross-store aggregation** (the structural advantage).

---

## 5. The user journey
1. **Connect** the stores you already use (compliant affiliate/deep-link — *not* password login).
2. **Upload** one full-body photo (optionally + side + back). The app validates pose, lighting, distance, visibility before accepting.
3. The app builds a **personalized avatar** — body shape, proportions, skin tone, posture — with an **honest confidence score**.
4. **Build an outfit** across stores (shirt + jeans + shoes + watch + sunglasses + jacket…).
5. **See it on your avatar**, rotate through multiple angles, zoom into fabric detail.
6. Read the **Fit Report** ("shoulders good; trousers may run slightly long — Fit 8.6/10, confidence 82%").
7. Read the **Outfit Score** (color harmony, occasion, body-shape, style).
8. **Add to FitCart**, then **open the store** to complete the purchase.

Six personas drive the design — College Shopper, Working Professional, Fashion Enthusiast, **Plus-Size User**, **Accessibility-Focused User**, **Prosthetic/Mobility-Impaired User** — with inclusion treated as first-class, not an afterthought. *(`docs/user-personas.md`, `docs/user-journeys.md`, `ux/`.)*

---

## 6. The 3D avatar concept (told honestly)
A single phone photo **cannot** produce a metrically perfect 3D body. We build a **believable, animatable, confidence-scored parametric avatar** (SMPL/SMPL-X family) and improve it with more inputs over versions:

| Version | Input | Fit accuracy (target) |
|---|---|---|
| **MVP** | 1 photo + height | silhouette-believable; ±5–10% `UNVERIFIED` |
| **V2** | + side + back | ±3–6% |
| **V3** | multi-photo/video | textured 3D; still an estimate |

**Non-negotiable product rule:** never present an estimate as a guaranteed measurement — always show confidence. *(`ai/body-model.md`.)*

---

## 7. The 360° virtual try-on (no faking)
Stores give us **product photos, not 3D garment assets** — so MVP try-on uses **2D/2.5D generative** models that output a **set of fixed viewing angles** (8–16 yaw) plus high-res zoom crops. A drag/swipe viewer makes it *feel* like rotation. This is labelled honestly as a **multi-angle preview**, and the viewer is coded against an `OutfitViewer` interface so **true real-time 3D drops in at V3** with no rewrite. We do not fake 3D. *(`ai/virtual-try-on.md`, `architecture/mobile-architecture.md`.)*

---

## 8. Fit intelligence (our real IP)
Try-on visuals are commoditizing; **accurate fit prediction with a trustworthy confidence score is the moat.** The Fit Engine compares avatar measurements against garment size-charts and metadata to produce per-region fit (shoulder/chest/waist/hip/sleeve/length/rise/shoe), an **overall Fit Score + confidence + plain recommendation** — and, crucially, learns from a **post-purchase fit-feedback loop** that builds proprietary per-brand true-to-size data over time. *(`ai/fit-engine.md`.)*

---

## 9. Outfit intelligence
The Outfit Engine scores **color harmony, occasion suitability, body-shape compatibility, style compatibility**, and (V2) trend — producing a single Outfit Score with rationale and suggestions. MVP is rules-based (explainable, cheap, cold-start-proof); V2 adds learned embeddings and personalization. Fit and outfit scores together form the "**buy with confidence**" summary that is FitCart's core value. *(`ai/outfit-intelligence.md`.)*

---

## 10. Multi-store integration — the honest feasibility truth
This is where most decks over-promise. We do not.

> **No target Indian fashion platform exposes an official public API for catalog read or cart write to third parties.** *(Researched Aug 2026 — `research/platform-api-research.md`.)*

What **is** available and compliant:
- **Affiliate networks** (Admitad, Cuelinks, EarnKaro, Amazon Associates) → deep links + commission + partial product feeds.
- **Amazon PA-API 5.0** → the only genuine first-party product API (rate-limited, Associates-gated).
- **Deep-link handoff** → route the user to the exact product with affiliate attribution.

*(`architecture/integration-architecture.md` encodes this as a per-store `CapabilitySet` so the app never promises what a store can't do.)*

---

## 11. Cart synchronization — brutally honest
The headline dream — *"build an outfit here, sync it into the store's real cart"* — is:

| Path | Verdict |
|---|---|
| Official cart API | ❌ **Does not exist** on any target platform |
| Partner API | 🔒 **PARTNERSHIP REQUIRED** (realistic only after we have traffic leverage) |
| Browser automation w/ user credentials | ⚠️ **AUTOMATION-ONLY / HIGH RISK** — ToS breach + security/DPDP liability + operational fragility. **We will not build it.** |

**Therefore:** MVP ships a **compliant deep-link handoff + affiliate attribution** (revenue on day one). "Sync to store cart" appears **only** for partner-enabled stores, and the architecture already supports dropping in a `PartnerAdapter` when a deal is signed — **no rewrite**. We would rather under-promise on a slide than build on a legal fault line. *(`compliance/platform-integration-risks.md`, `docs/risks.md`.)*

---

## 12. Technology
| Layer | Choice | Why |
|---|---|---|
| Mobile | **Flutter** | Custom-UI/animation for the viewer; mid-range Android perf (India) |
| Backend | **Python + FastAPI** (modular monolith) | One language with the AI stack; async; velocity |
| Database | **PostgreSQL (+pgvector)** | Integrity + JSON flexibility + recs |
| Cache/Queue | **Redis + Celery/RQ** → RabbitMQ/Kafka | Sufficient now; scale later |
| Object storage | **Cloudflare R2** | Zero egress on image-heavy product |
| GPU | **Hosted → self-host at volume** | No GPU capex early; cheaper per-inference at scale |
| Infra | **Managed containers/serverless → k8s at scale** | Low ops for a small team |

*(Decision matrices: `engineering/tech-stack.md`; full rationale + migration paths: `DECISION_LOG.md`.)*

---

## 13. AI architecture
Every AI capability is a **swappable interface** with **hosted / self-hosted / mock** adapters, orchestrated as **async jobs** with caching, confidence scoring, and cost metrics. The pipeline: *validate → parse → pose → body/avatar → garment segmentation → try-on (multi-angle) → fit → outfit*. Mocks are clearly **labelled synthetic** so the app runs end-to-end before production models are wired — **without faking results**. Every model passes a **license-review gate** (SMPL commercial licensing is a real, flagged cost). *(`architecture/ai-architecture.md`, `research/technology-research.md`.)*

---

## 14. Competitive landscape
Two groups: **marketplaces** (channels/partners, single-catalog — not try-on rivals) and **try-on tech players** (the real competition).

| Player | Composite (thesis-weighted) | Their edge | Our counter |
|---|---|---|---|
| **FitCart AI (target)** | **8.0** | fit+outfit+cross-store+India | — |
| Google Doppl | 8.5 | realism, scale, free | fit intelligence + outfit + cross-store + India depth |
| Walmart/Zeekit | 6.0 | retail-integrated | US/own-catalog only |
| Snap | 6.0 | best AR | camera-AR, accessory focus |
| Reactive Reality | 6.0 | avatar+outfit, B2B | not consumer cross-store |
| Vyking | 5.0 | footwear AR | narrow |
| Myntra (as rival) | 3.5 | owns checkout | single-catalog silo |

**Stated plainly:** we do **not** beat Google on raw generative realism or scale. We win on **fit intelligence, outfit composition, cross-store coverage, and India-first depth.** *(`research/competitors.md`, `docs/competitive-analysis.md`.)*

---

## 15. Competitive advantage (moat)
The try-on model is not the moat. Four durable advantages are (`investor/competitive-moat.md`):
1. **Fit-data flywheel** — try-on ↔ purchase ↔ return ↔ satisfaction data compounds per-brand fit accuracy. New entrants start at zero.
2. **Structural neutrality** — marketplaces *cannot* build a tool that routes shoppers to rivals; that cross-store lane is ours by construction.
3. **Trust & privacy brand** — a privacy-first posture on body data in a newly-regulated (DPDP) India earns loyalty a careless competitor can't buy back.
4. **B2B SDK optionality** — the differentiated fit engine can be licensed to brands/retailers — a high-margin hedge against big-tech consumer competition.

---

## 16. Business model
**Affiliate-led freemium** (`docs/monetization.md`, `investor/business-model.md`):
- **Affiliate commissions** — day-one revenue on routed purchases.
- **Pro subscription** — unlimited HD renders, saved outfits, advanced fit.
- **Studio renders / brand partnerships** — V2.
- **B2B fit/try-on SDK + fashion analytics** — V3, the durable high-margin endgame.

Illustrative unit economics (`ASSUMPTION`, validate in pilot): ~₹118 revenue/active user/mo vs ~$1.6 hosted AI cost/user — **the pilot must prove revenue/user > cost/user**, and caching + self-hosting drive cost down at scale.

---

## 17. Market opportunity
**India-first, global-next** (`docs/market-analysis.md`). Reasoning framework with explicit assumptions (not false precision):
- **TAM** (global try-on/personalization/affiliate value layer): ~$15–35B `ASSUMPTION`.
- **SAM** (India online fashion monetizable layer): ~$1–3B `ASSUMPTION`.
- **SOM** (24–36 mo, freemium+affiliate): ~$10–40M revenue ceiling `ASSUMPTION` — aspirational, not a forecast.
The credible story is **bottom-up**: revenue-per-active-user × retention, and return-reduction value to retailers.

---

## 18. The MVP
Smallest credible product to validate the hypothesis (`roadmap/mvp.md`): onboarding + granular consent → cross-store discovery (PA-API + affiliate) → body upload + validation + avatar → generative multi-angle try-on + viewer → Fit Score + Outfit Score → FitCart cart + deep-link handoff + affiliate → post-purchase fit feedback → privacy (delete-data) + WCAG 2.2 AA baseline.
**Out:** live AR, real-time 3D, credential login, cart-sync, guaranteed measurements.

---

## 19. Roadmap
- **MVP (0–3 mo):** validate confidence-driven purchasing + affiliate revenue.
- **V2 (3–9 mo):** multi-photo accuracy, variant swap/compare, learned outfit recs, Pro maturity, fit calibration (moat).
- **V3 (9–18 mo+):** true 3D + cloth sim, **partner cart-sync**, **B2B SDK**, seated/prosthesis avatars, geo expansion.
A **90-day week-by-week plan** takes us from validation → foundations → body pipeline → try-on + intelligence → integrate + pilot. *(`roadmap/`, `diagrams/roadmap.md`.)*

---

## 20. Costs
Order-of-magnitude infra (`business/cost-model.md`, all `ASSUMPTION`): ~$1–1.5k/mo at 1k users; ~$7–9k at 10k; ~$30–65k at 100k (self-host lowers AI sharply); ~$180–300k at 1M self-hosted. **Key inflection:** self-hosting GPUs beats hosted between ~10k–100k active users — a config change thanks to the adapter architecture. Dominant early cost is **team**, not infra.

---

## 21. Risks
Top board-level risks (`docs/risks.md`, `diagrams/risk-matrix.md`):
1. 🔴 **Cart-sync not officially possible** → reframed MVP; never promised.
2. 🔴 **Body-data + credentials under DPDP** → privacy-by-design or existential.
3. 🔴 **Unit economics** (inference cost vs affiliate revenue) → validate + cost controls.
4. 🔴 **Big-tech bundling** → defend with fit-data moat + partnerships + B2B pivot.
5. 🟠 **AI quality & honesty** → benchmark early; never over-claim.
Our credibility comes from engineering around these from day one, rather than discovering them after raising on a fantasy demo.

---

## 22. Compliance
Body photos are the most sensitive data we touch. Under **India's DPDP Act (Rules notified Nov 2025; penalties up to ₹250 cr; enforcement ramping to May 2027)** and **GDPR**, we adopt privacy-by-design as a **launch requirement**: granular verifiable consent (un-bundled, no pre-ticks), data minimization, delete-raw-photos-after-generation by default, encryption at rest + in transit, deletion rights honored within SLA, **no third-party shopping passwords stored**, and DPAs for any hosted AI touching images. This posture is a **market-entry moat**, not overhead. *(`compliance/privacy.md`, `compliance/security.md`.)*

---

## 23. Team
Ideal founding team: **CEO/Product + CTO + AI/ML lead**. First hires (~5–7 total): senior Flutter, backend (Python), ML engineer, product designer, fractional legal/compliance. Principle: **buy over build early** (hosted AI, avatar SDK) to stay small, senior, and focused; compliance + security seniority early because body data is existential. *(`investor/team-plan.md`.)*

---

## 24. The investment opportunity
- **Day-one revenue** (affiliate) — not purely pre-revenue.
- **Compounding moat** (fit data) → improving margins + defensibility.
- **Optionality** — consumer *and* B2B, de-risking big-tech consumer competition.
- **Capital-efficient MVP** — hosted AI, no GPU capex early.
- **Honest operators** — a team that named the hard truths (cart-sync, unit economics, AI limits) up front and engineered around them.

**The ask (illustrative):** pre-seed/seed for a small senior team over **12–18 months** to a monetizing MVP with early retention + affiliate revenue, and the **first platform/brand partnership** that unlocks cart-sync. *(`investor/pitch-deck-outline.md`.)*

---

## 25. Product surfaces — more than an app
FitCart AI ships across **four surfaces**, one backend (`docs/product-surfaces.md`, `web/`):
| Surface | Job | When |
|---|---|---|
| **Mobile app (Flutter)** | The full product (capture, avatar, try-on, fit) | P0 core |
| **Marketing website** | Acquisition, SEO, trust, conversion → installs/trials | P0, launch w/ MVP |
| **Web app (Guest Explore)** | No-install demo + shareable-render virality + desktop | P1, MVP/early |
| **Browser extension** | "Add to FitCart" **capture clipper** — **legal-gated, never a cart-writer** | P2, V2/V3 |

The web app + marketing site are the **fast, compliant, no-install capture surfaces**. The extension is an optional later convenience, scoped narrowly to product-capture (not cart injection — that red line from §11 holds). All surfaces reuse the same FastAPI backend + AI services, so surface expansion is cheap.

## 26. Fast user capture — the guest "Explore" funnel (without breaking revenue)
Guests can **try the free model with no login** — the top-of-funnel capture lever — under a strict principle: **show the aha for free, gate the *keep* and the *expensive*** (`docs/guest-trial-strategy.md`). A guest browses cross-store catalog, tries on with a **preset/demo avatar** (or one throttled upload), sees a **Fit + Outfit Score**, gets a **watermarked** preview, and can hand off to a store — then hits a **soft signup wall** only when they want to save, personalize, or get HD.

Three protections keep this from breaking revenue:
1. **Affiliate attribution survives anonymity** — commission rides on the outbound link/click, not the account, so guest handoffs still earn. Guest mode *expands* the affiliate funnel.
2. **Cost is bounded** — preset-avatar renders are cached/shared across guests (near-zero marginal cost); the **expensive personalized-avatar generation is gated behind a lightweight account**; guest caps + bot/WAF protection prevent cost-bombing.
3. **No Pro cannibalization** — guest is a *taste* (watermarked, preset, capped, no save); Pro is personalization + persistence + HD + unlimited.

**The guardrail, stated plainly:** guest mode is a win only if it lifts signups **and** affiliate revenue per visitor rises **and** cost-per-guest stays negligible. If cost-per-guest ever approaches guest-generated value, tighten caps before scaling. That is the concrete meaning of *"don't break our revenue."*

## 27. The one-sentence thesis
> *Anyone can render a shirt on a photo; only FitCart knows — from a compounding, India-first fit dataset no one else has — whether that shirt will actually fit **you**, across every store you shop, and can sell that knowledge back to the brands themselves.*

---

## Appendix — document map
| Theme | Files |
|---|---|
| Product | `docs/executive-summary.md`, `problem.md`, `solution.md`, `product-requirements.md`, `feature-specification.md`, `metrics.md` |
| Users/UX | `docs/user-personas.md`, `user-journeys.md`, `ux/*` |
| Research | `research/competitors.md`, `technology-research.md`, `platform-api-research.md` |
| Architecture | `architecture/*`, `diagrams/*` |
| AI | `ai/*` |
| Engineering | `engineering/*` |
| Compliance | `compliance/*` |
| Roadmap | `roadmap/*` |
| Investor/Business | `investor/*`, `docs/market-analysis.md`, `docs/monetization.md`, `business/cost-model.md` |
| Decisions | `DECISION_LOG.md` |

*Prepared autonomously as Phase 1. Next step: stakeholder review → green-light → Phase 2 build per `roadmap/90-day-plan.md`.*
