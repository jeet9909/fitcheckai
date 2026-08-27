# Metrics & KPIs

North-star + funnel + moat + economics metrics. Instrumented via privacy-safe events (`architecture/data-architecture.md`).

## 1. North-star metric
**Confident purchases enabled** = try-ons that lead to a checkout handoff *and* positive post-purchase fit feedback. Captures the whole thesis (visualize → fit → buy → satisfied).

## 2. Funnel metrics
| Metric | Definition | MVP target `ASSUMPTION` |
|---|---|---|
| **Activation** | install → first try-on completed | ≥ 35% |
| **Try-on conversion** | sessions with a completed try-on | ≥ 50% of active sessions |
| **Add-to-cart rate** | try-on → add-to-FitCart | ≥ 25% |
| **Handoff CTR** | cart → store deep-link opened | ≥ 40% |
| **Cart sync success** (partner only) | sync attempts succeeded | ≥ 95% (partner scope) |
| **Purchase uplift** | conversion vs baseline (pilot A/B) | positive, significant |

## 3. Outcome / moat metrics
| Metric | Definition | Target |
|---|---|---|
| **Fit accuracy** | "fit was accurate" / feedback responses | ≥ 70% MVP → ≥ 80% V2 |
| **Return reduction** | returns vs cohort baseline (partner data/pilot) | measurable ↓ |
| **Outfit completion** | outfits with ≥3 categories completed | ≥ 40% |
| **Feedback capture rate** | purchases with fit feedback (fuel for moat) | ≥ 30% |

## 4. Engagement / retention
| Metric | Target `ASSUMPTION` |
|---|---|
| **Session duration** | ≥ 4 min median |
| **Try-ons / active user / week** | ≥ 2 |
| **D7 retention** | ≥ 20% MVP |
| **D30 retention** | ≥ 15% V2 |
| **Saved outfits / user** | ≥ 2 |

## 5. Monetization
| Metric | Target |
|---|---|
| **Affiliate revenue / active user** | > inference cost / active user (**critical**) |
| **Pro conversion** | ≥ 4% (V2) |
| **ARPU (blended)** | grows QoQ |

## 6. Unit-economics guardrails (from `business/cost-model.md`)
| Metric | Guardrail |
|---|---|
| **Inference cost / active user** | tracked live; below revenue/user |
| **Render cache-hit rate** | ≥ 40% |
| **Cost / try-on** | trending down (caching + self-host) |

## 7. Quality / trust
| Metric | Target |
|---|---|
| Avatar generation success | ≥ 95% |
| Try-on render success | ≥ 95% |
| Low-confidence disclosure shown | 100% when confidence < threshold |
| Delete-account SLA met | 100% |

## 8. Instrumentation principles
- Events are **pseudonymized**; no raw body data in analytics.
- Every AI output logs a **confidence value** for calibration monitoring.
- Cost-per-inference is a **first-class production metric**, alerted on spikes.

## 9. Review cadence
Weekly funnel + cost review (during build/pilot); monthly moat metrics (fit accuracy, feedback capture) as data accumulates.
