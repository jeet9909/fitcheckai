# Revenue Feasibility & Time-to-Revenue Research

> Synthesis of `investor/business-model.md`, `docs/monetization.md`, `business/cost-model.md`, `roadmap/mvp.md`, `roadmap/90-day-plan.md`, and `docs/metrics.md`, cross-checked against `research/competitors.md`, `research/platform-api-research.md`, and `research/technology-research.md`. Adds an explicit **solo/unfunded, side-project pace** scenario, which the existing team-based planning docs do not model.

**Research date:** August 2026. All figures inherited from other docs remain `ASSUMPTION`/`UNVERIFIED` as originally labelled — this document does not re-validate them, only re-sequences them under a different team-capacity assumption.

---

## 1. Executive verdict

> **Yes, the idea can generate revenue — the mechanism (affiliate commission on cross-store outfit handoff) is legally available today and requires no platform partnership to start.** But two separate questions get conflated in "can it make money": *can it technically earn a rupee* (yes, fast) vs *can it earn more than it costs, sustainably* (unproven — the project's own cost model shows AI inference cost per user roughly equal to or above revenue per user at small scale). Time-to-revenue also depends heavily on team capacity, which the existing planning docs assume (small senior team, full-time) but which does not match the actual current situation (**solo, unfunded, side-project pace**).

---

## 2. How it makes money (staged, from the existing docs)

| # | Stream | When it activates | Mechanism | Confidence |
|---|---|---|---|---|
| 1 | **Affiliate commission** | Day 1 of MVP | Deep-link handoff to Myntra/Ajio/Amazon/etc. via Admitad/Cuelinks/Amazon Associates; ~5–10% commission on influenced purchases | Mechanism confirmed feasible (`platform-api-research.md` §3.1); exact rates `UNVERIFIED` |
| 2 | **Pro subscription** | V2 (post-MVP) | ₹99–299/mo for unlimited renders, HD quality, advanced fit reports | Pricing is `ASSUMPTION`; India willingness-to-pay untested |
| 3 | **AI Studio renders** | V2 | Per-render/credit-pack for shareable lookbook images | Minor stream |
| 4 | **Brand partnerships / sponsored placement** | V2 | Paid featured placement, always labelled | Minor stream early |
| 5 | **B2B fit/try-on SDK, white-label** | V3 | License the fit-intelligence engine to retailers/brands | Highest long-term margin; validated demand analogue = Walmart/Zeekit, Reactive Reality (`competitors.md` §3.2, §3.4) — but requires a mature fit-data moat first |
| 6 | **Fashion analytics** | V3 | Aggregated, anonymized trend/fit insights, consent-gated | Minor stream, privacy-constrained |

**Key structural fact:** because no Indian fashion platform exposes a cart-write or catalog API (`platform-api-research.md` §1–2), "sync to store cart" is not buildable at MVP. The only compliant monetizable action at MVP is the **deep-link + affiliate tag handoff** — this is not a limitation of the business model, it's the entire mechanism.

---

## 3. The number that decides "if yes": revenue vs. cost per user

From `business/cost-model.md` and `docs/monetization.md`:

| | Per active user / month |
|---|---|
| Estimated revenue (affiliate + thin Pro blend) | **≈ $1.4 (₹118)** `ASSUMPTION` |
| Estimated hosted AI inference cost (avatar + try-on renders) | **≈ $1.6** `ASSUMPTION` |

**At MVP/pilot scale, AI cost may equal or exceed revenue per user.** This flips positive only when:
- Self-hosted GPU inference replaces hosted API calls — but that's only cost-effective **past roughly 10,000–100,000 active users** (`cost-model.md` §3, "key inflection"), or
- Pro conversion or affiliate rates significantly outperform current assumptions.

This is the single metric the project's own docs flag as most important to validate (`docs/metrics.md` §5, `roadmap/mvp.md` success criteria) — and it is currently unvalidated.

---

## 4. Time-to-revenue: two different milestones

### 4.1 As planned in the existing docs (small senior team, full-time)

| Milestone | Timeline | Basis |
|---|---|---|
| First affiliate-attributed click possible | ~Week 10–12 (~3 months) | `roadmap/90-day-plan.md` sequences deep-link + affiliate attribution into the final phase, alongside closed pilot |
| Revenue/user > cost/user (sustainable unit economics) | ~9–15 months from build start | Requires funnel targets (activation ≥35%, add-to-cart ≥25%, handoff CTR ≥40% — all `ASSUMPTION`) to hold, plus enough scale or Pro conversion to close the cost gap |
| B2B/SDK high-margin revenue | 18–24+ months | Requires the fit-data moat to mature through real usage |

**Risk to this timeline:** Amazon Associates requires *qualifying sales within 180 days to keep API access* — a chicken-and-egg problem the project has already flagged (`platform-api-research.md` §7). Affiliate feed coverage/quality is also `UNVERIFIED` and gated as a Week 1–2 validation item.

### 4.2 Recalibrated for actual current situation: solo, unfunded, side-project pace

The 90-day plan assumes parallel workstreams (backend, mobile, AI, legal/compliance, design) running simultaneously across a small team at full-time hours. Solo and part-time (~10–15 hrs/week realistic for a side project), these become sequential and throughput drops to roughly a third.

| Milestone | Recalibrated timeline | Why |
|---|---|---|
| **MVP as currently scoped, live** (personalized SMPL avatar, hosted try-on, fit + outfit engines, multi-angle viewer, DPDP compliance, affiliate integration, a11y) | **12–20 months** | ~4–6 full-time-person-months of work stretched to solo/part-time pace, plus calendar delay waiting on external approvals (affiliate onboarding, any SMPL licensing negotiation) |
| **Meaningful / self-sustaining revenue** (revenue/user consistently > cost/user) | **24–36 months** | MVP live time + growth runway needed to reach the scale where self-hosted inference beats hosted cost, with zero paid CAC budget assumed |
| **B2B/SDK revenue** | 3+ years out | Requires MVP+V2 traction and a matured fit-data moat, which itself requires sustained usage over time |

---

## 5. Faster path: cut the avatar out of v1

The most expensive, slowest, and most legally-encumbered part of the stack is the personalized photo-to-3D avatar (SMPL/SMPL-X commercial licensing, image→body fitting, generative try-on model bake-offs, GPU inference cost — see `technology-research.md` §2, §9). It is also **not** the actual competitive moat: per `competitors.md` §5–6, FitCart's differentiation is **fit intelligence + cross-store outfit composition**, not try-on image realism (Google Doppl already wins on raw generative quality, scoring 9/10 on realism vs FitCart's target 7/10).

A leaner wedge, skipping the avatar/try-on-image pipeline entirely:
- Manual body-measurement input (height/weight/size) instead of photo→SMPL avatar.
- No generative try-on rendering — ship the **fit score + outfit intelligence + cross-store cart**, which is classical rules/light-ML and GPU-free (`technology-research.md` §7).
- Keep the deep-link + affiliate attribution handoff unchanged — it's the only MVP revenue mechanism either way and doesn't depend on the avatar.

This tests the actual unvalidated hypothesis — *will people trust a fit score enough to click through and buy* — without touching the SMPL licensing or GPU cost problem at all.

**Recalibrated timeline for this wedge, solo/unfunded:** first affiliate-attributed revenue in **~3–5 months**, versus 12–20 months for the full scoped MVP. If it gets traction, that traction is the raise/cofounder story that unlocks building the full avatar + try-on vision faster than grinding it out solo.

---

## 6. Bottom line

| Question | Answer |
|---|---|
| Can it generate revenue at all? | **Yes** — affiliate commission via deep-link handoff is legally available from day one, no partnership required. |
| Can it generate *profitable* revenue at MVP scale? | **Unproven** — the project's own cost model shows AI inference cost per user roughly matching revenue per user; this is explicitly the thing the pilot exists to test. |
| Time to first revenue, full scope, solo/unfunded | ~12–20 months to MVP launch, then revenue starts trickling in. |
| Time to first revenue, lean wedge (no avatar/try-on rendering), solo/unfunded | **~3–5 months.** |
| Time to sustainable/meaningful revenue, full scope, solo/unfunded | ~24–36 months. |
| Time to sustainable revenue, as originally planned with a funded small team | ~9–15 months. |

**Recommendation:** ship the fit-score + outfit-intelligence + affiliate-handoff wedge first (no avatar, no generative try-on) to reach real revenue signal in months, not years — then use that traction to justify building the more expensive, slower, differentiated avatar/try-on layer with funding or a technical cofounder rather than solo.
