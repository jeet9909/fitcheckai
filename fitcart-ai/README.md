# FitCart AI

> An AI intelligence and visualization layer that sits **between shoppers and existing fashion commerce** — not another marketplace.

FitCart AI lets a shopper discover fashion products, build a complete outfit, and preview it on a **personalized 3D body avatar** generated from their own photos. The app returns a **fit analysis**, an **outfit-compatibility score**, and hands the user off to the original store for checkout.

**Status:** 📋 Phase 1 — Product & Technical Blueprint (planning). Application code is intentionally **not** started; awaiting stakeholder green-light.

---

## What this repository is

This is the **stakeholder-ready product, business, and technical blueprint** for FitCart AI. It is designed so that:

- A **stakeholder / investor** can understand the product, market, and risks without a verbal walkthrough.
- An **engineering team** can begin implementation from the architecture without re-deriving decisions.
- A **founder** can drive fundraising, hiring, and a 90-day execution plan.

The single most important file is [`STAKEHOLDER_MASTER_DOCUMENT.md`](./STAKEHOLDER_MASTER_DOCUMENT.md) — the complete narrative for a stakeholder room.

---

## The honest one-paragraph reality check

The **visual try-on** and **outfit intelligence** layers are technically buildable today with a realistic accuracy ladder (MVP → V2 → V3). The **"unified cart that syncs into the real store's cart"** is the headline feature and also the **highest-risk** one: **none of the target Indian platforms expose an official cart or catalog API**, and browser-automation-based cart injection violates their Terms of Service and is operationally fragile. This blueprint is deliberately honest about that gap and recommends a **compliant, affiliate-and-deeplink MVP** while the true cart-sync is pursued through **partnerships**. See [`compliance/platform-integration-risks.md`](./compliance/platform-integration-risks.md) and [`docs/risks.md`](./docs/risks.md).

---

## Repository map

| Folder | Contents |
|---|---|
| [`STAKEHOLDER_MASTER_DOCUMENT.md`](./STAKEHOLDER_MASTER_DOCUMENT.md) | The master narrative — read this first |
| [`docs/`](./docs) | Executive summary, problem, solution, PRD, personas, journeys, features, competitive & market analysis, monetization, risks, **product surfaces**, **guest-trial strategy**, metrics |
| [`web/`](./web) | **Marketing website**, **web app (Guest Explore)**, **browser extension** specs |
| [`research/`](./research) | Deep competitor analysis, technology research, platform-API feasibility |
| [`architecture/`](./architecture) | System, mobile, backend, AI, data, integration architecture |
| [`ai/`](./ai) | Body model, virtual try-on, fit engine, outfit intelligence |
| [`engineering/`](./engineering) | Final tech stack, API design, DB design, deployment, testing |
| [`compliance/`](./compliance) | Privacy (DPDP/GDPR), security, platform integration risk |
| [`ux/`](./ux) | User flows, wireframes, screen-by-screen specs |
| [`roadmap/`](./roadmap) | MVP / V2 / V3 and the 90-day plan |
| [`investor/`](./investor) | Pitch-deck outline, business model, competitive moat |
| [`diagrams/`](./diagrams) | Mermaid diagrams: architecture, flows, AI pipeline, positioning, roadmap, risk heatmap |
| [`business/`](./business) | Cost model at 1k / 10k / 100k / 1M users |
| [`DECISION_LOG.md`](./DECISION_LOG.md) | Every major decision, alternatives, and migration path |

---

## Risk & status labels used throughout

| Label | Meaning |
|---|---|
| **MVP FEASIBLE** | Buildable now with a small team and no special access |
| **PARTNERSHIP REQUIRED** | Needs a commercial agreement with a platform/brand |
| **AUTOMATION-ONLY** | Only achievable via browser automation → ToS + fragility risk |
| **HIGH RISK** | Significant legal, platform, or reputational exposure |
| **UNVERIFIED** | Asserted but not confirmed from a primary source |
| **NOT FEASIBLE (MVP)** | Out of scope for the first release |

---

## Planned monorepo (Phase 2 — not yet built)

```
fitcart-ai/
├── mobile/          # Flutter app            (Phase 2)
├── backend/         # Python + FastAPI       (Phase 2)
├── ai-services/     # Modular AI adapters     (Phase 2)
├── infrastructure/  # Docker, IaC, CI/CD      (Phase 2)
├── docs/            # ✅ this blueprint
├── research/        # ✅
├── architecture/    # ✅
├── investor/        # ✅
├── compliance/      # ✅
└── scripts/         # (Phase 2)
```

## Next step

Review this blueprint → give the **green-light** → Phase 2 begins with the [90-day execution plan](./roadmap/90-day-plan.md).

---
*Prepared as an autonomous CTO / Principal Architect / Product-Strategy deliverable. All external facts are labelled with confidence; unverifiable claims are marked `UNVERIFIED`.*
