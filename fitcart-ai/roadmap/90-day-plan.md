# 90-Day Execution Plan

Week-by-week to a monetizing MVP + closed pilot. Assumes a small senior team (see `investor/` team plan). Adjust sequence if Week-1 validation dictates. Timeline diagram in `diagrams/roadmap.md`.

## Phase overview
| Weeks | Phase | Outcome |
|---|---|---|
| 1 | Validate & architect | Go/no-go on hypotheses; locked architecture |
| 2–3 | Foundations | Backend + app shell + adapters (mock AI) |
| 4–6 | Product + body pipeline | Catalog, body upload, avatar (mock→real) |
| 7–9 | Try-on + intelligence | Try-on MVP, fit + outfit engines |
| 10–12 | Integrate, harden, pilot | Cart/handoff, privacy, a11y, pilot launch |

---

## Week 1 — Validation & Architecture
- Problem validation: interviews + survey (H1–H4 in `docs/problem.md`).
- Affiliate network pilot: sign up Admitad + Cuelinks; **assess feed coverage/quality** (kills or confirms P3).
- Amazon Associates + PA-API application.
- **Buy-vs-build avatar bake-off** on real photos (Week-1 decision).
- Try-on hosted API shortlist for Week-4 benchmark.
- SMPL licensing clarity + budget.
- Lock architecture; set up repo, CI, environments.
- **Gate:** proceed only if H1/H2 hold and feed coverage is viable.

## Week 2–3 — Foundations
- Backend: FastAPI skeleton, Postgres schema + Alembic, Redis, R2, auth (OTP/social), job queue.
- **Store adapters** with `CapabilitySet` + **mock AI adapters** (app runs end-to-end).
- Flutter app shell: navigation, theming, auth, DI, networking, a11y baseline.
- Docker Compose dev env (mock AI).
- Contract tests for adapters + AI interfaces.

## Week 4–6 — Product & Body Pipeline
- Catalog: PA-API + first affiliate feed → normalized products; discovery + filters.
- Product details + outfit builder.
- Body upload + **capture validation** + consent flow.
- Avatar generation async job: **mock → real** (chosen SMPL/SDK path).
- **Try-on model bake-off** (hosted vs open) on target catalog images → pick.
- Object storage + render pipeline scaffolding.

## Week 7–9 — Try-On & Intelligence
- Try-on integration → **multi-angle render set** + viewer (drag/zoom).
- **Fit engine** (region fits + score + confidence + recs) with fixtures.
- **Outfit engine** (color/occasion/body-shape/style, rules-based).
- Texture zoom (+ optional SR).
- Cost instrumentation (inference cost/job) — watch unit economics.

## Week 10–12 — Integrate, Harden, Pilot
- FitCart cart + **deep-link handoff + affiliate attribution**.
- Post-purchase **fit feedback** loop (moat data).
- Privacy: delete-data/account (tested), export, retention jobs.
- Accessibility pass (WCAG 2.2 AA, textual fit narration).
- Security gate (`compliance/security.md`), load + cost tests.
- Analytics/metrics dashboards.
- **Closed pilot** (invite cohort) → measure MVP success criteria (`roadmap/mvp.md`).
- Iterate on pilot feedback.

---

## Parallel workstreams (throughout)
| Stream | Owner |
|---|---|
| Legal/compliance (affiliate terms, DPDP, DPAs) | Founder + counsel |
| Partnership outreach (for V3 cart-sync) | Founder |
| Fundraising narrative (this repo) | Founder/CEO |
| Design system + wireframes → hi-fi | Design |

## Weekly ritual
Demo Friday · metrics review · risk-register review · decision-log update.

## Definition of pilot-ready
End-to-end: connect → discover → upload → avatar → try-on → fit+outfit score → add → handoff → feedback, all **real (not mock) except where labelled**, passing tests, privacy + a11y gates green, cost/job measured.
