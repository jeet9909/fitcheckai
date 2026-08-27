# Roadmap — MVP

**Goal:** validate the core hypothesis — *personalized avatar try-on + fit + outfit intelligence across stores raises purchase confidence and drives affiliate conversions* — with the smallest credible product.

## Core hypothesis to validate

> Users will upload body photos, trust an honest fit/outfit score, build cross-store outfits, and click through to buy (generating affiliate revenue) — with retention beyond novelty.

## In scope (MVP)


| Area       | Feature                                                                      |
| ---------- | ---------------------------------------------------------------------------- |
| Onboarding | Intro, account (OTP/social), **granular consent**                            |
| Stores     | Connect via **affiliate/deep-link**; Amazon PA-API; capability display       |
| Discovery  | Cross-store search, normalized products, filters                             |
| Body       | Upload (1 photo + height), **capture validation**, async avatar + confidence |
| Try-on     | Generative try-on (hosted), **multi-angle viewer** + zoom                    |
| Fit        | Region fit + **Fit Score + confidence** + recommendation                     |
| Outfit     | Color/occasion/body-shape/style score (rules-based)                          |
| Cart       | FitCart internal cart, save outfits                                          |
| Handoff    | Deep-link + affiliate attribution                                            |
| Feedback   | Post-purchase "did it fit?" (moat data)                                      |
| Privacy    | Delete body data/account, encryption                                         |
| A11y       | WCAG 2.2 AA baseline, textual fit narration                                  |
| Platform   | Data-saver / mid-range Android support                                       |


## Explicitly OUT (MVP)

Live AR · real-time 3D cloth sim · store credential login · store cart-sync · guaranteed measurements · our own checkout · trend/learned outfit models · seated/prosthesis avatars (respectful handling only).

## MVP feasibility labels

- Try-on, fit, outfit, discovery, handoff → **MVP FEASIBLE**
- Amazon PA-API → **MVP FEASIBLE (constrained)**
- Affiliate feed coverage → **MVP FEASIBLE / UNVERIFIED coverage** (validate Wk1–2)
- Cart-sync → **PARTNERSHIP REQUIRED (not MVP)**

## Success criteria (exit MVP)


| Metric                                                 | Target `ASSUMPTION` |
| ------------------------------------------------------ | ------------------- |
| Install → first try-on (activation)                    | ≥ 35%               |
| Try-on → add-to-FitCart                                | ≥ 25%               |
| Handoff click-through                                  | ≥ 40% of carts      |
| D7 retention                                           | ≥ 20%               |
| Fit "was accurate" (feedback)                          | ≥ 70%               |
| Affiliate rev/active user > inference cost/active user | **must be true**    |


## Key risks gating MVP

Affiliate coverage (P3) · try-on quality (T1) · avatar over-claim (T2) · unit economics (B4/T4) · body-upload willingness (B2). Mitigations in `docs/risks.md`.

## Build sequence (maps to 90-day plan)

1. Foundations (auth, DB, adapters w/ mocks, app shell).
2. Catalog (PA-API + one affiliate feed) + discovery.
3. Body upload + validation + avatar (mock → real).
4. Try-on (hosted) + viewer.
5. Fit + outfit engines.
6. Cart + handoff + feedback.
7. Privacy, a11y, hardening, pilot.

