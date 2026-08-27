# Solution Overview

## 1. Positioning statement
> **FitCart AI is not another fashion marketplace. It is an AI intelligence and visualization layer that sits between shoppers and existing fashion commerce.**

We don't hold inventory, we don't run checkout, and we don't compete with the stores for the transaction. We make the shopper **more confident** — and route them to the store to buy.

## 2. The core loop
```
DISCOVER (cross-store)
   → SELECT items (build an outfit)
      → TRY ON (personalized 3D avatar)
         → INSPECT (360° multi-angle + texture zoom)
            → FIT CHECK (fit score + confidence)
               → OUTFIT SCORE (color/occasion/style/body-shape)
                  → ADD TO FITCART (internal outfit/basket)
                     → CHECKOUT HANDOFF (deep-link to store, affiliate-attributed)
```

## 3. What the user experiences (the magic)
1. **Connect the stores** they already use (compliant: affiliate/deep-link; not credential login for MVP).
2. **Upload 1 full-body photo** (optionally + side + back for better accuracy). The app validates pose, lighting, distance, and body visibility before accepting.
3. The app builds a **personalized avatar** matching body shape, proportions, skin tone, and posture — with an **honest accuracy/confidence indicator**.
4. **Build an outfit** by adding a shirt, jeans, shoes, watch, sunglasses, jacket, accessories — across stores.
5. **See the outfit on the avatar**, rotate it (360°-feeling multi-angle), and **zoom into texture/detail**.
6. Read a **Fit Report** ("Shoulder fit good; trousers may run slightly long — Fit 8.6/10, confidence 82%").
7. Read an **Outfit Score** (color harmony, occasion suitability, body-shape compatibility, trend).
8. **Add to FitCart**, then **open the store** to complete the purchase.

## 4. The four intelligence layers (our real product)
| Layer | What it does | Why it matters |
|---|---|---|
| **Visualization** | Avatar + garment render + 360° viewer + texture zoom | The "wow" that gets users in |
| **Fit Intelligence** | Body-vs-garment fit scoring with confidence | The *unique* value — answers "will it fit me?" |
| **Outfit Intelligence** | Multi-item compatibility scoring | Answers "does this look work?" |
| **Cross-store aggregation** | One outfit across many stores | The structural advantage marketplaces can't copy |

The visualization is the hook; the **fit + outfit intelligence** is the moat.

## 5. Deliberate scope discipline (what the MVP is NOT)
- ❌ Not live-camera AR. It's **photo-upload → avatar** (as specified).
- ❌ Not real-time free-camera 3D at MVP. The 360° viewer uses **pre-generated multi-angle renders** (honest, buildable) with a viewer architecture ready to upgrade to true 3D in V3.
- ❌ Not a store cart-writer at MVP. **No official cart API exists**; MVP does a compliant **deep-link handoff**. Cart-sync is partnership-gated (V3).
- ❌ Not a promise of measured, guaranteed sizing. Every number carries a **confidence score**.

## 6. How the honesty becomes a feature, not a weakness
By **showing confidence scores** and **never faking 3D or measurements**, FitCart earns the one thing body-data products most need: **trust**. Over-claiming is how competitors lose users after the first bad prediction; calibrated honesty is a retention strategy.

## 7. The accuracy ladder (set expectations)
| Version | Input | Try-on | Fit accuracy (target) |
|---|---|---|---|
| **MVP** | 1 photo + height/weight | Generative multi-angle image | Silhouette-believable; fit directional, ±5–10% `UNVERIFIED` |
| **V2** | Front+side+back | Better shape + more angles | ±3–6% |
| **V3** | Multi-photo/video | Textured 3D + cloth sim | Near-production 3D, still an estimate |

## 8. Why this is defensible
- **Data flywheel:** avatar ↔ purchase ↔ return ↔ satisfaction data makes fit predictions better over time — a compounding advantage a new entrant can't clone on day one.
- **Neutral cross-store layer:** marketplaces won't build a tool that routes shoppers to competitors.
- **India-first trust brand** around body data.

See `docs/feature-specification.md` for the full feature breakdown and `architecture/system-architecture.md` for how it's built.
