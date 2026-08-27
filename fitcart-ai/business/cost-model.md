# Business — Infrastructure Cost Model

> **All figures are engineering estimates with explicit assumptions, in USD/month, order-of-magnitude — NOT quotes.** GPU/inference pricing moves fast; re-price at build time. Every number is `ASSUMPTION`. The goal is to reason about **unit economics**, not to forecast a bill.

## 1. Core assumptions (state loudly)
| Assumption | Value | Note |
|---|---|---|
| Try-ons per active user / month | 8 | free-tier capped |
| Angles per try-on | 8 (free) / 16 (Pro) | cost scales with angles |
| **Render reuse (cache hit)** | 40% | identical avatar+item-set dedupe |
| Hosted try-on cost / generated image | $0.02–$0.06 | `UNVERIFIED` — bake-off dependent |
| Avatar generation cost (one-time/user) | $0.05–$0.20 | hosted or SDK |
| Active-user ratio (of registered) | 30% | |
| Storage / active user | ~50 MB | photos(short-lived)+avatar+renders |
| R2 storage | ~$0.015/GB-mo, **$0 egress** | |
| Postgres/Redis/CDN/monitoring | tiered managed | |

## 2. Try-on inference cost per active user / month
- Generated images/user/mo = 8 try-ons × 8 angles × (1 − 0.40 reuse) = **~38 images**
- @ $0.04/image (midpoint) = **~$1.52/active user/mo** inference
- + avatar (amortized) ~$0.10 → **~$1.6/active user/mo** AI cost
- *(This is the number that must stay below affiliate+Pro revenue/user.)*

## 3. Cost at scale (USD/month, order-of-magnitude)
Registered → 30% active. AI cost ≈ active × $1.6 (MVP hosted). Platform = API+DB+cache+storage+CDN+monitoring.

| Users (registered) | Active | AI/inference | Platform (API/DB/cache/CDN/obs) | Storage | **Total /mo `ASSUMPTION`** |
|---|---|---|---|---|---|
| **1,000** | 300 | ~$500 (incl. min hosted + testing) | ~$300–$600 (mostly fixed minimums) | ~$20 | **~$1k–$1.5k** |
| **10,000** | 3,000 | ~$4.8k | ~$1.5k–$3k | ~$150 | **~$7k–$9k** |
| **100,000** | 30,000 | ~$48k (hosted) → **~$20k–$30k if self-hosted** | ~$8k–$15k | ~$1.5k | **~$30k–$65k** (self-host lowers AI a lot) |
| **1,000,000** | 300,000 | hosted ~$480k → **self-host ~$120k–$200k** | ~$40k–$80k | ~$15k | **~$180k–$300k self-hosted** |

**Key inflection:** somewhere between **10k–100k active users**, self-hosting GPUs beats hosted per-inference cost. The adapter architecture makes this switch a config change (`architecture/ai-architecture.md`).

## 4. Cost levers (how we defend unit economics)
| Lever | Effect |
|---|---|
| **Render caching/reuse** (item_set_hash) | −30–50% inference |
| **Free-tier angle/try-on caps** | bounds cost/free user |
| **Downscale previews, SR only on zoom** | lower per-image cost |
| **Batch + spot GPUs** for non-interactive | −40–70% GPU |
| **Self-host at volume** | big step-down ≥100k active |
| **R2 zero-egress** | kills image-egress cost |

## 5. Cost vs revenue (the whole ballgame)
Per active user/mo: revenue ≈ ₹118 (~$1.4) `ASSUMPTION` vs AI cost ~$1.6 hosted.
- **At small scale, hosted AI cost ≈ or > revenue/user.** Acceptable while validating.
- **At scale with self-host + caching**, AI cost/user drops well below revenue → contribution positive.
- **⚠️ This is the #1 metric to validate in the pilot** (`docs/risks.md` B4/T4). If revenue/user can't clear cost/user with the levers above, the model must change (pricing, Pro push, fewer free renders) before scaling.

## 6. One-time / other costs (not in table)
SMPL commercial license (if build path) · legal (DPDP, affiliate terms, DPAs) · pen-test · app-store fees · design tools · founder/team salaries (dominant early cost — see team plan).

## 7. Re-pricing discipline
Re-benchmark inference cost every quarter and after any model change; keep a live **cost-per-inference** metric in production (`engineering/deployment.md`).
