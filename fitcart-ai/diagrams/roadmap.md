# Diagram — Roadmap Timeline

**90-day plan (Gantt)**
```mermaid
gantt
    title FitCart AI — 90-Day MVP Plan
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    section Validate & Architect
    Validation + affiliate/API checks     :a1, 2026-01-05, 7d
    Avatar buy-vs-build bake-off           :a2, 2026-01-05, 7d
    section Foundations
    Backend + adapters + mock AI           :b1, after a1, 14d
    App shell + auth + a11y base           :b2, after a1, 14d
    section Product & Body
    Catalog + discovery                    :c1, after b1, 21d
    Body upload + validation + avatar      :c2, after b1, 21d
    Try-on model bake-off                  :c3, after b1, 14d
    section Try-On & Intelligence
    Try-on + viewer                        :d1, after c2, 21d
    Fit + outfit engines                   :d2, after c2, 21d
    section Integrate & Pilot
    Cart + handoff + feedback              :e1, after d1, 14d
    Privacy + a11y + security + pilot      :e2, after d1, 21d
```

**Product horizon**
```mermaid
timeline
    title Product Roadmap
    MVP (0-3 mo) : Avatar from 1 photo : Multi-angle try-on : Fit + Outfit score : Affiliate handoff : Privacy + a11y baseline
    V2 (3-9 mo) : Multi-photo accuracy : Variant swap + compare : Learned outfit recs : Pro + Studio renders : Fit calibration (moat)
    V3 (9-18 mo+) : True 3D + cloth sim : Partner cart-sync : B2B fit SDK : Seated/prosthesis avatars : Geo expansion
```
> Dates illustrative (relative to project start). Detail: `roadmap/90-day-plan.md`, `roadmap/mvp.md`, `roadmap/v2.md`, `roadmap/v3.md`.
